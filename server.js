#!/usr/bin/env node
const WebSocket = require('ws');
const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = process.env.PORT || 8080;
const STATIC_DIR = path.join(__dirname, 'example');

const server = http.createServer((req, res) => {
  let filePath = path.join(STATIC_DIR, req.url === '/' ? 'index.html' : req.url);
  fs.exists(filePath, (exists) => {
    if (exists) {
      fs.readFile(filePath, (err, content) => {
        if (err) { res.writeHead(500); res.end('Server Error'); }
        else {
          const ext = path.extname(filePath);
          let contentType = 'text/html';
          if (ext === '.css') contentType = 'text/css';
          else if (ext === '.js') contentType = 'application/javascript';
          else if (ext === '.json') contentType = 'application/json';
          else if (ext === '.mp3') contentType = 'audio/mpeg';
          res.writeHead(200, { 'Content-Type': contentType });
          res.end(content);
        }
      });
    } else { res.writeHead(404); res.end('Not Found'); }
  });
});

const wss = new WebSocket.Server({ server });
const clients = new Set();
let master = null;

wss.on('connection', (ws, req) => {
  const clientId = Date.now().toString();
  clients.add(ws);
  console.log(`Client connected: ${clientId} (Total: ${clients.size})`);

  if (master === null) {
    master = ws;
    ws.send(JSON.stringify({ type: 'role', role: 'master', clientId }));
    console.log(`Master assigned: ${clientId}`);
  } else {
    ws.send(JSON.stringify({ type: 'role', role: 'slave', clientId }));
    console.log(`Slave assigned: ${clientId}`);
  }

  ws.on('message', (message) => {
    try {
      const data = JSON.parse(message);
      if (data.type === 'sync-ping' && ws !== master) {
        ws.send(JSON.stringify({ type: 'sync-pong', requestId: data.requestId, T1: data.T1, T4: Date.now() }));
      } else if (['start', 'stop', 'pause'].includes(data.type) && ws === master) {
        clients.forEach(client => { if (client !== ws) client.send(JSON.stringify(data)); });
      }
    } catch (e) { console.error(`Error from ${clientId}:`, e); }
  });

  ws.on('close', () => {
    clients.delete(ws);
    if (ws === master) {
      master = null;
      if (clients.size > 0) {
        master = clients.values().next().value;
        master.send(JSON.stringify({ type: 'role', role: 'master' }));
      }
    }
  });
});

server.listen(PORT, () => {
  console.log(`SyncAudio Server Running on http://localhost:${PORT}`);
});
