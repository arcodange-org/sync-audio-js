/**
 * SyncAudio Server - Node.js Implementation
 * 
 * A minimal WebSocket server for audio synchronization across multiple devices.
 * This is the reference implementation that powers the SyncAudio library.
 * 
 * Usage:
 *   node server.js [port]
 * 
 * Example:
 *   node server.js 8080
 * 
 * Then open http://localhost:8080 in your browser.
 */

const WebSocket = require('ws');
const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = process.argv[2] || 8080;
const EXAMPLE_DIR = path.join(__dirname, '..', '..', 'example');

// Create HTTP server to serve static files
const server = http.createServer((req, res) => {
  let filePath = path.join(EXAMPLE_DIR, req.url === '/' ? 'index.html' : req.url);
  
  fs.exists(filePath, (exists) => {
    if (exists) {
      fs.readFile(filePath, (err, content) => {
        if (err) {
          res.writeHead(500);
          res.end('Server Error');
        } else {
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
    } else {
      res.writeHead(404);
      res.end('Not Found');
    }
  });
});

// WebSocket server
const wss = new WebSocket.Server({ server });

// Store connected clients: Map<WebSocket, {clientId, role, alias}>
const clients = new Map();
let master = null;

/**
 * Broadcast session list to all clients
 */
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

/**
 * Send role assignment to a client
 */
function sendRole(ws, role, clientId) {
  const message = JSON.stringify({
    type: 'role',
    role: role,
    clientId: clientId
  });
  
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(message);
  }
}

// WebSocket connection handler
wss.on('connection', (ws, req) => {
  const clientId = `client-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
  const clientInfo = { clientId, role: null, alias: null };
  clients.set(ws, clientInfo);
  
  console.log(`[${new Date().toISOString()}] Client connected: ${clientId} (Total: ${clients.size})`);
  
  // Assign role
  if (master === null) {
    master = ws;
    clientInfo.role = 'master';
    sendRole(ws, 'master', clientId);
    console.log(`[${new Date().toISOString()}] Master assigned: ${clientId}`);
  } else {
    clientInfo.role = 'slave';
    sendRole(ws, 'slave', clientId);
    console.log(`[${new Date().toISOString()}] Slave assigned: ${clientId}`);
  }
  
  // Send initial session list
  const sessions = Array.from(clients.entries()).map(([ws, info]) => ({
    clientId: info.clientId,
    role: info.role,
    alias: info.alias || 'Unknown'
  }));
  
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify({
      type: 'session-update',
      sessions: sessions,
      timestamp: Date.now()
    }));
  }
  
  // Broadcast updated session list
  broadcastSessionUpdate();
  
  // Message handler
  ws.on('message', (message) => {
    try {
      const data = JSON.parse(message);
      
      switch (data.type) {
        case 'sync-ping':
          // Handle clock synchronization ping
          if (ws !== master) {
            ws.send(JSON.stringify({
              type: 'sync-pong',
              requestId: data.requestId,
              T1: data.T1,
              T4: Date.now()
            }));
          }
          break;
          
        case 'start':
        case 'stop':
        case 'pause':
          // Forward control messages from master to all slaves
          if (ws === master) {
            clients.forEach((info, client) => {
              if (client !== ws && client.readyState === WebSocket.OPEN) {
                client.send(JSON.stringify(data));
              }
            });
          }
          break;
          
        case 'set-alias':
          // Update client alias
          clientInfo.alias = data.alias;
          broadcastSessionUpdate();
          console.log(`[${new Date().toISOString()}] Client ${clientId} set alias: ${data.alias}`);
          break;
          
        default:
          console.log(`[${new Date().toISOString()}] Unknown message type: ${data.type}`);
      }
      
    } catch (e) {
      console.error(`[${new Date().toISOString()}] Error processing message from ${clientId}:`, e);
    }
  });
  
  // Close handler
  ws.on('close', () => {
    clients.delete(ws);
    
    if (ws === master) {
      master = null;
      if (clients.size > 0) {
        // Assign new master
        master = clients.keys().next().value;
        const masterInfo = clients.get(master);
        if (masterInfo) {
          masterInfo.role = 'master';
          sendRole(master, 'master', masterInfo.clientId);
          console.log(`[${new Date().toISOString()}] New master assigned: ${masterInfo.clientId}`);
        }
      }
    }
    
    console.log(`[${new Date().toISOString()}] Client disconnected: ${clientId} (Remaining: ${clients.size})`);
    broadcastSessionUpdate();
  });
  
  // Error handler
  ws.on('error', (error) => {
    console.error(`[${new Date().toISOString()}] WebSocket error for ${clientId}:`, error);
  });
});

// Start server
server.listen(PORT, () => {
  console.log(`========================================`);
  console.log(`  SyncAudio Server Running`);
  console.log(`  HTTP:  http://localhost:${PORT}`);
  console.log(`  WS:    ws://localhost:${PORT}`);
  console.log(`  Example: http://localhost:${PORT}/index.html`);
  console.log(`========================================`);
});

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\nShutting down server...');
  wss.clients.forEach((ws) => {
    if (ws.readyState === WebSocket.OPEN) {
      ws.close(1001, 'Server shutting down');
    }
  });
  server.close(() => {
    console.log('Server stopped.');
    process.exit(0);
  });
});

module.exports = { wss, clients, master, broadcastSessionUpdate };
