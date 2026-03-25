import { state } from "./state.js";
import { connectSocket } from "./network.js";

export async function doAuth(action) {
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

    state.myName = data.username || username;
    if (msgEl) msgEl.textContent = 'Authenticated, connecting...';
    connectSocket(data.playerId);
  } catch (err) {
    console.error('Auth error', err);
    if (msgEl) msgEl.textContent = 'Auth failed: ' + err.message;
  }
}

export function initAuth() {
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
}
