import { MSG_INPUT, MSG_STATE } from "./shared/messageTypes.js";

console.log("CLIENT LOADED");

let myId = null;
let players = [];
let planets = [];

const canvas = document.getElementById("game");
canvas.width = window.innerWidth;
canvas.height = window.innerHeight;
const ctx = canvas.getContext("2d");

// networking
const socket = new WebSocket("ws://localhost:8080");

// input
const input = { thrust: false, rotate: 0 };

// trails: playerId -> [{x,y}]
const trails = new Map();
const TRAIL_LENGTH = 25;

// ================= INPUT =================

window.addEventListener("keydown", e => {
  if (e.key === "w") input.thrust = true;
  if (e.key === "a") input.rotate = -1;
  if (e.key === "d") input.rotate = 1;
});

window.addEventListener("keyup", e => {
  if (e.key === "w") input.thrust = false;
  if (e.key === "a" || e.key === "d") input.rotate = 0;
});

// ================= NETWORK =================

socket.onopen = () => {
  console.log("WS CONNECTED");
  setInterval(() => {
    socket.send(JSON.stringify({
      type: MSG_INPUT,
      payload: input
    }));
  }, 50);
};

socket.onmessage = e => {
  const msg = JSON.parse(e.data);

  if (msg.type === "init") {
    myId = msg.id;
    console.log("MY ID:", myId);
  }

  if (msg.type === MSG_STATE) {
    players = msg.payload.players;
    planets = msg.payload.planets;
  }
};

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

function drawTrail(playerId) {
  const t = trails.get(playerId);
  if (!t || t.length < 2) return;

  ctx.beginPath();
  ctx.moveTo(t[0].x, t[0].y);
  for (let i = 1; i < t.length; i++) {
    ctx.lineTo(t[i].x, t[i].y);
  }

  ctx.strokeStyle =
    playerId === myId
      ? "rgba(0,255,255,0.5)"
      : "rgba(255,255,255,0.35)";
  ctx.lineWidth = 2;
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

  if (players.length === 0) {
    requestAnimationFrame(loop);
    return;
  }

  // camera target (safe fallback)
  const camTarget =
    players.find(p => p.id === myId) || players[0];

  // ---- update trails (world space data) ----
//   for (const p of players) {
//     if (!trails.has(p.id)) trails.set(p.id, []);
//     const t = trails.get(p.id);
//     t.push({ x: p.x, y: p.y });
//     if (t.length > TRAIL_LENGTH) t.shift();
//   }

  // ---- WORLD SPACE ----
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
  //draw trails
  // for (const p of players) {
  //   drawTrail(p.id);
  // }

  ctx.restore();

  requestAnimationFrame(loop);
}

loop();
