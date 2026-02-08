// --- Global state ---
let ws = null;
let gameState = null;
let myPlayer = null;

// --- DOM refs ---
const lobby = document.getElementById('lobby');
const gameBoard = document.getElementById('game-board');
const connectBtn = document.getElementById('connect-btn');
const lobbyStatus = document.getElementById('lobby-status');
const gameNameInput = document.getElementById('game-name');

// --- Connection ---
function connect(gameName, player) {
  myPlayer = player;
  const isGitHubPages = location.hostname.includes('github.io');
  const serverBase = isGitHubPages
    ? 'wss://shields-up-engineering-server.onrender.com'
    : `ws://${location.hostname || 'localhost'}:8000`;
  const wsUrl = `${serverBase}/game/${gameName}`;

  lobbyStatus.textContent = 'Connecting...';
  connectBtn.disabled = true;

  ws = new WebSocket(wsUrl);

  ws.addEventListener('open', () => {
    // Store game/player in URL hash so refresh reconnects
    location.hash = `${encodeURIComponent(gameName)}/${player}`;
    lobby.classList.add('hidden');
    gameBoard.classList.remove('hidden');
  });

  ws.addEventListener('message', (event) => {
    const data = JSON.parse(event.data);

    // Server sends Ok/Err for action responses, or full GameState for broadcasts
    if (data.Ok !== undefined || data.Err !== undefined) {
      if (data.Err) {
        showError(data.Err);
      }
      return;
    }

    // Full GameState
    gameState = data;

    // Auto-resolve empty effects list (e.g. Fusion Reactor activation produces no effects)
    if (gameState.players_turn === myPlayer) {
      const ts = gameState.turn_state;
      if (typeof ts === 'object' && ts.ResolvingEffects && ts.ResolvingEffects.effects.length === 0) {
        sendAction('StopResolvingEffects');
      }
    }

    render();
  });

  ws.addEventListener('close', () => {
    lobbyStatus.textContent = 'Disconnected. Refresh to reconnect.';
    lobby.classList.remove('hidden');
    gameBoard.classList.add('hidden');
    connectBtn.disabled = false;
  });

  ws.addEventListener('error', () => {
    lobbyStatus.textContent = 'Connection error. Is the server running?';
    connectBtn.disabled = false;
  });
}

connectBtn.addEventListener('click', () => {
  const gameName = gameNameInput.value.trim();
  if (!gameName) {
    lobbyStatus.textContent = 'Enter a game name.';
    return;
  }
  const player = document.querySelector('input[name="player"]:checked').value;
  connect(gameName, player);
});

// Auto-connect from URL hash on page load (e.g. #game1/Player1)
(function autoConnect() {
  const hash = location.hash.slice(1); // remove leading #
  if (!hash) return;
  const slashIdx = hash.lastIndexOf('/');
  if (slashIdx < 1) return;
  const gameName = decodeURIComponent(hash.slice(0, slashIdx));
  const player = hash.slice(slashIdx + 1);
  if (!gameName || (player !== 'Player1' && player !== 'Player2')) return;
  // Pre-fill the lobby inputs to match
  gameNameInput.value = gameName;
  document.querySelector(`input[name="player"][value="${player}"]`).checked = true;
  connect(gameName, player);
})();

// --- Card image lookup ---
const CARD_IMAGES = {
  'attack_01': 'attack_01[face,4].png',
  'attack_02': 'attack_02[face,2].png',
  'attack_05': 'attack_05[face,2].png',
  'attack_06': 'attack_06[face,2].png',
  'attack_07': 'attack_07[face,2].png',
  'attack_08': 'attack_08[face,2].png',
  'attack_10': 'Attack_10[face,1].png',
  'attack_11': 'Attack_11[face,1].png',
  'draw_01': 'draw_01[face,6].png',
  'draw_06': 'draw_06[face,4].png',
  'draw_06b': 'draw_06b[face,2].png',
  'draw_08': 'draw_08[face,2].png',
  'draw_10': 'Draw_10[face,1].png',
  'draw_11': 'Draw_11[face,1].png',
  'generic_01': 'generic_01[face,8].png',
  'generic_02': 'generic_02[face,3].png',
  'generic_04': 'generic_04[face,3].png',
  'generic_04c': 'generic_04c[face,3].png',
  'generic_04d': 'generic_04d[face,3].png',
  'generic_06': 'generic_06[face,7].png',
  'generic_07': 'generic_07[face,9].png',
  'power_04': 'power_04[face,2].png',
  'power_05': 'power_05[face,4].png',
  'power_05b': 'power_05b[face,4].png',
  'power_06': 'power_06[face,2].png',
  'power_07': 'power_07[face,2].png',
  'power_08': 'power_08[face,2].png',
  'shields_01': 'shields_01[face,4].png',
  'shields_02': 'shields_02[face,2].png',
  'shields_05': 'shields_05[face,2].png',
  'shields_06': 'shields_06[face,2].png',
  'shields_07': 'shields_07[face,2].png',
  'shields_08': 'shields_08[face,2].png',
  'shields_10': 'Shields_10[face,1].png',
  'shields_11': 'Shields_11[face,1].png',
};

const SYSTEM_KEYS = ['fusion_reactor', 'life_support', 'shield_generator', 'weapons_system'];
const SYSTEM_ENUMS = ['FusionReactor', 'LifeSupport', 'ShieldGenerator', 'Weapons'];
const SYSTEM_NAMES = {
  FusionReactor: 'Fusion Reactor',
  LifeSupport: 'Life Support',
  ShieldGenerator: 'Shield Generator',
  Weapons: 'Weapons System',
};
const SYSTEM_IMAGES = {
  FusionReactor: 'cards/aa_Fusion_Reactor[face,2].png',
  LifeSupport: 'cards/aa_Life_Support[face,2].png',
  ShieldGenerator: 'cards/aa_Shield_Generator[face,2].png',
  Weapons: 'cards/aa_Weapons_System[face,2].png',
};

// --- System energy helpers ---
// Starting StoreMoreEnergy counts per system (matches server starting_effects)
const STARTING_STORE_MORE = {
  FusionReactor: 5,
  LifeSupport: 3,
  ShieldGenerator: 3,
  Weapons: 3,
};

function getAllowedEnergy(systemState) {
  const base = STARTING_STORE_MORE[systemState.system] || 0;
  const fromHotWires = systemState.hot_wires.reduce((count, card) => {
    return count + card.hot_wire_effects.filter(e => e === 'StoreMoreEnergy').length;
  }, 0);
  return base + fromHotWires;
}

// --- Floating card preview ---
const cardPreview = document.createElement('img');
cardPreview.id = 'card-preview';
document.body.appendChild(cardPreview);

