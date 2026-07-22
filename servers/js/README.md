# SyncAudio Server - Node.js

A minimal WebSocket server for audio synchronization across multiple devices.

## Quick Start

```bash
# Install dependencies
npm install

# Start server (default port: 8080)
npm start

# Or with custom port
node server.js 9000
```

Then open [http://localhost:8080](http://localhost:8080) in your browser.

## Features

- ✅ WebSocket server with SyncAudio protocol
- ✅ Automatic master/slave role assignment
- ✅ Session tracking and broadcasting
- ✅ Clock synchronization support
- ✅ Static file serving for example page
- ✅ Automatic master reassignment on disconnect
- ✅ Graceful shutdown handling

## Usage

### Basic Usage
```bash
node server.js
```

### Custom Port
```bash
node server.js 8080
```

### With HTTPS
Use a reverse proxy like Nginx or Caddy for HTTPS support.

## Configuration

### Environment Variables
- `PORT`: Server port (default: 8080)

### Command Line Arguments
```
Usage: node server.js [port]

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
FROM node:18
WORKDIR /app
COPY package.json server.js ./
RUN npm install
EXPOSE 8080
CMD ["node", "server.js", "8080"]
```

Build and run:
```bash
docker build -t sync-audio-server .
docker run -p 8080:8080 sync-audio-server
```

### Systemd Service
```ini
[Unit]
Description=SyncAudio Server (Node.js)
After=network.target

[Service]
User=youruser
WorkingDirectory=/path/to/sync-audio-server
ExecStart=/usr/bin/node server.js 8080
Restart=always
Environment=NODE_ENV=production

[Install]
WantedBy=multi-user.target
```

### PM2
```bash
npm install -g pm2
pm2 start server.js --name sync-audio-server -- 8080
pm2 save
pm2 startup
```

## Development

### Project Structure
```
servers/js/
├── server.js      # Main server implementation
├── package.json   # Dependencies and scripts
└── README.md      # This file
```

### Dependencies
- `ws` - WebSocket library

## Troubleshooting

### Port Already in Use
```
Error: listen EADDRINUSE: address already in use :::8080
```

Solution: Use a different port or kill the existing process:
```bash
lsof -i :8080
kill -9 <PID>
```

### WebSocket Connection Failed
- Verify the server is running
- Check firewall settings
- Ensure you're using the correct port

### Static Files Not Loading
- Verify the example directory exists
- Check file permissions

## License

MIT License - See [LICENSE](../../LICENSE)
