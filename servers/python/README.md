# SyncAudio Server - Python

A minimal WebSocket server for audio synchronization across multiple devices, implemented with FastAPI.

## Quick Start

```bash
# Install dependencies
pip install -r requirements.txt

# Start server (default port: 8080)
python server.py

# Or with custom port
python server.py 9000
```

Then open [http://localhost:8080](http://localhost:8080) in your browser.

## Features

- ✅ WebSocket server with SyncAudio protocol
- ✅ Automatic master/slave role assignment
- ✅ Session tracking and broadcasting
- ✅ Clock synchronization support
- ✅ Static file serving for example page
- ✅ Automatic master reassignment on disconnect
- ✅ Async/await for high performance

## Usage

### Basic Usage
```bash
python server.py
```

### Custom Port
```bash
python server.py 8080
```

### With Uvicorn Directly
```bash
uvicorn server:app --port 8080
```

## Configuration

### Environment Variables
- `PORT`: Server port (default: 8080)

### Command Line Arguments
```
Usage: python server.py [port]

Arguments:
  port    Port number (default: 8080)
```

## API

### WebSocket Endpoint
- URL: `ws://localhost:8080`
- Protocol: SyncAudio WebSocket Protocol

See [PROTOCOL.md](../PROTOCOL.md) for message format details.

### HTTP Endpoints
- `GET /` - Serve example page
- `GET /index.html` - Serve example page
- `GET /dist/*` - Serve built library files
- `GET /example/*` - Serve example files

## Deployment

### Docker
```dockerfile
FROM python:3.11
WORKDIR /app
COPY requirements.txt server.py ./
RUN pip install -r requirements.txt
EXPOSE 8080
CMD ["python", "server.py", "8080"]
```

Build and run:
```bash
docker build -t sync-audio-server-python .
docker run -p 8080:8080 sync-audio-server-python
```

### Systemd Service
```ini
[Unit]
Description=SyncAudio Server (Python)
After=network.target

[Service]
User=youruser
WorkingDirectory=/path/to/sync-audio-server
ExecStart=/usr/bin/python3 server.py 8080
Restart=always
Environment=PYTHONUNBUFFERED=1

[Install]
WantedBy=multi-user.target
```

### Gunicorn (for production)
```bash
pip install gunicorn
 gunicorn -k uvicorn.workers.UvicornWorker -w 4 -b 0.0.0.0:8080 server:app
```

## Development

### Project Structure
```
servers/python/
├── server.py         # Main server implementation
├── requirements.txt  # Dependencies
└── README.md         # This file
```

### Dependencies
- `fastapi` - Web framework
- `uvicorn` - ASGI server
- `websockets` - WebSocket support

## Troubleshooting

### Port Already in Use
```
OSError: [Errno 98] Address already in use
```

Solution: Use a different port or kill the existing process:
```bash
lsof -i :8080
kill -9 <PID>
```

### Module Not Found
```
ModuleNotFoundError: No module named 'fastapi'
```

Solution: Install dependencies:
```bash
pip install -r requirements.txt
```

### WebSocket Connection Failed
- Verify the server is running
- Check firewall settings
- Ensure you're using the correct port

## Performance

For high-performance deployments:
- Use Gunicorn with Uvicorn workers
- Consider using `uvicorn` with `--workers` flag
- For 1000+ connections, consider Go or Rust implementations

## License

MIT License - See [LICENSE](../../LICENSE)
