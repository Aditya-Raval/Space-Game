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
  SHIP_RADIUS,
  PLANET_CLAIM_COST,
  BASE_RENT_COST,
  RENT_PERCENTAGE,
  FREE_REFUEL_AMOUNT,
  PAID_REFUEL_AMOUNT,
  REFUEL_COST_PER_TANK,
  MISSILE_FUEL_COST,
  MISSILE_CREDIT_COST,
  MISSILE_SPEED,
  MISSILE_LIFETIME,
  MISSILE_DAMAGE_FUEL,
  MISSILE_DAMAGE_CREDITS,
  MISSILE_REWARD_CREDITS
} from './shared/constants.js';

import { 
  MSG_INPUT, 
  MSG_STATE, 
  MSG_CLAIM_PLANET,
  MSG_CLAIM_RESPONSE,
  MSG_REFUEL,
  MSG_REFUEL_RESPONSE,
  MSG_REVOKE_PLANET,
  MSG_LANDING_PROMPT,
  MSG_CHAT,
  MSG_CHAT_BROADCAST,
  MSG_CHAT_ERROR,
  MSG_FIRE_MISSILE,
  MSG_MISSILE_UPDATE,
  MSG_MISSILE_HIT
} from './shared/messageTypes.js';
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
const missiles = [];