function showCardPreview(src, e) {
  cardPreview.src = src;
  cardPreview.classList.add('visible');
  positionCardPreview(e);
}

function positionCardPreview(e) {
  const pw = cardPreview.offsetWidth || 200;
  const ph = cardPreview.offsetHeight || 280;
  let x = e.clientX + 16;
  let y = e.clientY - ph / 2;
  // Keep on screen
  if (x + pw > window.innerWidth) x = e.clientX - pw - 16;
  if (y < 4) y = 4;
  if (y + ph > window.innerHeight - 4) y = window.innerHeight - ph - 4;
  cardPreview.style.left = x + 'px';
  cardPreview.style.top = y + 'px';
}

function hideCardPreview() {
  cardPreview.classList.remove('visible');
}

// --- Send action to server ---
function sendAction(userAction) {
  const msg = { player: myPlayer, user_action: userAction };
  ws.send(JSON.stringify(msg));
}

// --- Error display ---
let errorTimeout = null;
function showError(msg) {
  console.error('Server error:', msg);
  let toast = document.getElementById('error-toast');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'error-toast';
    document.body.appendChild(toast);
  }
  toast.textContent = msg;
  toast.classList.add('visible');
  clearTimeout(errorTimeout);
  errorTimeout = setTimeout(() => toast.classList.remove('visible'), 3000);
}

// --- Card popup ---
let activePopup = null;
function closePopup() {
  if (activePopup) {
    activePopup.remove();
    activePopup = null;
  }
}

function showCardPopup(cardEl, cardIndex) {
  closePopup();
  const popup = document.createElement('div');
  popup.className = 'card-popup';

  const playBtn = document.createElement('button');
  playBtn.textContent = 'Play Instant';
  playBtn.addEventListener('click', () => {
    sendAction({ ChooseAction: { action: { PlayInstantCard: { card_index: cardIndex } } } });
    closePopup();
  });

  const hotWireBtn = document.createElement('button');
  hotWireBtn.textContent = 'Hot-Wire';
  hotWireBtn.addEventListener('click', () => {
    closePopup();
    startHotWireFlow(cardIndex);
  });

  const cancelBtn = document.createElement('button');
  cancelBtn.textContent = 'Cancel';
  cancelBtn.className = 'cancel-btn';
  cancelBtn.addEventListener('click', closePopup);

  popup.appendChild(playBtn);
  popup.appendChild(hotWireBtn);
  popup.appendChild(cancelBtn);
  cardEl.appendChild(popup);
  activePopup = popup;
}

// --- Hot-Wire flow ---
function startHotWireFlow(cardIndex) {
  const myHand = getMyState().hand;
  const card = myHand[cardIndex];
  const discardsNeeded = card.hot_wire_cost.cards_to_discard;
  // Check if there are enough other cards to pay the discard cost
  if (discardsNeeded > 0 && myHand.length - 1 < discardsNeeded) {
    showError('Not enough cards in hand to pay discard cost');
    return;
  }
  showSystemPickerModal('Hot-Wire to which system?', (system) => {
    if (discardsNeeded > 0) {
      startCardSelectionMode(discardsNeeded, cardIndex, (selectedIndices) => {
        sendAction({ ChooseAction: { action: { HotWireCard: { card_index: cardIndex, system: system, indices_to_discard: selectedIndices } } } });
      });
    } else {
      sendAction({ ChooseAction: { action: { HotWireCard: { card_index: cardIndex, system: system, indices_to_discard: [] } } } });
    }
  });
}

// --- System picker modal (reusable) ---
function showSystemPickerModal(title, onPick) {
  closeModal();
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.id = 'energy-modal';

  const modal = document.createElement('div');
  modal.className = 'modal';

  const heading = document.createElement('h3');
  heading.textContent = title;
  modal.appendChild(heading);

  const btnRow = document.createElement('div');
  btnRow.className = 'system-picker-row';

  SYSTEM_ENUMS.forEach(sysEnum => {
    const btn = document.createElement('button');
    btn.textContent = SYSTEM_NAMES[sysEnum];
    btn.className = 'system-pick-btn';
    btn.addEventListener('click', () => {
      closeModal();
      onPick(sysEnum);
    });
    btnRow.appendChild(btn);
  });

  modal.appendChild(btnRow);

  const cancelBtn = document.createElement('button');
  cancelBtn.textContent = 'Cancel';
  cancelBtn.className = 'cancel-btn';
  cancelBtn.style.marginTop = '12px';
  cancelBtn.addEventListener('click', closeModal);
  modal.appendChild(cancelBtn);

  overlay.appendChild(modal);
  document.body.appendChild(overlay);
}

// --- Card selection mode (for discards) ---
let cardSelectionState = null;

function startCardSelectionMode(count, excludeIndex, onConfirm) {
  cardSelectionState = { count, excludeIndex, selected: [], onConfirm };
  renderCardSelection();
}

function renderCardSelection() {
  if (!cardSelectionState) return;
  const { count, excludeIndex, selected } = cardSelectionState;
  const container = document.getElementById('player-hand');
  const cards = container.querySelectorAll('.card');

  // Show selection prompt
  let prompt = document.getElementById('card-select-prompt');
  if (!prompt) {
    prompt = document.createElement('div');
    prompt.id = 'card-select-prompt';
    container.parentNode.insertBefore(prompt, container);
  }
  const promptLabel = cardSelectionState.promptLabel || `Select ${count} card(s) to discard`;
  prompt.textContent = `${promptLabel} (${selected.length}/${count})`;
  prompt.className = 'card-select-prompt';

  cards.forEach((cardEl, i) => {
    if (i === excludeIndex) {
      cardEl.classList.add('card-excluded');
      cardEl.classList.remove('card-selected');
    } else if (selected.includes(i)) {
      cardEl.classList.add('card-selected');
      cardEl.classList.remove('card-excluded');
    } else {
      cardEl.classList.remove('card-selected', 'card-excluded');
    }
  });

  // Show/remove confirm button
  let confirmBtn = document.getElementById('card-select-confirm');
  if (selected.length === count) {
    if (!confirmBtn) {
      confirmBtn = document.createElement('button');
      confirmBtn.id = 'card-select-confirm';
      confirmBtn.textContent = cardSelectionState.confirmLabel || 'Confirm Discard';
      confirmBtn.addEventListener('click', () => {
        const cb = cardSelectionState.onConfirm;
        const sel = [...cardSelectionState.selected];
        exitCardSelectionMode();
        cb(sel);
      });
      prompt.parentNode.insertBefore(confirmBtn, prompt.nextSibling);
    }
  } else if (confirmBtn) {
    confirmBtn.remove();
  }
}

