import { state } from "./state.js";

export function createLeaderboard() {
  const existing = document.getElementById('leaderboard-widget');
  if (existing) return;

  const widget = document.createElement('div');
  widget.id = 'leaderboard-widget';
  widget.style.cssText = `
    position: fixed;
    left: 15px;
    bottom: 15px;
    width: 240px;
    background: rgba(0, 0, 0, 0.85);
    border: 1px solid rgba(255, 180, 0, 0.4);
    border-radius: 6px;
    color: #fff;
    font-family: monospace;
    z-index: 1100;
    overflow: hidden;
  `;

  // Header
  const header = document.createElement('div');
  header.style.cssText = `
    padding: 7px 10px;
    border-bottom: 1px solid rgba(255, 255, 255, 0.08);
    font-size: 12px;
    font-weight: bold;
    color: #ffb300;
    display: flex;
    align-items: center;
    gap: 6px;
  `;
  header.innerHTML = `<span>🏆</span><span>Leaderboard</span>`;

  // Column headers
  const colHeaders = document.createElement('div');
  colHeaders.style.cssText = `
    display: flex;
    padding: 4px 10px;
    font-size: 10px;
    color: rgba(255,255,255,0.35);
    border-bottom: 1px solid rgba(255,255,255,0.06);
  `;
  colHeaders.innerHTML = `
    <span style="width:28px">#</span>
    <span style="flex:1">Player</span>
    <span>Credits</span>
  `;

  // Rows container
  const rowsContainer = document.createElement('div');
  rowsContainer.id = 'leaderboard-rows';
  rowsContainer.style.cssText = `padding: 2px 0 4px 0;`;

  widget.appendChild(header);
  widget.appendChild(colHeaders);
  widget.appendChild(rowsContainer);
  document.body.appendChild(widget);
}

export function updateLeaderboard() {
  const rowsContainer = document.getElementById('leaderboard-rows');
  if (!rowsContainer) return;

  const sorted = [...state.players].sort((a, b) => b.credits - a.credits);

  if (sorted.length === 0) {
    rowsContainer.innerHTML = `
      <div style="padding: 10px; font-size: 11px; color: rgba(255,255,255,0.3); text-align:center;">
        No players online
      </div>`;
    return;
  }

  const medals = ['🥇', '🥈', '🥉'];

  rowsContainer.innerHTML = sorted.map((p, i) => {
    const rank = i + 1;
    const isMe = p.id === state.myId;
    const medal = rank <= 3 ? medals[rank - 1] : `${rank}`;

    const rowBg = isMe ? 'rgba(255, 180, 0, 0.07)' : 'transparent';
    const nameColor = isMe ? '#ffb300' : '#ffffff';
    const creditColor = isMe ? '#ffb300' : '#4eff91';
    const fontWeight = isMe ? 'bold' : 'normal';
    const rankColor = rank === 1 ? '#ffb300' : rank === 2 ? '#cccccc' : rank === 3 ? '#cd7f32' : 'rgba(255,255,255,0.35)';
    const nameSuffix = isMe ? ' ◀' : '';

    // Truncate long usernames
    const displayName = (p.username || p.id).length > 14
      ? (p.username || p.id).slice(0, 13) + '…'
      : (p.username || p.id);

    return `
      <div style="
        display: flex;
        align-items: center;
        padding: 5px 10px;
        background: ${rowBg};
        font-size: 11px;
        font-weight: ${fontWeight};
      ">
        <span style="width:28px; color:${rankColor}; font-size:${rank <= 3 ? '13px' : '11px'}">${medal}</span>
        <span style="flex:1; color:${nameColor}; overflow:hidden; white-space:nowrap;">${displayName}${nameSuffix}</span>
        <span style="color:${creditColor}">$${Math.floor(p.credits)}</span>
      </div>
    `;
  }).join('');
}