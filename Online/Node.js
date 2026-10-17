const WebSocket = require('ws');
const wss = new WebSocket.Server({ port: 8080 });

const rooms = {}; // { roomId: { host, clients: [] } }

function makeRoomId() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

wss.on('connection', ws => {
  ws.on('message', msg => {
    const data = JSON.parse(msg);

    // ルーム作成
    if (data.type === 'createRoom') {
      const roomId = makeRoomId();
      rooms[roomId] = { host: ws, clients: [] };
      ws.roomId = roomId;
      ws.isHost = true;
      ws.send(JSON.stringify({ type: 'roomCreated', roomId }));
    }

    // ルーム参加
    if (data.type === 'joinRoom') {
      const room = rooms[data.roomId];
      if (!room) {
        ws.send(JSON.stringify({ type: 'error', msg: 'Room not found' }));
        return;
      }
      room.clients.push(ws);
      ws.roomId = data.roomId;
      ws.isHost = false;
      ws.send(JSON.stringify({ type: 'joined', roomId: data.roomId }));
    }

    // ゲームデータ転送
    if (data.type === 'sync' && ws.isHost) {
      const room = rooms[ws.roomId];
      room.clients.forEach(c =>
        c.send(JSON.stringify({ type: 'sync', state: data.state }))
      );
    }

    // 入力転送
    if (data.type === 'input' && !ws.isHost) {
      const room = rooms[ws.roomId];
      room.host.send(JSON.stringify(data));
    }
  });

  ws.on('close', () => {
    if (!ws.roomId) return;
    const room = rooms[ws.roomId];
    if (!room) return;

    room.clients = room.clients.filter(c => c !== ws);
    if (ws.isHost) delete rooms[ws.roomId];
  });
});