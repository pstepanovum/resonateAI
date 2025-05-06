from fastapi import FastAPI, BackgroundTasks, UploadFile, File, Form, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
import os
import uuid
import subprocess
import shutil
import logging
from pydantic import BaseModel
from typing import Optional
import time
from datetime import datetime

# Configure logging
logging.basicConfig(
    level=logging.DEBUG,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.StreamHandler(),
        logging.FileHandler("api_debug.log")
    ]
)
logger = logging.getLogger("music-generator-api")

app = FastAPI()

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],  # Your Next.js frontend URL
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Create necessary directories
os.makedirs("temp_uploads", exist_ok=True)
os.makedirs("infer/example/output", exist_ok=True)

# Mount the output directory to serve the generated audio files
app.mount("/audio", StaticFiles(directory="infer/example/output"), name="audio")

# Track job status
jobs = {}

class SongRequest(BaseModel):
    style_prompt: str
    audio_length: int = 95
    model_id: str = "ASLP-lab/DiffRhythm-full"
    
class JobStatus(BaseModel):
    id: str
    status: str
    output_file: Optional[str] = None
    created_at: str
    completed_at: Optional[str] = None
    error: Optional[str] = None

def generate_song(job_id: str, lyrics_path: Optional[str], style_prompt: str, audio_length: int, model_id: str, ref_audio_path: Optional[str] = None, chunked: bool = True):
    try:
        logger.info(f"Starting song generation for job {job_id}")
        jobs[job_id]["status"] = "processing"
        
        # Base command
        cmd = [
            "python3", "infer/infer.py",
            "--audio-length", str(audio_length),
            "--repo_id", model_id,
            "--output-dir", "infer/example/output",
        ]
        
        # Add chunked parameter if selected
        if chunked:
            cmd.append("--chunked")
            
        # Add lyrics path if provided
        if lyrics_path:
            logger.info(f"Using provided lyrics file: {lyrics_path}")
            cmd.extend(["--lrc-path", lyrics_path])
        else:
            # Create an empty temporary lyrics file if none provided
            logger.info("No lyrics provided, creating empty lyrics file")
            empty_lyrics_path = os.path.join("temp_uploads", f"empty_lyrics_{job_id}.lrc")
            with open(empty_lyrics_path, "w") as f:
                f.write("[00:00.00] ")  # Minimal valid LRC content
            cmd.extend(["--lrc-path", empty_lyrics_path])
        
        # Either use text prompt or audio reference
        if ref_audio_path:
            logger.info(f"Using reference audio: {ref_audio_path}")
            cmd.extend(["--ref-audio-path", ref_audio_path])
        else:
            logger.info(f"Using style prompt: {style_prompt}")
            cmd.extend(["--ref-prompt", style_prompt])
        
        # Set the PYTHONPATH environment variable
        env = os.environ.copy()
        env["PYTHONPATH"] = f"{env.get('PYTHONPATH', '')}:{os.getcwd()}"
        
        # Log the full command
        logger.info(f"Executing command: {' '.join(cmd)}")
        
        # Execute the command
        logger.debug("Starting subprocess")
        result = subprocess.run(cmd, capture_output=True, text=True, env=env)
        
        # Log the command output
        logger.debug(f"Command stdout: {result.stdout}")
        logger.debug(f"Command stderr: {result.stderr}")
        
        if result.returncode != 0:
            logger.error(f"Command failed with return code {result.returncode}")
            raise Exception(f"Generation failed: {result.stderr}")
        
        # Extract the output filename from stdout or use the latest file
        logger.debug("Looking for output files")
        output_files = os.listdir("infer/example/output")
        output_files = [f for f in output_files if f.endswith(".wav")]
        output_files.sort(key=lambda x: os.path.getmtime(os.path.join("infer/example/output", x)), reverse=True)
        
        if output_files:
            output_file = output_files[0]
            logger.info(f"Found output file: {output_file}")
            jobs[job_id]["output_file"] = output_file
            jobs[job_id]["status"] = "completed"
            jobs[job_id]["completed_at"] = datetime.now().isoformat()
        else:
            logger.error("No output file was generated")
            raise Exception("No output file was generated")
            
    except Exception as e:
        logger.error(f"Error during generation: {str(e)}", exc_info=True)
        jobs[job_id]["status"] = "failed"
        jobs[job_id]["error"] = str(e)
        jobs[job_id]["completed_at"] = datetime.now().isoformat()

