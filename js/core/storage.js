const STORAGE_KEY = 'mini_game_collection_scores_v1';

const DEFAULT_SCORES = {
  sudoku: {
    bestScore: 0,
    bestTime: 0,
    bestMistakes: 0,
    plays: 0,
    history: [],
  },
  huarongdao: {
    bestScore: 0,
    bestSteps: 0,
    bestTime: 0,
    plays: 0,
    history: [],
  },
  minesweeper: {
    bestScore: 0,
    bestTime: 0,
    bestSteps: 0,
    plays: 0,
    history: [],
  },
  game2048: {
    bestScore: 0,
    bestTime: 0,
    bestSteps: 0,
    plays: 0,
    history: [],
  },
  memory: {
    bestScore: 0,
    bestTime: 0,
    bestSteps: 0,
    plays: 0,
    history: [],
  },
  slitherlink: {
    bestScore: 0,
    bestTime: 0,
    bestSteps: 0,
    plays: 0,
    history: [],
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

  // ── History (最多 3 条，按 score 降序) ───────────────
  const history = (current.history || []).slice();
  if (result.won !== false) {
    const entry = {};
    for (const key of ['score', 'time', 'steps', 'mistakes', 'difficulty']) {
      if (result[key] !== undefined) entry[key] = result[key];
    }
    history.push(entry);
    history.sort((a, b) => (b.score || 0) - (a.score || 0));
    next.history = history.slice(0, 3);
  } else {
    next.history = history;
  }

  scores[gameId] = next;

  try {
    wx.setStorageSync(STORAGE_KEY, scores);
  } catch (error) {
    // 本地存储失败不应阻断单机游戏流程。
  }

  return scores;
}

export function getHistory(gameId) {
  const scores = getScores();
  const current = scores[gameId];
  if (!current || !Array.isArray(current.history)) return [];
  return current.history.slice(0, 3);
}
