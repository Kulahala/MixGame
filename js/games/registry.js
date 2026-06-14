import SudokuScene from './sudoku/index.js';
import HuarongdaoScene from './huarongdao/index.js';

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
  }
];

export function getGameConfig(id) {
  return GAMES.find((g) => g.id === id);
}
