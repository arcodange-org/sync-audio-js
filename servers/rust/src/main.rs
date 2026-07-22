// SyncAudio Server - Rust Implementation
//
// A minimal WebSocket server for audio synchronization across multiple devices.
//
// Usage:
//   cargo run [port]
//
// Example:
//   cargo run 8080
//
// Then open http://localhost:8080 in your browser.
//
// This server implements the SyncAudio WebSocket protocol for multi-device
// audio synchronization.

use std::collections::HashMap;
use std::sync::{Arc, RwLock};
use std::time::{SystemTime, UNIX_EPOCH};

use chrono::Utc;
use rand::Rng;
use serde::{Deserialize, Serialize};
use tokio::sync::broadcast;
use warp::ws::{Message, WebSocket};
use warp::{Filter, Rejection, Reply};

// Message types
const MESSAGE_TYPE_ROLE: &str = "role";
const MESSAGE_TYPE_SESSION_UPDATE: &str = "session-update";
const MESSAGE_TYPE_START: &str = "start";
const MESSAGE_TYPE_STOP: &str = "stop";
const MESSAGE_TYPE_PAUSE: &str = "pause";
const MESSAGE_TYPE_SET_ALIAS: &str = "set-alias";
const MESSAGE_TYPE_SYNC_PING: &str = "sync-ping";
const MESSAGE_TYPE_SYNC_PONG: &str = "sync-pong";

// Client state
#[derive(Debug, Clone)]
struct ClientState {
    role: String,
    alias: String,
    connected_at: i64,
}

// Session info for broadcast
#[derive(Debug, Serialize, Clone)]
struct SessionInfo {
    client_id: String,
    role: String,
    alias: String,
}

// Session update message
#[derive(Debug, Serialize)]
struct SessionUpdateMessage {
    r#type: String,
    sessions: Vec<SessionInfo>,
    timestamp: i64,
}

// Role message
#[derive(Debug, Serialize)]
struct RoleMessage {
    r#type: String,
    role: String,
    client_id: String,
}

// Sync pong message
#[derive(Debug, Serialize)]
struct SyncPongMessage {
    r#type: String,
    request_id: String,
    t1: i64,
    t4: i64,
}

// Set alias message
#[derive(Debug, Deserialize)]
struct SetAliasMessage {
    r#type: String,
    alias: String,
}

// Control message
#[derive(Debug, Serialize, Deserialize)]
struct ControlMessage {
    r#type: String,
    start_time: Option<i64>,
}

// Sync ping message
#[derive(Debug, Deserialize)]
struct SyncPingMessage {
    r#type: String,
    request_id: String,
    t1: i64,
}

// Server state
#[derive(Debug)]
struct ServerState {
    clients: RwLock<HashMap<String, broadcast::Sender<Message>>>,
    client_info: RwLock<HashMap<String, ClientState>>,
    master: RwLock<Option<String>>,
}

impl ServerState {
    fn new() -> Self {
        ServerState {
            clients: RwLock::new(HashMap::new()),
            client_info: RwLock::new(HashMap::new()),
            master: RwLock::new(None),
        }
    }

    fn generate_client_id() -> String {
        let mut rng = rand::thread_rng();
        let timestamp = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_millis();
        let suffix: String = (0..4)
            .map(|_| rng.gen_range(b'a'..b'z') as char)
            .collect();
        format!("client-{}-{}", timestamp, suffix)
    }

    fn get_sessions(&self) -> Vec<SessionInfo> {
        let client_info = self.client_info.read().unwrap();
        client_info
            .iter()
            .map(|(id, info)| SessionInfo {
                client_id: id.clone(),
                role: info.role.clone(),
                alias: info.alias.clone(),
            })
            .collect()
    }

    fn broadcast_session_update(&self) {
        let sessions = self.get_sessions();
        let message = SessionUpdateMessage {
            r#type: MESSAGE_TYPE_SESSION_UPDATE.to_string(),
            sessions,
            timestamp: Utc::now().timestamp_millis(),
        };
        
        let json = serde_json::to_string(&message).unwrap();
        
        let clients = self.clients.read().unwrap();
        for (_, sender) in clients.iter() {
            let _ = sender.send(Ok(Message::text(json.clone())));
        }
    }

