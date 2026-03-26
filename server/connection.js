import { WebSocketServer } from 'ws';
import { players } from './gameState.js';
import { Player } from './models/Player.js';
import { handleAuth, handleMessage } from './messageHandlers.js';

export function setupWebSocketServer(port = 8080) {
  const wss = new WebSocketServer({
  port,
  host: '0.0.0.0',
  });
  console.log(`Server running on ws://localhost:${port}`);

  wss.on('connection', async ws => {
    let player = null;

    const authTimeout = setTimeout(() => {
      if (!player) ws.close();
    }, 5000);

    ws.on('message', async data => {
      let msg;
      try {
        msg = JSON.parse(data);
      } catch (err) {
        return;
      }

      if (msg.type === 'auth') {
        player = await handleAuth(msg, ws);
        clearTimeout(authTimeout);
        return;
      }

      if (!player) return;

      const updatedPlayer = await handleMessage(msg, ws, player, wss);
      if (updatedPlayer) player = updatedPlayer;
    });

    ws.on('close', async () => {
      if (!player) return;
      try {
        await Player.findOneAndUpdate({ playerId: player.id }, {
          x: player.x,
          y: player.y,
          rot: player.rot,
          fuel: player.fuel,
          credits: player.credits,
          ownedPlanets: player.ownedPlanets,
          lastUpdated: new Date()
        });
      } catch (err) {
        console.error('Failed to save player state on close:', err.message);
      } finally {
        players.delete(ws);
      }
    });
  });

  return wss;
}
