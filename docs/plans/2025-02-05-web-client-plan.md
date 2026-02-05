# Web Client Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.
> **Progress tracking:** Check boxes below as steps complete. Any session can resume by reading this file.

**Goal:** Build a playable browser-based client for Shields Up Engineering that connects to the existing Rust WebSocket server.

**Architecture:** Single-page vanilla HTML/CSS/JS app. One JS file manages WebSocket connection, game state, and DOM rendering. The entire UI re-renders from server GameState on each update. No framework, no build step.

**Tech Stack:** HTML5, CSS3, vanilla JavaScript (ES modules not needed — single file), WebSocket API

## Session Setup

Before starting work each session, do the following:

1. **Read this plan file** to see which tasks/steps are checked off
2. **Start the Rust server** in background: `cargo run` from `shields-up-engineering-server/` (runs on port 8000)
3. **Start HTTP server for client** in background: `python3 -m http.server 3000` from `shields-up-engineering-client/` (needed after Task 1 creates the directory)
4. **Read the design doc** at `docs/plans/2025-02-05-web-client-design.md` for full context on layout, interaction model, and card image mapping

## Verification with Playwright

After each task's implementation steps, use the **Playwright MCP tools** available in this environment to verify the UI:

1. `browser_navigate` to `http://localhost:3000`
2. `browser_snapshot` to check the DOM structure and accessibility tree
3. `browser_take_screenshot` to visually verify the layout looks correct
4. For interactive tasks: use `browser_click`, `browser_fill_form`, etc. to simulate connecting to a game and performing actions
5. To test two-player flow: use `browser_tabs` to open a second tab, connect as Player 2

Fix any visual or functional issues found via Playwright before marking a task complete.

## Key Context

- **Server WebSocket endpoint**: `ws://localhost:8000/game/<game_name>`
- **Server protocol**: First message is full `GameState` JSON. Send `UserActionWithPlayer` JSON. Receive `{"Ok":null}` or `{"Err":"..."}` after actions, plus `GameState` broadcasts on state change.
- **Card images**: In `shields-up-engineering-client/cards/` (symlink to `../cards/`). Filenames like `attack_01[face,4].png`. See CARD_IMAGES mapping in Task 3.
- **System card images**: `aa_Fusion_Reactor[face,2].png`, `aa_Life_Support[face,2].png`, `aa_Shield_Generator[face,2].png`, `aa_Weapons_System[face,2].png`
- **Rulebook PDF**: `SUE-rule-book-v1.pdf` at repo root — reference for game rules if needed
- **Git**: Repo is at `shields-up-engineering-server/`. Client dir is outside the server git repo. No `circlefin` remote on this repo — use `origin` (points to `github.com-personal:lukemcneil/shields-up-engineering-server.git`).
- **PR auth**: `gh` CLI is authenticated as an enterprise account and cannot create PRs on this personal repo. Push branches and create PRs manually or via the GitHub web UI.

## Progress

- [x] Task 1: Project scaffolding and lobby screen
- [x] Task 2: Game board layout — static structure
- [x] Task 3: Render game state — player stats and systems
- [x] Task 4: Render hands with card images
- [ ] Task 5: Choosing Action — Play Instant and basic actions
- [ ] Task 6: Choosing Action — Activate System
- [ ] Task 7: Choosing Action — Hot-Wire cards
- [ ] Task 8: Resolving Effects — simple effects
- [ ] Task 9: Resolving Effects — effects with choices
- [ ] Task 10: Polish and pass-turn discard flow
- [ ] Task 11: Final integration test and cleanup

---

### Task 1: Project scaffolding and lobby screen

**Files:**
- Create: `shields-up-engineering-client/index.html`
- Create: `shields-up-engineering-client/style.css`
- Create: `shields-up-engineering-client/game.js`
- Create: `shields-up-engineering-client/cards` (symlink)

- [x] **Step 1: Create the directory and symlink**

```bash
mkdir -p shields-up-engineering-client
ln -s ../cards shields-up-engineering-client/cards
```

- [x] **Step 2: Create index.html with lobby UI**

Create `shields-up-engineering-client/index.html` with:
- Dark navy background page
- A centered lobby div with:
  - Text input for game name (default: "game1")
  - Two radio buttons: Player 1 / Player 2
  - Connect button
