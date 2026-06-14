import SudokuScene from './sudoku/index.js';
import HuarongdaoScene from './huarongdao/index.js';
import MinesweeperScene from './minesweeper/index.js';
import Game2048Scene from './game2048/index.js';
import MemoryScene from './memory/index.js';
import SlitherlinkScene from './slitherlink/index.js';
import WoodKingdomScene from './woodkingdom/index.js';


export const GAMES = [
  {
    id: 'sudoku',
    name: '数独',
    sceneClass: SudokuScene,
    formatScore: (scoreObj) => {
      return scoreObj && scoreObj.bestScore ? `最佳 ${scoreObj.bestScore} 分 · ${scoreObj.bestTime}s` : '九宫格推理 · 简单难度';
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
    formatScore: (scoreObj) => {
      return scoreObj && scoreObj.bestScore ? `最佳 ${scoreObj.bestScore} 分 · ${scoreObj.bestSteps} 步` : '数字排序滑动拼图';
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
    formatScore: (scoreObj) => {
      return scoreObj && scoreObj.bestScore ? `最佳 ${scoreObj.bestScore} 分 · ${scoreObj.bestTime}s` : '揭开安全格 · 避开地雷';
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
    formatScore: (scoreObj) => {
      return scoreObj && scoreObj.bestScore ? `最高 ${scoreObj.bestScore} 分` : '滑动合并数字方块';
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
    formatScore: (scoreObj) => {
      return scoreObj && scoreObj.bestScore ? `最佳 ${scoreObj.bestScore} 分 · ${scoreObj.bestTime}s` : '翻开卡牌寻找配对';
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
    formatScore: (scoreObj) => {
      return scoreObj && scoreObj.bestScore ? `最佳 ${scoreObj.bestScore} 分 · ${scoreObj.bestTime}s` : '连接点线形成单一闭合回路';
    },
    configTitle: '数回网格尺寸',
    configOptions: [
      { label: '5 x 5 (简单)', value: { rows: 5, cols: 5 } },
      { label: '7 x 7 (困难)', value: { rows: 7, cols: 7 } }
    ],
    themeColor: '#52677a',
    iconText: '圈'
  },
  {
    id: 'woodkingdom',
    name: '森之王国',
    sceneClass: WoodKingdomScene,
    formatScore: (scoreObj) => {
      return scoreObj && scoreObj.bestTime ? '最佳时间 ' + scoreObj.bestTime + 's' : '...';
    },
    configTitle: '森之王国战役模式',
    configOptions: [
      { label: '开始新战役', value: { level: 1 } }
    ],
    themeColor: '#7a4f3f',
    iconText: '森'
  }
];

export function getGameConfig(id) {
  return GAMES.find((g) => g.id === id);
}