function exitCardSelectionMode() {
  cardSelectionState = null;
  const prompt = document.getElementById('card-select-prompt');
  if (prompt) prompt.remove();
  const confirmBtn = document.getElementById('card-select-confirm');
  if (confirmBtn) confirmBtn.remove();
  // Re-render to clear selection styles
  if (gameState) render();
}

// --- Helper: get player/opponent state ---
function getMyState() {
  return myPlayer === 'Player1' ? gameState.player1 : gameState.player2;
}

function getOpponentState() {
  return myPlayer === 'Player1' ? gameState.player2 : gameState.player1;
}

function isMyTurn() {
  return gameState.players_turn === myPlayer;
}

// --- Render ---
function render() {
  if (!gameState) return;

  const myState = getMyState();
  const oppState = getOpponentState();

  renderPlayerStats(oppState, 'opponent-stats');
  renderPlayerStats(myState, 'player-stats');

  renderSystems(oppState, 'opponent-systems');
  renderSystems(myState, 'player-systems');

  renderHand(oppState.hand, 'opponent-hand', false);
  renderHand(myState.hand, 'player-hand', true);

  renderGameInfoBar();
  renderActionButtons();
  renderEffectChips();

  // Visual feedback — highlight active player area
  const playerArea = document.getElementById('player-area');
  const opponentArea = document.getElementById('opponent-area');
  const infoBar = document.getElementById('game-info-bar');

  if (isMyTurn()) {
    playerArea.classList.add('active-area');
    playerArea.classList.remove('inactive-area');
    opponentArea.classList.add('inactive-area');
    opponentArea.classList.remove('active-area');
    infoBar.classList.add('my-turn');
  } else {
    playerArea.classList.add('inactive-area');
    playerArea.classList.remove('active-area');
    opponentArea.classList.remove('inactive-area');
    opponentArea.classList.add('active-area');
    infoBar.classList.remove('my-turn');
  }
}

// --- Inline SVG icons ---
const ICONS = {
  hull: `<svg width="14" height="14" viewBox="0 0 16 16" style="vertical-align:-2px"><rect x="2" y="2" width="12" height="12" rx="2" fill="none" stroke="#f66" stroke-width="2"/><line x1="4" y1="4" x2="12" y2="12" stroke="#f66" stroke-width="2"/><line x1="12" y1="4" x2="4" y2="12" stroke="#f66" stroke-width="2"/></svg>`,
  shields: `<svg width="14" height="14" viewBox="0 0 16 16" style="vertical-align:-2px"><path d="M8 1L2 4v4c0 3.5 2.5 6 6 7 3.5-1 6-3.5 6-7V4L8 1z" fill="#6af" opacity="0.8"/></svg>`,
  shortCircuit: `<svg width="14" height="14" viewBox="0 0 16 16" style="vertical-align:-2px"><path d="M9 1L4 9h4l-1 6 5-8H8l1-6z" fill="#f44" opacity="0.9"/></svg>`,
  energy: `<svg width="12" height="12" viewBox="0 0 12 12" style="vertical-align:-2px"><rect x="1" y="1" width="10" height="10" rx="2" fill="#fd4" opacity="0.85"/></svg>`,
  overload: (n) => `<svg width="28" height="28" viewBox="0 0 28 28" style="vertical-align:-6px"><circle cx="14" cy="14" r="13" fill="#1a0000" stroke="#f44" stroke-width="2"/><circle cx="14" cy="14" r="9" fill="#300" stroke="#f44" stroke-width="1"/><text x="14" y="14" text-anchor="middle" dominant-baseline="central" fill="#ff4444" font-size="14" font-weight="bold" font-family="inherit">${n}</text></svg>`,
  hotWire: `<svg width="12" height="12" viewBox="0 0 12 12" style="vertical-align:-2px"><path d="M2 10L5 6 3 6 7 2 6 5 8 5 4 10z" fill="#aaa" opacity="0.8"/></svg>`,
  // Effect icons (16x16, used in effect chips)
  effectAttack: `<svg width="16" height="16" viewBox="0 0 16 16" style="vertical-align:-3px"><rect x="1" y="6" width="9" height="5" rx="1" fill="none" stroke="#f66" stroke-width="1.5"/><rect x="10" y="7.5" width="5" height="2" fill="#f66"/><path d="M1 8.5h4" stroke="#f66" stroke-width="1"/><rect x="3" y="3" width="2" height="3" rx="0.5" fill="#f66" opacity="0.7"/></svg>`,
  effectShield: `<svg width="16" height="16" viewBox="0 0 16 16" style="vertical-align:-3px"><path d="M8 1L2 4v4c0 3.5 2.5 6 6 7 3.5-1 6-3.5 6-7V4L8 1z" fill="#6af" opacity="0.8"/><path d="M6 8l2 2 3-4" stroke="#fff" stroke-width="1.5" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
  effectGainShortCircuit: `<svg width="16" height="16" viewBox="0 0 16 16" style="vertical-align:-3px"><path d="M9 1L4 9h4l-1 6 5-8H8l1-6z" fill="#f44" opacity="0.9"/></svg>`,
  effectLoseShortCircuit: `<svg width="16" height="16" viewBox="0 0 16 16" style="vertical-align:-3px"><path d="M9 1L4 9h4l-1 6 5-8H8l1-6z" fill="#4c4" opacity="0.8"/></svg>`,
  effectDraw: `<svg width="16" height="16" viewBox="0 0 16 16" style="vertical-align:-3px"><rect x="3" y="2" width="10" height="12" rx="1.5" fill="none" stroke="#8cf" stroke-width="1.5"/><path d="M6 8h4M8 6v4" stroke="#8cf" stroke-width="1.5" stroke-linecap="round"/></svg>`,
  effectGainAction: `<svg width="16" height="16" viewBox="0 0 16 16" style="vertical-align:-3px"><circle cx="8" cy="8" r="6" fill="none" stroke="#4c4" stroke-width="1.5"/><path d="M5 8h6M8 5v6" stroke="#4c4" stroke-width="2" stroke-linecap="round"/></svg>`,
  effectOpponentGainShortCircuit: `<svg width="16" height="16" viewBox="0 0 16 16" style="vertical-align:-3px"><path d="M9 1L4 9h4l-1 6 5-8H8l1-6z" fill="#f44" opacity="0.9"/></svg>`,
  effectOpponentLoseShield: `<svg width="16" height="16" viewBox="0 0 16 16" style="vertical-align:-3px"><path d="M8 1L2 4v4c0 3.5 2.5 6 6 7 3.5-1 6-3.5 6-7V4L8 1z" fill="#f66" opacity="0.6"/><path d="M5 5l6 6M11 5l-6 6" stroke="#fff" stroke-width="1.5" stroke-linecap="round"/></svg>`,
  effectBypassShield: `<svg width="16" height="16" viewBox="0 0 16 16" style="vertical-align:-3px"><path d="M8 1L2 4v4c0 3.5 2.5 6 6 7 3.5-1 6-3.5 6-7V4L8 1z" fill="#6af" opacity="0.3"/><path d="M1 12L15 4" stroke="#f66" stroke-width="2" stroke-linecap="round"/></svg>`,
  effectDiscardOverload: `<svg width="16" height="16" viewBox="0 0 16 16" style="vertical-align:-3px"><circle cx="8" cy="8" r="6" fill="#300" stroke="#4c4" stroke-width="1.5"/><path d="M5 8h6" stroke="#4c4" stroke-width="2" stroke-linecap="round"/></svg>`,
  effectOpponentGainOverload: `<svg width="16" height="16" viewBox="0 0 16 16" style="vertical-align:-3px"><circle cx="8" cy="8" r="6" fill="#300" stroke="#f44" stroke-width="1.5"/><path d="M5 8h6M8 5v6" stroke="#f44" stroke-width="2" stroke-linecap="round"/></svg>`,
  effectMoveEnergy: `<svg width="16" height="16" viewBox="0 0 16 16" style="vertical-align:-3px"><rect x="1" y="5" width="6" height="6" rx="1" fill="#fd4" opacity="0.85"/><path d="M10 8h4M12 6l2 2-2 2" stroke="#fd4" stroke-width="1.5" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
  effectOpponentMoveEnergy: `<svg width="16" height="16" viewBox="0 0 16 16" style="vertical-align:-3px"><rect x="1" y="5" width="6" height="6" rx="1" fill="#f66" opacity="0.7"/><path d="M10 8h4M12 6l2 2-2 2" stroke="#f66" stroke-width="1.5" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
  effectPlayHotWire: `<svg width="16" height="16" viewBox="0 0 16 16" style="vertical-align:-3px"><rect x="3" y="2" width="10" height="12" rx="1.5" fill="none" stroke="#aaa" stroke-width="1.5"/><path d="M8 6v4M6 8l2 2 2-2" stroke="#aaa" stroke-width="1.5" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
  effectOpponentDiscard: `<svg width="16" height="16" viewBox="0 0 16 16" style="vertical-align:-3px"><rect x="3" y="2" width="10" height="12" rx="1.5" fill="none" stroke="#f66" stroke-width="1.5"/><path d="M6 6l4 4M10 6l-4 4" stroke="#f66" stroke-width="1.5" stroke-linecap="round"/></svg>`,
};

