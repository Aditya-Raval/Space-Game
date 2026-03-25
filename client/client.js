import { MSG_INPUT, MSG_STATE, MSG_CLAIM_PLANET, MSG_CLAIM_RESPONSE, MSG_REFUEL, MSG_REFUEL_RESPONSE, MSG_REVOKE_PLANET, MSG_LANDING_PROMPT, MSG_CHAT, MSG_CHAT_BROADCAST, MSG_CHAT_ERROR, MSG_FIRE_MISSILE, MSG_MISSILE_UPDATE, MSG_MISSILE_HIT } from "./shared/messageTypes.js";
import { MAX_FUEL, PLANET_CLAIM_COST, FREE_REFUEL_AMOUNT, PAID_REFUEL_AMOUNT, REFUEL_COST_PER_TANK, MISSILE_FUEL_COST, MISSILE_CREDIT_COST } from "./shared/constants.js";

console.log("CLIENT LOADED");

let myId = null;
let players = [];
let planets = [];
let missiles = [];
let myName = null;
let myCredits = 0;
let landingPrompt = null;
let ownedPlanets = [];

const planetImageNames = {
  p1: 'sphereplanet.png',      // Terra
  p2: 'dryvenuslikeplanet.png', // Mars
  p3: 'neptunlikeplanet.png',   // Jupiter
  p4: 'dryvenuslikeplanet.png', // Venus
  p5: 'dryhotplanet.png',       // Mercury
  p6: 'iceplanet.png',          // Saturn
  p7: 'iceplanet_2.png',        // Uranus
  p8: 'neptunlikeplanet.png'    // Neptune
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

// ================= INPUT =================

window.addEventListener("keydown", e => {
  if (e.key === "w") input.thrust = true;
  if (e.key === "a") input.rotate = -1;
  if (e.key === "d") input.rotate = 1;
  if (e.key === "s") input.brake = true;
  if (e.key === "f") input.missile = true;
});

window.addEventListener("keyup", e => {
  if (e.key === "w") input.thrust = false;
  if (e.key === "a" || e.key === "d") input.rotate = 0;
  if (e.key === "s") input.brake = false;
  if (e.key === "f") input.missile = false;
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
                <button id="btn-refuel-own" style="width:100%;padding:5px;margin-bottom:5px;background:#000;color:#0f0;border:1px solid #0f0;cursor:pointer;">Refuel Free</button>
                <button id="btn-revoke" style="width:100%;padding:5px;margin-bottom:5px;background:#000;color:#f00;border:1px solid #f00;cursor:pointer;">Revoke</button>`;
  } else if (prompt.isOwned && !prompt.isOwner) {
    content += `<div style="font-size:12px;margin-bottom:10px;">Owned by: ${prompt.owner} | Rent: $${prompt.rentPaid}</div>
                <div style="font-size:12px;margin-bottom:10px;color:#ff0;">Credits: ${creditsDisplay}</div>
                <button id="btn-refuel-paid" style="width:100%;padding:5px;margin-bottom:5px;background:#000;color:#ff0;border:1px solid #ff0;cursor:pointer;">Refuel $${REFUEL_COST_PER_TANK}</button>`;
  } else {
    const canClaim = credits >= prompt.claimCost;
    content += `<div style="font-size:12px;margin-bottom:10px;">Unclaimed - Claim for $${prompt.claimCost}</div>`;
    content += `<div style="font-size:12px;margin-bottom:10px;color:#ff0;">Credits: ${creditsDisplay}</div>`;
    if (canClaim) {
      content += `<button id="btn-claim" style="width:100%;padding:5px;margin-bottom:5px;background:#000;color:#0f0;border:1px solid #0f0;cursor:pointer;">Claim Planet</button>`;
    } else {
      content += `<div style="font-size:12px;color:#f00;margin-bottom:5px;">Need $${prompt.claimCost - Math.floor(credits)} more</div>`;
    }
    content += `<button id="btn-refuel-paid" style="width:100%;padding:5px;margin-bottom:5px;background:#000;color:#ff0;border:1px solid #ff0;cursor:pointer;">Refuel $${REFUEL_COST_PER_TANK}</button>`;
  }

  content += `<button id="btn-close" style="width:100%;padding:5px;background:#000;color:#aaa;border:1px solid #aaa;cursor:pointer;">Close</button>`;
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
for (let i = 0; i < 200; i++) {
  stars.push({
    x: Math.random() * 4000 - 2000,
    y: Math.random() * 4000 - 2000,
    size: Math.random() * 2
  });
}
// ================= MAIN LOOP =================

function loop() {
  ctx.clearRect(0, 0, canvas.width, canvas.height); 
  for (const s of stars) {
    ctx.fillStyle = "white";
    ctx.fillRect(s.x, s.y, s.size, s.size);
  }

  // ---- HUD Panel (screen space) ----
  const hudX = 10;
  const hudY = 10;
  const hudW = 200;
  const hudH = 140;
  
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

  requestAnimationFrame(loop);
}


loop();
