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
});

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

    // Render hot-wired card thumbnails
    let hwContainer = panel.querySelector('.hotwire-cards');
    if (hwContainer) hwContainer.remove();
    if (sys.hot_wires.length > 0) {
      hwContainer = document.createElement('div');
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
        hwContainer.appendChild(thumb);
      });
      panel.appendChild(hwContainer);
    }

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
    chip.textContent = getEffectDisplayName(effect);

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
  const myHand = getMyState().hand;
  if (myHand.length === 0) {
    showError('No cards in hand to hot-wire');
    return;
  }

  // Enter card selection mode to pick a card to hot-wire
  // Use -1 as excludeIndex so no cards are excluded
  cardSelectionState = { count: 1, excludeIndex: -1, selected: [], promptLabel: 'Select a card to hot-wire', confirmLabel: 'Confirm Hot-Wire', onConfirm: (selectedIndices) => {
    const cardIndex = selectedIndices[0];
    const card = myHand[cardIndex];
    showSystemPickerModal('Hot-Wire to which system?', (system) => {
      const discardsNeeded = card.hot_wire_cost.cards_to_discard;
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
