#!/bin/bash
# Script to start the test WebSocket server

echo "Starting SyncAudio Test Server..."
echo "================================"
echo ""

# Navigate to project root
cd "$(dirname "$0")/.."

# Check if Python 3 is available
if command -v python3 &> /dev/null; then
    PYTHON=python3
elif command -v python &> /dev/null; then
    PYTHON=python
else
    echo "Error: Python is not installed"
    exit 1
fi

# Start the test server
$PYTHON tests/test_server.py --port 8080 --latency 0
