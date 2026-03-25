import { input, state } from "./state.js";
import { handleLandingDialogAction, dismissDialog } from "./landing.js";

export function updateGamepadInput() {
  const gamepads = navigator.getGamepads();
  const gamepad = gamepads[0];
  
  if (!gamepad) {
    if (state.gamepadConnected) {
      console.log("Gamepad disconnected");
      state.gamepadConnected = false;
      input.rotate = 0;
      input.thrust = false;
      input.brake = false;
      input.missile = false;
      state.missilePreview = false;
    }
    return;
  }
  
  if (!state.gamepadConnected) {
    console.log("Gamepad connected:", gamepad.id);
    state.gamepadConnected = true;
  }
  
  const leftStickX = gamepad.axes[0];
  const deadzone = 0.1;
  input.rotate = Math.abs(leftStickX) > deadzone ? leftStickX : 0;

  const leftTrigger = gamepad.buttons[6].value;
  input.brake = leftTrigger > 0.1;

  state.missilePreview = gamepad.buttons[4].pressed;

  const rightTrigger = gamepad.buttons[7].value;
  input.thrust = rightTrigger > 0.1;

  const xButtonPressed = gamepad.buttons[2].pressed;
  if (xButtonPressed && !state.lastGamepadState.xButton) {
    input.missile = true;
  }

  const startButtonPressed = gamepad.buttons[8].pressed;
  if (startButtonPressed && !state.lastGamepadState.startButton) {
    state.showControls = !state.showControls;
  }

  if (state.landingPrompt) {
    const yButtonPressed = gamepad.buttons[3].pressed;
    if (yButtonPressed && !state.lastGamepadState.yButton) {
      handleLandingDialogAction('refuel');
    }
    const bButtonPressed = gamepad.buttons[1].pressed;
    if (bButtonPressed && !state.lastGamepadState.bButton && state.landingPrompt.isOwned && state.landingPrompt.isOwner) {
      handleLandingDialogAction('revoke');
    }
    const aButtonPressed = gamepad.buttons[0].pressed;
    if (aButtonPressed && !state.lastGamepadState.aButton) {
      dismissDialog();
    }
    state.lastGamepadState.yButton = yButtonPressed;
    state.lastGamepadState.bButton = bButtonPressed;
    state.lastGamepadState.aButton = aButtonPressed;
  }

  state.lastGamepadState.leftStickX = leftStickX;
  state.lastGamepadState.leftTrigger = leftTrigger;
  state.lastGamepadState.rightTrigger = rightTrigger;
  state.lastGamepadState.xButton = xButtonPressed;
  state.lastGamepadState.startButton = startButtonPressed;
}

export function initGamepad() {
  window.addEventListener("gamepadconnected", (e) => {
    console.log("Gamepad connected:", e.gamepad.id);
    state.gamepadConnected = true;
  });

  window.addEventListener("gamepaddisconnected", (e) => {
    console.log("Gamepad disconnected:", e.gamepad.id);
    state.gamepadConnected = false;
    input.rotate = 0;
    input.thrust = false;
    input.brake = false;
    input.missile = false;
  });
}
