/* eslint-disable @typescript-eslint/no-unused-vars */

"use client";

import Image from "next/image";
import Link from "next/link";
import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  AlertCircle,
  ChevronDown,
  ChevronUp,
  Download,
  Info,
  Loader2,
  Music,
  Play,
  Pause,
  Upload,
} from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

// API URL
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

interface FormData {
  lrcFile: File | null;
  lrcPath: string;
  refPrompt: string;
  refAudioFile: File | null;
  refAudioPath: string;
  chunked: boolean;
  audioLength: string;
  repoId: string;
  useRefAudio: boolean;
  outputDir: string;
}

interface JobStatus {
  id?: string;
  status: string;
  output_file?: string;
  error?: string;
}

export default function MusicGenerationPage() {
  // Form state
  const [formData, setFormData] = useState<FormData>({
    lrcFile: null,
    lrcPath: "",
    refPrompt: "",
    refAudioFile: null,
    refAudioPath: "",
    chunked: true,
    audioLength: "95",
    repoId: "ASLP-lab/DiffRhythm-full",
    useRefAudio: false,
    outputDir: "infer/example/output",
  });

  // UI state
  const [isLoading, setIsLoading] = useState(false);
  const [isAdvancedOpen, setIsAdvancedOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentJobId, setCurrentJobId] = useState<string | null>(null);
  const [jobStatus, setJobStatus] = useState<JobStatus | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);

  // Refs
  const audioRef = useRef<HTMLAudioElement>(null);
  const lyricsFileRef = useRef<HTMLInputElement>(null);
  const refAudioFileRef = useRef<HTMLInputElement>(null);
  const statusCheckInterval = useRef<NodeJS.Timeout | null>(null);

  // Handle input changes
  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    const checked = (e.target as HTMLInputElement).checked;

    if (name === "audioLength") {
      const numericValue = value.replace(/[^0-9]/g, "");
      const validValue = numericValue === "95" || numericValue === "285" ? numericValue : "95";
      setFormData((prev) => ({
        ...prev,
        [name]: validValue,
      }));
      return;
    }

    setFormData((prev) => ({
      ...prev,
      [name]: type === "checkbox" ? checked : value,
    }));
  };

  // Handle file uploads
  const handleFileChange = (
    e: React.ChangeEvent<HTMLInputElement>,
    fileType: "lyrics" | "refAudio"
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (fileType === "lyrics") {
      if (!file.name.endsWith(".lrc")) {
        setError("Please select a valid .lrc file");
        return;
      }
      setFormData((prev) => ({
        ...prev,
        lrcFile: file,
        lrcPath: file.name,
      }));
    } else {
      if (!file.type.startsWith("audio/")) {
        setError("Please select a valid audio file");
        return;
      }
      setFormData((prev) => ({
        ...prev,
        refAudioFile: file,
        refAudioPath: file.name,
        useRefAudio: true,
      }));
    }

    setError(null);
  };

  // Form submission
  const handleGenerate = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);

    if (!formData.useRefAudio && !formData.refPrompt) {
      setError("Please enter a style prompt or upload a reference audio");
      return;
    }

    try {
      setIsLoading(true);
      const apiFormData = new FormData();

      if (formData.lrcFile) {
        apiFormData.append("lyrics_file", formData.lrcFile);
      }

      apiFormData.append("audio_length", formData.audioLength);
      apiFormData.append("model_id", formData.repoId);

      if (formData.useRefAudio && formData.refAudioFile) {
        apiFormData.append("ref_audio", formData.refAudioFile);
      } else {
        apiFormData.append("style_prompt", formData.refPrompt);
      }

      apiFormData.append("chunked", String(formData.chunked));

      const response = await fetch(`${API_BASE_URL}/api/generate`, {
        method: "POST",
        body: apiFormData,
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.detail || "Failed to generate song");
      }

      const data: JobStatus = await response.json();
      setCurrentJobId(data.id || null);
      setJobStatus(data);
      statusCheckInterval.current = setInterval(checkStatus, 5000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to start generation");
      setIsLoading(false);
    }
  };

  // Check job status
  const checkStatus = async () => {
    if (!currentJobId) return;

    try {
      const response = await fetch(`${API_BASE_URL}/api/jobs/${currentJobId}`);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.detail || "Failed to check job status");
      }

      const status: JobStatus = await response.json();
      setJobStatus(status);

      if (status.status === "completed" || status.status === "failed") {
        if (statusCheckInterval.current) {
          clearInterval(statusCheckInterval.current);
        }
        setIsLoading(status.status !== "completed");

        if (status.status === "failed") {
          setError(`Generation failed: ${status.error || "Unknown error"}`);
        }
      }
    } catch (err) {
      setError("Failed to check generation status");
      if (statusCheckInterval.current) {
        clearInterval(statusCheckInterval.current);
      }
      setIsLoading(false);
    }
  };

  // Play/pause audio
  const toggleAudio = () => {
    if (audioRef.current) {
      if (isPlaying) {
        audioRef.current.pause();
      } else {
        audioRef.current.play();
      }
      setIsPlaying(!isPlaying);
    }
  };

  // Listen for audio events
  useEffect(() => {
    const audio = audioRef.current;

    if (audio) {
      const handlePlay = () => setIsPlaying(true);
      const handlePause = () => setIsPlaying(false);
      const handleEnded = () => setIsPlaying(false);

      audio.addEventListener("play", handlePlay);
      audio.addEventListener("pause", handlePause);
      audio.addEventListener("ended", handleEnded);

      return () => {
        audio.removeEventListener("play", handlePlay);
        audio.removeEventListener("pause", handlePause);
        audio.removeEventListener("ended", handleEnded);
      };
    }
  }, [jobStatus]);

  // Clean up interval on unmount
  useEffect(() => {
    return () => {
      if (statusCheckInterval.current) {
        clearInterval(statusCheckInterval.current);
      }
    };
  }, []);

  // Helper function for download url
  const getSongDownloadUrl = (filename: string): string => {
    return `${API_BASE_URL}/api/download/${filename}`;
  };

  // Helper function for streaming url
  const getSongStreamUrl = (filename: string): string => {
    return `${API_BASE_URL}/audio/${filename}`;
  };

  return (
    <div className="min-h-screen flex flex-col lg:flex-row bg-white">
      {/* Left Panel - Hero Section */}
      <div className="hidden lg:flex lg:w-1/2 relative overflow-hidden bg-black">
        <div
          className="absolute inset-0 bg-cover bg-center opacity-50 transform transition-all duration-1000 hover:scale-110"
          style={{ backgroundImage: "url('/images/bg.webp')" }}
        />
        <div className="relative z-10 flex flex-col p-12 w-full text-white">
          <Link href="/" className="flex items-center">
            <div className="relative w-[140px] h-[48px]">
              <Image
                src="/images/logo-white.png"
                alt="resonateAI Logo"
                width={140}
                height={48}
                className="object-contain brightness-0 invert"
                priority
              />
            </div>
          </Link>
          <div className="mt-auto space-y-2">
            <blockquote className="space-y-2 max-w-md">
              <p className="text-lg font-medium leading-tight">
                AI as a tool in music-making is fine, but it&apos;s always going to
                be the humanity in music that makes people want to listen to it.
              </p>
              <footer className="text-base text-white/80">
                <p className="font-semibold">Jacob Collier</p>
                <p className="text-sm">Singer and songwriter</p>
              </footer>
            </blockquote>
          </div>
        </div>
      </div>

      {/* Right Panel - Music Generation Form */}
      <div className="flex-1 flex flex-col min-h-screen">
        <div className="flex items-center justify-center lg:hidden p-4">
          {/* Mobile Logo */}
          <Link href="/" className="flex items-center">
            <div className="relative w-[120px] h-[120px]">
              <Image
                src="/images/logo-black.png"
                alt="resonateAI Logo"
                width={120}
                height={120}
                className="object-contain"
                priority
              />
            </div>
          </Link>
        </div>
        <div className="flex-1 flex items-center justify-center p-4 sm:p-8">
          <div className="w-full max-w-[480px]">
            {/* Music Generation Card */}
            <Card className="shadow-none border-0">
              <CardHeader className="space-y-1 text-center">
                <CardTitle className="text-2xl font-bold text-black">
                  Music Generation
                </CardTitle>
                <CardDescription className="text-gray-600">
                  Generate AI music based on your preferences
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-5">
                <Button
                  className="w-full h-11 bg-white text-black border border-gray-300 hover:bg-gray-50 transition-all duration-300 ease-in-out focus:outline-none focus:ring-0"
                  disabled={true} // Feature coming soon
                >
                  <svg className="mr-2 h-5 w-5" viewBox="0 0 168 168">
                    <path
                      fill="#1ED760"
                      d="M83.996.277C37.747.277.253 37.77.253 84.019c0 46.251 37.494 83.741 83.743 83.741 46.254 0 83.744-37.49 83.744-83.741 0-46.246-37.49-83.738-83.745-83.738l.001-.004zm38.404 120.78a5.217 5.217 0 01-7.18 1.73c-19.662-12.01-44.414-14.73-73.564-8.07a5.222 5.222 0 01-6.249-3.93 5.213 5.213 0 013.926-6.25c31.9-7.291 59.263-4.15 81.337 9.34 2.46 1.51 3.24 4.72 1.73 7.18zm10.25-22.805c-1.89 3.075-5.91 4.045-8.98 2.155-22.51-13.839-56.823-17.846-83.448-9.764-3.453 1.043-7.1-.903-8.148-4.35a6.538 6.538 0 014.354-8.143c30.413-9.228 68.222-4.758 94.072 11.127 3.07 1.89 4.04 5.91 2.15 8.976v-.001zm.88-23.744c-26.99-16.031-71.52-17.505-97.289-9.684-4.138 1.255-8.514-1.081-9.768-5.219a7.835 7.835 0 015.221-9.771c29.581-8.98 78.756-7.245 109.83 11.202a7.823 7.823 0 012.74 10.733c-2.2 3.722-7.02 4.949-10.73 2.739z"
                    />
                  </svg>
                  Use Spotify Distribution{" "}
                  <span className="text-xs ml-1">(Coming Soon)</span>
                </Button>

                {error && (
                  <Alert
                    variant="destructive"
                    className="bg-red-50 border border-red-200"
                  >
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>{error}</AlertDescription>
                  </Alert>
                )}

                {jobStatus && jobStatus.status === "completed" && jobStatus.output_file && (
                  <div className="border rounded-lg p-4 bg-green-50">
                    <h3 className="font-medium mb-2 text-green-800">
                      Generated Successfully!
                    </h3>
                    <div className="flex items-center space-x-2 mb-2">
                      <Button
                        size="sm"
                        variant="outline"
                        className="flex-1 flex items-center justify-center"
                        onClick={toggleAudio}
                      >
                        {isPlaying ? (
                          <>
                            <Pause className="mr-1 h-4 w-4" /> Pause
                          </>
                        ) : (
                          <>
                            <Play className="mr-1 h-4 w-4" /> Play
                          </>
                        )}
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="flex-1 flex items-center justify-center"
                        onClick={() =>
                          window.open(
                            getSongDownloadUrl(jobStatus.output_file!),
                            "_blank"
                          )
                        }
                      >
                        <Download className="mr-1 h-4 w-4" /> Download
                      </Button>
                    </div>
                    <audio
                      ref={audioRef}
                      src={getSongStreamUrl(jobStatus.output_file)}
                      className="w-full h-8"
                      controls
                    />
                  </div>
                )}

                {jobStatus && jobStatus.status === "processing" && (
                  <div className="border rounded-lg p-4 bg-blue-50">
                    <h3 className="font-medium mb-2 text-blue-800">
                      Generating Music...
                    </h3>
                    <div className="w-full bg-blue-200 rounded-full h-2.5 mb-2">
                      <div className="bg-blue-600 h-2.5 rounded-full w-1/2 animate-pulse"></div>
                    </div>
                    <p className="text-sm text-blue-600">
                      This may take several minutes. Please wait while we create
                      your music.
                    </p>
                  </div>
                )}

                <form onSubmit={handleGenerate} className="space-y-5">
                  {/* Basic Options */}
                  <div className="space-y-4">
                    {/* Lyrics File (Optional) */}
                    <div className="space-y-2">
                      <Label
                        htmlFor="lrcPath"
                        className="text-sm font-medium text-black"
                      >
                        Lyrics File (.lrc){" "}
                        <span className="text-xs text-gray-500">
                          (Optional)
                        </span>
                      </Label>
                      <div className="relative">
                        <input
                          id="lrcPath"
                          name="lrcPath"
                          type="text"
                          value={formData.lrcPath}
                          onChange={handleChange}
                          placeholder="Upload lyrics file (.lrc) - Optional"
                          className="input w-full h-11 text-black transition-all duration-300 ease-in-out border border-gray-200 pr-10 rounded-md"
                          readOnly
                        />
                        <button
                          type="button"
                          className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-500 hover:text-gray-700"
                          onClick={() =>
                            lyricsFileRef.current && lyricsFileRef.current.click()
                          }
                        >
                          <Upload size={18} />
                        </button>
                        <input
                          ref={lyricsFileRef}
                          type="file"
                          accept=".lrc"
                          className="hidden"
                          onChange={(e) => handleFileChange(e, "lyrics")}
                        />
                      </div>
                      <p className="text-xs text-gray-500 flex items-center mt-1">
                        <Info size={12} className="inline mr-1" />
                        You can generate music without lyrics too
                      </p>
                    </div>

                    {/* Reference Prompt */}
                    <div className="space-y-2">
                      <Label
                        htmlFor="refPrompt"
                        className="text-sm font-medium text-black"
                      >
                        Reference Prompt (style guidance)
                      </Label>
                      <input
                        id="refPrompt"
                        name="refPrompt"
                        type="text"
                        value={formData.refPrompt}
                        onChange={handleChange}
                        placeholder="E.g., 'Upbeat pop with acoustic guitar'"
                        className="input w-full h-11 text-black transition-all duration-300 ease-in-out border border-gray-200 rounded-md"
                        disabled={formData.useRefAudio}
                      />
                    </div>

                    {/* Audio Length */}
                    <div className="space-y-2">
                      <div className="flex justify-between items-center">
                        <Label
                          htmlFor="audioLength"
                          className="text-sm font-medium text-black"
                        >
                          Audio Length (seconds)
                        </Label>
                      </div>
                      <div className="relative">
                        <select
                          id="audioLength"
                          name="audioLength"
                          value={formData.audioLength}
                          onChange={handleChange}
                          className="input w-full h-11 text-black transition-all duration-300 ease-in-out border border-gray-200 rounded-md appearance-none"
                        >
                          <option value="95">95 seconds (short)</option>
                          <option value="285">285 seconds (long)</option>
                        </select>
                      </div>
                      <p className="text-xs text-gray-500 flex items-center mt-1">
                        <Info size={12} className="inline mr-1" />
                        Longer audio takes more time to generate
                      </p>
                    </div>

                    {/* Chunked Generation */}
                    <div className="flex items-center justify-between space-x-2">
                      <Label
                        htmlFor="chunked"
                        className="text-sm font-medium text-black"
                      >
                        Use Chunked Decoding
                      </Label>
                      <Switch
                        id="chunked"
                        name="chunked"
                        checked={formData.chunked}
                        onCheckedChange={(checked) =>
                          setFormData((prev) => ({ ...prev, chunked: checked }))
                        }
                      />
                    </div>
                  </div>

                  {/* Advanced Settings Collapsible */}
                  <Collapsible
                    open={isAdvancedOpen}
                    onOpenChange={setIsAdvancedOpen}
                    className="border-t border-dashed border-gray-200 pt-4"
                  >
                    <CollapsibleTrigger className="flex items-center justify-center w-full text-sm text-gray-500 hover:text-gray-700">
                      Advanced Settings{" "}
                      {isAdvancedOpen ? (
                        <ChevronUp className="ml-1 h-4 w-4" />
                      ) : (
                        <ChevronDown className="ml-1 h-4 w-4" />
                      )}
                    </CollapsibleTrigger>
                    <CollapsibleContent className="space-y-4 mt-3">
                      {/* Reference Audio */}
                      <div className="space-y-2">
                        <Label
                          htmlFor="refAudioPath"
                          className="text-sm font-medium text-black"
                        >
                          Reference Audio
                        </Label>
                        <div className="relative">
                          <input
                            id="refAudioPath"
                            name="refAudioPath"
                            type="text"
                            value={formData.refAudioPath}
                            onChange={handleChange}
                            placeholder="Upload reference audio file"
                            className="input w-full h-11 text-black transition-all duration-300 ease-in-out border border-gray-200 pr-10 rounded-md"
                            readOnly
                          />
                          <button
                            type="button"
                            className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-500 hover:text-gray-700"
                            onClick={() =>
                              refAudioFileRef.current &&
                              refAudioFileRef.current.click()
                            }
                          >
                            <Upload size={18} />
                          </button>
                          <input
                            ref={refAudioFileRef}
                            type="file"
                            accept="audio/*"
                            className="hidden"
                            onChange={(e) => handleFileChange(e, "refAudio")}
                          />
                        </div>
                        <p className="text-xs text-gray-500 flex items-center mt-1">
                          <Info size={12} className="inline mr-1" />
                          Using reference audio will override the text prompt
                        </p>
                      </div>

                      {/* Repo ID */}
                      <div className="space-y-2">
                        <Label
                          htmlFor="repoId"
                          className="text-sm font-medium text-black"
                        >
                          Model Repo ID
                        </Label>
                        <select
                          id="repoId"
                          name="repoId"
                          value={formData.repoId}
                          onChange={handleChange}
                          className="input w-full h-11 text-black transition-all duration-300 ease-in-out border border-gray-200 rounded-md appearance-none"
                        >
                          <option value="ASLP-lab/DiffRhythm-full">
                            DiffRhythm Full
                          </option>
                          <option value="ASLP-lab/DiffRhythm-base">
                            DiffRhythm Base
                          </option>
                        </select>
                      </div>
                    </CollapsibleContent>
                  </Collapsible>

                  <Button
                    type="submit"
                    className="w-full h-11 font-medium bg-[#0c0c0c] text-white hover:bg-black hover:shadow-md transition-all duration-300 ease-in-out focus:outline-none focus:ring-0 border-0"
                    disabled={isLoading}
                  >
                    {isLoading ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Generating music...
                      </>
                    ) : (
                      <>
                        <Music className="mr-2 h-4 w-4" />
                        Generate Music
                      </>
                    )}
                  </Button>
                </form>
              </CardContent>
              <CardFooter>
                <div className="w-full">
                  <p className="text-xs text-gray-500 leading-tight">
                    Once generated, your music will be available for streaming and
                    download. You can use reference audio or text prompts to
                    influence the style.
                  </p>
                </div>
              </CardFooter>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}