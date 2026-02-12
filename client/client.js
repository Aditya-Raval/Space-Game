import { MSG_INPUT, MSG_STATE } from "./shared/messageTypes.js";
import { MAX_FUEL } from "./shared/constants.js";

console.log("CLIENT LOADED");

let myId = null;
let players = [];
let planets = [];
let myName = null;
let myCredits = 0;

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
    const res = await fetch(`http://localhost:3000/${action}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password })
    });

    const data = await res.json();
    if (!res.ok) {
      if (msgEl) msgEl.textContent = data.error || 'Auth failed';
      return;
    }

    // success: data contains playerId and username
    myName = data.username || username;
    if (msgEl) msgEl.textContent = 'Authenticated, connecting...';
    connectSocket(data.playerId);
  } catch (err) {
    const msgEl2 = document.getElementById('auth-msg');
    if (msgEl2) msgEl2.textContent = 'Auth server unreachable';
    console.error('Auth error', err);
  }
}

// Attach handlers to buttons if present
const loginBtn = document.getElementById('btn-login');
const registerBtn = document.getElementById('btn-register');
if (loginBtn) loginBtn.addEventListener('click', () => doAuth('login'));
if (registerBtn) registerBtn.addEventListener('click', () => doAuth('register'));

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
      }
    }, 50);
  };
  socket.onmessage = socketOnMessage;
}

// input
const input = { thrust: false, rotate: 0 };

// ================= INPUT =================

window.addEventListener("keydown", e => {
  if (e.key === "w") input.thrust = true;
  if (e.key === "a") input.rotate = -1;
  if (e.key === "d") input.rotate = 1;
  if (e.key === "s") input.brake = true;
});

window.addEventListener("keyup", e => {
  if (e.key === "w") input.thrust = false;
  if (e.key === "a" || e.key === "d") input.rotate = 0;
  if (e.key === "s") input.brake = false;
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
  }

  if (msg.type === MSG_STATE) {
    players = msg.payload.players;
    planets = msg.payload.planets;
    
    // Update my fuel and credits
    const myPlayer = players.find(p => p.id === myId);
    if (myPlayer) {
      myFuel = myPlayer.fuel;
      myCredits = myPlayer.credits;
      myName = myPlayer.username || myName;
    }
  }
}


// ================= RENDER HELPERS =================

function drawShip(p) {
  ctx.save();
  ctx.translate(p.x, p.y);
  ctx.rotate(p.rot || 0);

  ctx.beginPath();
  ctx.moveTo(15, 0);
  ctx.lineTo(-10, 8);
  ctx.lineTo(-10, -8);
  ctx.closePath();

  ctx.strokeStyle = p.id === myId ? "cyan" : "white";
  ctx.lineWidth = 2;
  ctx.stroke();

  ctx.restore();
}

function drawPlanet(p) {
  ctx.beginPath();
  ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
  ctx.strokeStyle = "#4af";
  ctx.lineWidth = 3;
  ctx.stroke();
}

// ================= MAIN LOOP =================

function loop() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // ---- UI (screen space) ----
  ctx.fillStyle = "white";
  ctx.font = "18px monospace";
  ctx.fillText(`PLAYERS: ${players.length}`, 20, 30);
  ctx.fillText(`MY ID: ${myId ?? "null"}`, 20, 55);
  ctx.fillText(`USER: ${myName ?? "guest"}`, 20, 80);
  // Fuel bar visual (drawn first)
  const fuelPercentage = (myFuel / MAX_FUEL) * 100;
  ctx.strokeStyle = "#0f0";
  ctx.strokeRect(20, 95, 200, 20);
  ctx.fillStyle = fuelPercentage > 25 ? "hsl(120, 100%, 39%)" : "#f00";
  ctx.fillRect(20, 95, (fuelPercentage / 100) * 200, 20);

  // Draw fuel and credits text on top of the bar
  ctx.fillStyle = "white";
  ctx.fillText(`FUEL: ${myFuel.toFixed(1)}/${MAX_FUEL}`, 40, 110);
  ctx.fillStyle = "hsl(120, 100%, 45%)"; // credits in green with $ prefix
  ctx.fillText(`CREDITS: $${myCredits}`, 20, 140);

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

  ctx.restore();

  requestAnimationFrame(loop);
}

loop();
