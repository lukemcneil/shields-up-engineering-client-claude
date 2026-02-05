# Web Client Design — Shields Up Engineering

## Overview

A browser-based client for the Shields Up Engineering card game. Connects to the existing Rust WebSocket server. Vanilla HTML/CSS/JS with no build step. Uses the existing card artwork.

## File Structure

```
shields-up-engineering-client/
├── index.html       # Single page: lobby + game board
├── style.css        # All styling
├── game.js          # WebSocket, state management, UI rendering
└── cards/           # Symlink to ../cards/
```

Served locally via `python3 -m http.server` or `open index.html`. No server changes needed (the Rocket server already handles WebSocket at `/game/<name>`).

## Layout

Three horizontal zones, stacked vertically:

### Opponent Area (top)
- Hull damage (0-5), shields, short circuits
- Four system panels in a row: Fusion Reactor, Life Support, Shield Generator, Weapons
- Each system shows: energy count, overload count, number of hot-wired cards
- Hand shown as face-down card backs with count (for future remote play hiding; locally both hands are visible during playtesting)

### Game Info Bar (middle)
- Whose turn it is (highlighted)
- Actions remaining (shown as pips or number)
- Current turn state: "Choosing Action" or "Resolving Effects"
- If resolving: list of pending effects as chips/badges
- Deck size and discard pile size

### Your Area (bottom)
- Hull damage, shields, short circuits (same as opponent but larger/more prominent)
- Four system panels — clickable to activate
- Hand of cards laid out horizontally, each showing the card face image
- Cards are clickable for Play Instant or Hot-Wire

### Lobby (pre-game)
- Text input for game name
- Player 1 / Player 2 toggle
- Connect button
- Replaced by the game board on connection

## Interaction Model

### During ChoosingAction

- Cards in hand are clickable. Clicking a card shows two options:
  - "Play Instant" (0 actions) — sends PlayInstantCard, transitions to ResolvingEffects
  - "Hot-Wire" (1 action) — prompts for target system, then cards to discard for cost
- System panels are clickable to activate:
  - Non-Fusion systems: sends ActivateSystem with default energy usage
  - Fusion Reactor: opens energy distribution dialog (number inputs per system, must sum to allowed energy)
- Utility buttons visible:
  - "Reduce Short Circuits" (1 action)
  - "Remove Overload" on overloaded systems (1 action)
  - "Pass Turn" — if hand > 5, prompts to pick cards to discard first

### During ResolvingEffects

- Pending effects shown as clickable chips
- Simple effects (Attack, Shield, GainShortCircuit, LoseShortCircuit, Draw, GainAction) resolve immediately on click
- Effects needing choices open a picker:
  - MoveEnergy / MoveEnergyTo / OpponentMoveEnergy: pick from-system and to-system
  - DiscardOverload: pick system
  - OpponentGainOverload: pick system
  - PlayHotWire: pick card, system, and discard cards
  - BypassShield: resolves on click (consumes an Attack effect too)
- OpponentDiscard: switches control to the opponent player, who picks a card
- "Stop Resolving" button — disabled if mandatory effects remain

### Read-Only State

The non-active player's view is read-only (no clickable actions), except when they need to resolve OpponentDiscard.

## Card Image Mapping

Card images are named `<name>[face,N].png` and `<name>[back,N].png` where N varies. The JS needs a lookup table mapping card names to filenames:

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

System cards use `aa_<SystemName>[face,2].png`.

## WebSocket Protocol

- Connect to `ws://<host>:8000/game/<game_name>`
- First message received: full `GameState` JSON
- Send: `UserActionWithPlayer` JSON (`{ player, user_action }`)
- Receive after action: `{"Ok": null}` or `{"Err": "<error>"}` — followed by updated `GameState` broadcast
- On any `GameState` message, re-render the entire UI from the new state

## Visual Style

- Dark navy background (matching card art aesthetic)
- Orange/teal accents for interactive elements
- Card images displayed at roughly card proportions (~180px wide)
- System panels with colored borders matching their system color (orange for Weapons, teal for Life Support, blue for Shield Generator, yellow for Fusion Reactor)
- Responsive enough for a laptop screen; not targeting mobile

## Future Considerations (not in scope now)

- Hide opponent's hand for remote play (server would need to strip this)
- Sound effects for attacks/shields
- Animation for card plays and damage
- Game over screen with winner announcement
- Spectator mode
