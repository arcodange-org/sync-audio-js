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
const clients = new Map(); // Map of WebSocket -> { clientId, role, alias }
let master = null;

function broadcastSessionUpdate() {
  const sessions = Array.from(clients.entries()).map(([ws, info]) => ({
    clientId: info.clientId,
    role: info.role,
    alias: info.alias || 'Unknown'
  }));
  
  const message = JSON.stringify({ 
    type: 'session-update', 
    sessions: sessions,
    timestamp: Date.now()
  });
  
  clients.forEach((info, ws) => {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(message);
    }
  });
}

wss.on('connection', (ws, req) => {
  const clientId = Date.now().toString() + '-' + Math.random().toString(36).substring(2, 6);
  const clientInfo = { clientId, role: null, alias: null };
  clients.set(ws, clientInfo);
  console.log(`Client connected: ${clientId} (Total: ${clients.size})`);

  if (master === null) {
    master = ws;
    clientInfo.role = 'master';
    ws.send(JSON.stringify({ type: 'role', role: 'master', clientId }));
    console.log(`Master assigned: ${clientId}`);
  } else {
    clientInfo.role = 'slave';
    ws.send(JSON.stringify({ type: 'role', role: 'slave', clientId }));
    console.log(`Slave assigned: ${clientId}`);
  }

  // Send initial session list to new client
  const sessions = Array.from(clients.entries()).map(([ws, info]) => ({
    clientId: info.clientId,
    role: info.role,
    alias: info.alias || 'Unknown'
  }));
  ws.send(JSON.stringify({ 
    type: 'session-update', 
    sessions: sessions,
    timestamp: Date.now()
  }));

  // Broadcast updated session list to all clients
  broadcastSessionUpdate();

  ws.on('message', (message) => {
    try {
      const data = JSON.parse(message);
      if (data.type === 'sync-ping' && ws !== master) {
        ws.send(JSON.stringify({ type: 'sync-pong', requestId: data.requestId, T1: data.T1, T4: Date.now() }));
      } else if (['start', 'stop', 'pause'].includes(data.type) && ws === master) {
        clients.forEach((info, client) => { 
          if (client !== ws && client.readyState === WebSocket.OPEN) {
            client.send(JSON.stringify(data));
          }
        });
      } else if (data.type === 'set-alias') {
        // Update the alias for this client
        const info = clients.get(ws);
        if (info) {
          info.alias = data.alias;
          broadcastSessionUpdate();
        }
      }
    } catch (e) { console.error(`Error from ${clientId}:`, e); }
  });

  ws.on('close', () => {
    clients.delete(ws);
    if (ws === master) {
      master = null;
      if (clients.size > 0) {
        master = clients.keys().next().value;
        const masterInfo = clients.get(master);
        if (masterInfo) {
          masterInfo.role = 'master';
          master.send(JSON.stringify({ type: 'role', role: 'master', clientId: masterInfo.clientId }));
        }
      }
    }
    console.log(`Client disconnected: ${clientId} (Remaining: ${clients.size})`);
    broadcastSessionUpdate();
  });
});

server.listen(PORT, () => {
  console.log(`SyncAudio Server Running on http://localhost:${PORT}`);
});