@app.post("/api/generate", response_model=JobStatus)
async def create_song(
    background_tasks: BackgroundTasks,
    lyrics_file: Optional[UploadFile] = None,
    style_prompt: str = Form(...),
    audio_length: int = Form(95),
    model_id: str = Form("ASLP-lab/DiffRhythm-full"),
    ref_audio: Optional[UploadFile] = None,
    chunked: bool = Form(True)
):
    try:
        # Generate a unique job ID
        job_id = str(uuid.uuid4())
        logger.info(f"Creating new job {job_id}")
        logger.debug(f"Parameters: style_prompt={style_prompt}, audio_length={audio_length}, model_id={model_id}, chunked={chunked}")
        
        # Save the lyrics file if provided
        lyrics_path = None
        if lyrics_file:
            logger.debug(f"Saving lyrics file: {lyrics_file.filename}")
            lyrics_filename = f"temp_lyrics_{job_id}.lrc"
            lyrics_path = os.path.join("temp_uploads", lyrics_filename)
            
            try:
                with open(lyrics_path, "wb") as f:
                    content = await lyrics_file.read()
                    f.write(content)
                logger.debug(f"Lyrics file saved to {lyrics_path}")
            except Exception as e:
                logger.error(f"Error saving lyrics file: {str(e)}", exc_info=True)
                raise HTTPException(status_code=500, detail=f"Failed to save lyrics file: {str(e)}")
        else:
            logger.debug("No lyrics file provided")
        
        # Save the reference audio if provided
        ref_audio_path = None
        if ref_audio:
            logger.debug(f"Saving reference audio: {ref_audio.filename}")
            ref_audio_filename = f"temp_refaudio_{job_id}.wav"
            ref_audio_path = os.path.join("temp_uploads", ref_audio_filename)
            
            try:
                with open(ref_audio_path, "wb") as f:
                    content = await ref_audio.read()
                    f.write(content)
                logger.debug(f"Reference audio saved to {ref_audio_path}")
            except Exception as e:
                logger.error(f"Error saving reference audio: {str(e)}", exc_info=True)
                raise HTTPException(status_code=500, detail=f"Failed to save reference audio: {str(e)}")
        
        # Create job entry
        jobs[job_id] = {
            "id": job_id,
            "status": "queued",
            "created_at": datetime.now().isoformat(),
            "output_file": None,
            "completed_at": None,
            "error": None
        }
        
        # Start the generation in background
        logger.info(f"Adding generation task to background for job {job_id}")
        background_tasks.add_task(
            generate_song,
            job_id,
            lyrics_path,
            style_prompt,
            audio_length,
            model_id,
            ref_audio_path,
            chunked
        )
        
        return JobStatus(**jobs[job_id])
    except Exception as e:
        logger.error(f"Error in create_song endpoint: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/jobs/{job_id}", response_model=JobStatus)
async def get_job_status(job_id: str):
    logger.debug(f"Checking status for job {job_id}")
    if job_id not in jobs:
        logger.warning(f"Job {job_id} not found")
        raise HTTPException(status_code=404, detail="Job not found")
    
    logger.debug(f"Job {job_id} status: {jobs[job_id]['status']}")
    return JobStatus(**jobs[job_id])

@app.get("/api/download/{filename}")
async def download_audio(filename: str):
    logger.debug(f"Download request for file {filename}")
    file_path = os.path.join("infer/example/output", filename)
    
    if not os.path.exists(file_path):
        logger.warning(f"File {filename} not found")
        raise HTTPException(status_code=404, detail="File not found")
    
    logger.debug(f"Returning file {file_path}")
    return FileResponse(file_path, media_type="audio/wav", filename=filename)

# Health check endpoint
@app.get("/api/health")
async def health_check():
    return {"status": "healthy", "timestamp": datetime.now().isoformat()}

if __name__ == "__main__":
    import uvicorn
    logger.info("Starting server on port 8000")
    uvicorn.run(app, host="0.0.0.0", port=8000)