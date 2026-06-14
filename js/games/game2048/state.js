import { saveScore } from '../../core/storage.js';

export default class Game2048State {
  constructor(target = 2048) {
    this.size = 4;
    this.target = target;
    this.grid = [];
    this.score = 0;
    this.completed = false;
    this.won = false;
    this.saved = false;
    this.startTime = Date.now();
    this.steps = 0;

    this.init();
  }

  init() {
    this.grid = Array.from({ length: this.size }, () => Array(this.size).fill(0));
    this.score = 0;
    this.completed = false;
    this.won = false;
    this.saved = false;
    this.steps = 0;
    this.startTime = Date.now();
    this.addRandomTile();
    this.addRandomTile();
  }

  addRandomTile() {
    const empty = [];
    for (let r = 0; r < this.size; r++) {
      for (let c = 0; c < this.size; c++) {
        if (this.grid[r][c] === 0) empty.push({ r, c });
      }
    }
    if (empty.length === 0) return false;
    const { r, c } = empty[Math.floor(Math.random() * empty.length)];
    this.grid[r][c] = Math.random() < 0.9 ? 2 : 4;
    return true;
  }

  // direction: 'up', 'down', 'left', 'right'
  // returns true if the grid changed
  move(direction) {
    if (this.completed) return false;

    const oldGrid = this.grid.map(row => row.slice());

    switch (direction) {
      case 'left': this.moveLeft(); break;
      case 'right': this.moveRight(); break;
      case 'up': this.moveUp(); break;
      case 'down': this.moveDown(); break;
    }

    let moved = false;
    for (let r = 0; r < this.size; r++) {
      for (let c = 0; c < this.size; c++) {
        if (this.grid[r][c] !== oldGrid[r][c]) {
          moved = true;
          break;
        }
      }
      if (moved) break;
    }

    if (moved) {
      this.steps++;
      this.addRandomTile();

      if (this.checkWin()) {
        this.completed = true;
        this.won = true;
      } else if (this.checkGameOver()) {
        this.completed = true;
        this.won = false;
      }
    }

    return moved;
  }

  mergeLine(line) {
    let arr = line.filter(v => v !== 0);
    let score = 0;
    for (let i = 0; i < arr.length - 1; i++) {
      if (arr[i] === arr[i + 1]) {
        arr[i] *= 2;
        score += arr[i];
        arr.splice(i + 1, 1);
      }
    }
    while (arr.length < this.size) arr.push(0);
    return { result: arr, score };
  }

  moveLeft() {
    let totalScore = 0;
    for (let r = 0; r < this.size; r++) {
      const { result, score } = this.mergeLine(this.grid[r]);
      this.grid[r] = result;
      totalScore += score;
    }
    this.score += totalScore;
  }

  moveRight() {
    let totalScore = 0;
    for (let r = 0; r < this.size; r++) {
      const { result, score } = this.mergeLine([...this.grid[r]].reverse());
      this.grid[r] = result.reverse();
      totalScore += score;
    }
    this.score += totalScore;
  }

  moveUp() {
    let totalScore = 0;
    for (let c = 0; c < this.size; c++) {
      const col = this.grid.map(row => row[c]);
      const { result, score } = this.mergeLine(col);
      for (let r = 0; r < this.size; r++) this.grid[r][c] = result[r];
      totalScore += score;
    }
    this.score += totalScore;
  }

  moveDown() {
    let totalScore = 0;
    for (let c = 0; c < this.size; c++) {
      const col = this.grid.map(row => row[c]).reverse();
      const { result, score } = this.mergeLine(col);
      result.reverse();
      for (let r = 0; r < this.size; r++) this.grid[r][c] = result[r];
      totalScore += score;
    }
    this.score += totalScore;
  }

  checkWin() {
    for (let r = 0; r < this.size; r++) {
      for (let c = 0; c < this.size; c++) {
        if (this.grid[r][c] >= this.target) return true;
      }
    }
    return false;
  }

  checkGameOver() {
    // empty cells remain → not over
    for (let r = 0; r < this.size; r++) {
      for (let c = 0; c < this.size; c++) {
        if (this.grid[r][c] === 0) return false;
      }
    }
    // check for any mergable neighbours
    for (let r = 0; r < this.size; r++) {
      for (let c = 0; c < this.size; c++) {
        const v = this.grid[r][c];
        if (c + 1 < this.size && this.grid[r][c + 1] === v) return false;
        if (r + 1 < this.size && this.grid[r + 1][c] === v) return false;
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
    saveScore('game2048', {
      score: this.score,
      time,
      steps: this.steps,
      difficulty: `目标${this.target}`,
    });
    this.saved = true;
  }
}
