# Repository Guidelines

## Project Structure & Module Organization

This is a WeChat Mini Game project. The runtime entry is `game.js`, which imports `js/main.js` as the main loop.

- `js/main.js`: creates the canvas context and starts the collection host.
- `js/core/`: scene switching, input dispatch, and local score storage.
- `js/scenes/`: top-level scenes such as the game selection menu.
- `js/games/`: standalone games; current modules are `sudoku/` and `huarongdao/`.
- `js/themes/` and `js/ui/`: visual tokens and reusable canvas UI helpers.
- `js/base/`, `js/player/`, `js/npc/`, `js/runtime/`: legacy airplane-game code kept for reference.
- `js/libs/`: third-party or vendored utilities such as `tinyemitter.js`.
- `images/` and `audio/`: game assets referenced by runtime code.
- `game.json`, `project.config.json`, `project.private.config.json`: Mini Game and tool configuration.

## Build, Test, and Development Commands

There is no package manager manifest or CLI build script. Use WeChat Developer Tools:

- Import this folder as a Mini Game project.
- Use the simulator to run and debug gameplay.
- Use upload/preview for device verification.
- For browser-only UI checks, run `python -m http.server 8765 --bind 127.0.0.1` and open `http://127.0.0.1:8765/dev/browser.html`.

For quick source inspection from a terminal:

```powershell
rg "GameGlobal.databus" js
rg --files
```

## Coding Style & Naming Conventions

JavaScript uses ES modules, class-based game objects, and 2-space indentation. Match the existing style. Use `PascalCase` for classes and `camelCase` for functions, methods, variables, and instance fields.

Keep asset paths stable and explicit. Do not rename files under `images/` or `audio/` without updating every import or runtime reference.

`.eslintrc.js` currently defines no strict rules. Treat existing formatting as the source of truth.

## Testing Guidelines

No automated test framework is configured. Validate changes in WeChat Developer Tools before submission. At minimum, verify startup, movement, shooting, enemy spawning, collisions, scoring, game over, restart, sound playback, and asset loading.

If tests are added later, place them in a clearly named `test/` or `__tests__/` directory and document the command here.

## Commit & Pull Request Guidelines

This directory has no Git history, so no historical convention can be inferred. Use short, imperative commit messages, for example `Fix bullet collision cleanup` or `Add enemy spawn tuning`.

Pull requests should include a behavior summary, affected files, verification notes, and screenshots for visible gameplay or UI changes.

## Agent-Specific Instructions

Read the real files before changing behavior. Keep edits narrow, avoid broad refactors, and preserve user assets and local configuration unless explicitly asked to change them.
