/**
 * Spellbook Runtime: WebSocket Transport
 * 
 * WebSocket-based transport for real-time MCP communication.
 * Supports bidirectional messaging, heartbeats, and reconnection.
 */

// ============================================================================
// Types
// ============================================================================

export interface WebSocketServerOptions {
    port: number;
    path?: string;
    heartbeatInterval?: number;
    maxConnections?: number;
}

export interface WebSocketMessage {
    type: 'request' | 'response' | 'notification' | 'heartbeat';
    id?: string;
    method?: string;
    params?: unknown;
    result?: unknown;
    error?: { code: number; message: string; data?: unknown };
}

export interface WebSocketConnection {
    id: string;
    socket: unknown; // WebSocket instance
    isAlive: boolean;
    lastActivity: number;
}

// ============================================================================
// WebSocket Transport Generator
// ============================================================================

/**
 * Generate WebSocket server code for MCP transport.
 */
export function generateWebSocketServer(options: WebSocketServerOptions): string {
    const { port, path = '/ws', heartbeatInterval = 30000, maxConnections = 100 } = options;

    return `
import { WebSocketServer, WebSocket } from 'ws';
import { createServer } from 'http';

// Create HTTP server for health checks
const httpServer = createServer((req, res) => {
  if (req.url === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ 
      status: 'healthy', 
      connections: wss.clients.size,
      timestamp: new Date().toISOString() 
    }));
  } else if (req.url === '/ready') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ ready: true }));
  } else {
    res.writeHead(404);
    res.end();
  }
});

// Create WebSocket server
const wss = new WebSocketServer({ server: httpServer, path: '${path}' });

const connections = new Map();
let connectionId = 0;

wss.on('connection', (ws, req) => {
  if (wss.clients.size > ${maxConnections}) {
    ws.close(1013, 'Server at capacity');
    return;
  }
  
  const id = String(++connectionId);
  connections.set(ws, { id, isAlive: true, lastActivity: Date.now() });
  
  log('info', 'ws_connected', { connectionId: id, total: wss.clients.size });
  
  ws.on('message', async (data) => {
    const conn = connections.get(ws);
    if (conn) conn.lastActivity = Date.now();
    
    try {
      const message = JSON.parse(data.toString());
      await handleMessage(ws, message);
    } catch (error) {
      ws.send(JSON.stringify({
        type: 'response',
        error: { code: -32700, message: 'Parse error' }
      }));
    }
  });
  
  ws.on('pong', () => {
    const conn = connections.get(ws);
    if (conn) conn.isAlive = true;
  });
  
  ws.on('close', () => {
    const conn = connections.get(ws);
    log('info', 'ws_disconnected', { connectionId: conn?.id });
    connections.delete(ws);
  });
  
  ws.on('error', (error) => {
    log('error', 'ws_error', { error: error.message });
  });
});

// Heartbeat to detect stale connections
const heartbeatInterval = setInterval(() => {
  wss.clients.forEach((ws) => {
    const conn = connections.get(ws);
    if (!conn?.isAlive) {
      ws.terminate();
      return;
    }
    conn.isAlive = false;
    ws.ping();
  });
}, ${heartbeatInterval});

wss.on('close', () => {
  clearInterval(heartbeatInterval);
});

async function handleMessage(ws, message) {
  if (message.type === 'heartbeat') {
    ws.send(JSON.stringify({ type: 'heartbeat', timestamp: Date.now() }));
    return;
  }
  
  if (message.method === 'tools/list') {
    const response = await server.handleRequest({ method: 'tools/list' });
    ws.send(JSON.stringify({ type: 'response', id: message.id, result: response }));
    return;
  }
  
  if (message.method === 'tools/call') {
    try {
      const response = await server.handleRequest({ method: 'tools/call', params: message.params });
      ws.send(JSON.stringify({ type: 'response', id: message.id, result: response }));
    } catch (error) {
      ws.send(JSON.stringify({
        type: 'response',
        id: message.id,
        error: { code: -32000, message: error.message }
      }));
    }
    return;
  }
  
  ws.send(JSON.stringify({
    type: 'response',
    id: message.id,
    error: { code: -32601, message: 'Method not found' }
  }));
}

httpServer.listen(${port}, () => {
  log('info', 'server_started', { port: ${port}, transport: 'websocket' });
  console.log(\` MCP Server running on WebSocket at ws://localhost:${port}${path}\`);
  console.log(\` Health: http://localhost:${port}/health\`);
});
`;
}

// ============================================================================
// WebSocket Client Helper
// ============================================================================

/**
 * Generate WebSocket client connection code.
 */
export function generateWebSocketClient(): string {
    return `
export class MCPWebSocketClient {
  constructor(url) {
    this.url = url;
    this.ws = null;
    this.pending = new Map();
    this.messageId = 0;
    this.reconnectAttempts = 0;
    this.maxReconnects = 5;
  }
  
  async connect() {
    return new Promise((resolve, reject) => {
      this.ws = new WebSocket(this.url);
      
      this.ws.onopen = () => {
        this.reconnectAttempts = 0;
        resolve();
      };
      
      this.ws.onmessage = (event) => {
        const message = JSON.parse(event.data);
        if (message.id && this.pending.has(message.id)) {
          const { resolve, reject } = this.pending.get(message.id);
          this.pending.delete(message.id);
          if (message.error) {
            reject(new Error(message.error.message));
          } else {
            resolve(message.result);
          }
        }
      };
      
      this.ws.onerror = reject;
      
      this.ws.onclose = () => {
        if (this.reconnectAttempts < this.maxReconnects) {
          setTimeout(() => {
            this.reconnectAttempts++;
            this.connect();
          }, Math.min(1000 * Math.pow(2, this.reconnectAttempts), 30000));
        }
      };
    });
  }
  
  async call(method, params) {
    const id = String(++this.messageId);
    
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.ws.send(JSON.stringify({ type: 'request', id, method, params }));
      
      setTimeout(() => {
        if (this.pending.has(id)) {
          this.pending.delete(id);
          reject(new Error('Request timeout'));
        }
      }, 30000);
    });
  }
  
  async listTools() {
    return this.call('tools/list');
  }
  
  async callTool(name, args) {
    return this.call('tools/call', { name, arguments: args });
  }
  
  close() {
    this.maxReconnects = 0;
    this.ws?.close();
  }
}
`;
}
