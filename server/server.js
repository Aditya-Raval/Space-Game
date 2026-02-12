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
import { connectDB } from './db/connection.js';
import { Player } from './models/Player.js';
import { Planet } from './models/Planet.js';

const wss = new WebSocketServer({ port: 8080 });
console.log("Server running on ws://localhost:8080");
import { startAuthServer } from "./auth.js";
startAuthServer();
const planets = [
  { id: "p1", x: 100, y: 300, r: 120, name: "Terra" },
  { id: "p2", x: 800, y: -400, r: 80, name: "Mars" },
  { id: "p3", x: -1000, y: 600, r: 150, name: "Jupiter" },
  { id: "p4", x: 1200, y: 800, r: 90, name: "Venus" },
  { id: "p5", x: -600, y: -500, r: 70, name: "Mercury" },
  { id: "p6", x: 500, y: -1200, r: 110, name: "Saturn" },
  { id: "p7", x: -200, y: 1000, r: 65, name: "Uranus" },
  { id: "p8", x: 1500, y: 200, r: 95, name: "Neptune" }
];

const players = new Map();

function makeId() {
  return Math.random().toString(36).slice(2);
}

// Initialize DB and planets on startup
async function initializeGame() {
  await connectDB();
  
  // Initialize planets in DB if not exist
  for (const planet of planets) {
    const existingPlanet = await Planet.findOne({ planetId: planet.id });
    if (!existingPlanet) {
      await Planet.create({
        planetId: planet.id,
        name: planet.name,
        x: planet.x,
        y: planet.y,
        r: planet.r
      });
    }
  }
  console.log("Game initialized");
}

wss.on("connection", async ws => {
  // Expect first message to be auth: { type: 'auth', payload: { playerId } }
  let player = null;

  const authTimeout = setTimeout(() => {
    if (!player) ws.close();
  }, 5000);

  ws.on("message", async data => {
    const msg = JSON.parse(data);
    if (msg.type === "auth") {
      clearTimeout(authTimeout);
      const { playerId } = msg.payload;
      let dbPlayer = await Player.findOne({ playerId });
      if (!dbPlayer) {
        // unknown player, reject
        ws.send(JSON.stringify({ type: "auth_fail" }));
        ws.close();
        return;
      }

      player = {
        id: dbPlayer.playerId,
        username: dbPlayer.username,
        x: dbPlayer.x || 0,
        y: dbPlayer.y || 0,
        vx: 0,
        vy: 0,
        rot: dbPlayer.rot || 0,
        fuel: dbPlayer.fuel,
        credits: dbPlayer.credits,
        on_planet : false,
        input: { thrust: false, rotate: 0, brake: false }
      };

      players.set(ws, player);
      ws.send(JSON.stringify({ type: "init", id: player.id, username: player.username }));
      return;
    }

    if (!player) return; // ignore until authed

    if (msg.type === MSG_INPUT) {
      player.input = msg.payload;
    }
  });

  ws.on("close", async () => {
    if (player) {
      // Save player data to DB on disconnect
      await Player.findOneAndUpdate(
        { playerId: player.id },
        {
          fuel: player.fuel,
          credits: player.credits,
          x: player.x,
          y: player.y,
          rot: player.rot,
          lastUpdated: new Date()
        }
      );
      players.delete(ws);
    }
  });
});

function updatePlayer(p) {
  if (p.on_planet) {
    if (p.input.rotate !== 0 && p.fuel > 0) {
      p.rot += p.input.rotate * ROT_SPEED * DT;
      p.fuel -= FUEL_ROTATE_COST * DT;
    }

    if (p.on_planet && p.input.thrust && p.fuel > 0) {
      const planet = planets.find(pl => pl.id === p.landedOn);

      const dx = p.x - planet.x;
      const dy = p.y - planet.y;
      const len = Math.hypot(dx, dy);

      // impulse away from surface
      p.vx += (dx / len) * 6;
      p.vy += (dy / len) * 6;

      p.on_planet = false;
      p.landedOn = null;
      p.fuel -= FUEL_THRUST_COST * 5;
    }

    return;
  }

  for (const planet of planets) {
    const dx = planet.x - p.x;
    const dy = planet.y - p.y;
    const distSq = dx * dx + dy * dy;
    const dist = Math.sqrt(distSq);

    const G = 500*planet.r; // gravity scaled to planet size
    const force = G / distSq;
    if(dist < planet.r * 5){
      p.vx += (dx / dist) * force * DT;
      p.vy += (dy / dist) * force * DT;
    } 
  }

  //Rotation
  if (p.input.rotate !== 0 && p.fuel > 0) {
    p.rot += p.input.rotate * ROT_SPEED * DT;
    p.fuel -= FUEL_ROTATE_COST * DT;
  }

  //Thrust
  if (p.input.thrust && p.fuel > 0) {
    p.vx += Math.cos(p.rot) * THRUST * DT;
    p.vy += Math.sin(p.rot) * THRUST * DT;
    p.fuel -= FUEL_THRUST_COST * DT;
  }

  //Braking
  if (p.input.brake && p.fuel > 0) {
    const speed = Math.hypot(p.vx, p.vy);
    if (speed > 0) {
      const decel = BRAKE * DT;
      if (speed <= decel) {
        p.vx = 0;
        p.vy = 0;
      } else {
        p.vx -= (p.vx / speed) * decel;
        p.vy -= (p.vy / speed) * decel;
        p.fuel -= FUEL_THRUST_COST * DT;
      }
    }
  }

  //Clamp max speed
  const speed = Math.hypot(p.vx, p.vy);
  if (speed > MAX_SPEED) {
    p.vx = (p.vx / speed) * MAX_SPEED;
    p.vy = (p.vy / speed) * MAX_SPEED;
  }

  //Integrate position
  p.x += p.vx * DT;
  p.y += p.vy * DT;

  for (const planet of planets) {
    const dx = p.x - planet.x;
    const dy = p.y - planet.y;
    const dist = Math.hypot(dx, dy);
    const minDist = planet.r + SHIP_RADIUS;

    if (dist < minDist) {
      const nx = dx / dist;
      const ny = dy / dist;

      // push out
      p.x = planet.x + nx * minDist;
      p.y = planet.y + ny * minDist;

      // remove only inward velocity
      const vDotN = p.vx * nx + p.vy * ny;
      if (vDotN < 0) {
        p.vx -= vDotN * nx;
        p.vy -= vDotN * ny;
      }

      //landing check
      const speed = Math.hypot(p.vx, p.vy);
      if (speed < 0.5 && !p.input.thrust) {
        p.on_planet = true;
        p.landedOn = planet.id;
      }
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
    rot: p.rot,
    fuel: p.fuel,
    credits: p.credits
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

// Periodic save of all connected players' position and state every 5s
setInterval(async () => {
  for (const p of players.values()) {
    try {
      await Player.findOneAndUpdate({ playerId: p.id }, {
        x: p.x,
        y: p.y,
        rot: p.rot,
        fuel: p.fuel,
        credits: p.credits,
        lastUpdated: new Date()
      });
    } catch (err) {
      console.error("Failed to save player state:", err.message);
    }
  }
}, 5000);

// Initialize game on startup
initializeGame().catch(err => {
  console.error("Failed to initialize game:", err);
  process.exit(1);
});
