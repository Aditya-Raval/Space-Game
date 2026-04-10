import { state, input, planetImages, planetImageNames } from "./state.js";
import { createChatWidget, appendChatMessage, showNotification } from "./chat.js";
import { showLandingPrompt } from "./landing.js";
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
  MSG_MISSILE_HIT
} from "./shared/messageTypes.js";
import { createLeaderboard, updateLeaderboard } from "./leaderboard.js";
export function connectSocket(playerId) {
  state.socket = new WebSocket("ws://localhost:8080");

  state.socket.onopen = () => {
    console.log("WS CONNECTED");
    state.socket.send(JSON.stringify({ type: 'auth', payload: { playerId } }));

    setInterval(() => {
      if (state.socket.readyState === 1) {
        state.socket.send(JSON.stringify({ type: MSG_INPUT, payload: input }));
        if (input.missile) {
          state.socket.send(JSON.stringify({ type: MSG_FIRE_MISSILE }));
          input.missile = false;
        }
      }
    }, 50);
  };

  state.socket.onmessage = socketOnMessage;
}

export function socketOnMessage(e) {
  const msg = JSON.parse(e.data);

  if (msg.type === "init") {
    state.myId = msg.id;
    state.myName = msg.username || msg.id;
    console.log("MY ID:", state.myId);
    const loginRoot = document.getElementById('login-root');
    if (loginRoot) loginRoot.style.display = 'none';
    createChatWidget();
    createLeaderboard();
    appendChatMessage({ system: true, text: 'Chat ready!', ts: Date.now() });
  }

  if (msg.type === MSG_STATE) {
    state.players = msg.payload.players;
    state.planets = msg.payload.planets;
    state.missiles = msg.payload.missiles || [];

    for (const p of state.planets) {
      if (!planetImages[p.id]) {
        planetImages[p.id] = new Image();
        planetImages[p.id].src = `./assets/planets/${planetImageNames[p.id] || 'sphereplanet.png'}`;
      }
    }

    const myPlayer = state.players.find(p => p.id === state.myId);
    if (myPlayer) {
      state.myFuel = myPlayer.fuel;
      state.myCredits = myPlayer.credits;
      state.myName = myPlayer.username || state.myName;
    }
    updateLeaderboard();
  }

  if (msg.type === MSG_LANDING_PROMPT) {
    state.landingPrompt = msg;
    showLandingPrompt(msg);
  }

  if (msg.type === MSG_CHAT_BROADCAST) {
    appendChatMessage({ from: msg.payload.from, text: msg.payload.text, ts: msg.payload.ts });
  }

  if (msg.type === MSG_CHAT_ERROR) {
    showNotification(msg.error || 'Chat error', 'red');
  }

  if (msg.type === MSG_MISSILE_HIT) {
    const { shooter, target, reward } = msg.payload;
    showNotification(`${shooter} hit ${target}! +$${reward}`, 'yellow');
  }

  if (msg.type === MSG_CLAIM_RESPONSE) {
    if (msg.success) {
      if (msg.planetId) state.ownedPlanets.push(msg.planetId);
      showNotification(msg.message || "Success!", "green");
      state.landingPrompt = null;
    } else {
      showNotification(msg.error, "red");
    }
  }

  if (msg.type === MSG_REFUEL_RESPONSE) {
    if (msg.success) {
      state.myFuel = msg.newFuel;
      showNotification(`Refueled +${msg.fuelAmount}. Cost: $${msg.costDeducted.toFixed(2)}`, msg.costDeducted > 0 ? "yellow" : "green");
    } else {
      showNotification(msg.error, "red");
    }
  }
}