    fn broadcast_control(&self, message: &str, sender_id: &str) {
        let master = self.master.read().unwrap();
        if let Some(master_id) = &*master {
            if master_id != sender_id {
                return;
            }
        }

        let clients = self.clients.read().unwrap();
        for (id, sender) in clients.iter() {
            if id != sender_id {
                let _ = sender.send(Ok(Message::text(message.to_string())));
            }
        }
    }
}

// WebSocket handler
async fn handle_websocket(
    ws: WebSocket,
    state: Arc<ServerState>,
) {
    let (mut ws_sender, mut ws_receiver) = ws.split();
    let client_id = ServerState::generate_client_id();
    
    // Create channel for sending messages to this client
    let (sender, mut receiver) = broadcast::channel::<Message>(256);
    
    // Add client to state
    {
        let mut clients = state.clients.write().unwrap();
        let mut client_info = state.client_info.write().unwrap();
        
        clients.insert(client_id.clone(), sender);
        
        // Assign role
        let mut master = state.master.write().unwrap();
        let role = if master.is_none() {
            *master = Some(client_id.clone());
            "master".to_string()
        } else {
            "slave".to_string()
        };
        
        client_info.insert(client_id.clone(), ClientState {
            role: role.clone(),
            alias: "".to_string(),
            connected_at: Utc::now().timestamp_millis(),
        });
        
        // Send role to client
        let role_msg = RoleMessage {
            r#type: MESSAGE_TYPE_ROLE.to_string(),
            role,
            client_id: client_id.clone(),
        };
        let json = serde_json::to_string(&role_msg).unwrap();
        let _ = ws_sender.send(Ok(Message::text(json))).await;
        
        println!(
            "[{}] Client connected: {} (Total: {})",
            Utc::now().format("%Y-%m-%d %H:%M:%S"),
            client_id,
            clients.len()
        );
    }
    
    // Broadcast initial session list
    state.broadcast_session_update();
    
    // Spawn a task to forward messages from the broadcast channel to the WebSocket
    let send_task = tokio::spawn(async move {
        while let Ok(msg) = receiver.recv().await {
            if let Err(e) = ws_sender.send(msg).await {
                eprintln!("Error sending message to {}: {}", client_id, e);
                break;
            }
        }
    });
    
    // Receive messages from WebSocket
    while let Some(result) = ws_receiver.next().await {
        match result {
            Ok(msg) => {
                if let Ok(text) = msg.to_str() {
                    if let Ok(value) = serde_json::from_str::<serde_json::Value>(text) {
                        if let Some(message_type) = value.get("type").and_then(|v| v.as_str()) {
                            println!(
                                "[{}] Received from {}: {}",
                                Utc::now().format("%Y-%m-%d %H:%M:%S"),
                                client_id,
                                message_type
                            );
                            
                            match message_type {
                                MESSAGE_TYPE_SYNC_PING => {
                                    // Handle clock sync ping
                                    {
                                        let master = state.master.read().unwrap();
                                        if let Some(master_id) = &*master {
                                            if &client_id != master_id {
                                                if let Ok(ping_msg) = serde_json::from_str::<SyncPingMessage>(text) {
                                                    let pong_msg = SyncPongMessage {
                                                        r#type: MESSAGE_TYPE_SYNC_PONG.to_string(),
                                                        request_id: ping_msg.request_id,
                                                        t1: ping_msg.t1,
                                                        t4: Utc::now().timestamp_millis(),
                                                    };
                                                    let json = serde_json::to_string(&pong_msg).unwrap();
                                                    let _ = ws_sender.send(Ok(Message::text(json))).await;
                                                }
                                            }
                                        }
                                    }
                                }
                                MESSAGE_TYPE_START | MESSAGE_TYPE_STOP | MESSAGE_TYPE_PAUSE => {
                                    // Forward control messages
                                    state.broadcast_control(text, &client_id);
                                }
                                MESSAGE_TYPE_SET_ALIAS => {
                                    // Update alias
                                    if let Ok(alias_msg) = serde_json::from_str::<SetAliasMessage>(text) {
                                        {
                                            let mut client_info = state.client_info.write().unwrap();
                                            if let Some(info) = client_info.get_mut(&client_id) {
                                                info.alias = alias_msg.alias;
                                            }
                                        }
                                        state.broadcast_session_update();
                                        println!(
                                            "[{}] Client {} set alias: {}",
                                            Utc::now().format("%Y-%m-%d %H:%M:%S"),
                                            client_id,
                                            alias_msg.alias
                                        );
                                    }
                                }
                                _ => {
                                    println!("Unknown message type: {}", message_type);
                                }
                            }
                        }
                    }
                }
            }
            Err(e) => {
                eprintln!("WebSocket error for {}: {}", client_id, e);
                break;
            }
        }
    }
    
    // Clean up
    {
        let mut clients = state.clients.write().unwrap();
        let mut client_info = state.client_info.write().unwrap();
        let mut master = state.master.write().unwrap();
        
        clients.remove(&client_id);
        client_info.remove(&client_id);
        
        // Reassign master if needed
        if *master == Some(client_id.clone()) {
            *master = None;
            if !clients.is_empty() {
                if let Some((new_master, _)) = clients.iter().next() {
                    *master = Some(new_master.clone());
                    if let Some(info) = client_info.get_mut(new_master) {
                        info.role = "master".to_string();
                    }
                    // Notify new master
                    let role_msg = RoleMessage {
                        r#type: MESSAGE_TYPE_ROLE.to_string(),
                        role: "master".to_string(),
                        client_id: new_master.clone(),
                    };
                    let json = serde_json::to_string(&role_msg).unwrap();
                    if let Some(sender) = clients.get(new_master) {
                        let _ = sender.send(Ok(Message::text(json)));
                    }
                }
            }
        }
        
        println!(
            "[{}] Client disconnected: {} (Remaining: {})",
            Utc::now().format("%Y-%m-%d %H:%M:%S"),
            client_id,
            clients.len()
        );
    }
    
    state.broadcast_session_update();
    
    // Wait for send task to finish
    let _ = send_task.await;
}