function repeatIcon(icon, count) {
  return icon.repeat(Math.max(0, count));
}

function renderShortCircuitScale(count) {
  const max = 12;
  const thresholdSlots = [4, 9]; // 0-indexed: 5th and 10th slots
  const deathSlot = 11; // 12th slot (0-indexed)
  const leftPad = 32; // space for bolt + number
  const barW = 160;
  const w = leftPad + barW;
  const h = 18;
  const segW = (barW - 2) / max;
  let svg = `<svg width="${w}" height="${h + 12}" viewBox="0 0 ${w} ${h + 12}" style="vertical-align:-4px">`;
  // Defs for stripe patterns
  svg += `<defs>`;
  svg += `<pattern id="sc-stripe" width="5" height="5" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">`;
  svg += `<rect width="2" height="5" fill="#aa2222"/>`;
  svg += `</pattern>`;
  svg += `<pattern id="sc-stripe-death" width="4" height="4" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">`;
  svg += `<rect width="2" height="4" fill="#ff2222"/>`;
  svg += `</pattern>`;
  svg += `</defs>`;
  // Bolt icon + count number at left, vertically centered with bar
  svg += `<path d="M6 ${h/2 - 1}l2-4h1.8l-0.8 2.8h1.8l-2.5 4.5h-1.8l0.8-2.8h-1.3z" fill="#f44" opacity="0.9"/>`;
  svg += `<text x="17" y="${h/2 + 1}" dominant-baseline="central" fill="#ff6666" font-size="13" font-weight="bold" font-family="inherit">${count}</text>`;
  // Background track
  svg += `<rect x="${leftPad + 1}" y="1" width="${barW - 2}" height="${h}" rx="3" fill="#111" stroke="#333" stroke-width="1"/>`;
  // Segments
  for (let i = 0; i < max; i++) {
    const x = leftPad + 1 + i * segW;
    const filled = i < count;
    const isThreshold = thresholdSlots.includes(i);
    const isDeath = i === deathSlot;
    if (filled) {
      let fill = '#c33';
      if (i >= 10) fill = '#f22';
      else if (i >= 5) fill = '#e44';
      svg += `<rect x="${x + 0.5}" y="1.5" width="${segW - 1}" height="${h - 1}" rx="1" fill="${fill}"/>`;
      if (isDeath) {
        svg += `<line x1="${x + 1.5}" y1="2.5" x2="${x + segW - 2}" y2="${h - 2}" stroke="#fff" stroke-width="2"/>`;
        svg += `<line x1="${x + segW - 2}" y1="2.5" x2="${x + 1.5}" y2="${h - 2}" stroke="#fff" stroke-width="2"/>`;
      }
    } else if (isDeath) {
      // 12th slot empty — red X
      svg += `<rect x="${x + 0.5}" y="1.5" width="${segW - 1}" height="${h - 1}" rx="1" fill="#1a0000" stroke="#f22" stroke-width="1"/>`;
      svg += `<line x1="${x + 1.5}" y1="2.5" x2="${x + segW - 2}" y2="${h - 2}" stroke="#f44" stroke-width="2"/>`;
      svg += `<line x1="${x + segW - 2}" y1="2.5" x2="${x + 1.5}" y2="${h - 2}" stroke="#f44" stroke-width="2"/>`;
    } else if (isThreshold) {
      // Striped warning slots for 5, 10, 11
      const pattern = 'sc-stripe';
      svg += `<rect x="${x + 0.5}" y="1.5" width="${segW - 1}" height="${h - 1}" rx="1" fill="#1a1a1a"/>`;
      svg += `<rect x="${x + 0.5}" y="1.5" width="${segW - 1}" height="${h - 1}" rx="1" fill="url(#${pattern})"/>`;
    } else {
      svg += `<rect x="${x + 0.5}" y="1.5" width="${segW - 1}" height="${h - 1}" rx="1" fill="#1a1a1a"/>`;
    }
  }
  // Threshold labels centered under their boxes (0-indexed: 4=5th, 9=10th, 11=12th)
  const labels = { 5: 4, 10: 9, 12: 11 };
  for (const [num, slotIdx] of Object.entries(labels)) {
    const cx = leftPad + 1 + slotIdx * segW + segW / 2;
    svg += `<text x="${cx}" y="${h + 10}" text-anchor="middle" fill="#f88" font-size="8" font-family="inherit">${num}</text>`;
  }
  svg += `</svg>`;
  return svg;
}

