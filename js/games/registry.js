import SudokuScene from './sudoku/index.js';
import HuarongdaoScene from './huarongdao/index.js';
import MinesweeperScene from './minesweeper/index.js';
import Game2048Scene from './game2048/index.js';
import MemoryScene from './memory/index.js';
import SlitherlinkScene from './slitherlink/index.js';
import WoodKingdomScene from './woodkingdom/index.js';
import OneStrokeScene from './onestroke/index.js';
import ReversiScene from './reversi/index.js';
import JumpScene from './jump/index.js';


export const GAMES = [
  {
    id: 'sudoku',
    name: '数独',
    sceneClass: SudokuScene,
    description: '九宫格推理 · 简单难度',
    rules: '【数独规则说明】\n1. 棋盘共 81 个格子。每行、每列以及每一个 3×3 的九宫格内都必须填入数字 1 到 9，且不能重复。\n2. 选中空白格后，点击下方数字键填入答案。若填错，格子上会以红色警示，同时计入一次错误记录。\n3. 可点击「撤销」回退上一步，或在「草稿」模式下记入候选数字（再次点击草稿关闭该模式）。',
    formatScore: (scoreObj) => {
      return scoreObj && scoreObj.bestScore ? `最佳 ${scoreObj.bestScore} 分 · ${scoreObj.bestTime}s` : null;
    },
    configTitle: '数独难度选择',
    configOptions: [
      { label: '简单 (挖 20 空)', value: { holes: 20 } },
      { label: '普通 (挖 40 空)', value: { holes: 40 } },
      { label: '困难 (挖 55 空)', value: { holes: 55 } }
    ],
    themeColor: '#798b7d',
    iconText: '九'
  },
  {
    id: 'huarongdao',
    name: '华容道',
    sceneClass: HuarongdaoScene,
    description: '数字排序滑动拼图',
    rules: '【华容道规则说明】\n1. 棋盘上散落着被打乱的数字滑块，以及一个唯一的空白格。\n2. 您可以点击空白格四周的相邻数字，或用手指轻扫，将该数字移入空白格内。\n3. 目标是通过不断移动，将所有数字按从左到右、从上到下的顺序（1, 2, 3...）重新排好。\n4. 游戏会为您记录所用的总步数与总时间。',
    formatScore: (scoreObj) => {
      return scoreObj && scoreObj.bestScore ? `最佳 ${scoreObj.bestScore} 分 · ${scoreObj.bestSteps} 步` : null;
    },
    configTitle: '数字华容道阶数',
    configOptions: [
      { label: '3 x 3 (简单)', value: { size: 3 } },
      { label: '4 x 4 (经典)', value: { size: 4 } },
      { label: '5 x 5 (困难)', value: { size: 5 } }
    ],
    themeColor: '#8a7a6c',
    iconText: '华'
  },
  {
    id: 'minesweeper',
    name: '扫雷',
    sceneClass: MinesweeperScene,
    description: '揭开安全格 · 避开地雷',
    rules: '【扫雷规则说明】\n1. 棋盘中隐藏着一定数量的地雷，您的目标是找出并标记所有地雷，且不踩中任何地雷。\n2. 点击格子可以将其揭开：\n   - 如果是数字，代表其周围 8 格的地雷总数。\n   - 如果是空地，会自动展开周围相邻的安全格。\n   - 踩雷即宣告挑战失败。\n3. 长按格子可以插上/收回红旗，判定该格为雷。',
    formatScore: (scoreObj) => {
      return scoreObj && scoreObj.bestScore ? `最佳 ${scoreObj.bestScore} 分 · ${scoreObj.bestTime}s` : null;
    },
    configTitle: '扫雷难度选择',
    configOptions: [
      { label: '简单 (9×9 · 10雷)', value: { rows: 9, cols: 9, mines: 10 } },
      { label: '普通 (12×12 · 30雷)', value: { rows: 12, cols: 12, mines: 30 } },
      { label: '困难 (12×16 · 50雷)', value: { rows: 12, cols: 16, mines: 50 } },
    ],
    themeColor: '#52677a',
    iconText: '雷'
  },
  {
    id: 'game2048',
    name: '2048',
    sceneClass: Game2048Scene,
    description: '滑动合并数字方块',
    rules: '【2048规则说明】\n1. 在屏幕上向上下左右轻扫来滑动所有方块。\n2. 当发生移动时，所有非空方块都会朝滑动方向靠拢。\n3. 如果两个数值相同的方块在靠拢过程中相撞，它们将合并为一个双倍数值的新方块（如：2 + 2 = 4）。\n4. 每次滑动后，棋盘空处会随机生成一个 2 或 4 的新方块。\n5. 合并出目标数字即通关。',
    formatScore: (scoreObj) => {
      return scoreObj && scoreObj.bestScore ? `最高 ${scoreObj.bestScore} 分` : null;
    },
    configTitle: '2048 目标选择',
    configOptions: [
      { label: '目标 1024', value: { target: 1024 } },
      { label: '目标 2048', value: { target: 2048 } },
      { label: '目标 4096', value: { target: 4096 } },
    ],
    themeColor: '#b29259',
    iconText: '2k'
  },
  {
    id: 'memory',
    name: '记忆翻牌',
    sceneClass: MemoryScene,
    description: '翻开卡牌寻找配对',
    rules: '【记忆翻牌规则说明】\n1. 卡牌初始背面朝上。点击卡牌将其翻开，显示卡牌上的符号图案。\n2. 再次翻开另外一张卡牌：\n   - 如果图案完全一致，则匹配成功，卡牌高亮并保持正面朝上。\n   - 如果不同，展示 0.6 秒后会自动重新翻回背面。\n3. 凭您的记忆找出并成功配对棋盘上所有的卡牌，即完成挑战。',
    formatScore: (scoreObj) => {
      return scoreObj && scoreObj.bestScore ? `最佳 ${scoreObj.bestScore} 分 · ${scoreObj.bestTime}s` : null;
    },
    configTitle: '记忆翻牌难度',
    configOptions: [
      { label: '简单 (3×4 · 6对)', value: { rows: 3, cols: 4 } },
      { label: '普通 (4×4 · 8对)', value: { rows: 4, cols: 4 } },
      { label: '困难 (4×6 · 12对)', value: { rows: 4, cols: 6 } },
    ],
    themeColor: '#a54b44',
    iconText: '忆',
  },
  {
    id: 'slitherlink',
    name: '数回',
    sceneClass: SlitherlinkScene,
    description: '连接点线形成单一闭合回路',
    rules: '【数回规则说明】\n1. 棋盘是由虚线段和点组成的网络。每个小方格内部的数字（0 到 3）表示该格子四周必须连接实线段的数量（0 代表周围无连线）。\n2. 玩家的目标是点击虚线将其描黑连线，最终在棋盘上形成一条唯一的、不分叉且不交叉的闭合回路。\n3. 线圈之外及之内的网格需配合数字连线。',
    formatScore: (scoreObj) => {
      return scoreObj && scoreObj.bestScore ? `最佳 ${scoreObj.bestScore} 分 · ${scoreObj.bestTime}s` : null;
    },
    configTitle: '数回网格尺寸',
    configOptions: [
      { label: '5 x 5 (简单)', value: { rows: 5, cols: 5 } },
      { label: '7 x 7 (困难)', value: { rows: 7, cols: 7 } }
    ],
    themeColor: '#536b5d',
    iconText: '圈'
  },
  {
    id: 'woodkingdom',
    name: '森之王国',
    sceneClass: WoodKingdomScene,
    description: '森林资源策略 · 战役',
    rules: '【森之王国规则说明】\n1. 战场对局：这是一个 2×4 的卡牌战场对局游戏。目标是造成伤害使天平向敌方侧倾斜 5 点，净受到 5 点伤害即败。\n2. 出牌资源：\n   - 露珠：点击己方卡牌右上角「归」字按钮放归卡牌获得，露珠在每回合战斗开始前清零。\n   - 落叶：卡牌离场（放归或被击败）时获得，落叶可跨回合累积。\n3. 兵种印记特质：\n   - 飞行 (Airborne)：卡牌会跃过前方防守直接击打天平。\n   - 双击 (Bifurcated)：朝左前和右前同时攻击两个位置。\n   - 催眠 (sleepTouch)：受击者在下一次出手攻击时将跳过攻击并醒来。\n   - 坚固 (Shield)：可以完全抵挡住一次受到的伤害。\n   - 不朽 (unkillable)：卡牌离场或被放归时重新回到玩家手牌。\n   - 领袖 (leader)：相邻己方卡牌获得 +1 攻击力。\n   - 雏鸟 (fledgling)：在场存活一回合后自动进化成长，属性提升。\n4. 回合流程：点击结束回合开始结算，步骤为：敌方预备卡向前推入战场 -> 双方卡牌对撞攻击 -> 敌方在预备区放下新卡。战胜可抽取新卡加入牌库进行 Deckbuilding。',
    formatScore: (scoreObj) => {
      return scoreObj && scoreObj.bestTime ? '最佳时间 ' + scoreObj.bestTime + 's' : null;
    },
    configTitle: '森之王国战役模式',
    configOptions: [
      { label: '开始新战役', value: { level: 1 } }
    ],
    themeColor: '#7a4f3f',
    iconText: '森'
  },
  {
    id: 'onestroke',
    name: '一笔画',
    sceneClass: OneStrokeScene,
    description: '连线走通所有空白方格',
    rules: '【一笔画规则说明】\n1. 从带有金色高亮（起点）的格子开始，通过滑动连接相邻的格子。\n2. 目标是连续走通棋盘上除障碍物以外的所有空白方格且不能重复走同一个格子。\n3. 在滑动时，可向后倒退抹除多余连线，或者通过点击「返回」再重新进入重开游戏。',
    formatScore: (scoreObj) => {
      return scoreObj && scoreObj.bestScore ? `最佳 ${scoreObj.bestScore} 分 · ${scoreObj.bestTime}s` : null;
    },
    configTitle: '一笔画网格阶数',
    configOptions: [
      { label: '4 x 4 (1个障碍)', value: { size: 4, obstacleCount: 1 } },
      { label: '5 x 5 (2个障碍)', value: { size: 5, obstacleCount: 2 } },
      { label: '6 x 6 (3个障碍)', value: { size: 6, obstacleCount: 3 } }
    ],
    themeColor: '#655b6c',
    iconText: '画'
  },
  {
    id: 'reversi',
    name: '黑白棋',
    sceneClass: ReversiScene,
    description: '经典人机对弈 · 翻转黑白',
    rules: '【黑白棋规则说明】\n1. 只能在可夹击对手棋子的空白位置落子。\n2. 落子后，被夹在己方棋子之间的对方棋子将全部翻转为己方颜色。\n3. 如果自己没有合法位置可下，将自动被跳过回合（Pass）。\n4. 棋盘填满或双方都无子可下时游戏结束，棋子多的一方获胜。',
    formatScore: (scoreObj) => {
      return scoreObj && scoreObj.bestScore ? `最佳 ${scoreObj.bestScore} 分 · ${scoreObj.bestTime}s` : null;
    },
    configTitle: '黑白棋 AI 难度选择',
    configOptions: [
      { label: '简单模式', value: { difficulty: 'easy' } },
      { label: '普通对弈', value: { difficulty: 'normal' } },
      { label: '大师挑战', value: { difficulty: 'hard' } }
    ],
    themeColor: '#567d65',
    iconText: '棋'
  },
  {
    id: 'jump',
    name: '跃上云巅',
    sceneClass: JumpScene,
    description: '单手弹跳攀爬 · 温馨篝火旅途',
    rules: '【跃上云巅规则说明】\n1. 在屏幕任意位置向反方向拖拽并松手，可将粘性 Slime 饭团发射出去。\n2. 撞击平台侧壁或下方会发生弹性物理反弹，踩中平台顶部可平稳站立。\n3. 每个区域的起点入口均有一堆安全篝火，踩中即可点亮。如果不慎跌落可随时返回最后篝火起跳。\n4. 冲过重重险阻与物理反弹，登上 3200 米的云巅即可通关！',
    formatScore: (scoreObj) => {
      if (!scoreObj) return null;
      if (scoreObj.bestTime && scoreObj.bestTime !== Infinity) {
        return `最佳速通 ${scoreObj.bestTime}s`;
      }
      return scoreObj.bestScore ? `最佳攀爬 ${scoreObj.bestScore}%` : null;
    },
    configTitle: '跃上云巅 旅程模式',
    configOptions: [
      { label: '点亮篝火，开启攀登', value: {} }
    ],
    themeColor: '#8f9f91',
    iconText: '跃'
  }
];

export function getGameConfig(id) {
  return GAMES.find((g) => g.id === id);
}
