import "./state.js";
import { initAuth } from "./auth.js";
import { initInput } from "./input.js";
import { initGamepad, updateGamepadInput } from "./gamepad.js";
import { startGameLoop } from "./render.js";

console.log("CLIENT LOADED");

initAuth();
initInput();
initGamepad();

function animate() {
  updateGamepadInput();
  requestAnimationFrame(animate);
}

animate();
startGameLoop();
