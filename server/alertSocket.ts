import crypto from 'crypto';
import type { Server as HttpServer } from 'http';
import type { Socket } from 'net';
import { getSachetAlerts } from './sachet';
import type { SachetAlert } from '../src/types/disaster';

type AlertFeedSnapshot = {
  alerts: SachetAlert[];
  etag: string;
  lastUpdated: string;
  cacheStatus: 'LIVE_FETCH' | 'ETAG_CACHED' | 'FALLBACK_SNAPSHOT';
};

const clients = new Set<Socket>();
let latestSnapshot: AlertFeedSnapshot | null = null;
let refreshTimer: NodeJS.Timeout | null = null;
let pingTimer: NodeJS.Timeout | null = null;
let refreshPromise: Promise<void> | null = null;

function buildWebSocketAccept(key: string): string {
  return crypto
    .createHash('sha1')
    .update(`${key}258EAFA5-E914-47DA-95CA-C5AB0DC85B11`)
    .digest('base64');
}

function encodeWebSocketFrame(payload: string): Buffer {
  const data = Buffer.from(payload, 'utf8');
  const length = data.length;

  if (length < 126) {
    const frame = Buffer.allocUnsafe(2 + length);
    frame[0] = 0x81;
    frame[1] = length;
    data.copy(frame, 2);
    return frame;
  }

  if (length < 65536) {
    const frame = Buffer.allocUnsafe(4 + length);
    frame[0] = 0x81;
    frame[1] = 126;
    frame.writeUInt16BE(length, 2);
    data.copy(frame, 4);
    return frame;
  }

  const frame = Buffer.allocUnsafe(10 + length);
  frame[0] = 0x81;
  frame[1] = 127;
  frame.writeBigUInt64BE(BigInt(length), 2);
  data.copy(frame, 10);
  return frame;
}

function sendSocketJSON(socket: Socket, message: unknown) {
  try {
    socket.write(encodeWebSocketFrame(JSON.stringify(message)));
  } catch {
    socket.destroy();
  }
}

function broadcast(message: unknown) {
  for (const socket of clients) {
    if (!socket.destroyed) {
      sendSocketJSON(socket, message);
    }
  }
}

async function refreshFeed(forceBroadcast = false) {
  if (refreshPromise) return refreshPromise;

  refreshPromise = (async () => {
    try {
      const result = await getSachetAlerts(latestSnapshot?.etag);
      const nextSnapshot: AlertFeedSnapshot = {
        alerts: result.alerts,
        etag: result.etag,
        lastUpdated: result.lastUpdated,
        cacheStatus: result.cacheStatus,
      };

      const changed = !latestSnapshot || latestSnapshot.etag !== nextSnapshot.etag;
      latestSnapshot = nextSnapshot;

      if (changed || forceBroadcast) {
        broadcast({
          type: 'alerts',
          snapshot: latestSnapshot,
        });
      }
    } catch (error) {
      broadcast({
        type: 'error',
        error: (error as Error).message,
      });
    }
  })().finally(() => {
    refreshPromise = null;
  });

  return refreshPromise;
}

function handleWebSocketUpgrade(req: any, socket: Socket) {
  const host = req.headers.host || 'localhost';
  const url = new URL(req.url || '/', `http://${host}`);
  if (url.pathname !== '/api/alerts/ws') {
    socket.destroy();
    return;
  }

  const key = req.headers['sec-websocket-key'];
  if (typeof key !== 'string') {
    socket.destroy();
    return;
  }

  const accept = buildWebSocketAccept(key);
  socket.write(
    'HTTP/1.1 101 Switching Protocols\r\n' +
      'Upgrade: websocket\r\n' +
      'Connection: Upgrade\r\n' +
      `Sec-WebSocket-Accept: ${accept}\r\n\r\n`,
  );

  clients.add(socket);
  socket.on('close', () => clients.delete(socket));
  socket.on('error', () => clients.delete(socket));
  socket.on('data', (chunk: Buffer) => {
    if (!chunk.length) return;
    const opcode = chunk[0] & 0x0f;
    if (opcode === 0x8) {
      socket.end();
      clients.delete(socket);
    }
  });

  if (latestSnapshot) {
    sendSocketJSON(socket, {
      type: 'alerts',
      snapshot: latestSnapshot,
    });
  } else {
    void refreshFeed(true);
  }
}

export function initializeAlertSocketServer(server: HttpServer) {
  server.on('upgrade', handleWebSocketUpgrade);

  void refreshFeed(true);

  if (!refreshTimer) {
    refreshTimer = setInterval(() => {
      void refreshFeed(false);
    }, 30000);
  }

  if (!pingTimer) {
    pingTimer = setInterval(() => {
      for (const socket of clients) {
        if (!socket.destroyed) {
          socket.write(Buffer.from([0x89, 0x00]));
        }
      }
    }, 25000);
  }
}
