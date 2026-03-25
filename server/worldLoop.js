import {
  TICK_RATE,
  DT,
  SHIP_RADIUS,
  MISSILE_LIFETIME,
  MISSILE_DAMAGE_FUEL,
  MISSILE_DAMAGE_CREDITS,
  MISSILE_REWARD_CREDITS
} from './shared/constants.js';
import { MSG_STATE, MSG_MISSILE_HIT } from './shared/messageTypes.js';
import { players, planets, missiles } from './gameState.js';
import { updatePlayer } from './physics.js';
import { Player } from './models/Player.js';

export function runGameLoop(wss) {
  setInterval(() => {
    for (const p of players.values()) {
      p.dt = DT;
      updatePlayer(p);
    }

    processMissiles(wss);
    broadcastState(wss);
  }, 1000 / TICK_RATE);

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
        console.error('Failed to save player state:', err.message);
      }
    }
  }, 5000);
}

function processMissiles(wss) {
  for (let i = missiles.length - 1; i >= 0; i--) {
    const m = missiles[i];
    m.x += m.vx * DT;
    m.y += m.vy * DT;

    if (Date.now() - m.created > MISSILE_LIFETIME) {
      missiles.splice(i, 1);
      continue;
    }

    let hit = false;
    for (const p of planets) {
      const dx = m.x - p.x;
      const dy = m.y - p.y;
      if (dx * dx + dy * dy < p.r * p.r) {
        missiles.splice(i, 1);
        hit = true;
        break;
      }
    }
    if (hit) continue;

    for (const pl of players.values()) {
      if (pl.id === m.shooter) continue;
      const dx = m.x - pl.x;
      const dy = m.y - pl.y;
      if (dx * dx + dy * dy < SHIP_RADIUS * SHIP_RADIUS) {
        pl.fuel = Math.max(0, pl.fuel - MISSILE_DAMAGE_FUEL);
        pl.credits = Math.max(0, pl.credits - MISSILE_DAMAGE_CREDITS);

        for (const shooter of players.values()) {
          if (shooter.id === m.shooter) {
            shooter.credits += MISSILE_REWARD_CREDITS;
            break;
          }
        }

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
          if (client.readyState === 1) client.send(JSON.stringify(hitMsg));
        }

        missiles.splice(i, 1);
        break;
      }
    }
  }
}

export function broadcastState(wss) {
  const snapshot = {
    players: Array.from(players.values()).map(p => ({
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
    missiles: missiles.map(m => ({ id: m.id, x: m.x, y: m.y, vx: m.vx, vy: m.vy }))
  };

  const msg = JSON.stringify({ type: MSG_STATE, payload: snapshot });
  for (const client of wss.clients) {
    if (client.readyState === 1) client.send(msg);
  }
}
