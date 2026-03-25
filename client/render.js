import { state, input, planetImages, stars, parallaxLayers } from "./state.js";
import { MAX_FUEL, MISSILE_FUEL_COST, MISSILE_CREDIT_COST } from "./shared/constants.js";
import { showLandingPrompt } from "./landing.js";

const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");

export function resizeCanvas() {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
}

const shipImg = new Image();
shipImg.src = "./assets/ships/player_ship_idle.png";
const shipImgThr = new Image();
shipImgThr.src = "./assets/ships/player_ship.png";
const otherImg = new Image();
otherImg.src = "./assets/ships/other_ship_idle.png";

export function drawShip(p) {
  if (!shipImg.complete || !shipImgThr.complete) return;

  ctx.save();
  ctx.translate(p.x, p.y);
  ctx.rotate((p.rot || 0) + Math.PI / 2);

  const size = 80;
  if (p.id !== state.myId) {
    ctx.drawImage(otherImg, -size/2, -size/2, size, size);
    ctx.restore();
    return;
  }

  const thrusting = input.thrust || p.thrust;
  const image = thrusting ? shipImgThr : shipImg;
  ctx.drawImage(image, -size/2, -size/2, size, size);

  if (state.missilePreview) {
    ctx.strokeStyle = "rgba(255, 255, 255, 0.3)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, -size/2);
    ctx.lineTo(0, -size/2 - 60);
    ctx.stroke();
  }

  ctx.restore();
}

export function drawMissile(m) {
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

export function drawPlanet(p) {
  const img = planetImages[p.id];
  if (img && img.complete && img.naturalHeight !== 0) {
    ctx.save();
    ctx.translate(p.x, p.y);
    const size = p.id === 'p1' ? p.r * 4 + 3 : p.r * 2 + 3;
    ctx.drawImage(img, -size/2, -size/2, size, size);
    ctx.restore();
  } else {
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
    ctx.shadowBlur = 20;
    ctx.shadowColor = ctx.strokeStyle;
    ctx.stroke();
    ctx.shadowBlur = 0;
    ctx.strokeStyle = p.owner ? (p.owner === state.myId ? "#0f0" : "#f0f") : "#4af";
    ctx.lineWidth = 3;
    ctx.stroke();
  }

  ctx.save();
  ctx.fillStyle = p.owner === state.myId ? "#0f0" : p.owner ? "#f0f" : "#4af";
  ctx.font = "12px monospace";
  ctx.textAlign = "center";
  ctx.fillText(p.name, p.x, p.y - p.r - 15);

  if (p.owner) {
    ctx.font = "10px monospace";
    ctx.fillStyle = p.owner === state.myId ? "#0f0" : "#f0f";
    ctx.fillText(`[${p.ownerUsername || "?"}]`, p.x, p.y - p.r - 3);
  }
  ctx.restore();
}

function drawControlsScreen() {
  ctx.fillStyle = "rgba(0, 0, 0, 0.9)";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.fillStyle = "#fff";
  ctx.font = "bold 24px monospace";
  ctx.textAlign = "center";
  ctx.fillText("CONTROLS", canvas.width / 2, 50);

  ctx.font = "16px monospace";
  ctx.fillText("Press F1 or Start to toggle", canvas.width / 2, 80);

  ctx.textAlign = "left";
  ctx.font = "14px monospace";

  const leftX = 50;
  const rightX = canvas.width / 2 + 50;
  let yPos = 120;
  const lineHeight = 25;

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

export function loop() {
  requestAnimationFrame(loop);

  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // HUD
  const hudX = 10;
  const hudY = 10;
  const hudW = 200;
  const hudH = 160;

  ctx.fillStyle = "rgba(0, 0, 0, 0.8)";
  ctx.fillRect(hudX, hudY, hudW, hudH);

  ctx.strokeStyle = "#fff";
  ctx.lineWidth = 1;
  ctx.strokeRect(hudX, hudY, hudW, hudH);

  ctx.textAlign = "left";
  ctx.fillStyle = "#fff";
  ctx.font = "11px monospace";

  let yPos = hudY + 12;
  const lineHeight = 16;

  ctx.fillText(`Player: ${state.myName}`, hudX + 10, yPos); yPos += lineHeight;
  ctx.fillStyle = "#ffff00";
  ctx.fillText(`Credits: $${Math.floor(state.myCredits)}`, hudX + 10, yPos); yPos += lineHeight;

  const fuelPercent = Math.floor((state.myFuel / MAX_FUEL) * 100);
  ctx.fillStyle = "#fff";
  ctx.fillText(`Fuel: ${fuelPercent}%`, hudX + 10, yPos);

  const barW = 90;
  const barH = 8;
  const barX = hudX + 80;
  const barY = yPos - 10;

  ctx.fillStyle = "#333";
  ctx.fillRect(barX, barY, barW, barH);
  ctx.strokeStyle = "#fff";
  ctx.lineWidth = 1;
  ctx.strokeRect(barX, barY, barW, barH);

  if (fuelPercent > 50) { ctx.fillStyle = "#0f0"; }
  else if (fuelPercent > 25) { ctx.fillStyle = "#ff0"; }
  else { ctx.fillStyle = "#f00"; }
  ctx.fillRect(barX, barY, (fuelPercent / 100) * barW, barH);

  yPos += lineHeight;
  ctx.fillStyle = "#fff";
  ctx.fillText(`Players: ${state.players.length}`, hudX + 10, yPos);
  yPos += lineHeight;

  ctx.fillStyle = state.ownedPlanets.length > 0 ? "#0f0" : "#888";
  ctx.fillText(`Owned: ${state.ownedPlanets.length}`, hudX + 10, yPos);
  yPos += lineHeight;

  ctx.fillStyle = "#fff";
  ctx.fillText(`Missiles: ${state.missiles.length}`, hudX + 10, yPos);
  yPos += lineHeight;
  ctx.fillStyle = "#ff0";
  ctx.fillText(`Fire: F (${MISSILE_FUEL_COST} fuel, $${MISSILE_CREDIT_COST})`, hudX + 10, yPos);
  yPos += lineHeight;

  ctx.fillStyle = state.gamepadConnected ? "#0f0" : "#666";
  ctx.fillText(`Gamepad: ${state.gamepadConnected ? 'Connected' : 'None'}`, hudX + 10, yPos);

  if (!state.players.length) return;

  const camTarget = state.players.find(p => p.id === state.myId) || state.players[0];

  ctx.save();
  ctx.translate(canvas.width / 2 - camTarget.x, canvas.height / 2 - camTarget.y);

  for (const s of stars) {
    const parallaxX = camTarget.x * (1 - s.layer);
    const parallaxY = camTarget.y * (1 - s.layer);
    ctx.fillStyle = s.color;
    ctx.fillRect(s.x + parallaxX, s.y + parallaxY, s.size, s.size);
  }

  for (const pl of state.planets) drawPlanet(pl);
  for (const p of state.players) drawShip(p);
  for (const m of state.missiles) drawMissile(m);
  ctx.restore();

  if (state.showControls) drawControlsScreen();
}

// create stars once
(function generateStars() {
  if (stars.length > 0) return;
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
})();

export function startGameLoop() {
  resizeCanvas();
  window.addEventListener("resize", resizeCanvas);
  requestAnimationFrame(loop);
}

export default {
  canvas,
  ctx
};