// Serve static files
async fn serve_static(path: String) -> Result<impl Reply, Rejection> {
    let example_dir = std::path::Path::new("../../example");
    let file_path = example_dir.join(&path);
    
    if file_path.exists() && file_path.is_file() {
        let content = tokio::fs::read_to_string(file_path).await
            .map_err(|_| warp::reject::not_found())?;
        
        let content_type = match file_path.extension().and_then(|s| s.to_str()) {
            Some("html") => "text/html",
            Some("css") => "text/css",
            Some("js") => "application/javascript",
            Some("json") => "application/json",
            Some("mp3") => "audio/mpeg",
            _ => "text/plain",
        };
        
        Ok(warp::reply::html(content).into_response())
    } else {
        // Try index.html
        let index_path = example_dir.join("index.html");
        if index_path.exists() {
            let content = tokio::fs::read_to_string(index_path).await
                .map_err(|_| warp::reject::not_found())?;
            Ok(warp::reply::html(content).into_response())
        } else {
            Err(warp::reject::not_found())
        }
    }
}

#[tokio::main]
async fn main() {
    let port: u16 = std::env::args()
        .nth(1)
        .and_then(|s| s.parse().ok())
        .unwrap_or(8080);

    let state = Arc::new(ServerState::new());
    
    // WebSocket route
    let ws_route = warp::path::end()
        .and(warp::ws())
        .and(with_state(state.clone()))
        .and_then(|ws: WebSocket, state: Arc<ServerState>| async move {
            handle_websocket(ws, state).await
        });
    
    // Static files route
    let static_route = warp::get()
        .and(warp::path::param())
        .and_then(serve_static);
    
    // Root route
    let root_route = warp::get()
        .and(warp::path::end())
        .and_then(|| async { 
            serve_static("index.html".to_string()).await
        });
    
    let routes = ws_route
        .or(static_route)
        .or(root_route)
        .with(warp::cors().allow_any_origin());

    println!("========================================");
    println!("  SyncAudio Server Running (Rust)");
    println!("  HTTP:  http://localhost:{}", port);
    println!("  WS:    ws://localhost:{}", port);
    println!("  Example: http://localhost:{}/index.html", port);
    println!("========================================");

    warp::serve(routes)
        .run(([0, 0, 0, 0], port))
        .await;
}

// Helper to share state
fn with_state(
    state: Arc<ServerState>,
) -> impl Filter<Extract = (Arc<ServerState>,), Error = std::convert::Infallible> + Clone {
    warp::any().map(move || state.clone())
}
