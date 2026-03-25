import { input, state } from "./state.js";

export function initInput() {
  window.addEventListener("keydown", e => {
    if (e.key === "w") input.thrust = true;
    if (e.key === "a") input.rotate = -1;
    if (e.key === "d") input.rotate = 1;
    if (e.key === "s") input.brake = true;
    if (e.key === "f") input.missile = true;
    if (e.key === "q" || e.key === "Q") state.missilePreview = true;
    if (e.key === "F1") {
      e.preventDefault();
      state.showControls = !state.showControls;
    }
  });

  window.addEventListener("keyup", e => {
    if (e.key === "w") input.thrust = false;
    if (e.key === "a" || e.key === "d") input.rotate = 0;
    if (e.key === "s") input.brake = false;
    if (e.key === "f") input.missile = false;
    if (e.key === "q" || e.key === "Q") state.missilePreview = false;
  });
}
