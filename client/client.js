import { MSG_INPUT, MSG_STATE, MSG_CLAIM_PLANET, MSG_CLAIM_RESPONSE,
   MSG_REFUEL, MSG_REFUEL_RESPONSE, MSG_REVOKE_PLANET, MSG_LANDING_PROMPT,
   MSG_CHAT, MSG_CHAT_BROADCAST, MSG_CHAT_ERROR, MSG_FIRE_MISSILE,
    MSG_MISSILE_UPDATE,  MSG_MISSILE_HIT } from "./shared/messageTypes.js";

import { MAX_FUEL, PLANET_CLAIM_COST, FREE_REFUEL_AMOUNT,
   PAID_REFUEL_AMOUNT, REFUEL_COST_PER_TANK,
    MISSILE_FUEL_COST, MISSILE_CREDIT_COST } from "./shared/constants.js";

console.log("CLIENT LOADED");

let myId = null;
let players = [];
let planets = [];
let missiles = [];
let myName = null;
let myCredits = 0;
let landingPrompt = null;
let ownedPlanets = [];
let missilePreview = false;
let showControls = false;

const planetImageNames = {
  p1: 'sphereplanet.png',      // Terra
  p2: 'dryvenuslikeplanet.png', // Mars
  p3: 'neptunlikeplanet.png',   // Jupiter
  p4: 'dryvenuslikeplanet.png', // Venus
  p5: 'dryhotplanet.png',       // Mercury
  p6: 'iceplanet.png',          // Saturn
  p7: 'iceplanet_2.png',        // Uranus
  p8: 'neptunlikeplanet.png',   // Neptune
  p9: 'iceplanet.png',          // Pluto
  p10: 'moon.png',              // Ceres
  p11: 'shattered_planet.png',  // Eris
  p12: 'iceplanet_2.png',       // Haumea
  p13: 'neptunlikeplanet.png',  // Makemake
  p14: 'moon.png',              // Titan
  p15: 'iceplanet.png',         // Europa
  p16: 'moon.png',              // Ganymede
  p17: 'lava_planet.png',       // Callisto
  p18: 'lava_planet.png',       // Io
  p19: 'iceplanet_2.png',       // Triton
  p20: 'moon.png',              // Charon
  p21: 'machine_world.png',     // Oberon
  p22: 'exoplanet.png',         // Rhea
  p23: 'shattered_planet.png',  // Iapetus
  p24: 'exoplanet.png',         // Dione
  p25: 'sun.png',               // Tethys
  p26: 'iceplanet.png',         // Enceladus
  p27: 'shattered_planet.png',  // Mimas
  p28: 'machine_world.png'      // Hyperion
};

const planetImages = {};

