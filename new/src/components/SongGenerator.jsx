// frontend/components/SongGenerator.jsx
import { useState, useRef, useEffect } from 'react';
import { generateSong, checkJobStatus, getSongStreamUrl, getSongDownloadUrl } from '../utils/api';

export default function SongGenerator() {
  const [stylePrompt, setStylePrompt] = useState('');
  const [audioLength, setAudioLength] = useState(95);
  const [modelId, setModelId] = useState('ASLP-lab/DiffRhythm-full');
  const [lyricsFile, setLyricsFile] = useState(null);
  const [refAudioFile, setRefAudioFile] = useState(null);
  const [useRefAudio, setUseRefAudio] = useState(false);
  
  const [isGenerating, setIsGenerating] = useState(false);
  const [currentJobId, setCurrentJobId] = useState(null);
  const [jobStatus, setJobStatus] = useState(null);
  const [error, setError] = useState(null);
  
  const audioRef = useRef(null);
  const statusCheckInterval = useRef(null);
  
  // Handle file selection for lyrics
  const handleLyricsFileChange = (e) => {
    const file = e.target.files[0];
    if (file && file.name.endsWith('.lrc')) {
      setLyricsFile(file);
      setError(null);
    } else {
      setLyricsFile(null);
      setError('Please select a valid .lrc file');
    }
  };
  
  // Handle file selection for reference audio
  const handleRefAudioChange = (e) => {
    const file = e.target.files[0];
    if (file && file.type.startsWith('audio/')) {
      setRefAudioFile(file);
      setError(null);
    } else {
      setRefAudioFile(null);
      setError('Please select a valid audio file');
    }
  };
  
  // Start song generation
  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    
    if (!lyricsFile) {
      setError('Please select a lyrics file (.lrc)');
      return;
    }
    
    if (!useRefAudio && !stylePrompt) {
      setError('Please enter a style prompt');
      return;
    }
    
    if (useRefAudio && !refAudioFile) {
      setError('Please select a reference audio file');
      return;
    }
    
    try {
      setIsGenerating(true);
      
      const response = await generateSong(
        lyricsFile,
        stylePrompt,
        audioLength,
        modelId,
        useRefAudio ? refAudioFile : null
      );
      
      setCurrentJobId(response.id);
      setJobStatus(response);
      
      // Start polling for status updates
      statusCheckInterval.current = setInterval(checkStatus, 5000);
    } catch (err) {
      setError(err.message || 'Failed to start generation');
      setIsGenerating(false);
    }
  };
  
  // Check job status
  const checkStatus = async () => {
    if (!currentJobId) return;
    
    try {
      const status = await checkJobStatus(currentJobId);
      setJobStatus(status);
      
      if (status.status === 'completed' || status.status === 'failed') {
        clearInterval(statusCheckInterval.current);
        setIsGenerating(status.status !== 'completed');
        
        if (status.status === 'failed') {
          setError(`Generation failed: ${status.error || 'Unknown error'}`);
        }
      }
    } catch (err) {
      setError('Failed to check generation status');
      clearInterval(statusCheckInterval.current);
      setIsGenerating(false);
    }
  };
  
  // Clean up interval on unmount
  useEffect(() => {
    return () => {
      if (statusCheckInterval.current) {
        clearInterval(statusCheckInterval.current);
      }
    };
  }, []);
  
  return (
    <div className="max-w-2xl mx-auto p-6 bg-white rounded-lg shadow-lg">
      <h1 className="text-2xl font-bold mb-6">AI Song Generator</h1>
      
      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
          {error}
        </div>
      )}
      
      <form onSubmit={handleSubmit}>
        <div className="mb-4">
          <label className="block text-sm font-medium mb-1">Lyrics File (.lrc)</label>
          <input
            type="file"
            accept=".lrc"
            onChange={handleLyricsFileChange}
            className="w-full border rounded p-2"
            disabled={isGenerating}
          />
          {lyricsFile && (
            <p className="text-sm text-gray-600 mt-1">Selected: {lyricsFile.name}</p>
          )}
        </div>
        
        <div className="mb-4">
          <div className="flex items-center mb-2">
            <input
              type="checkbox"
              id="useRefAudio"
              checked={useRefAudio}
              onChange={() => setUseRefAudio(!useRefAudio)}
              className="mr-2"
              disabled={isGenerating}
            />
            <label htmlFor="useRefAudio" className="text-sm font-medium">
              Use reference audio instead of text prompt
            </label>
          </div>
          
          {useRefAudio ? (
            <div>
              <label className="block text-sm font-medium mb-1">Reference Audio</label>
              <input
                type="file"
                accept="audio/*"
                onChange={handleRefAudioChange}
                className="w-full border rounded p-2"
                disabled={isGenerating}
              />
              {refAudioFile && (
                <p className="text-sm text-gray-600 mt-1">Selected: {refAudioFile.name}</p>
              )}
            </div>
          ) : (
            <div>
              <label className="block text-sm font-medium mb-1">Style Prompt</label>
              <input
                type="text"
                value={stylePrompt}
                onChange={(e) => setStylePrompt(e.target.value)}
                placeholder="e.g., piano house, rock, jazz, etc."
                className="w-full border rounded p-2"
                disabled={isGenerating}
              />
            </div>
          )}
        </div>
        
        <div className="mb-4">
          <label className="block text-sm font-medium mb-1">Audio Length</label>
          <select
            value={audioLength}
            onChange={(e) => setAudioLength(Number(e.target.value))}
            className="w-full border rounded p-2"
            disabled={isGenerating}
          >
            <option value={95}>95 seconds</option>
            <option value={285}>285 seconds</option>
          </select>
        </div>
        
        <div className="mb-6">
          <label className="block text-sm font-medium mb-1">Model</label>
          <select
            value={modelId}
            onChange={(e) => setModelId(e.target.value)}
            className="w-full border rounded p-2"
            disabled={isGenerating}
          >
            <option value="ASLP-lab/DiffRhythm-full">DiffRhythm Full</option>
            <option value="ASLP-lab/DiffRhythm-base">DiffRhythm Base</option>
          </select>
        </div>
        
        <button
          type="submit"
          className={`w-full py-2 px-4 rounded font-medium ${
            isGenerating
              ? 'bg-gray-400 cursor-not-allowed'
              : 'bg-blue-600 hover:bg-blue-700 text-white'
          }`}
          disabled={isGenerating}
        >
          {isGenerating ? 'Generating...' : 'Generate Song'}
        </button>
      </form>
      
      {jobStatus && (
        <div className="mt-6 p-4 border rounded">
          <h2 className="text-lg font-semibold mb-2">Generation Status</h2>
          <p>Status: <span className="font-medium">{jobStatus.status}</span></p>
          
          {jobStatus.status === 'processing' && (
            <div className="mt-2">
              <div className="w-full bg-gray-200 rounded-full h-2.5">
                <div className="bg-blue-600 h-2.5 rounded-full w-1/2 animate-pulse"></div>
              </div>
              <p className="text-sm text-gray-600 mt-1">
                This may take several minutes depending on the audio length
              </p>
            </div>
          )}
          
          {jobStatus.status === 'completed' && jobStatus.output_file && (
            <div className="mt-4">
              <h3 className="font-medium mb-2">Generated Song</h3>
              <audio
                ref={audioRef}
                controls
                className="w-full"
                src={getSongStreamUrl(jobStatus.output_file)}
              />
              <div className="mt-2">
                <a
                  href={getSongDownloadUrl(jobStatus.output_file)}
                  download
                  className="inline-block mt-2 bg-green-600 hover:bg-green-700 text-white py-1 px-4 rounded"
                >
                  Download
                </a>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}