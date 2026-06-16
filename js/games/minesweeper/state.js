import { saveScore } from '../../core/storage.js';

export default class MinesweeperState {
  constructor(rows, cols, mines) {
    this.rows = rows;
    this.cols = cols;
    this.totalMines = mines;
    this.grid = [];        // 2D array: -1 = mine, 0-8 = adjacent mine count
    this.revealed = [];    // 2D boolean
    this.flagged = [];     // 2D boolean
    this.completed = false;
    this.won = false;
    this.saved = false;
    this.startTime = Date.now();
    this.firstClick = true; // 首点安全
    this.steps = 0;
    this.flagCount = 0;

    this.initGrid();
  }

  initGrid() {
    this.grid = Array.from({ length: this.rows }, () => Array(this.cols).fill(0));
    this.revealed = Array.from({ length: this.rows }, () => Array(this.cols).fill(false));
    this.flagged = Array.from({ length: this.rows }, () => Array(this.cols).fill(false));
  }

  // 首点安全：在首点点击后生成雷区，确保首点及周围不是雷
  generateMines(safeRow, safeCol) {
    // 收集所有合法位置（排除安全区）
    const candidates = [];
    for (let r = 0; r < this.rows; r++) {
      for (let c = 0; c < this.cols; c++) {
        if (Math.abs(r - safeRow) <= 1 && Math.abs(c - safeCol) <= 1) continue;
        candidates.push({ r, c });
      }
    }
    // Fisher-Yates 从候选池中抽取 mines 个位置
    const mineCount = Math.min(this.totalMines, candidates.length);
    for (let i = 0; i < mineCount; i++) {
      const j = i + Math.floor(Math.random() * (candidates.length - i));
      [candidates[i], candidates[j]] = [candidates[j], candidates[i]];
      this.grid[candidates[i].r][candidates[i].c] = -1;
    }
    // 计算数字
    for (let r = 0; r < this.rows; r++) {
      for (let c = 0; c < this.cols; c++) {
        if (this.grid[r][c] === -1) continue;
        let count = 0;
        for (let dr = -1; dr <= 1; dr++) {
          for (let dc = -1; dc <= 1; dc++) {
            const nr = r + dr;
            const nc = c + dc;
            if (nr >= 0 && nr < this.rows && nc >= 0 && nc < this.cols && this.grid[nr][nc] === -1) {
              count++;
            }
          }
        }
        this.grid[r][c] = count;
      }
    }
  }

  // 揭开一个格子，返回 'mine' | 'ok' | 'already'
  reveal(row, col) {
    if (this.completed || this.flagged[row][col] || this.revealed[row][col]) return 'already';

    if (this.firstClick) {
      this.generateMines(row, col);
      this.firstClick = false;
    }

    if (this.grid[row][col] === -1) {
      this.revealed[row][col] = true;
      this.completed = true;
      this.won = false;
      this.revealAllMines();
      this.saveResult();
      return 'mine';
    }

    this.steps++;
    this.floodReveal(row, col);

    if (this.checkWin()) {
      this.completed = true;
      this.won = true;
      this.saveResult();
    }
    return 'ok';
  }

  floodReveal(startRow, startCol) {
    const stack = [[startRow, startCol]];
    while (stack.length > 0) {
      const [row, col] = stack.pop();
      if (row < 0 || row >= this.rows || col < 0 || col >= this.cols) continue;
      if (this.revealed[row][col] || this.flagged[row][col]) continue;

      this.revealed[row][col] = true;

      if (this.grid[row][col] === 0) {
        for (let dr = -1; dr <= 1; dr++) {
          for (let dc = -1; dc <= 1; dc++) {
            stack.push([row + dr, col + dc]);
          }
        }
      }
    }
  }

  // 切换旗子标记，返回 'flagged' | 'unflagged' | 'blocked'
  toggleFlag(row, col) {
    if (this.completed || this.revealed[row][col]) return 'blocked';
    this.flagged[row][col] = !this.flagged[row][col];
    if (this.flagged[row][col]) {
      this.flagCount++;
    } else {
      this.flagCount--;
    }
    return this.flagged[row][col] ? 'flagged' : 'unflagged';
  }

  revealAllMines() {
    for (let r = 0; r < this.rows; r++) {
      for (let c = 0; c < this.cols; c++) {
        if (this.grid[r][c] === -1) {
          this.revealed[r][c] = true;
        }
      }
    }
  }

  checkWin() {
    for (let r = 0; r < this.rows; r++) {
      for (let c = 0; c < this.cols; c++) {
        if (this.grid[r][c] !== -1 && !this.revealed[r][c]) return false;
      }
    }
    return true;
  }

  getElapsed() {
    return Math.floor((Date.now() - this.startTime) / 1000);
  }

  getFlagCount() {
    return this.flagCount;
  }

  getScore() {
    if (!this.won) return 0;
    let base = 1000;
    if (this.rows === 12 && this.cols === 12) base = 3000;
    if (this.rows === 12 && this.cols === 16) base = 5000;
    return Math.max(100, base - this.getElapsed() * 2 - this.steps);
  }

  saveResult() {
    if (this.saved) return;
    const time = this.getElapsed();
    const score = this.getScore();
    saveScore('minesweeper', {
      score,
      time,
      steps: this.steps,
      difficulty: `${this.rows}x${this.cols}`,
      won: this.won,
    });
    this.saved = true;
  }
}