function renderHullScale(damage) {
  const max = 5;
  const deathSlot = 4; // 0-indexed: 5th slot
  const leftPad = 32;
  const barW = max * 13.2 + 2; // match segment width with short circuits
  const w = leftPad + barW;
  const h = 18;
  const segW = (barW - 2) / max;
  let svg = `<svg width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" style="vertical-align:-4px">`;
  // Hull icon (X in box) + count at left
  svg += `<rect x="1" y="2" width="12" height="12" rx="2" fill="none" stroke="#f66" stroke-width="1.5"/>`;
  svg += `<line x1="3" y1="4" x2="11" y2="12" stroke="#f66" stroke-width="1.5"/>`;
  svg += `<line x1="11" y1="4" x2="3" y2="12" stroke="#f66" stroke-width="1.5"/>`;
  svg += `<text x="19" y="${h/2 + 1}" dominant-baseline="central" fill="#f66" font-size="13" font-weight="bold" font-family="inherit">${damage}</text>`;
  // Background track
  svg += `<rect x="${leftPad + 1}" y="1" width="${barW - 2}" height="${h - 2}" rx="3" fill="#111" stroke="#333" stroke-width="1"/>`;
  // Segments
  for (let i = 0; i < max; i++) {
    const x = leftPad + 1 + i * segW;
    const filled = i < damage;
    const isDeath = i === deathSlot;
    if (filled) {
      const fill = '#cc3333';
      svg += `<rect x="${x + 0.5}" y="1.5" width="${segW - 1}" height="${h - 3}" rx="1" fill="${fill}"/>`;
      if (isDeath) {
        svg += `<line x1="${x + 1.5}" y1="2.5" x2="${x + segW - 2}" y2="${h - 3.5}" stroke="#fff" stroke-width="2"/>`;
        svg += `<line x1="${x + segW - 2}" y1="2.5" x2="${x + 1.5}" y2="${h - 3.5}" stroke="#fff" stroke-width="2"/>`;
      }
    } else if (isDeath) {
      svg += `<rect x="${x + 0.5}" y="1.5" width="${segW - 1}" height="${h - 3}" rx="1" fill="#1a0000" stroke="#f22" stroke-width="1"/>`;
      svg += `<line x1="${x + 1.5}" y1="2.5" x2="${x + segW - 2}" y2="${h - 3.5}" stroke="#f44" stroke-width="2"/>`;
      svg += `<line x1="${x + segW - 2}" y1="2.5" x2="${x + 1.5}" y2="${h - 3.5}" stroke="#f44" stroke-width="2"/>`;
    } else {
      svg += `<rect x="${x + 0.5}" y="1.5" width="${segW - 1}" height="${h - 3}" rx="1" fill="#1a1a1a"/>`;
    }
  }
  svg += `</svg>`;
  return svg;
}

function renderShieldScale(count, max) {
  const leftPad = 32;
  const barW = max * 13.2 + 2; // match segment width with other scales
  const w = leftPad + barW;
  const h = 18;
  const segW = (barW - 2) / max;
  let svg = `<svg width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" style="vertical-align:-4px">`;
  // Shield icon + count at left
  svg += `<path d="M7 2L2 4.5v3.5c0 3 2.2 5.2 5 6 2.8-.8 5-3 5-6V4.5L7 2z" fill="#6af" opacity="0.8"/>`;
  svg += `<text x="17" y="${h/2 + 1}" dominant-baseline="central" fill="#6af" font-size="13" font-weight="bold" font-family="inherit">${count}</text>`;
  // Background track
  svg += `<rect x="${leftPad + 1}" y="1" width="${barW - 2}" height="${h - 2}" rx="3" fill="#111" stroke="#333" stroke-width="1"/>`;
  // Segments
  for (let i = 0; i < max; i++) {
    const x = leftPad + 1 + i * segW;
    const filled = i < count;
    const fill = filled ? '#4488ff' : '#1a1a1a';
    svg += `<rect x="${x + 0.5}" y="1.5" width="${segW - 1}" height="${h - 3}" rx="1" fill="${fill}"/>`;
  }
  svg += `</svg>`;
  return svg;
}

function renderPlayerStats(playerState, elementId) {
  const el = document.getElementById(elementId);
  const hull = el.querySelector('.hull');
  const shields = el.querySelector('.shields');
  const sc = el.querySelector('.short-circuits');

  hull.innerHTML = renderHullScale(playerState.hull_damage);
  const maxShields = getAllowedEnergy(playerState.shield_generator);
  shields.innerHTML = renderShieldScale(playerState.shields, maxShields);
  sc.innerHTML = renderShortCircuitScale(playerState.short_circuits);
}

function renderSystems(playerState, containerId) {
  const container = document.getElementById(containerId);
  const panels = container.querySelectorAll('.system-panel');
  const isPlayerSystems = containerId === 'player-systems';
  const canAct = isMyTurn() && gameState.turn_state === 'ChoosingAction';

  SYSTEM_KEYS.forEach((key, i) => {
    const sys = playerState[key];
    const panel = panels[i];
    const systemEnum = SYSTEM_ENUMS[i];

    // Rebuild panel DOM from scratch
    panel.innerHTML = '';

    // System image (col 1, spans rows)
    const img = document.createElement('img');
    img.className = 'system-img';
    img.src = SYSTEM_IMAGES[systemEnum];
    img.alt = SYSTEM_NAMES[systemEnum];
    img.addEventListener('mouseenter', (e) => showCardPreview(img.src, e));
    img.addEventListener('mousemove', positionCardPreview);
    img.addEventListener('mouseleave', hideCardPreview);
    panel.appendChild(img);

    // System name (col 2)
    const nameEl = document.createElement('div');
    nameEl.className = 'system-name';
    nameEl.textContent = SYSTEM_NAMES[systemEnum];
    panel.appendChild(nameEl);

    // Inline stats (col 2) — "E:3  OL:0  HW:1"
    const statsEl = document.createElement('div');
    statsEl.className = 'system-stats-inline';
    const overloadHtml = sys.overloads > 0
      ? `<span class="stat-overloads">${ICONS.overload(sys.overloads)}</span>`
      : '';
    statsEl.innerHTML =
      `<span class="stat-energy">${repeatIcon(ICONS.energy, sys.energy)} <span class="stat-num">${sys.energy}</span></span>` +
      overloadHtml;
    panel.appendChild(statsEl);

    // Hot-wired card thumbnails (spans both cols)
    if (sys.hot_wires.length > 0) {
      const hwContainer = document.createElement('div');
      hwContainer.className = 'hotwire-cards';
      sys.hot_wires.forEach(card => {
        const thumb = document.createElement('img');
        const filename = CARD_IMAGES[card.name];
        if (filename) {
          thumb.src = `cards/${filename}`;
        }
        thumb.alt = card.name;
        thumb.title = card.name;
        thumb.className = 'hotwire-thumb';
        thumb.draggable = false;
        thumb.addEventListener('mouseenter', (e) => showCardPreview(thumb.src, e));
        thumb.addEventListener('mousemove', positionCardPreview);
        thumb.addEventListener('mouseleave', hideCardPreview);
        hwContainer.appendChild(thumb);
      });
      panel.appendChild(hwContainer);
    }

    // Mark panel as overloaded
    if (sys.overloads > 0) {
      panel.classList.add('system-overloaded');
    } else {
      panel.classList.remove('system-overloaded');
    }

    // Action buttons (spans both cols)
    if (isPlayerSystems && canAct) {
      if (sys.overloads === 0) {
        const activateBtn = document.createElement('button');
        activateBtn.className = 'system-action-btn activate-btn';
        activateBtn.textContent = 'Activate';
        activateBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          if (systemEnum === 'FusionReactor') {
            showEnergyDistributionDialog();
          } else {
            sendAction({ ChooseAction: { action: { ActivateSystem: { system: systemEnum, energy_to_use: null, energy_distribution: null } } } });
          }
        });
        panel.appendChild(activateBtn);
      }

      if (sys.overloads > 0) {
        const removeBtn = document.createElement('button');
        removeBtn.className = 'system-action-btn overload-btn';
        removeBtn.textContent = 'Remove Overload';
        removeBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          sendAction({ ChooseAction: { action: { DiscardOverload: { system: systemEnum } } } });
        });
        panel.appendChild(removeBtn);
      }
    }
  });
}