// Initialize DB and planets on startup
async function initializeGame() {
  await connectDB();
  
  // Initialize planets in DB if not exist and load ownership
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
    } else {
      // Load ownership from DB
      planet.owner = existingPlanet.owner;
      planet.ownerUsername = existingPlanet.ownerUsername;
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
        ownedPlanets: dbPlayer.ownedPlanets || [],
        on_planet : false,
        landedOn: null,
        lastPrompted: null,
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

    if (msg.type === MSG_CLAIM_PLANET) {
      const { planetId } = msg.payload;
      const planet = planets.find(p => p.id === planetId);
      
      if (!planet) {
        ws.send(JSON.stringify({ 
          type: MSG_CLAIM_RESPONSE, 
          success: false, 
          error: "Planet not found" 
        }));
        return;
      }

      if (planet.owner) {
        ws.send(JSON.stringify({ 
          type: MSG_CLAIM_RESPONSE, 
          success: false, 
          error: `Planet already owned by ${planet.ownerUsername}` 
        }));
        return;
      }

      if (player.credits < PLANET_CLAIM_COST) {
        ws.send(JSON.stringify({ 
          type: MSG_CLAIM_RESPONSE, 
          success: false, 
          error: `Insufficient credits. Need $${PLANET_CLAIM_COST}, have $${player.credits}` 
        }));
        return;
      }

      // Claim the planet
      player.credits -= PLANET_CLAIM_COST;
      player.ownedPlanets.push(planetId);
      planet.owner = player.id;
      planet.ownerUsername = player.username;

      // Update in DB
      await Planet.findOneAndUpdate(
        { planetId },
        { owner: player.id, ownerUsername: player.username }
      );

      await Player.findOneAndUpdate(
        { playerId: player.id },
        { ownedPlanets: player.ownedPlanets, credits: player.credits }
      );

      ws.send(JSON.stringify({ 
        type: MSG_CLAIM_RESPONSE, 
        success: true, 
        message: `Successfully claimed ${planet.name}!`,
        planetId
      }));
    }

    if (msg.type === MSG_REVOKE_PLANET) {
      const { planetId } = msg.payload;
      
      if (!player.ownedPlanets.includes(planetId)) {
        ws.send(JSON.stringify({ 
          type: MSG_CLAIM_RESPONSE, 
          success: false, 
          error: "You don't own this planet" 
        }));
        return;
      }

      const planet = planets.find(p => p.id === planetId);
      player.ownedPlanets = player.ownedPlanets.filter(p => p !== planetId);
      planet.owner = null;
      planet.ownerUsername = null;

      await Planet.findOneAndUpdate(
        { planetId },
        { owner: null, ownerUsername: null }
      );

      await Player.findOneAndUpdate(
        { playerId: player.id },
        { ownedPlanets: player.ownedPlanets }
      );

      ws.send(JSON.stringify({ 
        type: MSG_CLAIM_RESPONSE, 
        success: true, 
        message: `Revoked ownership of ${planet.name}`,
        planetId
      }));
    }

    if (msg.type === MSG_CHAT) {
      const { text } = msg.payload || {};
      const cleanText = (text || '').toString().trim();
      const badWords = ['fuck','shit','bitch','asshole','damn','dick','pussy'];
      const containsBad = badWords.some(word => new RegExp(`\\b${word}\\b`, 'i').test(cleanText));

      if (!cleanText) {
        ws.send(JSON.stringify({ type: MSG_CHAT_ERROR, error: 'Cannot send empty message' }));
        return;
      }

      if (containsBad) {
        ws.send(JSON.stringify({ type: MSG_CHAT_ERROR, error: 'Profanity is not allowed' }));
        return;
      }

      const chatPayload = {
        type: MSG_CHAT_BROADCAST,
        payload: {
          from: player.username,
          fromId: player.id,
          text: cleanText,
          ts: Date.now()
        }
      };

      for (const client of wss.clients) {
        if (client.readyState === 1) {
          client.send(JSON.stringify(chatPayload));
        }
      }

      return;
    }

    if (msg.type === MSG_REFUEL) {
      const { amount, isOwned } = msg.payload;
      const cost = isOwned ? 0 : REFUEL_COST_PER_TANK * (amount / PAID_REFUEL_AMOUNT);

      if (!isOwned && player.credits < cost) {
        ws.send(JSON.stringify({ 
          type: MSG_REFUEL_RESPONSE, 
          success: false, 
          error: `Insufficient credits. Need $${cost.toFixed(2)}` 
        }));
        return;
      }

      player.credits -= cost;
      player.fuel = Math.min(MAX_FUEL, player.fuel + amount);

      ws.send(JSON.stringify({ 
        type: MSG_REFUEL_RESPONSE, 
        success: true, 
        fuelAmount: amount,
        costDeducted: cost,
        newFuel: player.fuel
      }));
    }

    if (msg.type === MSG_FIRE_MISSILE) {
      if (player.fuel < MISSILE_FUEL_COST || player.credits < MISSILE_CREDIT_COST) {
        ws.send(JSON.stringify({ type: MSG_CHAT_ERROR, error: 'Not enough fuel or credits for missile' }));
        return;
      }

      player.fuel -= MISSILE_FUEL_COST;
      player.credits -= MISSILE_CREDIT_COST;

      const missile = {
        id: Date.now() + Math.random(),
        x: player.x,
        y: player.y,
        vx: Math.cos(player.rot) * MISSILE_SPEED,
        vy: Math.sin(player.rot) * MISSILE_SPEED,
        shooter: player.id,
        shooterUsername: player.username,
        created: Date.now()
      };

      missiles.push(missile);
      return;
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
          ownedPlanets: player.ownedPlanets,
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
        // Check if landing on a different planet or not yet prompted
        if (!p.on_planet || p.landedOn !== planet.id || !p.lastPrompted) {
          p.on_planet = true;
          p.landedOn = planet.id;
          p.lastPrompted = planet.id;

          // Handle economy: rent payment or claim prompt
          let ws = null;
          for (const [clientWs, clientPlayer] of players.entries()) {
            if (clientPlayer.id === p.id) {
              ws = clientWs;
              break;
            }
          }

          if (ws) {
            if (planet.owner && planet.owner !== p.id) {
              // Pay rent to planet owner
              const rentAmount = Math.max(BASE_RENT_COST, Math.floor(p.credits * RENT_PERCENTAGE));
              const actualRent = Math.min(rentAmount, p.credits);
              
              p.credits -= actualRent;

              // Find owner and give them credits
              for (const ownerPlayer of players.values()) {
                if (ownerPlayer.id === planet.owner) {
                  ownerPlayer.credits += actualRent;
                  break;
                }
              }

              ws.send(JSON.stringify({
                type: MSG_LANDING_PROMPT,
                planetId: planet.id,
                planetName: planet.name,
                owner: planet.ownerUsername,
                isOwned: true,
                rentPaid: actualRent,
                creditsLeft: p.credits,
                currentCredits: p.credits
              }));
            } else if (!planet.owner) {
              // Prompt to claim
              ws.send(JSON.stringify({
                type: MSG_LANDING_PROMPT,
                planetId: planet.id,
                planetName: planet.name,
                isOwned: false,
                isOwner: false,
                claimCost: PLANET_CLAIM_COST,
                currentCredits: p.credits
              }));
            } else if (planet.owner === p.id) {
              // Own planet - just landed safely
              ws.send(JSON.stringify({
                type: MSG_LANDING_PROMPT,
                planetId: planet.id,
                planetName: planet.name,
                isOwned: true,
                isOwner: true,
                currentCredits: p.credits
              }));
            }
          }
        }
        return;
      }
    }
  }

}



