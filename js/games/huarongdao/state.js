import { saveScore } from '../../core/storage.js';

export default class HuarongdaoState {
  constructor(size) {
    this.size = size;
    this.grid = [];
    this.emptyPos = { r: size - 1, c: size - 1 };
    this.steps = 0;
    this.completed = false;
    this.saved = false;
    this.startTime = Date.now();

    this.reset();
  }

  reset() {
    this.grid = Array.from({ length: this.size }, () => Array(this.size).fill(0));
    let num = 1;
    for (let r = 0; r < this.size; r++) {
      for (let c = 0; c < this.size; c++) {
        if (r === this.size - 1 && c === this.size - 1) {
          this.grid[r][c] = 0; // 0 for empty
        } else {
          this.grid[r][c] = num++;
        }
      }
    }
    this.emptyPos = { r: this.size - 1, c: this.size - 1 };
    
    do {
      this.shuffle(1000);
    } while (this.isSolved());

    this.steps = 0;
    this.completed = false;
    this.saved = false;
    this.startTime = Date.now();
  }

  shuffle(times) {
    const moves = [
      {dr: -1, dc: 0}, {dr: 1, dc: 0},
      {dr: 0, dc: -1}, {dr: 0, dc: 1}
    ];
    let lastMove = null;
    for (let i = 0; i < times; i++) {
      const validMoves = moves.filter(m => {
        const nr = this.emptyPos.r + m.dr;
        const nc = this.emptyPos.c + m.dc;
        if (nr < 0 || nr >= this.size || nc < 0 || nc >= this.size) return false;
        if (lastMove && m.dr === -lastMove.dr && m.dc === -lastMove.dc) return false;
        return true;
      });
      const move = validMoves[Math.floor(Math.random() * validMoves.length)];
      const tr = this.emptyPos.r + move.dr;
      const tc = this.emptyPos.c + move.dc;
      this.grid[this.emptyPos.r][this.emptyPos.c] = this.grid[tr][tc];
      this.grid[tr][tc] = 0;
      this.emptyPos = { r: tr, c: tc };
      lastMove = move;
    }
  }

  tryMoveGrid(r, c) {
    if (this.completed) return false;
    if (this.emptyPos.r !== r && this.emptyPos.c !== c) return false;
    if (this.emptyPos.r === r && this.emptyPos.c === c) return false;

    if (this.emptyPos.r === r) {
      // Move horizontally
      const step = this.emptyPos.c > c ? -1 : 1;
      for (let i = this.emptyPos.c; i !== c; i += step) {
        this.grid[r][i] = this.grid[r][i + step];
      }
      this.grid[r][c] = 0;
      this.emptyPos = { r, c };
      this.steps++;
    } else {
      // Move vertically
      const step = this.emptyPos.r > r ? -1 : 1;
      for (let i = this.emptyPos.r; i !== r; i += step) {
        this.grid[i][c] = this.grid[i + step][c];
      }
      this.grid[r][c] = 0;
      this.emptyPos = { r, c };
      this.steps++;
    }
    return true;
  }

  isSolved() {
    let expected = 1;
    for (let r = 0; r < this.size; r++) {
      for (let c = 0; c < this.size; c++) {
        if (r === this.size - 1 && c === this.size - 1) {
          if (this.grid[r][c] !== 0) return false;
        } else {
          if (this.grid[r][c] !== expected++) return false;
        }
      }
    }
    return true;
  }

  getElapsed() {
    return Math.floor((Date.now() - this.startTime) / 1000);
  }

  saveResult() {
    if (this.saved) return;
    const time = this.getElapsed();
    const score = Math.max(100, 1000 - time * 2 - this.steps * 10);
    saveScore('huarongdao', {
      score,
      time,
      steps: this.steps,
      difficulty: `${this.size}x${this.size}`,
    });
    this.saved = true;
  }
}
