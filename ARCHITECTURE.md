# Architecture

This project is a pure frontend WeChat Mini Game collection. Runtime code runs on Canvas through the WeChat game APIs, with an optional browser debug shim under `dev/`.

## Runtime Flow

`game.js` imports `js/main.js`. `main.js` creates the canvas context from `js/render.js`, constructs `GameHost`, and starts the animation loop.

`GameHost` owns the active scene, frame updates, rendering, scene switching, touch dispatch, and shared visual effects. Scenes expose optional `init()`, `update(dt)`, `render(ctx)`, `onTouchStart(point)`, `onTouchMove(point)`, `onTouchEnd(point)`, and `destroy()` methods.

All game scenes extend `BaseGameScene`, which provides standard enter/exit animations, top-bar back button, result modal lifecycle, and input cleanup. Subclasses implement `reset()` and `renderGame(ctx)`.

## Module Boundaries

- `js/core/`: framework-level services. `game-host.js` controls scene lifecycle, `game-scene-base.js` provides shared scene behavior (animations, buttons, modals), `input-dispatcher.js` routes touches to interactive objects, `storage.js` persists local scores, and `layout.js` provides responsive screen tier detection (`tablet`/`standard`/`compact`/`tiny`).
- `js/scenes/`: app-level screens. `menu-scene.js` renders the game selection menu and opens configuration modals.
- `js/games/`: game modules. Each game keeps rule/state logic in `state.js` and scene/render/input glue in `index.js`. Current games: `sudoku/`, `huarongdao/`, `minesweeper/`, `game2048/`, `memory/`, `woodkingdom/`, `slitherlink/`, `onestroke/`.
- `js/ui/`: reusable Canvas UI primitives and overlays. `canvas.js` provides low-level helpers (text, scaling, hit-testing), `animation.js` provides shared easing functions (easeOutQuart, easeOutCubic, easeOutBack, smoothLerp) consumed by scenes and modals.
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

## Canvas and Rendering

`js/render.js` creates the primary canvas, sets its physical size to `windowWidth × windowHeight × pixelRatio`, and exports `SCREEN_WIDTH`, `SCREEN_HEIGHT` (logical pixels), `PIXEL_RATIO`, and `SAFE_TOP` (safe area top offset from `safeArea.top` or `statusBarHeight`). `js/main.js` applies `ctx.scale(PIXEL_RATIO, PIXEL_RATIO)` so all downstream code works in logical pixels. All scenes use `host.safeTop` to offset titles, buttons, and board positions below the status bar / notch area.

All game scenes render through `BaseGameScene.render(ctx)`, which handles background fill, enter/exit animation wrapping, top buttons, and modal overlay. Subclasses implement `renderGame(ctx)` for game-specific drawing.

The menu scene (`MenuScene`) is independent — it manages its own layout, animation, and input dispatch. It supports a responsive 2-column grid when the game count is 3 or more.

## Game State

State classes own gameplay rules, scoring inputs, completion checks, timers, and save calls.

`SudokuBoardState` owns the puzzle board, fixed cells, notes, undo history, mistake tracking, fill count, solve detection, score calculation, and local save. The puzzle generator (`generator.js`) uses a bounded backtracking solver with an iteration budget to avoid stalls on low-end devices.

`HuarongdaoState` owns puzzle size, grid generation, shuffle, tile movement, solve detection, timing, steps, and local save.

`MinesweeperState`, `Game2048State`, and `MemoryState` follow the same pattern: own the game rules, completion checks, scoring, and local save. `Game2048State` additionally tracks per-tile identity (`{ id, value }` objects) and returns movement metadata from `move()` to support slide/spawn animation in the scene layer.

`SlitherlinkState` and `OneStrokeState` also follow this state encapsulation pattern, using algorithmic pathfinding (DFS) and heuristics to ensure 100% solvable puzzle generation.

`WoodKingdomState` owns the battlefield grids (opponent queue, opponent frontline, and player frontline), card configurations, double resources (raindrop and wood), death rewards (acorn and leaves), scale tilt value, level progression, AI actions, turn resolution sequence, and local save.

Scenes should not duplicate core game rules. They should translate screen input into state method calls and render state.

## Scoring And Storage

Scores are stored through `saveScore(gameId, result)` in `js/core/storage.js`, using `wx.setStorageSync` under the key `mini_game_collection_scores_v1`. Default score templates exist for all games.

Current stored fields include best and last values for score, time, steps, mistakes, difficulty, level id, and play count. If future games need different metrics, extend storage deliberately instead of overloading existing fields with unrelated meaning.

Result screens may display intuitive per-game metrics such as time, steps, mistakes, or fills. Do not assume every game has the same scoring formula.

## UI And Effects

Canvas UI should use shared helpers from `js/ui/canvas.js` (draw, `scaleAround`, `clamp`, `hitTestGrid`), shared easing from `js/ui/animation.js`, and shared theme values from `js/themes/elegant.js`. Game scenes should extend `BaseGameScene` and implement `reset()` and `renderGame(ctx)` rather than duplicating animation, button, and modal logic.

Game-specific animations live in the scene layer (`index.js`), consuming state change metadata and interpolating visuals per frame. Current animation patterns: 2048 tile slide/spawn (two-phase: slide 160ms + spawn 200ms with input locking), minesweeper cell reveal (synchronous fade/scale 150ms), memory card flip (3D scaleX interpolation 200ms). All use easing functions from `js/ui/animation.js`.

Reusable overlays belong in `js/ui/`. `ConfigModal` is used before starting configurable games. `ResultModal` is used after completion. `Confetti` is a shared host-level effect exposed through `host.effects`. `quotes.js` acts as a static collection of zen-styled quotes and game-specific tips, rendered randomly at the bottom of the menu and game scenes.

Keep visual changes centralized where possible. Avoid hardcoding game-specific menu branches when the registry can carry the metadata.

## Browser Debug Adapter

`dev/browser.html` and `dev/browser-main.js` provide a local browser shim for faster UI checks. The browser path mirrors WeChat behavior closely enough for layout and click smoke tests, including `pixelRatio`-aware canvas sizing and touch coordinate mapping. WeChat Developer Tools remains the final runtime target.

## Extension Checklist

When adding or changing a game:

1. Add or update `js/games/<game-id>/state.js` for rules, performance-bounded loops, and persistence.
2. Add or update `js/games/<game-id>/index.js` for rendering, touch input glue, and drawing quotes at the unified screen bottom (`this.host.height - 42`).
3. Register the game in `js/games/registry.js`.
4. Register the default score template structure in `DEFAULT_SCORES` within `js/core/storage.js`.
5. Add game-specific tips (prefixed with `"小tips: "`) in `GAME_TIPS` within `js/ui/quotes.js`.
6. Ensure the gameplay area respects mobile ergonomics (positioned in the middle-lower golden interactive area) and inherits from `BaseGameScene` for unified transition animations and input interception.
7. Reuse `InputDispatcher`, `Button`, `ConfigModal`, and `ResultModal` instead of custom one-off controls.
8. Check whether `README.md`, `ARCHITECTURE.md`, or `AGENTS.md` need updates before committing.

