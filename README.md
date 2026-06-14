# MixGame

MixGame 是一个微信小游戏合集，采用纯前端 Canvas 架构，本地保存成绩，不依赖后端和排行榜。

## 功能

- 典雅风游戏大厅，双列卡片布局，入口处选择小游戏。
- 数独：支持生成不同难度（简单、普通、困难），支持点击填数、撤销、草稿笔记模式，完成后展示用时、填写次数等结果信息。
- 数字华容道：支持阶数选择（3x3, 4x4, 5x5），采用纯数字打乱滑块拼图模式，支持点选或手势滑动操作。
- 扫雷：支持三种难度（9×9、12×12、12×16），经典扫雷玩法。
- 2048：支持目标选择（1024、2048、4096），滑动合并数字方块。
- 记忆翻牌：支持三种尺寸（3×4、4×4、4×6），翻开卡牌寻找配对。
- 本地成绩：使用 `wx.setStorageSync` / `wx.getStorageSync` 保存最佳成绩和最近成绩。
- 高 DPI 适配：Canvas 按 `devicePixelRatio` 缩放，在高清屏上文字和线条更清晰。
- 浏览器调试壳：用于快速检查 UI、点击流程和基础交互，不影响微信小游戏正式入口。

## 目录结构

```text
├── game.js                         # 微信小游戏入口
├── game.json                       # 小游戏运行配置
├── project.config.json             # 微信开发者工具项目配置
├── dev/
│   ├── browser.html                # 浏览器调试入口
│   └── browser-main.js             # wx/canvas 浏览器适配
├── js/
│   ├── core/                       # 场景宿主、输入分发、本地存储
│   ├── games/
│   │   ├── sudoku/                 # 数独玩法
│   │   ├── huarongdao/             # 华容道玩法
│   │   ├── minesweeper/            # 扫雷玩法
│   │   ├── game2048/               # 2048 玩法
│   │   └── memory/                 # 记忆翻牌玩法
│   ├── scenes/                     # 游戏大厅等场景
│   ├── themes/                     # 主题色、字体、圆角
│   ├── ui/                         # Canvas UI 工具
│   └── render.js                   # Canvas 初始化（含 pixelRatio 缩放）
└── ARCHITECTURE.md                 # 当前架构和扩展边界
```

## 运行

### 微信开发者工具

1. 打开微信开发者工具。
2. 选择“小程序 / 小游戏”项目导入本目录。
3. 使用模拟器预览，或上传/预览到真机测试。

### 浏览器调试

浏览器调试只用于本地 UI 和交互检查：

```powershell
python -m http.server 8765 --bind 127.0.0.1
```

然后打开：

```text
http://127.0.0.1:8765/dev/browser.html
```

## 开发约定

- README 负责项目介绍、运行方式和面向使用者的功能概览；架构细节见 `ARCHITECTURE.md`，agent 协作规范见 `AGENTS.md`。
- 保持功能和样式分离：玩法状态逻辑抽离至 `state.js`，视图渲染在 `index.js`，视觉风格统一在 `js/themes/` 和 `js/ui/`。
- 新增小游戏时，优先新增独立目录（例如 `js/games/minesweeper/`），并在 `js/games/registry.js` 注册，主菜单会自动适配。
- 后续难度选项可基于现有 `options` / `difficulty` 字段进一步扩展，通过统一的配置弹窗唤起。
- 私人开发者工具配置不要提交，使用本机自己的 `project.private.config.json`。

## 验证

当前没有自动化测试框架。提交前至少执行：

```powershell
Get-ChildItem -Recurse -File -Filter *.js | ForEach-Object { node --check $_.FullName }
```

并在微信开发者工具或浏览器调试壳中检查：

- 大厅能打开，五个游戏卡片可进入对应配置或游戏。
- 数独能选格、输入数字、撤销、擦除、切换笔记、返回大厅。
- 数字华容道能点选或滑动移动数字块，并能返回大厅。
- 扫雷能点击揭开、长按标旗、完成或踩雷后显示结果。
- 2048 能滑动合并方块、达到目标后显示结果。
- 记忆翻牌能翻开卡牌配对、完成后显示结果。
- 完成游戏后能显示结算弹窗，本地成绩能保存并在大厅显示。
