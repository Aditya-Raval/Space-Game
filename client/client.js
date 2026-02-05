import { MSG_INPUT, MSG_STATE } from "./shared/messageTypes.js";
import { MAX_FUEL } from "./shared/constants.js";

console.log("CLIENT LOADED");

let myId = null;
let players = [];
let planets = [];

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
const socket = new WebSocket("ws://localhost:8080");

// input
const input = { thrust: false, rotate: 0 };

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
    
    // Update my fuel
    const myPlayer = players.find(p => p.id === myId);
    if (myPlayer) {
      myFuel = myPlayer.fuel;
    }
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

// ================= MAIN LOOP =================

function loop() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // ---- UI (screen space) ----
  ctx.fillStyle = "white";
  ctx.font = "18px monospace";
  ctx.fillText(`PLAYERS: ${players.length}`, 20, 30);
  ctx.fillText(`MY ID: ${myId ?? "null"}`, 20, 55);
  
  // Fuel bar
  const fuelPercentage = (myFuel / MAX_FUEL) * 100;
  ctx.fillStyle = fuelPercentage > 25 ? "#0f0" : "#f00";
  ctx.fillText(`FUEL: ${myFuel.toFixed(1)}/${MAX_FUEL}`, 20, 80);
  
  // Fuel bar visual
  ctx.strokeStyle = "#0f0";
  ctx.strokeRect(20, 90, 200, 20);
  ctx.fillStyle = fuelPercentage > 25 ? "#0f0" : "#f00";
  ctx.fillRect(20, 90, (fuelPercentage / 100) * 200, 20);

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
