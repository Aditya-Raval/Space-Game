import { setupWebSocketServer } from './connection.js';
import { runGameLoop } from './worldLoop.js';
import { initializeGame } from './dbInit.js';
import { startAuthServer } from './auth.js';

startAuthServer();
const wss = setupWebSocketServer(8080);

initializeGame().catch(err => {
  console.error('Failed to initialize game:', err);
  process.exit(1);
});

runGameLoop(wss);