/* ===== Fixed timestep loop ===== */
setInterval(() => {
  for (const p of players.values()) {
    updatePlayer(p);
  }

  // Update missiles
  for (let i = missiles.length - 1; i >= 0; i--) {
    const m = missiles[i];
    m.x += m.vx * DT;
    m.y += m.vy * DT;

    // Check timeout
    if (Date.now() - m.created > MISSILE_LIFETIME) {
      missiles.splice(i, 1);
      continue;
    }

    // Check collision with planets
    let hitPlanet = false;
    for (const p of planets) {
      const dx = m.x - p.x;
      const dy = m.y - p.y;
      if (dx * dx + dy * dy < p.r * p.r) {
        missiles.splice(i, 1);
        hitPlanet = true;
        break;
      }
    }
    if (hitPlanet) continue;

    // Check collision with players
    for (const [ws, pl] of players) {
      if (pl.id === m.shooter) continue; // Don't hit self
      const dx = m.x - pl.x;
      const dy = m.y - pl.y;
      if (dx * dx + dy * dy < SHIP_RADIUS * SHIP_RADIUS) {
        // Hit
        pl.fuel = Math.max(0, pl.fuel - MISSILE_DAMAGE_FUEL);
        pl.credits = Math.max(0, pl.credits - MISSILE_DAMAGE_CREDITS);

        // Reward shooter
        for (const [ws2, pl2] of players) {
          if (pl2.id === m.shooter) {
            pl2.credits += MISSILE_REWARD_CREDITS;
            break;
          }
        }

        // Broadcast hit
        const hitMsg = {
          type: MSG_MISSILE_HIT,
          payload: {
            shooter: m.shooterUsername,
            target: pl.username,
            reward: MISSILE_REWARD_CREDITS,
            damageFuel: MISSILE_DAMAGE_FUEL,
            damageCredits: MISSILE_DAMAGE_CREDITS
          }
        };
        for (const client of wss.clients) {
          if (client.readyState === 1) {
            client.send(JSON.stringify(hitMsg));
          }
        }

        missiles.splice(i, 1);
        break;
      }
    }
  }

  const snapshot = {
    players : Array.from(players.values()).map(p => ({
    id: p.id,
    x: p.x,
    y: p.y,
    rot: p.rot,
    fuel: p.fuel,
    credits: p.credits,
    ownedPlanets: p.ownedPlanets
  })),
  planets: planets.map(p => ({
    id: p.id,
    x: p.x,
    y: p.y,
    r: p.r,
    name: p.name,
    owner: p.owner,
    ownerUsername: p.ownerUsername
  })),
  missiles: missiles.map(m => ({
    id: m.id,
    x: m.x,
    y: m.y,
    vx: m.vx,
    vy: m.vy
  }))
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
        ownedPlanets: p.ownedPlanets,
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
