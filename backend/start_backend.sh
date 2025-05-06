#!/bin/bash
# start_backend.sh

# Set the espeak library path
export PHONEMIZER_ESPEAK_LIBRARY=/opt/homebrew/Cellar/espeak-ng/1.52.0/lib/libespeak-ng.dylib
# Set the Python path
export PYTHONPATH=$PYTHONPATH:$(pwd)

# Start the server
python app.py