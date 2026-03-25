import {
  ROT_SPEED,
  THRUST,
  BRAKE,
  MAX_SPEED,
  FUEL_THRUST_COST,
  FUEL_ROTATE_COST,
  SHIP_RADIUS,
  BASE_RENT_COST,
  RENT_PERCENTAGE,
  PLANET_CLAIM_COST
} from './shared/constants.js';
import {
  MSG_LANDING_PROMPT
} from './shared/messageTypes.js';
import { planets, players, findPlanetById } from './gameState.js';

export function updatePlayer(p) {
  if (p.on_planet) {
    if (p.input.rotate !== 0 && p.fuel > 0) {
      p.rot += p.input.rotate * ROT_SPEED * p.dt;
      p.fuel -= FUEL_ROTATE_COST * p.dt;
    }

    if (p.input.thrust && p.fuel > 0) {
      const planet = findPlanetById(p.landedOn);
      if (planet) {
        const dx = p.x - planet.x;
        const dy = p.y - planet.y;
        const len = Math.hypot(dx, dy) || 1;

        p.vx += (dx / len) * 6;
        p.vy += (dy / len) * 6;
        p.on_planet = false;
        p.landedOn = null;
        p.fuel -= FUEL_THRUST_COST * 5;
      }
    }

    return;
  }

  // Gravity
  for (const planet of planets) {
    const dx = planet.x - p.x;
    const dy = planet.y - p.y;
    const distSq = dx * dx + dy * dy;
    const dist = Math.sqrt(distSq) || 1;

    const G = 500 * planet.r;
    const force = G / distSq;
    if (dist < planet.r * 5) {
      p.vx += (dx / dist) * force * p.dt;
      p.vy += (dy / dist) * force * p.dt;
    }
  }

  // Rotation
  if (p.input.rotate !== 0 && p.fuel > 0) {
    p.rot += p.input.rotate * ROT_SPEED * p.dt;
    p.fuel -= FUEL_ROTATE_COST * p.dt;
  }

  // Thrust
  if (p.input.thrust && p.fuel > 0) {
    p.vx += Math.cos(p.rot) * THRUST * p.dt;
    p.vy += Math.sin(p.rot) * THRUST * p.dt;
    p.fuel -= FUEL_THRUST_COST * p.dt;
  }

  // Brake
  if (p.input.brake && p.fuel > 0) {
    const speed = Math.hypot(p.vx, p.vy);
    if (speed > 0) {
      const decel = BRAKE * p.dt;
      if (speed <= decel) {
        p.vx = 0;
        p.vy = 0;
      } else {
        p.vx -= (p.vx / speed) * decel;
        p.vy -= (p.vy / speed) * decel;
        p.fuel -= FUEL_THRUST_COST * p.dt;
      }
    }
  }

  // Clamp
  const speed = Math.hypot(p.vx, p.vy);
  if (speed > MAX_SPEED) {
    p.vx = (p.vx / speed) * MAX_SPEED;
    p.vy = (p.vy / speed) * MAX_SPEED;
  }

  p.x += p.vx * p.dt;
  p.y += p.vy * p.dt;

  for (const planet of planets) {
    const dx = p.x - planet.x;
    const dy = p.y - planet.y;
    const dist = Math.hypot(dx, dy);
    const minDist = planet.r + SHIP_RADIUS;

    if (dist < minDist) {
      const nx = dx / dist;
      const ny = dy / dist;
      p.x = planet.x + nx * minDist;
      p.y = planet.y + ny * minDist;

      const vDotN = p.vx * nx + p.vy * ny;
      if (vDotN < 0) {
        p.vx -= vDotN * nx;
        p.vy -= vDotN * ny;
      }

      const currentSpeed = Math.hypot(p.vx, p.vy);
      if (currentSpeed < 0.5 && !p.input.thrust) {
        if (!p.on_planet || p.landedOn !== planet.id || !p.lastPrompted) {
          p.on_planet = true;
          p.landedOn = planet.id;
          p.lastPrompted = planet.id;
          broadcastLandingPrompt(p, planet);
        }
      }

      return;
    }
  }
}

export function broadcastLandingPrompt(p, planet) {
  const ws = Array.from(players.keys()).find(client => players.get(client).id === p.id);
  if (!ws || ws.readyState !== 1) return;

  if (planet.owner && planet.owner !== p.id) {
    const rentAmount = Math.max(BASE_RENT_COST, Math.floor(p.credits * RENT_PERCENTAGE));
    const actualRent = Math.min(rentAmount, p.credits);
    p.credits -= actualRent;

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
    return;
  }

  if (!planet.owner) {
    ws.send(JSON.stringify({
      type: MSG_LANDING_PROMPT,
      planetId: planet.id,
      planetName: planet.name,
      isOwned: false,
      isOwner: false,
      claimCost: PLANET_CLAIM_COST,
      currentCredits: p.credits
    }));
    return;
  }

  if (planet.owner === p.id) {
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