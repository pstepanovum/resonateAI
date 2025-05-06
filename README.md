# ResonateAI DiffRhythm UI

A modern web interface for ResonateAI's DiffRhythm music generation model, built with Next.js.

## Overview

This repository contains a full-stack application for interacting with the DiffRhythm music generation model. The project consists of two main components:

1. **Backend**: Python-based API that interfaces with the DiffRhythm model
2. **Frontend**: A responsive Next.js application providing an intuitive user interface

The interface allows users to generate full-length songs by simply providing lyrics and style descriptions, leveraging DiffRhythm's powerful diffusion-based music generation capabilities.

## Project Structure

```
/
├── backend/               # Python backend
│   ├── config/            # Configuration files
│   ├── dataset/           # Dataset handling
│   ├── g2p/               # Grapheme-to-phoneme conversion
│   ├── infer/             # Inference code
│   ├── model/             # Model architecture
│   ├── pretrained/        # Pre-trained model weights
│   ├── scripts/           # Utility scripts
│   ├── src/               # Source code
│   ├── temp_uploads/      # Temporary file storage
│   ├── thirdparty/        # Third-party dependencies
│   ├── train/             # Training code
│   ├── app.py             # Flask application entry point
│   ├── requirements.txt   # Python dependencies
│   └── start_backend.sh   # Backend startup script
│
├── frontend/              # Next.js frontend
│   ├── public/            # Static assets
│   ├── src/               # React components & pages
│   ├── components.json    # Component definitions
│   ├── next.config.ts     # Next.js configuration
│   ├── package.json       # Node dependencies
│   └── tsconfig.json      # TypeScript configuration
│
└── LICENSE                # Project license
```

## Features

- **Intuitive Song Generation**: Upload lyrics and define style to generate complete songs
- **Real-time Progress**: Visual feedback during the generation process
- **Song Management**: Save, organize, and re-generate songs
- **Audio Controls**: Play, pause, seek, and download generated music
- **Responsive Design**: Works seamlessly on desktop and mobile devices
- **Style Customization**: Detailed control over musical style parameters

## Technology Stack

- **Frontend**:

  - Next.js (React framework)
  - TypeScript
  - Tailwind CSS
  - React Query (data fetching)
  - Howler.js (audio playback)

- **Backend**:
  - Flask (Python web framework)
  - DiffRhythm model integration
  - Librosa (audio processing)
  - MuQ & MuQ-MuLan (music representation)

## Getting Started

### Prerequisites

- Node.js 18+ and npm
- Python 3.8+
- CUDA-compatible GPU (for optimal performance)

### Installation

1. **Clone the repository**:

   ```bash
   git clone https://github.com/your-username/resonateai-ui.git
   cd resonateai-ui
   ```

2. **Set up the backend**:

   ```bash
   cd backend
   python -m venv venv
   source venv/bin/activate  # On Windows: venv\Scripts\activate
   pip install -r requirements.txt
   ```

3. **Set up the frontend**:

   ```bash
   cd frontend
   npm install
   ```

4. **Environment configuration**:
   - Create a `.env.local` file in the frontend directory with:
     ```
     NEXT_PUBLIC_API_URL=http://localhost:5000
     ```

### Running the Application

1. **Start the backend**:

   ```bash
   cd backend
   bash start_backend.sh
   ```

2. **Start the frontend**:

   ```bash
   cd frontend
   npm run dev
   ```

3. **Access the application**:
   Open your browser and navigate to `http://localhost:3000`

## Usage

1. **Generate a new song**:

   - Click "New Song" on the dashboard
   - Upload or paste lyrics
   - Enter a style description (e.g., "upbeat pop with acoustic guitar")
   - Click "Generate"

2. **Manage songs**:

   - All generated songs appear on your dashboard
   - Click on any song to play, edit, or regenerate

3. **Export your music**:
   - Download songs in MP3 format
   - Share directly to supported platforms

## Deployment

### Frontend Deployment

1. Build the Next.js application:

   ```bash
   cd frontend
   npm run build
   ```

2. Deploy using Vercel, Netlify, or any static hosting service:
   ```bash
   npm run start  # For local production testing
   ```

### Backend Deployment

1. Set up a server with Python and required dependencies
2. Configure NGINX or Apache as a reverse proxy
3. Use Gunicorn to serve the Flask application:
   ```bash
   gunicorn --bind 0.0.0.0:5000 app:app
   ```

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Acknowledgements

- [ResonateAI](https://resonateai.com) for the DiffRhythm model
- [Pavel Stepanov](https://github.com/pavelstepanov) for the original DiffRhythm implementation
- All the libraries and tools that made this project possible
