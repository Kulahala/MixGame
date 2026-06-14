# Repository Guidelines

## Project Structure & Module Organization

This is a WeChat Mini Game project. The runtime entry is `game.js`, which imports `js/main.js` as the main loop.

- `js/main.js`: creates the canvas context and starts the collection host.
- `js/core/`: scene switching, input dispatch, and local score storage.
- `js/scenes/`: top-level scenes such as the game selection menu.
- `js/games/`: standalone games; current modules are `sudoku/` and `huarongdao/`.
- `js/themes/` and `js/ui/`: visual tokens and reusable canvas UI helpers.
- `js/libs/`: third-party or vendored utilities such as `tinyemitter.js`.
- `dev/`: browser-only debug shell and wx/canvas adapter.
- `ARCHITECTURE.md`: current architecture and extension boundaries.
- `game.json`, `project.config.json`, `project.private.config.json`: Mini Game and tool configuration.

## Build, Test, and Development Commands

There is no package manager manifest or CLI build script. Use WeChat Developer Tools:

- Import this folder as a Mini Game project.
- Use the simulator to run and debug gameplay.
- Use upload/preview for device verification.
- For browser-only UI checks, run `python -m http.server 8765 --bind 127.0.0.1` and open `http://127.0.0.1:8765/dev/browser.html`.

For quick source inspection from a terminal:

```powershell
rg "GameHost" js
rg "InputDispatcher" js
rg --files
```

## Coding Style & Naming Conventions

JavaScript uses ES modules, class-based game objects, and 2-space indentation. Match the existing style. Use `PascalCase` for classes and `camelCase` for functions, methods, variables, and instance fields.

Keep runtime paths stable and explicit. If future assets are added, keep them in a documented directory and update every import or runtime reference when moving them.

`.eslintrc.js` currently defines no strict rules. Treat existing formatting as the source of truth.

## Testing Guidelines

No automated test framework is configured. Validate changes in WeChat Developer Tools or the browser debug shell before submission. At minimum, verify:

- The menu renders and each game card opens the correct configuration or game.
- Sudoku supports selecting cells, entering numbers, immediate mistake marking, undo, erase, note mode, restart, result modal, and return to menu.
- Digital Huarongdao supports size selection, click or swipe movement, restart, result modal, and return to menu.
- Local scores or result metrics persist through `wx.setStorageSync` / `wx.getStorageSync` and display correctly in the menu.
- Responsive layout remains usable on common phone heights, including small-screen cases touched by the change.

If tests are added later, place them in a clearly named `test/` or `__tests__/` directory and document the command here.

## Commit Message Policy

提交信息应清晰、贴合当前仓库风格。

- 如果仓库已有明确提交格式，优先遵循仓库格式。
- 如果仓库没有格式，默认使用中英双语标题：
  - `[Feature] 中文标题（English Title）`
  - `[Fix] 中文标题（English Title）`
  - `[Docs] 中文标题（English Title）`
  - `[Refactor] 中文标题（English Title）`
  - `[Test] 中文标题（English Title）`
  - `[Chore] 中文标题（English Title）`
- 中文标题说明实际变化，英文标题保持简洁自然，不要逐字硬翻。
- 标题不要太长；复杂信息放到正文。
- 非复杂改动不需要长正文。
- 复杂改动正文说明：改了什么、为什么改、是否有迁移/兼容/验证事项。
- 不要声称已测试、已构建、已部署、已打包或已人工验证，除非确实执行过或用户明确确认。
- 不要堆砌 diff 里一眼能看出的低价值细节。
- 每次提交前检查 `README.md`、`ARCHITECTURE.md`、`AGENTS.md` 或其他项目文档是否需要随代码变化同步更新。

## Pull Request Guidelines

Pull requests should include a behavior summary, affected files, verification notes, and screenshots for visible gameplay or UI changes.

## Agent-Specific Instructions

Read the real files before changing behavior. Keep edits narrow, avoid broad refactors, and preserve user assets and local configuration unless explicitly asked to change them.

Use `README.md` for project introduction and run instructions, `ARCHITECTURE.md` for current architecture and extension boundaries, and `AGENTS.md` for contributor and agent behavior rules. Do not put architecture update history in `ARCHITECTURE.md`; use Git history for change history.

`plan.md` is a local multi-agent collaboration file. Read it before coordinated planning or review, write cross-agent feedback under its Feedback section, and keep it ignored rather than pushing it to GitHub.
