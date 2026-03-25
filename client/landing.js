import { state } from "./state.js";
import { showNotification } from "./chat.js";
import {
  MSG_CLAIM_PLANET,
  MSG_REFUEL,
  MSG_REVOKE_PLANET
} from "./shared/messageTypes.js";
import {
  FREE_REFUEL_AMOUNT,
  PAID_REFUEL_AMOUNT,
  REFUEL_COST_PER_TANK
} from "./shared/constants.js";

export function showLandingPrompt(prompt) {
  const existing = document.getElementById("landing-dialog");
  if (existing) existing.remove();

  const credits = typeof prompt.currentCredits === 'number' ? prompt.currentCredits : (typeof state.myCredits === 'number' ? state.myCredits : 0);
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
                <button id="btn-refuel-own" style="width:100%;padding:5px;margin-bottom:5px;background:#000;color:#0f0;border:1px solid #0f0;cursor:pointer;">Refuel Free${state.gamepadConnected ? ' (Y)' : ''}</button>
                <button id="btn-revoke" style="width:100%;padding:5px;margin-bottom:5px;background:#000;color:#f00;border:1px solid #f00;cursor:pointer;">Revoke${state.gamepadConnected ? ' (B)' : ''}</button>`;
  } else if (prompt.isOwned && !prompt.isOwner) {
    content += `<div style="font-size:12px;margin-bottom:10px;">Owned by: ${prompt.owner} | Rent: $${prompt.rentPaid}</div>
                <div style="font-size:12px;margin-bottom:10px;color:#ff0;">Credits: ${creditsDisplay}</div>
                <button id="btn-refuel-paid" style="width:100%;padding:5px;margin-bottom:5px;background:#000;color:#ff0;border:1px solid #ff0;cursor:pointer;">Refuel $${REFUEL_COST_PER_TANK}${state.gamepadConnected ? ' (Y)' : ''}</button>`;
  } else {
    const canClaim = credits >= prompt.claimCost;
    content += `<div style="font-size:12px;margin-bottom:10px;">Unclaimed - Claim for $${prompt.claimCost}</div>`;
    content += `<div style="font-size:12px;margin-bottom:10px;color:#ff0;">Credits: ${creditsDisplay}</div>`;
    if (canClaim) {
      content += `<button id="btn-claim" style="width:100%;padding:5px;margin-bottom:5px;background:#000;color:#0f0;border:1px solid #0f0;cursor:pointer;">Claim Planet</button>`;
    } else {
      content += `<div style="font-size:12px;color:#f00;margin-bottom:5px;">Need $${prompt.claimCost - Math.floor(credits)} more</div>`;
    }
    content += `<button id="btn-refuel-paid" style="width:100%;padding:5px;margin-bottom:5px;background:#000;color:#ff0;border:1px solid #ff0;cursor:pointer;">Refuel $${REFUEL_COST_PER_TANK}${state.gamepadConnected ? ' (Y)' : ''}</button>`;
  }

  content += `<button id="btn-close" style="width:100%;padding:5px;background:#000;color:#aaa;border:1px solid #aaa;cursor:pointer;">Close${state.gamepadConnected ? ' (A)' : ''}</button>`;
  dialog.innerHTML = content;
  document.body.appendChild(dialog);

  const btnClaim = document.getElementById("btn-claim");
  if (btnClaim) {
    btnClaim.addEventListener("click", () => {
      state.socket.send(JSON.stringify({ type: MSG_CLAIM_PLANET, payload: { planetId: prompt.planetId } }));
      dismissDialog();
    });
  }

  const btnRefuelOwn = document.getElementById("btn-refuel-own");
  if (btnRefuelOwn) {
    btnRefuelOwn.addEventListener("click", () => {
      state.socket.send(JSON.stringify({ type: MSG_REFUEL, payload: { amount: FREE_REFUEL_AMOUNT, isOwned: true } }));
      dismissDialog();
    });
  }

  const btnRefuelPaid = document.getElementById("btn-refuel-paid");
  if (btnRefuelPaid) {
    btnRefuelPaid.addEventListener("click", () => {
      state.socket.send(JSON.stringify({ type: MSG_REFUEL, payload: { amount: PAID_REFUEL_AMOUNT, isOwned: false } }));
      dismissDialog();
    });
  }

  const btnRevoke = document.getElementById("btn-revoke");
  if (btnRevoke) {
    btnRevoke.addEventListener("click", () => {
      state.socket.send(JSON.stringify({ type: MSG_REVOKE_PLANET, payload: { planetId: prompt.planetId } }));
      dismissDialog();
    });
  }

  const btnClose = document.getElementById("btn-close");
  if (btnClose) {
    btnClose.addEventListener("click", dismissDialog);
  }
}

export function dismissDialog() {
  const dialog = document.getElementById("landing-dialog");
  if (dialog) dialog.remove();
  state.landingPrompt = null;
}

export function handleLandingDialogAction(action) {
  if (!state.landingPrompt || !state.socket) return;

  if (action === 'refuel') {
    if (state.landingPrompt.isOwned && state.landingPrompt.isOwner) {
      state.socket.send(JSON.stringify({ type: MSG_REFUEL, payload: { amount: FREE_REFUEL_AMOUNT, isOwned: true } }));
    } else {
      state.socket.send(JSON.stringify({ type: MSG_REFUEL, payload: { amount: PAID_REFUEL_AMOUNT, isOwned: false } }));
    }
    dismissDialog();
  } else if (action === 'revoke' && state.landingPrompt.isOwned && state.landingPrompt.isOwner) {
    state.socket.send(JSON.stringify({ type: MSG_REVOKE_PLANET, payload: { planetId: state.landingPrompt.planetId } }));
    dismissDialog();
  }
}
