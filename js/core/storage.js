const STORAGE_KEY = 'mini_game_collection_scores_v1';

const DEFAULT_SCORES = {
  sudoku: {
    bestScore: 0,
    bestTime: 0,
    bestMistakes: 0,
    plays: 0,
  },
  huarongdao: {
    bestScore: 0,
    bestSteps: 0,
    bestTime: 0,
    plays: 0,
  },
};

function cloneDefaultScores() {
  return JSON.parse(JSON.stringify(DEFAULT_SCORES));
}

export function getScores() {
  try {
    return Object.assign(cloneDefaultScores(), wx.getStorageSync(STORAGE_KEY) || {});
  } catch (error) {
    return cloneDefaultScores();
  }
}

export function saveScore(gameId, result) {
  const scores = getScores();
  const current = scores[gameId] || {};
  const next = Object.assign({}, current, {
    plays: (current.plays || 0) + 1,
    lastScore: result.score,
    lastTime: result.time || 0,
    lastSteps: result.steps || 0,
    lastMistakes: result.mistakes || 0,
    lastDifficulty: result.difficulty || current.lastDifficulty || 'easy',
    lastLevelId: result.levelId || current.lastLevelId || '',
  });

  if (!current.bestScore || result.score > current.bestScore) {
    next.bestScore = result.score;
    next.bestTime = result.time || 0;
    next.bestSteps = result.steps || 0;
    next.bestMistakes = result.mistakes || 0;
    next.bestDifficulty = result.difficulty || 'easy';
    next.bestLevelId = result.levelId || '';
  }

  scores[gameId] = next;

  try {
    wx.setStorageSync(STORAGE_KEY, scores);
  } catch (error) {
    // 本地存储失败不应阻断单机游戏流程。
  }

  return scores;
}