// --- Energy Distribution Dialog (Fusion Reactor) ---
function showEnergyDistributionDialog() {
  closeModal();
  const myState = getMyState();
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.id = 'energy-modal';

  const modal = document.createElement('div');
  modal.className = 'modal';

  const title = document.createElement('h3');
  title.textContent = 'Distribute Energy';
  modal.appendChild(title);

  const inputs = {};
  // Fusion Reactor's allowed energy = starting StoreMoreEnergy effects + hot-wire StoreMoreEnergy
  const totalAllowed = getAllowedEnergy(myState.fusion_reactor);

  const currentTotal = SYSTEM_KEYS.reduce((sum, key) => sum + myState[key].energy, 0);

  const totalDisplay = document.createElement('div');
  totalDisplay.className = 'energy-total';
  totalDisplay.textContent = `Total: ${currentTotal} / ${totalAllowed}`;
  modal.appendChild(totalDisplay);

  SYSTEM_ENUMS.forEach((sysEnum, i) => {
    const key = SYSTEM_KEYS[i];
    const sys = myState[key];
    const isOverloaded = sys.overloads > 0;

    const row = document.createElement('div');
    row.className = 'energy-row';

    const label = document.createElement('label');
    label.textContent = SYSTEM_NAMES[sysEnum];
    row.appendChild(label);

    const input = document.createElement('input');
    input.type = 'number';
    input.min = '0';
    input.value = isOverloaded ? '0' : String(sys.energy);
    input.disabled = isOverloaded;
    input.addEventListener('input', () => {
      const sum = SYSTEM_ENUMS.reduce((s, se) => s + (parseInt(inputs[se].value) || 0), 0);
      totalDisplay.textContent = `Total: ${sum} / ${totalAllowed}`;
      confirmBtn.disabled = sum !== totalAllowed;
    });

    inputs[sysEnum] = input;
    row.appendChild(input);
    modal.appendChild(row);
  });

  const btnRow = document.createElement('div');
  btnRow.className = 'modal-buttons';

  const confirmBtn = document.createElement('button');
  confirmBtn.textContent = 'Confirm';
  confirmBtn.addEventListener('click', () => {
    const distribution = {};
    SYSTEM_ENUMS.forEach(se => {
      distribution[se] = parseInt(inputs[se].value) || 0;
    });
    sendAction({ ChooseAction: { action: { ActivateSystem: { system: 'FusionReactor', energy_to_use: null, energy_distribution: distribution } } } });
    closeModal();
  });

  const cancelBtn = document.createElement('button');
  cancelBtn.textContent = 'Cancel';
  cancelBtn.className = 'cancel-btn';
  cancelBtn.addEventListener('click', closeModal);

  btnRow.appendChild(confirmBtn);
  btnRow.appendChild(cancelBtn);
  modal.appendChild(btnRow);

  overlay.appendChild(modal);
  document.body.appendChild(overlay);
}

function closeModal() {
  const modal = document.getElementById('energy-modal');
  if (modal) modal.remove();
}

function renderGameInfoBar() {
  const bar = document.getElementById('game-info-bar');

  const turnLabel = isMyTurn() ? '⚡ Your Turn' : "Opponent's Turn";
  bar.querySelector('.turn-indicator').textContent = turnLabel;

  bar.querySelector('.actions-display').textContent = `Actions: ${gameState.actions_left}/3`;

  // Turn state
  let stateText = 'Choosing Action';
  if (typeof gameState.turn_state === 'object' && gameState.turn_state.ResolvingEffects) {
    const effects = gameState.turn_state.ResolvingEffects.effects;
    stateText = `Resolving Effects (${effects.length})`;
  }
  bar.querySelector('.turn-state').textContent = stateText;

  bar.querySelector('.deck-info').textContent = `Deck: ${gameState.deck.length} | Discard: ${gameState.discard_pile.length}`;
}

// --- Render hand ---
function renderHand(cards, containerId, isMyHand) {
  const container = document.getElementById(containerId);
  container.innerHTML = '';

  // Opponent hand: show compact card count indicator instead of individual cards
  if (!isMyHand) {
    const indicator = document.createElement('div');
    indicator.className = 'opponent-hand-indicator';
    const backImg = document.createElement('img');
    backImg.src = 'cards/attack_01[back,4].png';
    backImg.alt = 'card back';
    backImg.draggable = false;
    indicator.appendChild(backImg);
    const countSpan = document.createElement('span');
    countSpan.textContent = `Hand: ${cards.length} card${cards.length !== 1 ? 's' : ''}`;
    indicator.appendChild(countSpan);
    container.appendChild(indicator);
    return;
  }

  cards.forEach((card, index) => {
    const cardEl = document.createElement('div');
    cardEl.className = 'card my-card';
    cardEl.dataset.index = index;
    cardEl.title = card.name;

    const img = document.createElement('img');
    const filename = CARD_IMAGES[card.name];
    if (filename) {
      img.src = `cards/${filename}`;
    }
    img.alt = card.name;
    img.draggable = false;

    cardEl.appendChild(img);

    cardEl.addEventListener('click', (e) => {
      e.stopPropagation();
      // Card selection mode (for discards)
      if (cardSelectionState) {
        if (index === cardSelectionState.excludeIndex) return;
        const sel = cardSelectionState.selected;
        const idx = sel.indexOf(index);
        if (idx >= 0) {
          sel.splice(idx, 1);
        } else if (sel.length < cardSelectionState.count) {
          sel.push(index);
        }
        renderCardSelection();
        return;
      }
      if (!isMyTurn()) return;
      if (gameState.turn_state !== 'ChoosingAction') return;
      showCardPopup(cardEl, index);
    });

    container.appendChild(cardEl);
  });
}