- A hidden game board div (empty for now)
- Links to style.css and game.js

- [x] **Step 3: Create style.css with base styles**

- Dark navy (`#0a1628`) background, white/light text
- Lobby centered on screen, styled inputs/buttons with orange accent (`#e8622a`)
- `.hidden { display: none; }` utility class
- Base font: system monospace or sans-serif

- [x] **Step 4: Create game.js with WebSocket connection**

- On connect button click:
  - Read game name and player selection
  - Open WebSocket to `ws://localhost:8000/game/<name>`
  - On open: hide lobby, show game board
  - On message: parse JSON, store as `gameState`, call `render()`
  - On close/error: show reconnect message
- Store selected player as global `myPlayer` ("Player1" or "Player2")
- `render()` function: for now just `console.log(gameState)`

- [x] **Step 5: Verify**

Run the Rust server (`cargo run` in server dir), open `shields-up-engineering-client/index.html` in browser (or `python3 -m http.server 3000` from client dir), enter game name, connect. Check browser console shows GameState JSON.

Note: `file://` won't work for WebSocket — must use a local HTTP server.

- [x] **Step 6: Commit**

```bash
git add shields-up-engineering-client/
git commit -m "feat: add web client scaffolding with lobby and WebSocket connection"
```

---

### Task 2: Game board layout — static structure

**Files:**
- Modify: `shields-up-engineering-client/index.html`
- Modify: `shields-up-engineering-client/style.css`

- [x] **Step 1: Add game board HTML structure**

Inside the game board div, add three zones:

```
#opponent-area
  .player-stats (hull, shields, short-circuits)
  .systems-row (4 system panels)
  .hand-row (opponent cards)

#game-info-bar
  .turn-indicator
  .actions-display
  .turn-state
  .deck-info

#player-area
  .hand-row (your cards)
  .systems-row (4 system panels)
  .player-stats
  .action-buttons (pass, reduce short circuits)
```

Each system panel (`.system-panel`) contains:
- System name
- System card image (`aa_*` images)
- Energy display
- Overload indicator
- Hot-wire card count/slots

- [x] **Step 2: Style the layout**

- Game board: full viewport, flex column
- Opponent area: ~30% height, top
- Game info bar: ~40px fixed, middle, horizontal flex
- Player area: ~60% height, bottom
- Systems row: horizontal flex with 4 equal panels
- System panels: dark card-like boxes with colored left border (orange=Weapons, teal=LifeSupport, blue=ShieldGenerator, yellow=FusionReactor)
- Player stats: horizontal row of labeled values

- [x] **Step 3: Verify**

Open in browser, connect to a game. The layout should be visible (empty/placeholder values). No data populated yet — just structure.

- [x] **Step 4: Commit**

```bash
git add shields-up-engineering-client/
git commit -m "feat: add game board HTML structure and CSS layout"
```

---

### Task 3: Render game state — player stats and systems

**Files:**
- Modify: `shields-up-engineering-client/game.js`

- [x] **Step 1: Implement card image lookup**

```js
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
```

- [x] **Step 2: Implement render() — player stats**

Write `renderPlayerStats(playerState, elementId)`:
- Set hull damage text (e.g., "Hull: 2/5")
- Set shields text (e.g., "Shields: 2")
- Set short circuits text (e.g., "Short Circuits: 3")

Call for both players using `gameState.player1` / `gameState.player2`.

- [x] **Step 3: Implement render() — system panels**

Write `renderSystem(systemState, panelElement)`:
- Show energy as filled/empty pips (filled = current energy, total = allowed from StoreMoreEnergy effects)
- Show overload count (red badges)
- Show hot-wired card count
- If overloaded, dim the panel

Render all 4 systems for both players: `fusion_reactor`, `life_support`, `shield_generator`, `weapons_system`.

- [x] **Step 4: Implement render() — game info bar**

- Show whose turn: "Player 1's Turn" or "Player 2's Turn"
- Show actions left: "Actions: 2/3"
- Show turn state: "Choosing Action" or "Resolving Effects"
- If resolving, show effects list as text
- Show deck size and discard pile size

- [x] **Step 5: Verify**