// ===== Auth UI handlers =====
async function doAuth(action) {
  const userEl = document.getElementById('username');
  const passEl = document.getElementById('password');
  const msgEl = document.getElementById('auth-msg');
  const username = userEl?.value?.trim();
  const password = passEl?.value || '';
  
  if (!username || !password) {
    if (msgEl) msgEl.textContent = 'Please enter username and password';
    return;
  }

  try {
    console.log(`Attempting to ${action}...`);
    const res = await fetch(`http://localhost:3000/${action}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password })
    });

    const data = await res.json();
    console.log(`${action} response:`, data);
    
    if (!res.ok) {
      if (msgEl) msgEl.textContent = data.error || 'Auth failed';
      return;
    }

    // success: data contains playerId and username
    myName = data.username || username;
    if (msgEl) msgEl.textContent = 'Authenticated, connecting...';
    connectSocket(data.playerId);
  } catch (err) {
    console.error('Auth error', err);
    const msgEl2 = document.getElementById('auth-msg');
    if (msgEl2) msgEl2.textContent = 'Auth failed: ' + err.message;
  }
}

// Attach handlers to buttons with preventDefault
const loginBtn = document.getElementById('btn-login');
const registerBtn = document.getElementById('btn-register');
if (loginBtn) {
  loginBtn.addEventListener('click', (e) => {
    e.preventDefault();
    doAuth('login');
  });
}
if (registerBtn) {
  registerBtn.addEventListener('click', (e) => {
    e.preventDefault();
    doAuth('register');
  });
}

const canvas = document.getElementById("game");
let myFuel = MAX_FUEL;
const ctx = canvas.getContext("2d");

// Responsive canvas sizing
function resizeCanvas() {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
}

resizeCanvas();
window.addEventListener("resize", resizeCanvas);

// networking
let socket = null;

function connectSocket(playerId) {
  socket = new WebSocket("ws://localhost:8080");
  socket.onopen = () => {
    console.log("WS CONNECTED");
    // authenticate over WS
    socket.send(JSON.stringify({ type: 'auth', payload: { playerId } }));
    setInterval(() => {
      if (socket.readyState === 1) {
        socket.send(JSON.stringify({
          type: MSG_INPUT,
          payload: input
        }));
        if (input.missile) {
          socket.send(JSON.stringify({ type: MSG_FIRE_MISSILE }));
          input.missile = false;
        }
      }
    }, 50);
  };
  socket.onmessage = socketOnMessage;
}

// input
const input = { thrust: false, rotate: 0, missile: false };

const chatProfanity = ['fuck','shit','bitch','asshole','damn','dick','pussy'];

function createChatWidget() {
  const existing = document.getElementById('chat-widget');
  if (existing) return;

  const widget = document.createElement('div');
  widget.id = 'chat-widget';
  widget.style.cssText = `
    position: fixed;
    right: 15px;
    top: 15px;
    width: 280px;
    max-height: 420px;
    background: rgba(0,0,0,0.7);
    border: 1px solid #777;
    border-radius: 6px;
    color: #fff;
    font-family: monospace;
    z-index: 1100;
    overflow: hidden;
    transition: all 0.16s ease;
    opacity: 0.96;
  `;

  const title = document.createElement('div');
  title.textContent = 'Chat (hover to type)';
  title.style.cssText = 'padding: 8px 10px; border-bottom: 1px solid #444; font-size: 12px;';

  const msgArea = document.createElement('div');
  msgArea.id = 'chat-msg-area';
  msgArea.style.cssText = 'padding: 8px; height: 270px; overflow-y: auto; font-size: 12px;';

  const inputContainer = document.createElement('div');
  inputContainer.style.cssText = 'display: none; padding: 8px; border-top: 1px solid #444;';
  inputContainer.id = 'chat-input-container';

  const inputEl = document.createElement('input');
  inputEl.id = 'chat-input';
  inputEl.placeholder = 'Type message and press Enter...';
  inputEl.style.cssText = 'width: 100%; padding: 6px; background:#111; color:#fff; border:1px solid #555; border-radius:3px;';

  inputContainer.appendChild(inputEl);
  widget.appendChild(title);
  widget.appendChild(msgArea);
  widget.appendChild(inputContainer);

  widget.addEventListener('mouseenter', () => {
    inputContainer.style.display = 'block';
    widget.style.boxShadow = '0 0 16px rgba(255,255,255,0.25)';
  });
  widget.addEventListener('mouseleave', () => {
    inputContainer.style.display = 'none';
    widget.style.boxShadow = 'none';
  });

  inputEl.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      const text = inputEl.value.trim();
      if (!text) return;
      const hasProfanity = chatProfanity.some(word => new RegExp('\\b' + word + '\\b', 'i').test(text));
      if (hasProfanity) {
        showNotification('Profanity blocked.', 'red');
        inputEl.value = '';
        return;
      }
      if (socket && socket.readyState === 1) {
        socket.send(JSON.stringify({ type: MSG_CHAT, payload: { text } }));
      }
      inputEl.value = '';
    }
  });

  document.body.appendChild(widget);
}

function appendChatMessage({ from, text, ts, system }) {
  const msgArea = document.getElementById('chat-msg-area');
  if (!msgArea) return;

  const line = document.createElement('div');
  line.style.cssText = 'margin-bottom: 4px;';

  const time = new Date(ts || Date.now()).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'});
  if (system) {
    line.textContent = `[${time}] ${text}`;
    line.style.color = '#ffa500';
  } else {
    line.textContent = `[${time}] ${from}: ${text}`;
  }
  msgArea.appendChild(line);
  msgArea.scrollTop = msgArea.scrollHeight;
}

// ================= GAMEPAD SUPPORT =================

// Gamepad state
let gamepadConnected = false;
let lastGamepadState = {
  leftStickX: 0,
  leftTrigger: 0,
  rightTrigger: 0,
  xButton: false,
  yButton: false,
  bButton: false,
  aButton: false,
  startButton: false
};

function updateGamepadInput() {
  const gamepads = navigator.getGamepads();
  const gamepad = gamepads[0]; // Use first connected gamepad
  
  if (!gamepad) {
    if (gamepadConnected) {
      console.log("Gamepad disconnected");
      gamepadConnected = false;
      // Reset inputs when gamepad disconnects
      input.rotate = 0;
      input.thrust = false;
      input.brake = false;
      input.missile = false;
      missilePreview = false;
    }
    return;
  }
  
  if (!gamepadConnected) {
    console.log("Gamepad connected:", gamepad.id);
    gamepadConnected = true;
  }
  
  // Left stick X-axis for steering (with deadzone)
  const leftStickX = gamepad.axes[0];
  const deadzone = 0.1;
  if (Math.abs(leftStickX) > deadzone) {
    input.rotate = leftStickX; // -1 to 1
  } else {
    input.rotate = 0;
  }
  
  // Left trigger for brake
  const leftTrigger = gamepad.buttons[6].value; // 0 to 1
  input.brake = leftTrigger > 0.1;
  
  // Left bumper (LB) for missile preview
  const leftBumper = gamepad.buttons[4].pressed;
  missilePreview = leftBumper;
  
  // Right trigger for thrust
  const rightTrigger = gamepad.buttons[7].value; // 0 to 1
  input.thrust = rightTrigger > 0.1;
  
  // X button for fire (only trigger on press, not hold)
  const xButtonPressed = gamepad.buttons[2].pressed;
  if (xButtonPressed && !lastGamepadState.xButton) {
    input.missile = true;
  }
  // Note: Don't set missile to false here - let the network code handle it
  
  // Start button for controls toggle
  const startButtonPressed = gamepad.buttons[8].pressed;
  if (startButtonPressed && !lastGamepadState.startButton) {
    showControls = !showControls;
  }
  
  // Handle landing dialog gamepad controls
  if (landingPrompt) {
    // Y button (button 3) for refuel
    const yButtonPressed = gamepad.buttons[3].pressed;
    if (yButtonPressed && !lastGamepadState.yButton) {
      handleLandingDialogAction('refuel');
    }
    
    // B button (button 1) for revoke (only if player owns the planet)
    const bButtonPressed = gamepad.buttons[1].pressed;
    if (bButtonPressed && !lastGamepadState.bButton && landingPrompt.isOwned && landingPrompt.isOwner) {
      handleLandingDialogAction('revoke');
    }
    
    // A button (button 0) for close dialog
    const aButtonPressed = gamepad.buttons[0].pressed;
    if (aButtonPressed && !lastGamepadState.aButton) {
      dismissDialog();
    }
    
    // Update last state for dialog buttons
    lastGamepadState.yButton = yButtonPressed;
    lastGamepadState.bButton = bButtonPressed;
    lastGamepadState.aButton = aButtonPressed;
  }
  
  // Update last state
  lastGamepadState.leftStickX = leftStickX;
  lastGamepadState.leftTrigger = leftTrigger;
  lastGamepadState.rightTrigger = rightTrigger;
  lastGamepadState.xButton = xButtonPressed;
  lastGamepadState.startButton = startButtonPressed;
}

// Listen for gamepad connection events
window.addEventListener("gamepadconnected", (e) => {
  console.log("Gamepad connected:", e.gamepad.id);
  gamepadConnected = true;
});

window.addEventListener("gamepaddisconnected", (e) => {
  console.log("Gamepad disconnected:", e.gamepad.id);
  gamepadConnected = false;
  // Reset inputs
  input.rotate = 0;
  input.thrust = false;
  input.brake = false;
  input.missile = false;
});

// ================= INPUT =================

window.addEventListener("keydown", e => {
  if (e.key === "w") input.thrust = true;
  if (e.key === "a") input.rotate = -1;
  if (e.key === "d") input.rotate = 1;
  if (e.key === "s") input.brake = true;
  if (e.key === "f") input.missile = true;
  if (e.key === "q" || e.key === "Q") missilePreview = true;
  if (e.key === "F1") {
    e.preventDefault();
    showControls = !showControls;
  }
});

window.addEventListener("keyup", e => {
  if (e.key === "w") input.thrust = false;
  if (e.key === "a" || e.key === "d") input.rotate = 0;
  if (e.key === "s") input.brake = false;
  if (e.key === "f") input.missile = false;
  if (e.key === "q" || e.key === "Q") missilePreview = false;
});

// ================= NETWORK =================

function socketOnMessage(e) {
  const msg = JSON.parse(e.data);

  if (msg.type === "init") {
    myId = msg.id;
    myName = msg.username || myId;
    console.log("MY ID:", myId);
    // hide login
    document.getElementById('login-root').style.display = 'none';
    createChatWidget();
    appendChatMessage({ system: true, text: 'Chat ready!', ts: Date.now() });
  }

  if (msg.type === MSG_STATE) {
    players = msg.payload.players;
    planets = msg.payload.planets;
    missiles = msg.payload.missiles || [];
    
    // Load planet images if not already loaded
    for (const p of planets) {
      if (!planetImages[p.id]) {
        planetImages[p.id] = new Image();
        planetImages[p.id].src = `./assets/planets/${planetImageNames[p.id] || 'sphereplanet.png'}`;
      }
    }
    
    // Update my fuel and credits
    const myPlayer = players.find(p => p.id === myId);
    if (myPlayer) {
      myFuel = myPlayer.fuel;
      myCredits = myPlayer.credits;
      myName = myPlayer.username || myName;
    }
  }

  if (msg.type === MSG_LANDING_PROMPT) {
    landingPrompt = msg;
    showLandingPrompt(msg);
  }

  if (msg.type === MSG_CHAT_BROADCAST) {
    appendChatMessage({ from: msg.payload.from, text: msg.payload.text, ts: msg.payload.ts });
  }

  if (msg.type === MSG_CHAT_ERROR) {
    showNotification(msg.error || 'Chat error', 'red');
  }

  if (msg.type === MSG_MISSILE_HIT) {
    const { shooter, target, reward, damageFuel, damageCredits } = msg.payload;
    showNotification(`${shooter} hit ${target}! +$${reward}`, 'yellow');
  }

  if (msg.type === MSG_CLAIM_RESPONSE) {
    if (msg.success) {
      if (msg.planetId) ownedPlanets.push(msg.planetId);
      showNotification(msg.message || "Success!", "green");
      if (landingPrompt) landingPrompt = null;
    } else {
      showNotification(msg.error, "red");
    }
  }

  if (msg.type === MSG_REFUEL_RESPONSE) {
    if (msg.success) {
      myFuel = msg.newFuel;
      showNotification(`Refueled +${msg.fuelAmount}. Cost: $${msg.costDeducted.toFixed(2)}`, msg.costDeducted > 0 ? "yellow" : "green");
    } else {
      showNotification(msg.error, "red");
    }
  }
}


// ================= RENDER HELPERS =================

function showNotification(text, color = "white") {
  const notif = document.createElement("div");
  notif.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
    background: #000;
    color: ${color};
    padding: 10px 15px;
    border: 1px solid ${color};
    z-index: 1000;
    font-family: monospace;
    font-size: 12px;
  `;
  notif.textContent = text;
  document.body.appendChild(notif);
  setTimeout(() => notif.remove(), 3000);
}

function showLandingPrompt(prompt) {
  // Remove existing prompt if any
  const existing = document.getElementById("landing-dialog");
  if (existing) existing.remove();

  // Safely handle credits - use currentCredits from server, fallback to myCredits
  const credits = typeof prompt.currentCredits === 'number' ? prompt.currentCredits : (typeof myCredits === 'number' ? myCredits : 0);
  const creditsDisplay = `$${Math.floor(credits)}`;

  const dialog = document.createElement("div");
  dialog.id = "landing-dialog";
  dialog.style.cssText = `
    position: fixed;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    background: #000;
    border: 1px solid #fff;
    padding: 15px;
    z-index: 999;
    min-width: 250px;
    font-family: monospace;
    color: #fff;
  `;

  let content = `<div style="margin-bottom: 10px;"><strong>${prompt.planetName}</strong></div>`;
  
  if (prompt.isOwned && prompt.isOwner) {
    content += `<div style="font-size:12px;margin-bottom:10px;">Your planet - Free refuel available</div>
                <button id="btn-refuel-own" style="width:100%;padding:5px;margin-bottom:5px;background:#000;color:#0f0;border:1px solid #0f0;cursor:pointer;">Refuel Free${gamepadConnected ? ' (Y)' : ''}</button>
                <button id="btn-revoke" style="width:100%;padding:5px;margin-bottom:5px;background:#000;color:#f00;border:1px solid #f00;cursor:pointer;">Revoke${gamepadConnected ? ' (B)' : ''}</button>`;
  } else if (prompt.isOwned && !prompt.isOwner) {
    content += `<div style="font-size:12px;margin-bottom:10px;">Owned by: ${prompt.owner} | Rent: $${prompt.rentPaid}</div>
                <div style="font-size:12px;margin-bottom:10px;color:#ff0;">Credits: ${creditsDisplay}</div>
                <button id="btn-refuel-paid" style="width:100%;padding:5px;margin-bottom:5px;background:#000;color:#ff0;border:1px solid #ff0;cursor:pointer;">Refuel $${REFUEL_COST_PER_TANK}${gamepadConnected ? ' (Y)' : ''}</button>`;
  } else {
    const canClaim = credits >= prompt.claimCost;
    content += `<div style="font-size:12px;margin-bottom:10px;">Unclaimed - Claim for $${prompt.claimCost}</div>`;
    content += `<div style="font-size:12px;margin-bottom:10px;color:#ff0;">Credits: ${creditsDisplay}</div>`;
    if (canClaim) {
      content += `<button id="btn-claim" style="width:100%;padding:5px;margin-bottom:5px;background:#000;color:#0f0;border:1px solid #0f0;cursor:pointer;">Claim Planet</button>`;
    } else {
      content += `<div style="font-size:12px;color:#f00;margin-bottom:5px;">Need $${prompt.claimCost - Math.floor(credits)} more</div>`;
    }
    content += `<button id="btn-refuel-paid" style="width:100%;padding:5px;margin-bottom:5px;background:#000;color:#ff0;border:1px solid #ff0;cursor:pointer;">Refuel $${REFUEL_COST_PER_TANK}${gamepadConnected ? ' (Y)' : ''}</button>`;
  }

  content += `<button id="btn-close" style="width:100%;padding:5px;background:#000;color:#aaa;border:1px solid #aaa;cursor:pointer;">Close${gamepadConnected ? ' (A)' : ''}</button>`;
  dialog.innerHTML = content;
  document.body.appendChild(dialog);

  // Attach event listeners
  const btnClaim = document.getElementById("btn-claim");
  if (btnClaim) {
    btnClaim.addEventListener("click", () => {
      socket.send(JSON.stringify({
        type: MSG_CLAIM_PLANET,
        payload: { planetId: prompt.planetId }
      }));
      dismissDialog();
    });
  }

  const btnRefuelOwn = document.getElementById("btn-refuel-own");
  if (btnRefuelOwn) {
    btnRefuelOwn.addEventListener("click", () => {
      socket.send(JSON.stringify({
        type: MSG_REFUEL,
        payload: { amount: FREE_REFUEL_AMOUNT, isOwned: true }
      }));
      dismissDialog();
    });
  }

  const btnRefuelPaid = document.getElementById("btn-refuel-paid");
  if (btnRefuelPaid) {
    btnRefuelPaid.addEventListener("click", () => {
      socket.send(JSON.stringify({
        type: MSG_REFUEL,
        payload: { amount: PAID_REFUEL_AMOUNT, isOwned: false }
      }));
      dismissDialog();
    });
  }

  const btnRevoke = document.getElementById("btn-revoke");
  if (btnRevoke) {
    btnRevoke.addEventListener("click", () => {
      socket.send(JSON.stringify({
        type: MSG_REVOKE_PLANET,
        payload: { planetId: prompt.planetId }
      }));
      dismissDialog();
    });
  }

  const btnClose = document.getElementById("btn-close");
  if (btnClose) {
    btnClose.addEventListener("click", dismissDialog);
  }
}

function dismissDialog() {
  const dialog = document.getElementById("landing-dialog");
  if (dialog) dialog.remove();
  landingPrompt = null;
}

function handleLandingDialogAction(action) {
  if (!landingPrompt || !socket) return;
  
  if (action === 'refuel') {
    if (landingPrompt.isOwned && landingPrompt.isOwner) {
      // Free refuel for owned planets
      socket.send(JSON.stringify({
        type: MSG_REFUEL,
        payload: { amount: FREE_REFUEL_AMOUNT, isOwned: true }
      }));
    } else {
      // Paid refuel
      socket.send(JSON.stringify({
        type: MSG_REFUEL,
        payload: { amount: PAID_REFUEL_AMOUNT, isOwned: false }
      }));
    }
    dismissDialog();
  } else if (action === 'revoke' && landingPrompt.isOwned && landingPrompt.isOwner) {
    socket.send(JSON.stringify({
      type: MSG_REVOKE_PLANET,
      payload: { planetId: landingPrompt.planetId }
    }));
    dismissDialog();
  }
}

function drawControlsScreen() {
  // Semi-transparent overlay
  ctx.fillStyle = "rgba(0, 0, 0, 0.9)";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  
  // Title
  ctx.fillStyle = "#fff";
  ctx.font = "bold 24px monospace";
  ctx.textAlign = "center";
  ctx.fillText("CONTROLS", canvas.width / 2, 50);
  
  // Subtitle
  ctx.font = "16px monospace";
  ctx.fillText("Press F1 or Start to toggle", canvas.width / 2, 80);
  
  ctx.textAlign = "left";
  ctx.font = "14px monospace";
  
  const leftX = 50;
  const rightX = canvas.width / 2 + 50;
  let yPos = 120;
  const lineHeight = 25;
  
  // Movement Controls
  ctx.fillStyle = "#4af";
  ctx.fillText("MOVEMENT", leftX, yPos);
  ctx.fillText("MOVEMENT", rightX, yPos);
  yPos += lineHeight;
  
  ctx.fillStyle = "#fff";
  ctx.fillText("W - Thrust/Accelerate", leftX, yPos);
  ctx.fillText("Right Trigger (RT) - Thrust", rightX, yPos);
  yPos += lineHeight;
  
  ctx.fillText("S - Brake", leftX, yPos);
  ctx.fillText("Left Trigger (LT) - Brake", rightX, yPos);
  yPos += lineHeight;
  
  ctx.fillText("A/D - Turn Left/Right", leftX, yPos);
  ctx.fillText("Left Stick - Steering", rightX, yPos);
  yPos += lineHeight * 1.5;
  
  // Combat Controls
  ctx.fillStyle = "#4af";
  ctx.fillText("COMBAT", leftX, yPos);
  ctx.fillText("COMBAT", rightX, yPos);
  yPos += lineHeight;
  
  ctx.fillStyle = "#fff";
  ctx.fillText("F - Fire Missile", leftX, yPos);
  ctx.fillText("X Button - Fire Missile", rightX, yPos);
  yPos += lineHeight;
  
  ctx.fillText("Q - Missile Preview", leftX, yPos);
  ctx.fillText("Left Bumper (LB) - Preview", rightX, yPos);
  yPos += lineHeight * 1.5;
  
  // Planet Interaction
  ctx.fillStyle = "#4af";
  ctx.fillText("PLANET INTERACTION", leftX, yPos);
  ctx.fillText("PLANET INTERACTION", rightX, yPos);
  yPos += lineHeight;
  
  ctx.fillStyle = "#fff";
  ctx.fillText("(When landed on planet)", leftX, yPos);
  ctx.fillText("(When landed on planet)", rightX, yPos);
  yPos += lineHeight;
  
  ctx.fillText("Click buttons or:", leftX, yPos);
  ctx.fillText("Y - Refuel", rightX, yPos);
  yPos += lineHeight;
  
  ctx.fillText("", leftX, yPos);
  ctx.fillText("B - Revoke (if owned)", rightX, yPos);
  yPos += lineHeight;
  
  ctx.fillText("", leftX, yPos);
  ctx.fillText("A - Close Dialog", rightX, yPos);
  yPos += lineHeight * 1.5;
  
  // Other
  ctx.fillStyle = "#4af";
  ctx.fillText("OTHER", leftX, yPos);
  ctx.fillText("OTHER", rightX, yPos);
  yPos += lineHeight;
  
  ctx.fillStyle = "#fff";
  ctx.fillText("F1 - Toggle Controls", leftX, yPos);
  ctx.fillText("Start Button - Toggle", rightX, yPos);
  yPos += lineHeight;
  
  ctx.fillText("Chat: Click widget", leftX, yPos);
  ctx.fillText("", rightX, yPos);
}

const shipImg = new Image();
shipImg.src = "./assets/ships/player_ship_idle.png";

const shipImgThr = new Image();
shipImgThr.src = "./assets/ships/player_ship.png";

const otherImg = new Image();
otherImg.src = "./assets/ships/other_ship_idle.png";

shipImg.onload = () => console.log("SHIP IMAGE LOADED");
shipImg.onerror = () => console.log("SHIP IMAGE FAILED");

// function drawShip(p) {
//   ctx.save();
//   ctx.translate(p.x, p.y);
//   ctx.rotate(p.rot || 0);

//   // ship body
//   ctx.beginPath();
//   ctx.moveTo(18,0);
//   ctx.lineTo(-10,10);
//   ctx.lineTo(-6,0);
//   ctx.lineTo(-10,-10);
//   ctx.closePath();

//   ctx.strokeStyle = p.id === myId ? "#0ff" : "#fff";
//   ctx.lineWidth = 2;
//   ctx.stroke();

//   // engine glow
//   if (p.thrust) {
//     ctx.beginPath();
//     ctx.moveTo(-10,4);
//     ctx.lineTo(-18,0);
//     ctx.lineTo(-10,-4);
//     ctx.strokeStyle = "orange";
//     ctx.stroke();
//   }

//   ctx.restore();
// }

function drawShip(p) {
  if (!shipImg.complete || !shipImgThr.complete) return;

  ctx.save();
  ctx.translate(p.x, p.y);
  ctx.rotate((p.rot || 0) + Math.PI / 2);

  const size = 80;
  if(p.id !== myId){
    ctx.drawImage(otherImg, -size/2, -size/2, size, size);
    ctx.restore();
    return;
  }
  // determine thrust visually
  const thrusting = (p.id === myId) ? input.thrust : p.thrust;

  if (!thrusting) {
    ctx.drawImage(shipImg, -size/2, -size/2, size, size);
  } else {
    ctx.drawImage(shipImgThr, -size/2, -size/2, size, size);
  }

  // Draw missile preview line when holding Q or LT
  if (missilePreview) {
    ctx.strokeStyle = "rgba(255, 255, 255, 0.3)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, -size/2); // Start from front of ship
    ctx.lineTo(0, -size/2 - 60); // Draw line forward (60 pixels length)
    ctx.stroke();
  }

  ctx.restore();
}
function drawMissile(m) {
  ctx.save();
  ctx.translate(m.x, m.y);
  const angle = Math.atan2(m.vy, m.vx);
  ctx.rotate(angle);
  ctx.beginPath();
  ctx.moveTo(10, 0);
  ctx.lineTo(-5, -3);
  ctx.lineTo(-5, 3);
  ctx.closePath();
  ctx.fillStyle = "#ff0000";
  ctx.fill();
  ctx.restore();
}
function drawPlanet(p) {
  const img = planetImages[p.id];
  if (img && img.complete && img.naturalHeight !== 0) {
    // Draw only the planet image when loaded
    ctx.save();
    ctx.translate(p.x, p.y);
    let size;
    if (p.id === 'p1') {
      size = p.r * 4 + 3; // Twice the size for Terra due to ring, plus extra
    } else {
      size = p.r * 2 + 3; // Standard size plus extra
    }
    ctx.drawImage(img, -size/2, -size/2, size, size);
    ctx.restore();
  } else {
    // Fallback to drawing circle with shadow and border
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
    ctx.shadowBlur = 20;
    ctx.shadowColor = ctx.strokeStyle;
    ctx.stroke();
    ctx.shadowBlur = 0;
    
    if (p.owner) {
      ctx.strokeStyle = p.owner === myId ? "#0f0" : "#f0f";
    } else {
      ctx.strokeStyle = "#4af";
    }
    ctx.lineWidth = 3;
    ctx.stroke();
  }

  // Draw planet name and owner
  ctx.save();
  ctx.fillStyle = p.owner === myId ? "#0f0" : p.owner ? "#f0f" : "#4af";
  ctx.font = "12px monospace";
  ctx.textAlign = "center";
  ctx.fillText(p.name, p.x, p.y - p.r - 15);
  
  if (p.owner) {
    ctx.font = "10px monospace";
    ctx.fillStyle = p.owner === myId ? "#0f0" : "#f0f";
    ctx.fillText(`[${p.ownerUsername || "?"}]`, p.x, p.y - p.r - 3);
  }
  ctx.restore();
}

const stars = [];
const numStars = 200;
const parallaxLayers = [
  { factor: 0.1, count: Math.floor(numStars * 0.4), color: '#aaa', size: 1 }, // Far layer
  { factor: 0.5, count: Math.floor(numStars * 0.4), color: '#ddd', size: 1.5 }, // Medium layer
  { factor: 1.0, count: numStars - Math.floor(numStars * 0.8), color: '#fff', size: 2 }  // Close layer
];

for (const layer of parallaxLayers) {
  for (let i = 0; i < layer.count; i++) {
    stars.push({
      x: Math.random() * 4000 - 2000,
      y: Math.random() * 4000 - 2000,
      layer: layer.factor,
      color: layer.color,
      size: Math.random() * layer.size + 0.5
    });
  }
}
// ================= MAIN LOOP =================

function loop() {
  // Update gamepad input
  updateGamepadInput();
  
  ctx.clearRect(0, 0, canvas.width, canvas.height); 

  // ---- HUD Panel (screen space) ----
  const hudX = 10;
  const hudY = 10;
  const hudW = 200;
  const hudH = 160;
  
  // HUD background panel
  ctx.fillStyle = "rgba(0, 0, 0, 0.8)";
  ctx.fillRect(hudX, hudY, hudW, hudH);
  
  // HUD border
  ctx.strokeStyle = "#fff";
  ctx.lineWidth = 1;
  ctx.strokeRect(hudX, hudY, hudW, hudH);
  
  // HUD content
  ctx.textAlign = "left";
  ctx.fillStyle = "#fff";
  ctx.font = "11px monospace";
  
  let yPos = hudY + 12;
  const lineHeight = 16;
  
  // Player name
  ctx.fillText(`Player: ${myName}`, hudX + 10, yPos);
  yPos += lineHeight;
  
  // Credits
  ctx.fillStyle = "#ffff00";
  ctx.fillText(`Credits: $${Math.floor(myCredits)}`, hudX + 10, yPos);
  yPos += lineHeight;
  
  // Fuel bar with percentage
  const fuelPercent = Math.floor((myFuel / MAX_FUEL) * 100);
  ctx.fillStyle = "#fff";
  ctx.fillText(`Fuel: ${fuelPercent}%`, hudX + 10, yPos);
  
  // Draw fuel bar
  const barW = 90;
  const barH = 8;
  const barX = hudX + 80;
  const barY = yPos - 10;
  
  ctx.fillStyle = "#333";
  ctx.fillRect(barX, barY, barW, barH);
  ctx.strokeStyle = "#fff";
  ctx.lineWidth = 1;
  ctx.strokeRect(barX, barY, barW, barH);
  
  // Fuel bar fill color based on level
  if (fuelPercent > 50) {
    ctx.fillStyle = "#0f0";
  } else if (fuelPercent > 25) {
    ctx.fillStyle = "#ff0";
  } else {
    ctx.fillStyle = "#f00";
  }
  ctx.fillRect(barX, barY, (fuelPercent / 100) * barW, barH);
  
  yPos += lineHeight;
  
  // Players count
  ctx.fillStyle = "#fff";
  ctx.fillText(`Players: ${players.length}`, hudX + 10, yPos);
  yPos += lineHeight;
  
  // Owned planets
  if (ownedPlanets.length > 0) {
    ctx.fillStyle = "#0f0";
    ctx.fillText(`Owned: ${ownedPlanets.length}`, hudX + 10, yPos);
  } else {
    ctx.fillStyle = "#888";
    ctx.fillText(`Owned: 0`, hudX + 10, yPos);
  }

  yPos += lineHeight;

  // Missiles info
  ctx.fillStyle = "#fff";
  ctx.fillText(`Missiles: ${missiles.length}`, hudX + 10, yPos);
  yPos += lineHeight;
  ctx.fillStyle = "#ff0";
  ctx.fillText(`Fire: F (${MISSILE_FUEL_COST} fuel, $${MISSILE_CREDIT_COST})`, hudX + 10, yPos);

  yPos += lineHeight;
  
  // Gamepad status
  if (gamepadConnected) {
    ctx.fillStyle = "#0f0";
    ctx.fillText(`Gamepad: Connected`, hudX + 10, yPos);
  } else {
    ctx.fillStyle = "#666";
    ctx.fillText(`Gamepad: None`, hudX + 10, yPos);
  }

  if (players.length === 0) {
    requestAnimationFrame(loop);
    return;
  }

  // camera target
  const camTarget =
    players.find(p => p.id === myId) || players[0];

  // WORLD SPACE 
  ctx.save();
  ctx.translate(
    canvas.width / 2 - camTarget.x,
    canvas.height / 2 - camTarget.y
  );

  // Draw parallax stars
  for (const s of stars) {
    const parallaxX = camTarget.x * (1 - s.layer);
    const parallaxY = camTarget.y * (1 - s.layer);
    ctx.fillStyle = s.color;
    ctx.fillRect(s.x + parallaxX, s.y + parallaxY, s.size, s.size);
  }

  for (const pl of planets) {
    drawPlanet(pl);
  }

  // draw ships
  for (const p of players) {
    drawShip(p);
  }

  // draw missiles
  for (const m of missiles) {
    drawMissile(m);
  }

  ctx.restore();

  // Draw controls screen if enabled
  if (showControls) {
    drawControlsScreen();
  }

  requestAnimationFrame(loop);
}


loop();
