import { state, chatProfanity } from "./state.js";
import { MSG_CHAT } from "./shared/messageTypes.js";

export function showNotification(text, color = "white") {
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

export function createChatWidget() {
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

            // Guard: ensure chatProfanity is a non-empty array before filtering
            const hasProfanity = Array.isArray(chatProfanity) && chatProfanity.length > 0
            ? chatProfanity.some(word => {
                try {
                    return new RegExp('\\b' + word + '\\b', 'i').test(text);
                } catch {
                    // Malformed word in list won't crash the whole filter
                    return false;
                }
                })
            : false;

            if (hasProfanity) {
            showNotification('Profanity blocked.', 'red');
            inputEl.value = '';
            return;
            }

            if (state.socket && state.socket.readyState === 1) {
            state.socket.send(JSON.stringify({ type: MSG_CHAT, payload: { text } }));
            } else {
            showNotification('Not connected.', 'red');
            }

            inputEl.value = '';
        }
    });

  document.body.appendChild(widget);
}

export function appendChatMessage({ from, text, ts, system }) {
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
