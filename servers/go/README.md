# SyncAudio Server - Go

A minimal WebSocket server for audio synchronization across multiple devices, implemented with gorilla/websocket.

## Quick Start

```bash
# Download dependencies
go mod download

# Start server (default port: 8080)
go run server.go

# Or with custom port
go run server.go 9000
```

Then open [http://localhost:8080](http://localhost:8080) in your browser.

## Features

- ✅ WebSocket server with SyncAudio protocol
- ✅ Automatic master/slave role assignment
- ✅ Session tracking and broadcasting
- ✅ Clock synchronization support
- ✅ Static file serving for example page
- ✅ Automatic master reassignment on disconnect
- ✅ High performance with goroutines
- ✅ Low memory footprint

## Usage

### Basic Usage
```bash
go run server.go
```

### Custom Port
```bash
go run server.go 8080
```

### Build and Run
```bash
go build -o sync-audio-server
./sync-audio-server 8080
```

## Configuration

### Environment Variables
- `PORT`: Server port (default: 8080)

### Command Line Arguments
```
Usage: go run server.go [port]

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
FROM golang:1.21
WORKDIR /app
COPY go.mod server.go ./
RUN go mod download
EXPOSE 8080
CMD ["go", "run", "server.go", "8080"]
```

Build and run:
```bash
docker build -t sync-audio-server-go .
docker run -p 8080:8080 sync-audio-server-go
```

### Systemd Service
```ini
[Unit]
Description=SyncAudio Server (Go)
After=network.target

[Service]
User=youruser
WorkingDirectory=/path/to/sync-audio-server
ExecStart=/path/to/sync-audio-server 8080
Restart=always
Environment=GIN_MODE=release

[Install]
WantedBy=multi-user.target
```

### Binary Deployment
```bash
# Build for Linux
go build -o sync-audio-server

# Build for Windows
go build -o sync-audio-server.exe

# Build for macOS
go build -o sync-audio-server
```

## Development

### Project Structure
```
servers/go/
├── server.go      # Main server implementation
├── go.mod         # Go module definition
├── go.sum         # Dependency checksums
└── README.md      # This file
```

### Dependencies
- `github.com/gorilla/websocket` - WebSocket library
- `github.com/gorilla/mux` - HTTP router

## Troubleshooting

### Port Already in Use
```
listen tcp :8080: bind: address already in use
```

Solution: Use a different port or kill the existing process:
```bash
lsof -i :8080
kill -9 <PID>
```

### Module Not Found
```
go: finding module for package github.com/gorilla/websocket
```

Solution: Download dependencies:
```bash
go mod download
```

### WebSocket Connection Failed
- Verify the server is running
- Check firewall settings
- Ensure you're using the correct port

## Performance

Go implementation is optimized for:
- **High concurrency**: Thousands of simultaneous connections
- **Low latency**: Efficient message handling
- **Low memory**: Minimal memory per connection
- **Scalability**: Easy to scale horizontally

For production deployments with 10,000+ connections, this is the recommended implementation.

## License

MIT License - See [LICENSE](../../LICENSE)