// --- Action buttons ---
function renderActionButtons() {
  const buttons = document.getElementById('action-buttons');
  const passBtn = document.getElementById('pass-btn');
  const reduceSCBtn = document.getElementById('reduce-sc-btn');

  const canAct = isMyTurn() && gameState.turn_state === 'ChoosingAction';
  passBtn.disabled = !canAct;
  reduceSCBtn.disabled = !canAct;
  buttons.style.opacity = canAct ? '1' : '0.4';
}

// Wire up action buttons (once)
document.getElementById('pass-btn').addEventListener('click', () => {
  if (!isMyTurn() || gameState.turn_state !== 'ChoosingAction') return;
  const myHand = getMyState().hand;
  if (myHand.length > 5) {
    startDiscardSelection(myHand.length - 5);
  } else {
    sendAction({ Pass: { card_indices_to_discard: [] } });
  }
});

document.getElementById('reduce-sc-btn').addEventListener('click', () => {
  if (!isMyTurn() || gameState.turn_state !== 'ChoosingAction') return;
  sendAction({ ChooseAction: { action: 'ReduceShortCircuits' } });
});

// --- Discard selection for pass turn ---
function startDiscardSelection(count) {
  startCardSelectionMode(count, -1, (selectedIndices) => {
    sendAction({ Pass: { card_indices_to_discard: selectedIndices } });
  });
}

// --- Effect resolution ---

// Effects that must be resolved before StopResolvingEffects is allowed
const MANDATORY_EFFECTS = ['GainShortCircuit', 'OpponentDiscard'];

// Simple effects that need no extra input
const SIMPLE_EFFECTS = [
  'Attack', 'Shield', 'GainShortCircuit', 'LoseShortCircuit',
  'Draw', 'GainAction', 'OpponentGainShortCircuit', 'OpponentLoseShield', 'BypassShield',
];

function getEffectName(effect) {
  if (typeof effect === 'string') return effect;
  // Object-form effects like { MoveEnergyTo: "ShieldGenerator" }
  return Object.keys(effect)[0];
}

function getEffectDisplayName(effect) {
  const name = getEffectName(effect);
  // Pretty-print camelCase to spaced words
  return name.replace(/([A-Z])/g, ' $1').trim();
}

function getEffectIcon(effect) {
  const name = getEffectName(effect);
  const iconMap = {
    Attack: ICONS.effectAttack,
    Shield: ICONS.effectShield,
    GainShortCircuit: ICONS.effectGainShortCircuit,
    LoseShortCircuit: ICONS.effectLoseShortCircuit,
    Draw: ICONS.effectDraw,
    GainAction: ICONS.effectGainAction,
    OpponentGainShortCircuit: ICONS.effectOpponentGainShortCircuit,
    OpponentLoseShield: ICONS.effectOpponentLoseShield,
    BypassShield: ICONS.effectBypassShield,
    DiscardOverload: ICONS.effectDiscardOverload,
    OpponentGainOverload: ICONS.effectOpponentGainOverload,
    MoveEnergy: ICONS.effectMoveEnergy,
    MoveEnergyTo: ICONS.effectMoveEnergy,
    OpponentMoveEnergy: ICONS.effectOpponentMoveEnergy,
    PlayHotWire: ICONS.effectPlayHotWire,
    OpponentDiscard: ICONS.effectOpponentDiscard,
  };
  return iconMap[name] || '';
}

function isEffectMandatory(effect) {
  return MANDATORY_EFFECTS.includes(getEffectName(effect));
}

function isSimpleEffect(effect) {
  return SIMPLE_EFFECTS.includes(getEffectName(effect));
}

function renderEffectChips() {
  // Remove old container if present
  let container = document.getElementById('effect-chips');
  if (container) container.remove();

  if (!gameState) return;
  const ts = gameState.turn_state;
  if (typeof ts !== 'object' || !ts.ResolvingEffects) return;

  const effects = ts.ResolvingEffects.effects;
  if (!effects || effects.length === 0) return;

  container = document.createElement('div');
  container.id = 'effect-chips';

  const label = document.createElement('span');
  label.className = 'effect-chips-label';
  label.textContent = 'Effects to resolve:';
  container.appendChild(label);

  const hasMandatory = effects.some(isEffectMandatory);

  effects.forEach((effect, index) => {
    const chip = document.createElement('button');
    chip.className = 'effect-chip';
    const icon = getEffectIcon(effect);
    chip.innerHTML = icon ? `${icon} ${getEffectDisplayName(effect)}` : getEffectDisplayName(effect);

    if (isEffectMandatory(effect)) {
      chip.classList.add('mandatory');
    }

    const effectName = getEffectName(effect);

    // Determine if this player can click this effect
    const isOpponentDiscard = effectName === 'OpponentDiscard';
    const activePlayer = gameState.players_turn;
    const opponentPlayer = activePlayer === 'Player1' ? 'Player2' : 'Player1';

    // OpponentDiscard is resolved by the non-active player
    if (isOpponentDiscard) {
      if (myPlayer !== opponentPlayer) {
        chip.disabled = true;
        chip.title = 'Opponent must discard';
      } else {
        chip.title = 'Pick a card from your hand to discard';
        chip.addEventListener('click', () => {
          startOpponentDiscardMode();
        });
      }
    } else if (myPlayer !== activePlayer) {
      chip.disabled = true;
    } else if (isSimpleEffect(effect)) {
      chip.addEventListener('click', () => {
        sendAction({ ResolveEffect: { resolve_effect: effectName } });
      });
    } else {
      // Complex effects — handled in Task 9
      chip.addEventListener('click', () => {
        resolveComplexEffect(effect);
      });
    }

    container.appendChild(chip);
  });

  // Stop Resolving button
  if (myPlayer === gameState.players_turn) {
    const stopBtn = document.createElement('button');
    stopBtn.className = 'effect-stop-btn';
    stopBtn.textContent = 'Stop Resolving';
    stopBtn.disabled = hasMandatory;
    if (hasMandatory) {
      stopBtn.title = 'Must resolve mandatory effects first';
    }
    stopBtn.addEventListener('click', () => {
      sendAction('StopResolvingEffects');
    });
    container.appendChild(stopBtn);
  }

  // Insert above player hand
  const playerArea = document.getElementById('player-area');
  const playerHand = document.getElementById('player-hand');
  playerArea.insertBefore(container, playerHand);
}

