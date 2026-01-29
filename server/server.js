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
  FUEL_ROTATE_COST,
  SHIP_RADIUS
} from './shared/constants.js';

import { MSG_INPUT, MSG_STATE } from './shared/messageTypes.js';

const wss = new WebSocketServer({ port: 8080 });
console.log("Server running on ws://localhost:8080");
const planets = [
  { id: "p1", x: 100, y: 300, r: 120 },
  { id: "p2", x: 800, y: -400, r: 80 },
  { id: "p3", x: -1000, y: 600, r: 150 }
];

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
    on_planet : false,
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
  for (const planet of planets) {
    const dx = planet.x - p.x;
    const dy = planet.y - p.y;
    const distSq = dx * dx + dy * dy;
    const dist = Math.sqrt(distSq);

    const G = 150000; // tweak later
    const force = G / distSq;
    if(dist < planet.r * 5){
      p.vx += (dx / dist) * force * DT;
      p.vy += (dy / dist) * force * DT;
    } 
  }

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

  for (const planet of planets) {
  const dx = p.x - planet.x;
  const dy = p.y - planet.y;
  const dist = Math.hypot(dx, dy);

  if (dist < planet.r + SHIP_RADIUS) {
    // simple collision response
    const nx = dx / dist;
    const ny = dy / dist;

    // push ship out
    p.x = planet.x + nx * (planet.r + SHIP_RADIUS);
    p.y = planet.y + ny * (planet.r + SHIP_RADIUS);
    // kill velocity
    p.vx = 0;
    p.vy = 0;
  
  }
}

}

/* ===== Fixed timestep loop ===== */
setInterval(() => {
  for (const p of players.values()) {
    updatePlayer(p);
  }

  const snapshot = {
    players : Array.from(players.values()).map(p => ({
    id: p.id,
    x: p.x,
    y: p.y,
    rot: p.rot
  })),
  planets
};

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
