# MixGame

MixGame 是一个微信小游戏合集。当前第一版包含数独和华容道，采用纯前端 Canvas 架构，本地计分，不依赖后端和排行榜。

## 功能

- 典雅风游戏大厅，入口处选择小游戏。
- 数独：支持生成不同难度（简单、普通、困难），支持点击填数、撤销（Undo）、擦除与草稿笔记（Note）模式，完成后自动计算得分。
- 数字华容道：支持阶数选择（3x3, 4x4, 5x5），采用纯数字打乱滑块拼图模式，支持点选或手势滑动操作。
- 本地积分：使用 `wx.setStorageSync` / `wx.getStorageSync` 保存最佳成绩。
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
│   │   └── huarongdao/             # 华容道玩法
│   ├── scenes/                     # 游戏大厅等场景
│   ├── themes/                     # 主题色、字体、圆角
│   ├── ui/                         # Canvas UI 工具
│   └── render.js                   # Canvas 初始化
├── images/                         # 图片资源
└── audio/                          # 音频资源
```

`js/base/`、`js/player/`、`js/npc/`、`js/runtime/` 保留了原始飞机大战模板代码，当前合集入口不再依赖这些模块。

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

- 大厅能打开，两个卡片可进入。
- 数独能选格、输入数字、返回大厅。
- 华容道能选棋、移动棋子、返回大厅。
- 完成游戏后本地成绩能保存并在大厅显示。
