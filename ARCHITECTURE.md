# Architecture

This project is a pure frontend WeChat Mini Game collection. Runtime code runs on Canvas through the WeChat game APIs, with an optional browser debug shim under `dev/`.

## Runtime Flow

`game.js` imports `js/main.js`. `main.js` creates the canvas context from `js/render.js`, constructs `GameHost`, and starts the animation loop.

`GameHost` owns the active scene, frame updates, rendering, scene switching, touch dispatch, and shared visual effects. Scenes expose optional `init()`, `update(dt)`, `render(ctx)`, `onTouchStart(point)`, `onTouchMove(point)`, `onTouchEnd(point)`, and `destroy()` methods.

## Module Boundaries

- `js/core/`: framework-level services. `game-host.js` controls scene lifecycle, `input-dispatcher.js` routes touches to interactive objects, and `storage.js` persists local scores.
- `js/scenes/`: app-level screens. `menu-scene.js` renders the game selection menu and opens configuration modals.
- `js/games/`: game modules. Each game should keep rule/state logic in `state.js` and scene/render/input glue in `index.js`.
- `js/ui/`: reusable Canvas UI primitives and overlays such as `Button`, `ConfigModal`, `ResultModal`, and `Confetti`.
- `js/themes/`: shared visual tokens. Current UI uses `elegant.js`.
- `dev/`: browser-only debug adapter. It should not become a second runtime architecture.

## Game Registration

Games are registered in `js/games/registry.js`. A game entry provides:

- `id`: stable storage and routing key.
- `name`: menu display name.
- `sceneClass`: scene constructor used by `GameHost.startGame()`.
- `formatScore(scoreObj)`: menu score summary.
- `configTitle` and `configOptions`: optional configuration modal content.
- Optional menu visuals such as `themeColor` and `iconText`.

Adding a game should usually require a new `js/games/<game-id>/` folder and one registry entry. Avoid adding game-specific branches to `MenuScene` or `GameHost`.

## Input Model

`GameHost` normalizes WeChat touch events into `{ x, y }` points. Scenes can handle points directly or delegate to `InputDispatcher`.

`InputDispatcher` treats later-added receivers as topmost. On touch start, the first receiver that returns `true` becomes the active receiver, and only that receiver receives move/end for the gesture. Modal overlays should return `true` to block touch-through.

Interactive UI objects should follow the same lifecycle:

- `onTouchStart(x, y)` returns whether the touch was handled.
- `onTouchMove(x, y)` updates pressed or hover-like state.
- `onTouchEnd(x, y)` triggers the action only when appropriate.

## Game State

State classes own gameplay rules, scoring inputs, completion checks, timers, and save calls.

`SudokuBoardState` owns the puzzle board, fixed cells, notes, undo history, mistake tracking, fill count, solve detection, score calculation, and local save.

`HuarongdaoState` owns puzzle size, grid generation, shuffle, tile movement, solve detection, timing, steps, and local save.

Scenes should not duplicate core game rules. They should translate screen input into state method calls and render state.

## Scoring And Storage

Scores are stored through `saveScore(gameId, result)` in `js/core/storage.js`, using `wx.setStorageSync` under the key `mini_game_collection_scores_v1`.

Current stored fields include best and last values for score, time, steps, mistakes, difficulty, level id, and play count. If future games need different metrics, extend storage deliberately instead of overloading existing fields with unrelated meaning.

Result screens may display intuitive per-game metrics such as time, steps, mistakes, or fills. Do not assume every game has the same scoring formula.

## UI And Effects

Canvas UI should use shared helpers from `js/ui/canvas.js` and shared theme values from `js/themes/elegant.js`.

Reusable overlays belong in `js/ui/`. `ConfigModal` is used before starting configurable games. `ResultModal` is used after completion. `Confetti` is a shared host-level effect exposed through `host.effects`.

Keep visual changes centralized where possible. Avoid hardcoding game-specific menu branches when the registry can carry the metadata.

## Browser Debug Adapter

`dev/browser.html` and `dev/browser-main.js` provide a local browser shim for faster UI checks. The browser path should mirror WeChat behavior closely enough for layout and click smoke tests, but WeChat Developer Tools remains the final runtime target.

## Extension Checklist

When adding or changing a game:

1. Add or update `js/games/<game-id>/state.js` for rules and persistence.
2. Add or update `js/games/<game-id>/index.js` for rendering and input glue.
3. Register the game in `js/games/registry.js`.
4. Reuse `InputDispatcher`, `Button`, `ConfigModal`, and `ResultModal` instead of custom one-off controls.
5. Check whether `README.md`, `ARCHITECTURE.md`, or `AGENTS.md` need updates before committing.
