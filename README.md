# 片刻游

片刻游是一个微信小游戏合集，采用纯前端 Canvas 架构，本地保存成绩，不依赖后端和排行榜。

## 功能

- 典雅风游戏大厅，双列卡片布局，入口处选择小游戏。
- 数独：支持生成不同难度（简单、普通、困难），支持点击填数、撤销、擦除、草稿标记模式，完成后展示用时、填写次数等结果信息。
- 数字华容道：支持阶数选择（3x3, 4x4, 5x5），采用纯数字打乱滑块拼图模式，支持点选或手势滑动操作。
- 扫雷：支持三种难度（9×9、12×12、12×16），已标雷数显示，防首点踩雷机制，经典扫雷玩法。
- 2048：支持目标选择（1024、2048、4096），滑动合并数字方块。
- 记忆翻牌：支持三种尺寸（3×4、4×4、4×6），翻开卡牌寻找配对。
- 数回：支持点线回路解密（5x5、7x7），点击虚线段围成唯一不分叉闭合环。
- 森之王国：独创的 2x4 积木卡牌天平战役策略对决，支持三关 Boss 战役与 Deckbuilding。
- 一笔画：首发连续滑线益智格子（4x4、5x5、6x6），支持手指连续拖拽划线，倒退擦除或点击历史点自动回滚。
- 黑白棋：8x8 棋盘人机对决，支持简单、普通和困难（Minimax 算法 + Alpha-Beta 剪枝）三档 AI 棋力，搭载平滑 3D 翻子与涟漪波浪延迟动画。
- 跃上云巅：动感 Slime 攀爬游戏，拥有森林/遗迹/天空三阶段高度，天空段搭载 4000px 周期的平滑昼夜流逝循环、太阳/月亮物理弧线位移、流星拉丝及云朵平台同步发光变色，配合蓄力简谐形变、六状态情绪眼睛、高对比度黑边、低饱和日系防滑台阶/斜面、替代空气墙的主题装饰壁（藤蔓/石壁/云层）、起跳落地及撞击粒子特效，及基于抛物线的 100% 物理可达性校验算法。
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
│   ├── core/                       # 场景宿主、输入分发、本地存储、屏幕档位检测
│   │   ├── game-host.js            # 场景生命周期与主循环
│   │   ├── game-scene-base.js      # 游戏场景基类（动画、按钮、弹窗）
│   │   ├── input-dispatcher.js     # 触摸事件分发
│   │   ├── layout.js               # 响应式屏幕档位检测
│   │   └── storage.js              # 本地成绩存储
│   ├── games/
│   │   ├── registry.js             # 游戏注册表
│   │   ├── sudoku/                 # 数独玩法
│   │   ├── huarongdao/             # 华容道玩法
│   │   ├── minesweeper/            # 扫雷玩法
│   │   ├── game2048/               # 2048 玩法
│   │   ├── memory/                 # 记忆翻牌玩法
│   │   ├── slitherlink/            # 数回玩法
│   │   ├── woodkingdom/            # 森之王国卡牌玩法
│   │   ├── onestroke/              # 一笔画玩法
│   │   ├── reversi/                # 黑白棋玩法
│   │   └── jump/                   # 跃上云巅玩法
│   ├── scenes/                     # 游戏大厅等场景
│   ├── themes/                     # 主题色、字体、圆角
│   ├── ui/                         # Canvas UI 工具
│   │   ├── animation.js            # 共享缓动函数
│   │   ├── button.js               # 按钮组件
│   │   ├── canvas.js               # 绘制原语与命中检测
│   │   ├── config-modal.js         # 配置弹窗
│   │   ├── result-modal.js         # 结果弹窗
│   │   └── quotes.js               # 底部语录
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

支持运行部分游戏状态机引擎的自动化单元测试：

```powershell
# 运行一笔画状态机压测
node js/games/onestroke/test_state.js
# 运行森之王国状态机测试
node js/games/woodkingdom/test_state.js
# 运行黑白棋状态机与AI对弈测试
node js/games/reversi/test_state.js
# 运行跃上云巅物理引擎与可达性测试
node js/games/jump/test_state.js
```

静态语法走查与日常验证：

```powershell
Get-ChildItem -Recurse -File -Filter *.js | ForEach-Object { node --check $_.FullName }
```

并在微信开发者工具或浏览器调试壳中检查：

- 大厅能打开，所有卡片均可正常进入且无配色冲突。
- 扫雷能延迟首点避雷、正常标记并沉降模式按钮。
- 数独能够正常使用“标记”草稿与回退。
- 一笔画支持划线和点击历史轨迹智能截断。
- 关末结算弹出 ResultModal，本地成绩保存完好，返回大厅智能记忆页签且无白屏。