// --- Complex effect resolution ---
function resolveComplexEffect(effect) {
  const name = getEffectName(effect);

  switch (name) {
    case 'DiscardOverload':
      showSystemPickerModal('Discard overload from which system?', (system) => {
        sendAction({ ResolveEffect: { resolve_effect: { DiscardOverload: { system } } } });
      });
      break;

    case 'OpponentGainOverload':
      showSystemPickerModal('Give opponent overload on which system?', (system) => {
        sendAction({ ResolveEffect: { resolve_effect: { OpponentGainOverload: { system } } } });
      });
      break;

    case 'MoveEnergy':
      showDualSystemPickerModal('Move Energy', 'From system:', 'To system:', (fromSystem, toSystem) => {
        sendAction({ ResolveEffect: { resolve_effect: { MoveEnergy: { from_system: fromSystem, to_system: toSystem } } } });
      });
      break;

    case 'MoveEnergyTo': {
      // The effect has a fixed target system embedded: { MoveEnergyTo: "ShieldGenerator" }
      const toSystem = effect[name];
      showSystemPickerModal(`Move energy to ${SYSTEM_NAMES[toSystem] || toSystem} from:`, (fromSystem) => {
        sendAction({ ResolveEffect: { resolve_effect: { MoveEnergyTo: { from_system: fromSystem, to_system: toSystem } } } });
      });
      break;
    }

    case 'OpponentMoveEnergy':
      showDualSystemPickerModal('Move Opponent Energy', 'From system:', 'To system:', (fromSystem, toSystem) => {
        sendAction({ ResolveEffect: { resolve_effect: { OpponentMoveEnergy: { from_system: fromSystem, to_system: toSystem } } } });
      });
      break;

    case 'PlayHotWire':
      startPlayHotWireEffect();
      break;

    default:
      showError(`Unknown complex effect: ${name}`);
  }
}

// --- Dual system picker modal (from + to) ---
function showDualSystemPickerModal(title, fromLabel, toLabel, onPick) {
  closeModal();
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.id = 'energy-modal';

  const modal = document.createElement('div');
  modal.className = 'modal';

  const heading = document.createElement('h3');
  heading.textContent = title;
  modal.appendChild(heading);

  let selectedFrom = null;

  const fromHeading = document.createElement('div');
  fromHeading.className = 'picker-label';
  fromHeading.textContent = fromLabel;
  modal.appendChild(fromHeading);

  const fromRow = document.createElement('div');
  fromRow.className = 'system-picker-row';

  SYSTEM_ENUMS.forEach(sysEnum => {
    const btn = document.createElement('button');
    btn.textContent = SYSTEM_NAMES[sysEnum];
    btn.className = 'system-pick-btn';
    btn.addEventListener('click', () => {
      selectedFrom = sysEnum;
      fromRow.querySelectorAll('.system-pick-btn').forEach(b => b.classList.remove('selected'));
      btn.classList.add('selected');
      // Show to-system picker
      toSection.classList.remove('hidden');
    });
    fromRow.appendChild(btn);
  });
  modal.appendChild(fromRow);

  const toSection = document.createElement('div');
  toSection.className = 'hidden';

  const toHeading = document.createElement('div');
  toHeading.className = 'picker-label';
  toHeading.textContent = toLabel;
  toSection.appendChild(toHeading);

  const toRow = document.createElement('div');
  toRow.className = 'system-picker-row';

  SYSTEM_ENUMS.forEach(sysEnum => {
    const btn = document.createElement('button');
    btn.textContent = SYSTEM_NAMES[sysEnum];
    btn.className = 'system-pick-btn';
    btn.addEventListener('click', () => {
      closeModal();
      onPick(selectedFrom, sysEnum);
    });
    toRow.appendChild(btn);
  });
  toSection.appendChild(toRow);
  modal.appendChild(toSection);

  const cancelBtn = document.createElement('button');
  cancelBtn.textContent = 'Cancel';
  cancelBtn.className = 'cancel-btn';
  cancelBtn.style.marginTop = '12px';
  cancelBtn.addEventListener('click', closeModal);
  modal.appendChild(cancelBtn);

  overlay.appendChild(modal);
  document.body.appendChild(overlay);
}

// --- PlayHotWire effect resolution ---
function startPlayHotWireEffect() {
  if (getMyState().hand.length === 0) {
    showError('No cards in hand to hot-wire');
    return;
  }

  // Enter card selection mode to pick a card to hot-wire
  // Use -1 as excludeIndex so no cards are excluded
  cardSelectionState = { count: 1, excludeIndex: -1, selected: [], promptLabel: 'Select a card to hot-wire', confirmLabel: 'Confirm Hot-Wire', onConfirm: (selectedIndices) => {
    const currentHand = getMyState().hand;
    const cardIndex = selectedIndices[0];
    const card = currentHand[cardIndex];
    const discardsNeeded = card.hot_wire_cost.cards_to_discard;
    // Check if there are enough other cards to pay the discard cost
    if (discardsNeeded > 0 && currentHand.length - 1 < discardsNeeded) {
      showError('Not enough cards in hand to pay discard cost');
      return;
    }
    showSystemPickerModal('Hot-Wire to which system?', (system) => {
      if (discardsNeeded > 0) {
        startCardSelectionMode(discardsNeeded, cardIndex, (discardIndices) => {
          sendAction({ ResolveEffect: { resolve_effect: { PlayHotWire: { card_index: cardIndex, system: system, indices_to_discard: discardIndices } } } });
        });
      } else {
        sendAction({ ResolveEffect: { resolve_effect: { PlayHotWire: { card_index: cardIndex, system: system, indices_to_discard: [] } } } });
      }
    });
  }};
  renderCardSelection();
}

// --- OpponentDiscard mode ---
function startOpponentDiscardMode() {
  // The non-active player picks a card from their hand to discard
  const myHand = getMyState().hand;
  if (myHand.length === 0) {
    showError('No cards in hand to discard');
    return;
  }

  cardSelectionState = { count: 1, excludeIndex: -1, selected: [], onConfirm: (selectedIndices) => {
    sendAction({ ResolveEffect: { resolve_effect: { OpponentDiscard: { card_index: selectedIndices[0] } } } });
  }};
  renderCardSelection();
}

// Close popup on click outside
document.addEventListener('click', () => closePopup());
