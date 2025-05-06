// frontend/utils/api.js

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

/**
 * Submit a song generation request
 * @param {File} lyricsFile - The LRC file with lyrics
 * @param {string} stylePrompt - The style description (e.g., "piano house")
 * @param {number} audioLength - Length in seconds (95 or 285)
 * @param {string} modelId - The model ID from Hugging Face
 * @param {File|null} refAudio - Optional reference audio file
 * @returns {Promise<Object>} - Job info with ID for status tracking
 */
export const generateSong = async (lyricsFile, stylePrompt, audioLength = 95, modelId = "ASLP-lab/DiffRhythm-full", refAudio = null) => {
    const formData = new FormData();
    formData.append('lyrics_file', lyricsFile);
    formData.append('style_prompt', stylePrompt);
    formData.append('audio_length', audioLength);
    formData.append('model_id', modelId);
    
    if (refAudio) {
        formData.append('ref_audio', refAudio);
    }
    
    const response = await fetch(`${API_BASE_URL}/api/generate`, {
        method: 'POST',
        body: formData,
    });
    
    if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || 'Failed to generate song');
    }
    
    return response.json();
};

/**
 * Check the status of a song generation job
 * @param {string} jobId - The job ID returned from generateSong
 * @returns {Promise<Object>} - Current job status
 */
export const checkJobStatus = async (jobId) => {
    const response = await fetch(`${API_BASE_URL}/api/jobs/${jobId}`);
    
    if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || 'Failed to check job status');
    }
    
    return response.json();
};

/**
 * Get the download URL for a generated song
 * @param {string} filename - The output filename
 * @returns {string} - The full URL to download the file
 */
export const getSongDownloadUrl = (filename) => {
    return `${API_BASE_URL}/api/download/${filename}`;
};

/**
 * Get the streaming URL for a generated song
 * @param {string} filename - The output filename
 * @returns {string} - The full URL to stream the file
 */
export const getSongStreamUrl = (filename) => {
    return `${API_BASE_URL}/audio/${filename}`;
};