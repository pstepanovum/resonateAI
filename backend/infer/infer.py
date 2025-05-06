import argparse
import os
import time
from datetime import datetime
from termcolor import colored

import torch
import torchaudio
from einops import rearrange

print(colored("Current working directory: " + os.getcwd(), "cyan"))

from infer_utils import (
    decode_audio,
    get_lrc_token,
    get_negative_style_prompt,
    get_reference_latent,
    get_style_prompt,
    prepare_model,
)


def inference(
    cfm_model,
    vae_model,
    cond,
    text,
    duration,
    style_prompt,
    negative_style_prompt,
    start_time,
    chunked=False,
):
    print(colored("[DEBUG] Starting inference...", "cyan"))
    with torch.inference_mode():
        print(colored("[DEBUG] Sampling with CFM model...", "yellow"))
        generated, _ = cfm_model.sample(
            cond=cond,
            text=text,
            duration=duration,
            style_prompt=style_prompt,
            negative_style_prompt=negative_style_prompt,
            steps=32,
            cfg_strength=4.0,
            start_time=start_time,
        )

        print(colored("[DEBUG] Converting generated output to float32...", "yellow"))
        generated = generated.to(torch.float32)
        latent = generated.transpose(1, 2)  # [b d t]

        print(colored("[DEBUG] Decoding audio with VAE model...", "yellow"))
        output = decode_audio(latent, vae_model, chunked=chunked)

        print(colored("[DEBUG] Rearranging and normalizing audio...", "yellow"))
        output = rearrange(output, "b d n -> d (b n)")
        output = (
            output.to(torch.float32)
            .div(torch.max(torch.abs(output)))
            .clamp(-1, 1)
            .mul(32767)
            .to(torch.int16)
            .cpu()
        )

        print(colored("[DEBUG] Inference completed.", "green"))
        return output


def load_local_checkpoint(cfm_model, checkpoint_path, device):
    """Load weights from a local checkpoint file into the CFM model."""
    print(colored(f"[DEBUG] Loading local checkpoint from {checkpoint_path}...", "yellow"))
    checkpoint = torch.load(checkpoint_path, map_location=device)
    
    if "model_state_dict" in checkpoint:
        model_dict = cfm_model.state_dict()
        checkpoint_model_dict = checkpoint["model_state_dict"]
        
        filtered_model_dict = {
            k: v for k, v in checkpoint_model_dict.items()
            if k in model_dict and model_dict[k].shape == v.shape  
        }
        
        cfm_model.load_state_dict(filtered_model_dict, strict=False)
        print(colored(f"[DEBUG] Loaded model weights from training checkpoint ({len(filtered_model_dict)}/{len(model_dict)} keys)", "green"))
    else:
        cfm_model.load_state_dict(checkpoint, strict=False)
        print(colored("[DEBUG] Loaded direct model weights", "green"))
    
    return cfm_model


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--lrc-path",
        type=str,
        help="lyrics of target song",
    )
    parser.add_argument(
        "--ref-prompt",
        type=str,
        help="reference prompt as style prompt for target song",
        required=False,
    )
    parser.add_argument(
        "--ref-audio-path",
        type=str,
        help="reference audio as style prompt for target song",
        required=False,
    )
    parser.add_argument(
        "--chunked",
        action="store_true",
        help="whether to use chunked decoding",
    )
    parser.add_argument(
        "--audio-length",
        type=int,
        default=95,
        choices=[95, 285],
        help="length of generated song",
    )
    parser.add_argument(
        "--repo_id", 
        type=str, 
        default="ASLP-lab/DiffRhythm-base", 
        help="target model from Hugging Face"
    )
    parser.add_argument(
        "--local-checkpoint",
        type=str,
        help="path to local checkpoint file (model_last.pt) from training",
        required=False,
    )
    parser.add_argument(
        "--output-dir",
        type=str,
        default="infer/example/output",
        help="output directory for generated song",
    )
    args = parser.parse_args()
    print(colored("[DEBUG] Argument parsing completed.", "green"))

    assert (
        args.ref_prompt or args.ref_audio_path
    ), "either ref_prompt or ref_audio_path should be provided"
    assert not (
        args.ref_prompt and args.ref_audio_path
    ), "only one of them should be provided"

    device = "cpu"
    if torch.cuda.is_available():
        device = "cuda"
    elif torch.mps.is_available():
        device = "mps"
    print(colored(f"[DEBUG] Using device: {device}", "cyan"))

    audio_length = args.audio_length
    if audio_length == 95:
        max_frames = 2048
    elif audio_length == 285:
        max_frames = 6144
    print(colored(f"[DEBUG] Audio length set to {audio_length}s, max frames: {max_frames}", "cyan"))

    print(colored("[DEBUG] Loading models from Hugging Face...", "yellow"))
    cfm, tokenizer, muq, vae = prepare_model(max_frames, device, repo_id=args.repo_id)
    print(colored("[DEBUG] Models loaded successfully.", "green"))

    if args.local_checkpoint:
        cfm = load_local_checkpoint(cfm, args.local_checkpoint, device)
        print(colored("[DEBUG] Local checkpoint applied.", "green"))

    if args.lrc_path:
        print(colored("[DEBUG] Reading lyrics file...", "yellow"))
        with open(args.lrc_path, "r", encoding='utf-8') as f:
            lrc = f.read()
    else:
        lrc = ""
    print(colored("[DEBUG] Processing lyrics tokens...", "yellow"))
    lrc_prompt, start_time = get_lrc_token(max_frames, lrc, tokenizer, device)
    print(colored("[DEBUG] Lyrics tokens processed.", "green"))

    if args.ref_audio_path:
        print(colored("[DEBUG] Generating style prompt from audio...", "yellow"))
        style_prompt = get_style_prompt(muq, args.ref_audio_path)
    else:
        print(colored("[DEBUG] Generating style prompt from text...", "yellow"))
        style_prompt = get_style_prompt(muq, prompt=args.ref_prompt)
    print(colored("[DEBUG] Style prompt generated.", "green"))

    print(colored("[DEBUG] Generating negative style prompt...", "yellow"))
    negative_style_prompt = get_negative_style_prompt(device)
    print(colored("[DEBUG] Negative style prompt generated.", "green"))

    print(colored("[DEBUG] Generating reference latent...", "yellow"))
    latent_prompt = get_reference_latent(device, max_frames)
    print(colored("[DEBUG] Reference latent generated.", "green"))

    s_t = time.time()
    print(colored("[DEBUG] Starting song generation...", "cyan"))
    generated_song = inference(
        cfm_model=cfm,
        vae_model=vae,
        cond=latent_prompt,
        text=lrc_prompt,
        duration=max_frames,
        style_prompt=style_prompt,
        negative_style_prompt=negative_style_prompt,
        start_time=start_time,
        chunked=args.chunked,
    )
    e_t = time.time() - s_t
    print(colored(f"[DEBUG] Inference completed in {e_t:.2f} seconds.", "green"))

    output_dir = args.output_dir
    print(colored(f"[DEBUG] Creating output directory: {output_dir}", "yellow"))
    os.makedirs(output_dir, exist_ok=True)

    # Generate timestamp for filename
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    output_filename = f"output_{timestamp}.wav"
    output_path = os.path.join(output_dir, output_filename)
    print(colored(f"[DEBUG] Saving generated song to {output_path}...", "yellow"))
    torchaudio.save(output_path, generated_song, sample_rate=44100)
    print(colored("[DEBUG] Song saved successfully.", "green"))