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
  woodkingdom: {
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

  const isBest = gameId === 'woodkingdom'
    ? (!current.bestTime || (result.time && result.time < current.bestTime))
    : (!current.bestScore || result.score > current.bestScore);

  if (isBest) {
    next.bestScore = result.score;
    next.bestTime = result.time || 0;
    next.bestSteps = result.steps || 0;
    next.bestMistakes = result.mistakes || 0;
    next.bestDifficulty = result.difficulty || 'easy';
    next.bestLevelId = result.levelId || '';
  }

  // ── History (按难度分组，每个难度最多保留 3 条) ──────────────────────────
  const history = (current.history || []).slice();
  if (result.won !== false) {
    const entry = {};
    for (const key of ['score', 'time', 'steps', 'mistakes', 'difficulty']) {
      if (result[key] !== undefined) entry[key] = result[key];
    }
    history.push(entry);

    // 按难度进行分组和排序裁剪
    const groups = {};
    for (const item of history) {
      const diff = item.difficulty || 'easy';
      if (!groups[diff]) groups[diff] = [];
      groups[diff].push(item);
    }

    const nextHistory = [];
    for (const diff in groups) {
      if (gameId === 'woodkingdom') {
        groups[diff].sort((a, b) => (a.time || 0) - (b.time || 0));
      } else {
        groups[diff].sort((a, b) => (b.score || 0) - (a.score || 0));
      }
      nextHistory.push(...groups[diff].slice(0, 3));
    }
    next.history = nextHistory;
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

export function getHistory(gameId, difficulty) {
  const scores = getScores();
  const current = scores[gameId];
  if (!current || !Array.isArray(current.history)) return [];
  let list = current.history;
  if (difficulty) {
    list = list.filter(h => h.difficulty === difficulty);
  }
  if (gameId === 'woodkingdom') {
    list.sort((a, b) => (a.time || 0) - (b.time || 0));
  } else {
    list.sort((a, b) => (b.score || 0) - (a.score || 0));
  }
  return list.slice(0, 3);
}
