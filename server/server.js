import { WebSocketServer } from "ws";
import {
  TICK_RATE,
  DT,
  ROT_SPEED,
  THRUST,
  BRAKE,
  MAX_SPEED,
  MAX_FUEL,
  FUEL_THRUST_COST,
  FUEL_ROTATE_COST
} from './shared/constants.js';

import { MSG_INPUT, MSG_STATE } from './shared/messageTypes.js';

const wss = new WebSocketServer({ port: 8080 });
console.log("Server running on ws://localhost:8080");

const players = new Map();

function makeId() {
  return Math.random().toString(36).slice(2);
}

wss.on("connection", ws => {
  const id = makeId();

  const player = {
    id,
    x: 0,
    y: 0,
    vx: 0,
    vy: 0,
    rot: 0,
    fuel: MAX_FUEL,
    input: { thrust: false, rotate: 0, brake: false }
  };

  players.set(ws, player);

  ws.send(JSON.stringify({ type: "init", id }));

  ws.on("message", data => {
    const msg = JSON.parse(data);
    if (msg.type === MSG_INPUT) {
      player.input = msg.payload;
    }
  });

  ws.on("close", () => {
    players.delete(ws);
  });
});

function updatePlayer(p) {
  /* ===== Rotation ===== */
  if (p.input.rotate !== 0 && p.fuel > 0) {
    p.rot += p.input.rotate * ROT_SPEED * DT;
    p.fuel -= FUEL_ROTATE_COST * DT;
  }

  /* ===== Thrust ===== */
  if (p.input.thrust && p.fuel > 0) {
    p.vx += Math.cos(p.rot) * THRUST * DT;
    p.vy += Math.sin(p.rot) * THRUST * DT;
    p.fuel -= FUEL_THRUST_COST * DT;
  }

  /* ===== Braking (hard stop) ===== */
  if (p.input.brake) {
    const speed = Math.hypot(p.vx, p.vy);
    if (speed > 0) {
      const decel = BRAKE * DT;
      if (speed <= decel) {
        p.vx = 0;
        p.vy = 0;
      } else {
        p.vx -= (p.vx / speed) * decel;
        p.vy -= (p.vy / speed) * decel;
      }
    }
  }

  /* ===== Clamp max speed ===== */
  const speed = Math.hypot(p.vx, p.vy);
  if (speed > MAX_SPEED) {
    p.vx = (p.vx / speed) * MAX_SPEED;
    p.vy = (p.vy / speed) * MAX_SPEED;
  }

  /* ===== Integrate position ===== */
  p.x += p.vx * DT;
  p.y += p.vy * DT;
}

/* ===== Fixed timestep loop ===== */
setInterval(() => {
  for (const p of players.values()) {
    updatePlayer(p);
  }

  const snapshot = Array.from(players.values()).map(p => ({
    id: p.id,
    x: p.x,
    y: p.y,
    rot: p.rot
  }));

  const msg = JSON.stringify({
    type: MSG_STATE,
    payload: snapshot
  });

  for (const client of wss.clients) {
    if (client.readyState === 1) {
      client.send(msg);
    }
  }
}, 1000 / TICK_RATE);