Connect to a game in browser. All stats, system panels, and game info should render with live data from the server. Play a few actions via websocat in another terminal and confirm the UI updates.

- [x] **Step 6: Commit**

```bash
git add shields-up-engineering-client/game.js
git commit -m "feat: render player stats, systems, and game info from server state"
```

---

### Task 4: Render hands with card images

**Files:**
- Modify: `shields-up-engineering-client/game.js`
- Modify: `shields-up-engineering-client/style.css`

- [x] **Step 1: Implement renderHand()**

Write `renderHand(cards, containerElement, isMyHand)`:
- Clear the container
- For each card, create an element with:
  - Card face image from `CARD_IMAGES[card.name]`
  - Card name as tooltip/title
- If `isMyHand` is true, add click handler (implemented in later task — for now just add a `data-index` attribute)
- Style cards ~150px wide, slight overlap for space

- [x] **Step 2: Style cards**

- Card images: fixed width, slight border-radius, subtle box-shadow
- Hover: lift up slightly (transform translateY)
- Hand container: horizontal flex with negative margin for overlap

- [x] **Step 3: Verify**

Both players' hands should show card images. Hovering should lift cards.

- [x] **Step 4: Commit**

```bash
git add shields-up-engineering-client/
git commit -m "feat: render card hands with card face images"
```

---

### Task 5: Choosing Action — Play Instant and basic actions

**Files:**
- Modify: `shields-up-engineering-client/game.js`
- Modify: `shields-up-engineering-client/style.css`

- [ ] **Step 1: Add action helper — sendAction()**

```js
function sendAction(userAction) {
  const msg = { player: myPlayer, user_action: userAction };
  ws.send(JSON.stringify(msg));
}
```

- [ ] **Step 2: Implement card click → Play Instant**

When a card in hand is clicked during ChoosingAction:
- Show a small popup/tooltip on the card with two buttons: "Play Instant" and "Hot-Wire"
- "Play Instant" sends: `{ "ChooseAction": { "action": { "PlayInstantCard": { "card_index": N } } } }`
- Close the popup after sending

- [ ] **Step 3: Implement Pass Turn button**

- "Pass Turn" button in player area
- On click: if hand.length > 5, show a card selection UI to pick cards to discard down to 5
- Otherwise send: `{ "Pass": { "card_indices_to_discard": [] } }`

- [ ] **Step 4: Implement Reduce Short Circuits button**

- Button in player area
- Sends: `{ "ChooseAction": { "action": "ReduceShortCircuits" } }`

- [ ] **Step 5: Only show controls when it's your turn and state is ChoosingAction**

- Check `gameState.players_turn === myPlayer`
- Check `gameState.turn_state === "ChoosingAction"`
- Hide/disable action buttons otherwise

- [ ] **Step 6: Implement error display**

- When server responds with `{"Err": "..."}`, show a brief toast/message with the error
- Auto-dismiss after 3 seconds

- [ ] **Step 7: Verify**

Connect two tabs as P1 and P2. P1 plays an instant card — both tabs update. P1 passes — P2's tab becomes active. Errors show as toasts.

- [ ] **Step 8: Commit**

```bash
git add shields-up-engineering-client/
git commit -m "feat: implement play instant, pass turn, reduce short circuits actions"
```

---

### Task 6: Choosing Action — Activate System

**Files:**
- Modify: `shields-up-engineering-client/game.js`
- Modify: `shields-up-engineering-client/style.css`

- [ ] **Step 1: Make system panels clickable**

During ChoosingAction + your turn:
- Non-overloaded system panels get an "Activate" button
- Clicking sends ActivateSystem

- [ ] **Step 2: Non-Fusion activation**

For Weapons, Life Support, Shield Generator:
- Send: `{ "ChooseAction": { "action": { "ActivateSystem": { "system": "<System>", "energy_to_use": null, "energy_distribution": null } } } }`
- Server uses default energy from the system itself

- [ ] **Step 3: Fusion Reactor activation — energy distribution dialog**

When activating Fusion Reactor:
- Show a modal/overlay with number inputs for each system (Fusion Reactor, Weapons, Life Support, Shield Generator)
- Pre-fill with current energy values
- Show total allowed energy, enforce sum constraint
- Disable inputs for overloaded systems (set to 0)
- On confirm, send:
  ```json
  { "ChooseAction": { "action": { "ActivateSystem": {
    "system": "FusionReactor",
    "energy_to_use": null,
    "energy_distribution": { "FusionReactor": N, "Weapons": N, "LifeSupport": N, "ShieldGenerator": N }
  } } } }
  ```

