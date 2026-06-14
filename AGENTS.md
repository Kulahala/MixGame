# Repository Guidelines

## Project Structure & Module Organization

This is a WeChat Mini Game project. The runtime entry is `game.js`, which imports `js/main.js` as the main loop.

- `js/main.js`: creates the canvas context and starts the collection host.
- `js/core/`: scene switching, input dispatch, and local score storage.
- `js/scenes/`: top-level scenes such as the game selection menu.
- `js/games/`: standalone games; current modules are `sudoku/`, `huarongdao/`, `minesweeper/`, `game2048/`, and `memory/`.
- `js/themes/` and `js/ui/`: visual tokens and reusable canvas UI helpers.
- `js/libs/`: third-party or vendored utilities (currently empty; previously held `tinyemitter.js` which was removed).
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

## Mobile Ergonomics & UI Guidelines (移动端人体工学与UI交互设计规范)

- **黄金交互区（自适应中下部布局）**：为了方便右手持机时单手大拇指舒适游玩，游戏的核心操作区域（如棋盘、网格、按钮组）必须使用自适应高度计算将其定位在屏幕中下部（通常为垂直剩余空间居中稍偏下，如 `Y = Math.floor((screenHeight - boardHeight) / 2) + 30`）。
- **安全边界保护**：在计算高度偏移时，必须限制最小 Y 坐标（通常为 `safeTop + 130` 左右），防止操作区遮挡顶部的返回/重置等功能按钮。
- **高质感阻尼动效**：界面切换和滑块移动不得使用生硬的瞬闪或单纯线性过渡，必须采用 Easing 缓动曲线（如弹窗进入使用 `easeOutBack` 微弹，退出使用 `easeInQuad`；方块滑动使用 `easeOutCubic` 阻尼减速），动画时长保持在 150ms-220ms 之间，以实现极佳 of 物理仿真质感。
- **全面屏自适应布局（Responsive Home Indicator Buffer）**：底部手牌与按钮堆必须防切，但又不能由于死板上移导致矮屏幕下中段拥挤。必须使用响应式计算，在大屏（如 `height >= 750`）上将底部堆上提 30px，而在矮屏幕上自动微缩还原，完美契合全面屏 Home 小黑条的安全适配。
- **视觉宽度对齐边线（Horizontal Edge Alignment）**：下方的独立摸牌堆、回合结束等功能行的总宽必须限宽并居中对齐到与中间棋盘一样的物理宽度（如 310px），形成隐形的左右垂直参考边线，避免由于过度分散显得左右空旷与不协调。
- **用户友好度编号（Friendly Indexes）**：在面向用户展现的占位符或序号中，必须将底层 0-indexed 数据展示为 1-based（如列号 0-3 映射为 1-4），以提供契合普通用户心智模型的极佳用户体验。

## Design System & Color Palette (设计系统与配色规范)

新游戏和新组件的设计必须严格遵循“静游集”特有的**低饱和度日系温暖雅致风格（Elegant Theme）**，禁止使用高饱和度的纯色（如纯红 `#FF0000`、纯蓝 `#0000FF`），必须通过引用 `theme` 变量来使用以下预定义的 Design Tokens：

1. **背景与底色（Warm White）**：
   * 页面大背景使用暖灰白 `theme.color.bg` (`#f4f2ed`)。
   * 面板/卡片衬底使用温润的纸白 `theme.color.paper` (`#fffdf8`)。
   * 深色按压或输入态使用暖灰 `theme.color.paperDeep` (`#ece7dd`)。
2. **文字与线条（Warm Ink & Natural Lines）**：
   * 核心文字采用暖深墨色 `theme.color.ink` (`#25221d`)，绝对禁止使用无阻尼的纯黑 `#000`。
   * 次要文字与辅助线条使用自然的中性暖灰 `theme.color.muted` (`#756f64`) 或淡米色 `theme.color.line` (`#d7cec0`)。
3. **低饱和雅致辅助色（Subdued Accents）**：
   * 熟褐色 `theme.color.accent` (`#7a4f3f`) — 用于核心按钮、数独填入的非固定数字。
   * 艾绿色 `theme.color.sage` (`#536b5d`) — 用于数字位置正确状态、扫雷旗帜及匹配成功色。
   * 蓝灰色 `theme.color.blue` (`#52677a`) — 用于难度或辅助数字标识。
   * 暗金色 `theme.color.gold` (`#b29259`) — 用于突出徽标、卡片序号或亮色描边。
   * 熟红/朱砂 `theme.color.danger` (`#a54b44`) — 用于错误数字标红、扫雷踩雷标示。
4. **圆角规则（Corner Radius）**：
   * 小组件/格子棋盘：使用圆角小 `theme.radius.sm` (`8px`)。
   * 中型游戏卡片/按键：使用圆角中 `theme.radius.md` (`14px`)。
   * 模态弹窗/外大框：使用圆角大 `theme.radius.lg` (`22px`)。

## Testing Guidelines

No automated test framework is configured. Validate changes in WeChat Developer Tools or the browser debug shell before submission. At minimum, verify:

- The menu renders and each game card opens the correct configuration or game.
- Sudoku supports selecting cells, entering numbers, immediate mistake marking, undo, note mode, restart, result modal, and return to menu.
- Digital Huarongdao supports size selection, click or swipe movement, restart, result modal, and return to menu.
- Minesweeper supports difficulty selection, click to reveal, long-press to flag, win/lose detection, and return to menu.
- 2048 supports target selection, swipe to merge tiles, win detection, and return to menu.
- Memory supports size selection, card flip and match, completion detection, and return to menu.
- Local scores or result metrics persist through `wx.setStorageSync` / `wx.getStorageSync` and display correctly in the menu.
- Responsive layout remains usable on common phone heights, including small-screen cases touched by the change.

If tests are added later, place them in a clearly named `test/` or `__tests__/` directory and document the command here.

## Commit Message Policy

提交信息应清晰、贴合当前仓库风格。

- **无需每次改动都直接 commit，等改动效果经由用户判断确认后再提交。**

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
