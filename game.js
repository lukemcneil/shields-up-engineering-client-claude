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
const SYSTEM_NAMES = {
  FusionReactor: 'Fusion Reactor',
  LifeSupport: 'Life Support',
  ShieldGenerator: 'Shield Generator',
  Weapons: 'Weapons System',
};

// --- Error display ---
function showError(msg) {
  console.error('Server error:', msg);
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

  SYSTEM_KEYS.forEach((key, i) => {
    const sys = playerState[key];
    const panel = panels[i];

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
  });
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
    container.appendChild(cardEl);
  });
}
