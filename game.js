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
connectBtn.addEventListener('click', () => {
  const gameName = gameNameInput.value.trim();
  if (!gameName) {
    lobbyStatus.textContent = 'Enter a game name.';
    return;
  }

  myPlayer = document.querySelector('input[name="player"]:checked').value;
  const wsUrl = `ws://${location.hostname || 'localhost'}:8000/game/${gameName}`;

  lobbyStatus.textContent = 'Connecting...';
  connectBtn.disabled = true;

  ws = new WebSocket(wsUrl);

  ws.addEventListener('open', () => {
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
});

// --- Card image lookup ---
const CARD_IMAGES = {
  'attack_01': 'attack_01[face,4].png',
  'attack_02': 'attack_02[face,2].png',
  'draw_01': 'draw_01[face,6].png',
  'draw_06': 'draw_06[face,4].png',
  'generic_01': 'generic_01[face,8].png',
  'generic_02': 'generic_02[face,3].png',
  'generic_07': 'generic_07[face,9].png',
  'power_05b': 'power_05b[face,4].png',
  'shields_01': 'shields_01[face,4].png',
  'shields_02': 'shields_02[face,2].png',
};

const SYSTEM_KEYS = ['fusion_reactor', 'life_support', 'shield_generator', 'weapons_system'];
const SYSTEM_ENUMS = ['FusionReactor', 'LifeSupport', 'ShieldGenerator', 'Weapons'];
const SYSTEM_NAMES = {
  FusionReactor: 'Fusion Reactor',
  LifeSupport: 'Life Support',
  ShieldGenerator: 'Shield Generator',
  Weapons: 'Weapons System',
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
  const card = getMyState().hand[cardIndex];
  showSystemPickerModal('Hot-Wire to which system?', (system) => {
    const discardsNeeded = card.hot_wire_cost.cards_to_discard;
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
  prompt.textContent = `Select ${count} card(s) to discard (${selected.length}/${count})`;
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
      confirmBtn.textContent = 'Confirm Discard';
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
}

function renderPlayerStats(playerState, elementId) {
  const el = document.getElementById(elementId);
  const hull = el.querySelector('.hull');
  const shields = el.querySelector('.shields');
  const sc = el.querySelector('.short-circuits');

  hull.textContent = `Hull: ${playerState.hull_damage}/5`;
  shields.textContent = `Shields: ${playerState.shields}`;
  sc.textContent = `Short Circuits: ${playerState.short_circuits}`;
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

    const energyEl = panel.querySelector('.system-energy');
    const overloadEl = panel.querySelector('.system-overloads');
    const hotwireEl = panel.querySelector('.system-hotwires');

    energyEl.textContent = `Energy: ${sys.energy}`;
    overloadEl.textContent = `Overloads: ${sys.overloads}`;
    hotwireEl.textContent = `Hot-Wires: ${sys.hot_wires.length}`;

    // Dim panel if overloaded
    if (sys.overloads > 0) {
      panel.style.opacity = '0.5';
    } else {
      panel.style.opacity = '1';
    }

    // Remove old action buttons
    panel.querySelectorAll('.system-action-btn').forEach(b => b.remove());

    if (isPlayerSystems && canAct) {
      // Activate button (only if not overloaded)
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

      // Discard Overload button
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

  const turnLabel = gameState.players_turn === 'Player1' ? "Player 1's Turn" : "Player 2's Turn";
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

  cards.forEach((card, index) => {
    const cardEl = document.createElement('div');
    cardEl.className = 'card' + (isMyHand ? ' my-card' : '');
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

    if (isMyHand) {
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
    }

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

// --- Discard selection for pass turn (placeholder, refined in Task 10) ---
let discardMode = null;
function startDiscardSelection(count) {
  console.log('Need to discard', count, 'cards — not yet implemented');
  // For now just pass with empty discards
  sendAction({ Pass: { card_indices_to_discard: [] } });
}

// Close popup on click outside
document.addEventListener('click', () => closePopup());