- [ ] **Step 4: Discard Overload button on overloaded systems**

- If a system has overloads > 0, show "Remove Overload" button on that panel
- Sends: `{ "ChooseAction": { "action": { "DiscardOverload": { "system": "<System>" } } } }`

- [ ] **Step 5: Verify**

Activate weapons — should trigger resolving effects. Activate Fusion Reactor — dialog appears, distribute energy, confirm. Remove overload from a disabled system.

- [ ] **Step 6: Commit**

```bash
git add shields-up-engineering-client/
git commit -m "feat: implement system activation with energy distribution dialog"
```

---

### Task 7: Choosing Action — Hot-Wire cards

**Files:**
- Modify: `shields-up-engineering-client/game.js`
- Modify: `shields-up-engineering-client/style.css`

- [ ] **Step 1: Hot-Wire flow**

When "Hot-Wire" is clicked from the card popup:
1. Highlight the clicked card
2. Show system selection: 4 system buttons (only valid systems for the card's affinity — if card has no system, all 4; if it has a system, only that system unless UseSystemCards effects allow others)
3. After picking system: if card has `cards_to_discard > 0`, prompt to select that many other cards from hand
4. Send: `{ "ChooseAction": { "action": { "HotWireCard": { "card_index": N, "system": "<System>", "indices_to_discard": [...] } } } }`

- [ ] **Step 2: Card selection mode for discards**

- When discards are needed, enter a "select cards" mode
- Cards in hand become toggleable (except the card being hot-wired)
- Show a count: "Select N cards to discard"
- Confirm button when correct number selected

- [ ] **Step 3: Verify**

Hot-wire a card onto a system. Try one with a discard cost. Verify the system's hot-wire count increases in the UI.

- [ ] **Step 4: Commit**

```bash
git add shields-up-engineering-client/
git commit -m "feat: implement hot-wire card action with system and discard selection"
```

---

### Task 8: Resolving Effects — simple effects

**Files:**
- Modify: `shields-up-engineering-client/game.js`
- Modify: `shields-up-engineering-client/style.css`

- [ ] **Step 1: Render effect chips**

During ResolvingEffects, render each effect in the effects list as a clickable chip/button in the game info bar area or above the player's hand.

- [ ] **Step 2: Implement simple effect resolution**

For effects that need no extra input, clicking the chip sends:
- Attack → `{ "ResolveEffect": { "resolve_effect": "Attack" } }`
- Shield → `{ "ResolveEffect": { "resolve_effect": "Shield" } }`
- GainShortCircuit → `{ "ResolveEffect": { "resolve_effect": "GainShortCircuit" } }`
- LoseShortCircuit → `{ "ResolveEffect": { "resolve_effect": "LoseShortCircuit" } }`
- Draw → `{ "ResolveEffect": { "resolve_effect": "Draw" } }`
- GainAction → `{ "ResolveEffect": { "resolve_effect": "GainAction" } }`
- OpponentGainShortCircuit → `{ "ResolveEffect": { "resolve_effect": "OpponentGainShortCircuit" } }`
- OpponentLoseShield → `{ "ResolveEffect": { "resolve_effect": "OpponentLoseShield" } }`
- BypassShield → `{ "ResolveEffect": { "resolve_effect": "BypassShield" } }`

- [ ] **Step 3: Implement StopResolvingEffects button**

- Show "Stop Resolving" button during ResolvingEffects
- Sends: `"StopResolvingEffects"`
- Disable if any effect in the list has `must_resolve` = true (GainShortCircuit, OpponentDiscard)

Note: The client can check which effects are mandatory. GainShortCircuit and OpponentDiscard must be resolved. All others are optional.

- [ ] **Step 4: Verify**

Play an instant card, resolve its effects by clicking chips. Stop resolving optional effects. Verify state transitions correctly.

- [ ] **Step 5: Commit**

```bash
git add shields-up-engineering-client/
git commit -m "feat: implement simple effect resolution and stop resolving"
```

---

### Task 9: Resolving Effects — effects with choices

**Files:**
- Modify: `shields-up-engineering-client/game.js`

- [ ] **Step 1: System picker for targeted effects**

For effects that need a system choice, clicking the chip opens a system picker (4 buttons):
- DiscardOverload → pick system → `{ "ResolveEffect": { "resolve_effect": { "DiscardOverload": { "system": "<System>" } } } }`
- OpponentGainOverload → pick system → `{ "ResolveEffect": { "resolve_effect": { "OpponentGainOverload": { "system": "<System>" } } } }`

- [ ] **Step 2: Dual-system picker for move energy effects**

For MoveEnergy, MoveEnergyTo, OpponentMoveEnergy — pick from-system and to-system:
- MoveEnergy → `{ "ResolveEffect": { "resolve_effect": { "MoveEnergy": { "from_system": "...", "to_system": "..." } } } }`
- MoveEnergyTo (has fixed to_system from effect) → `{ "ResolveEffect": { "resolve_effect": { "MoveEnergyTo": { "from_system": "...", "to_system": "..." } } } }`
- OpponentMoveEnergy → same structure

Note: MoveEnergyTo has a fixed target system embedded in the effect (e.g., `MoveEnergyTo(ShieldGenerator)`). The chip should show the target and only ask for from-system.

- [ ] **Step 3: PlayHotWire effect resolution**

When PlayHotWire chip is clicked:
- Reuse the hot-wire flow from Task 7 (card selection, system selection, discard selection)
- Send as ResolveEffect instead of ChooseAction

- [ ] **Step 4: OpponentDiscard**

When OpponentDiscard is in the effects list:
- The non-active player's UI becomes interactive for this one action
- They see their hand with a prompt: "Opponent played a discard effect. Pick a card to discard."
- On card click, sends (as the non-active player): `{ "ResolveEffect": { "resolve_effect": { "OpponentDiscard": { "card_index": N } } } }`

- [ ] **Step 5: Verify**

Test move energy effects, overload targeting, and opponent discard flow across two tabs.

- [ ] **Step 6: Commit**

```bash
git add shields-up-engineering-client/game.js
git commit -m "feat: implement effect resolution with system pickers and opponent discard"
```

---

### Task 10: Polish and pass-turn discard flow

**Files:**
- Modify: `shields-up-engineering-client/game.js`
- Modify: `shields-up-engineering-client/style.css`

- [ ] **Step 1: Pass turn with hand-size discard**

When passing with hand > 5 cards:
- Enter card selection mode: "Discard down to 5 cards. Select N cards."
- Toggleable cards, confirm button
- Send: `{ "Pass": { "card_indices_to_discard": [...] } }`

- [ ] **Step 2: Show hot-wired cards on system panels**

- Below each system, show small thumbnails of hot-wired card faces
- Clickable to expand/view the card

- [ ] **Step 3: Visual feedback**

- Highlight active player's area
- Dim non-active player's area
- Pulse/highlight the game info bar when it's your turn
- Color-code effect chips (red for mandatory, blue for optional)

- [ ] **Step 4: Error toast styling**

- Red background toast in corner
- Auto-dismiss with fade-out

- [ ] **Step 5: Verify**

Full playthrough: connect two tabs, play multiple turns, hot-wire cards, activate systems, resolve effects, pass turns with discards. Verify everything works end-to-end.

- [ ] **Step 6: Commit**

```bash
git add shields-up-engineering-client/
git commit -m "feat: polish UI with hot-wire display, visual feedback, and pass-turn discards"
```

---

### Task 11: Final integration test and cleanup

- [ ] **Step 1: Full game playthrough**

Play a complete game across two browser tabs until someone reaches 5 hull damage (or 12 short circuits if server supports it). Document any bugs found.

- [ ] **Step 2: Fix any bugs found**

Address issues from the playthrough.

- [ ] **Step 3: Update CLAUDE.md**

Add client info to the existing CLAUDE.md or create one in the client directory noting:
- How to run the client (`python3 -m http.server 3000` from client dir)
- Requires server running on port 8000
- Open two tabs for local play

- [ ] **Step 4: Final commit**

```bash
git add -A
git commit -m "feat: complete web client for Shields Up Engineering"
```
