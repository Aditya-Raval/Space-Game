import {
  PLANET_CLAIM_COST,
  FREE_REFUEL_AMOUNT,
  PAID_REFUEL_AMOUNT,
  REFUEL_COST_PER_TANK,
  MISSILE_FUEL_COST,
  MISSILE_CREDIT_COST,
  MISSILE_SPEED,
  MISSILE_LIFETIME,
  MISSILE_DAMAGE_FUEL,
  MISSILE_DAMAGE_CREDITS,
  MISSILE_REWARD_CREDITS,
  MAX_FUEL
} from './shared/constants.js';
import {
  MSG_INPUT,
  MSG_CLAIM_PLANET,
  MSG_CLAIM_RESPONSE,
  MSG_REFUEL,
  MSG_REFUEL_RESPONSE,
  MSG_REVOKE_PLANET,
  MSG_LANDING_PROMPT,
  MSG_CHAT,
  MSG_CHAT_BROADCAST,
  MSG_CHAT_ERROR,
  MSG_FIRE_MISSILE
} from './shared/messageTypes.js';
import { players, planets, missiles } from './gameState.js';
import { Player } from './models/Player.js';


export async function handleAuth(msg, ws) {
  const { playerId } = msg.payload || {};
  const dbPlayer = await Player.findOne({ playerId });

  if (!dbPlayer) {
    ws.send(JSON.stringify({ type: 'auth_fail' }));
    ws.close();
    return null;
  }

  const player = {
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
    on_planet: false,
    landedOn: null,
    lastPrompted: null,
    input: { thrust: false, rotate: 0, brake: false }
  };

  players.set(ws, player);
  ws.send(JSON.stringify({ type: 'init', id: player.id, username: player.username }));
  return player;
}

export async function handleMessage(msg, ws, player, wss) {
  if (!player && msg.type !== 'auth') return;

  switch (msg.type) {
    case 'auth':
      return handleAuth(msg, ws);
    case MSG_INPUT:
      player.input = msg.payload;
      return player;
    case MSG_CLAIM_PLANET:
      return handleClaimPlanet(msg, ws, player);
    case MSG_REVOKE_PLANET:
      return handleRevokePlanet(msg, ws, player);
    case MSG_CHAT:
      return handleChat(msg, ws, player, wss);
    case MSG_REFUEL:
      return handleRefuel(msg, ws, player);
    case MSG_FIRE_MISSILE:
      return handleFireMissile(msg, player);
    default:
      return player;
  }
}

export async function handleClaimPlanet(msg, ws, player) {
  const { planetId } = msg.payload || {};
  const planet = planets.find(p => p.id === planetId);
  if (!planet) {
    ws.send(JSON.stringify({ type: MSG_CLAIM_RESPONSE, success: false, error: 'Planet not found' }));
    return player;
  }
  if (planet.owner) {
    ws.send(JSON.stringify({ type: MSG_CLAIM_RESPONSE, success: false, error: `Planet already owned by ${planet.ownerUsername}` }));
    return player;
  }
  if (player.credits < PLANET_CLAIM_COST) {
    ws.send(JSON.stringify({ type: MSG_CLAIM_RESPONSE, success: false, error: `Insufficient credits. Need $${PLANET_CLAIM_COST}, have $${player.credits}` }));
    return player;
  }
  player.credits -= PLANET_CLAIM_COST;
  player.ownedPlanets.push(planetId);
  planet.owner = player.id;
  planet.ownerUsername = player.username;

  await Planet.findOneAndUpdate({ planetId }, { owner: player.id, ownerUsername: player.username });
  await Player.findOneAndUpdate({ playerId: player.id }, { ownedPlanets: player.ownedPlanets, credits: player.credits });

  ws.send(JSON.stringify({ type: MSG_CLAIM_RESPONSE, success: true, message: `Successfully claimed ${planet.name}!`, planetId }));
  return player;
}

export async function handleRevokePlanet(msg, ws, player) {
  const { planetId } = msg.payload || {};
  if (!player.ownedPlanets.includes(planetId)) {
    ws.send(JSON.stringify({ type: MSG_CLAIM_RESPONSE, success: false, error: "You don't own this planet" }));
    return player;
  }
  const planet = planets.find(p => p.id === planetId);
  if (!planet) return player;

  player.ownedPlanets = player.ownedPlanets.filter(id => id !== planetId);
  planet.owner = null;
  planet.ownerUsername = null;

  await Planet.findOneAndUpdate({ planetId }, { owner: null, ownerUsername: null });
  await Player.findOneAndUpdate({ playerId: player.id }, { ownedPlanets: player.ownedPlanets });

  ws.send(JSON.stringify({ type: MSG_CLAIM_RESPONSE, success: true, message: `Revoked ownership of ${planet.name}`, planetId }));
  return player;
}

export function handleChat(msg, ws, player, wss) {
  const text = (msg.payload?.text || '').toString().trim();
  if (!text) {
    ws.send(JSON.stringify({ type: MSG_CHAT_ERROR, error: 'Cannot send empty message' }));
    return player;
  }

  const broadcast = {
    type: MSG_CHAT_BROADCAST,
    payload: { from: player.username, fromId: player.id, text, ts: Date.now() }
  };

  for (const client of wss.clients) {
    if (client.readyState === 1) {
      client.send(JSON.stringify(broadcast));
    }
  }

  return player;
}

export function handleRefuel(msg, ws, player) {
  const { amount, isOwned } = msg.payload || {};
  const cost = isOwned ? 0 : REFUEL_COST_PER_TANK * (amount / PAID_REFUEL_AMOUNT);

  if (!isOwned && player.credits < cost) {
    ws.send(JSON.stringify({ type: MSG_REFUEL_RESPONSE, success: false, error: `Insufficient credits. Need $${cost.toFixed(2)}` }));
    return player;
  }

  player.credits -= cost;
  player.fuel = Math.min(MAX_FUEL, player.fuel + amount);
  ws.send(JSON.stringify({ type: MSG_REFUEL_RESPONSE, success: true, fuelAmount: amount, costDeducted: cost, newFuel: player.fuel }));
  return player;
}

export function handleFireMissile(msg, player) {
  if (player.fuel < MISSILE_FUEL_COST || player.credits < MISSILE_CREDIT_COST) {
    return player;
  }

  player.fuel -= MISSILE_FUEL_COST;
  player.credits -= MISSILE_CREDIT_COST;

  missiles.push({
    id: Date.now() + Math.random(),
    x: player.x,
    y: player.y,
    vx: Math.cos(player.rot) * MISSILE_SPEED,
    vy: Math.sin(player.rot) * MISSILE_SPEED,
    shooter: player.id,
    shooterUsername: player.username,
    created: Date.now()
  });

  return player;
}
