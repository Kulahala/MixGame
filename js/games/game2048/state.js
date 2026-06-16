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
    this._nextId = 1;

    this.init();
  }

  init() {
    this.grid = Array.from({ length: this.size }, () => Array(this.size).fill(null));
    this.score = 0;
    this.completed = false;
    this.won = false;
    this.saved = false;
    this.steps = 0;
    this.startTime = Date.now();
    this._nextId = 1;
    this.addRandomTile();
    this.addRandomTile();
  }

  addRandomTile() {
    const empty = [];
    for (let r = 0; r < this.size; r++) {
      for (let c = 0; c < this.size; c++) {
        if (this.grid[r][c] === null) empty.push({ r, c });
      }
    }
    if (empty.length === 0) return null;
    const { r, c } = empty[Math.floor(Math.random() * empty.length)];
    const value = Math.random() < 0.9 ? 2 : 4;
    const id = this._nextId++;
    this.grid[r][c] = { id, value };
    return { r, c, value, id };
  }

  // direction: 'up', 'down', 'left', 'right'
  // Returns { moved, movements, newTile }
  move(direction) {
    if (this.completed) return { moved: false, movements: [], newTile: null };

    const oldGrid = this.grid.map(row => row.map(cell => cell ? { ...cell } : null));

    let directionResult;
    switch (direction) {
      case 'left': directionResult = this.moveLeft(); break;
      case 'right': directionResult = this.moveRight(); break;
      case 'up': directionResult = this.moveUp(); break;
      case 'down': directionResult = this.moveDown(); break;
      default: directionResult = { movements: [], score: 0 };
    }

    // Check if anything actually changed
    let moved = false;
    for (let r = 0; r < this.size; r++) {
      for (let c = 0; c < this.size; c++) {
        const oldV = oldGrid[r][c] ? oldGrid[r][c].value : 0;
        const newV = this.grid[r][c] ? this.grid[r][c].value : 0;
        if (oldV !== newV) {
          moved = true;
          break;
        }
      }
      if (moved) break;
    }

    if (moved) {
      this.steps++;
      const newTile = this.addRandomTile();

      if (this.checkWin()) {
        this.completed = true;
        this.won = true;
      } else if (this.checkGameOver()) {
        this.completed = true;
        this.won = false;
      }

      return {
        moved: true,
        movements: directionResult.movements,
        newTile,
      };
    }

    return { moved: false, movements: [], newTile: null };
  }

  // line: array of {id, value} | null, length = this.size
  // Returns { result, score, movements }
  // movements: [{id, fromIndex, toIndex, value, merged, mergedFromIds}]
  mergeLine(line) {
    let score = 0;
    let movements = [];

    // Collect non-null tiles with original indices
    const tiles = [];
    for (let i = 0; i < line.length; i++) {
      if (line[i] !== null) {
        tiles.push({ id: line[i].id, value: line[i].value, fromIndex: i });
      }
    }

    // Process merges and slides
    const resultTiles = []; // {id, value}
    for (let i = 0; i < tiles.length; i++) {
      if (i + 1 < tiles.length && tiles[i].value === tiles[i + 1].value) {
        // Merge two tiles
        const newValue = tiles[i].value * 2;
        score += newValue;
        const mergedId = this._nextId++;
        const fromId1 = tiles[i].id;
        const fromId2 = tiles[i + 1].id;
        const toIndex = resultTiles.length;

        // Movement for first source tile
        movements.push({
          id: fromId1,
          fromIndex: tiles[i].fromIndex,
          toIndex,
          value: tiles[i].value,
          merged: true,
          mergedFromIds: [fromId1, fromId2],
        });

        // Movement for second source tile
        movements.push({
          id: fromId2,
          fromIndex: tiles[i + 1].fromIndex,
          toIndex,
          value: tiles[i + 1].value,
          merged: true,
          mergedFromIds: [fromId1, fromId2],
        });

        resultTiles.push({ id: mergedId, value: newValue });
        i++; // skip the merged-away tile
      } else {
        // Slide only (no merge)
        movements.push({
          id: tiles[i].id,
          fromIndex: tiles[i].fromIndex,
          toIndex: resultTiles.length,
          value: tiles[i].value,
          merged: false,
          mergedFromIds: [],
        });

        resultTiles.push({ id: tiles[i].id, value: tiles[i].value });
      }
    }

    // Pad with nulls to full size
    const result = [];
    for (let i = 0; i < this.size; i++) {
      result.push(i < resultTiles.length
        ? { id: resultTiles[i].id, value: resultTiles[i].value }
        : null);
    }

    return { result, score, movements };
  }

  moveLeft() {
    let totalScore = 0;
    const allMovements = [];
    for (let r = 0; r < this.size; r++) {
      const { result, score, movements } = this.mergeLine(this.grid[r]);
      this.grid[r] = result;
      for (const m of movements) {
        allMovements.push({
          id: m.id,
          fromR: r, fromC: m.fromIndex,
          toR: r, toC: m.toIndex,
          value: m.value,
          merged: m.merged,
          mergedFromIds: m.mergedFromIds,
        });
      }
      totalScore += score;
    }
    this.score += totalScore;
    return { movements: allMovements, score: totalScore };
  }

  moveRight() {
    let totalScore = 0;
    const allMovements = [];
    for (let r = 0; r < this.size; r++) {
      const reversed = [...this.grid[r]].reverse();
      const { result, score, movements } = this.mergeLine(reversed);
      this.grid[r] = result.reverse();
      for (const m of movements) {
        allMovements.push({
          id: m.id,
          fromR: r, fromC: this.size - 1 - m.fromIndex,
          toR: r, toC: this.size - 1 - m.toIndex,
          value: m.value,
          merged: m.merged,
          mergedFromIds: m.mergedFromIds,
        });
      }
      totalScore += score;
    }
    this.score += totalScore;
    return { movements: allMovements, score: totalScore };
  }

  moveUp() {
    let totalScore = 0;
    const allMovements = [];
    for (let c = 0; c < this.size; c++) {
      const col = this.grid.map(row => row[c]);
      const { result, score, movements } = this.mergeLine(col);
      for (let r = 0; r < this.size; r++) this.grid[r][c] = result[r];
      for (const m of movements) {
        allMovements.push({
          id: m.id,
          fromR: m.fromIndex, fromC: c,
          toR: m.toIndex, toC: c,
          value: m.value,
          merged: m.merged,
          mergedFromIds: m.mergedFromIds,
        });
      }
      totalScore += score;
    }
    this.score += totalScore;
    return { movements: allMovements, score: totalScore };
  }

  moveDown() {
    let totalScore = 0;
    const allMovements = [];
    for (let c = 0; c < this.size; c++) {
      const col = this.grid.map(row => row[c]).reverse();
      const { result, score, movements } = this.mergeLine(col);
      result.reverse();
      for (let r = 0; r < this.size; r++) this.grid[r][c] = result[r];
      for (const m of movements) {
        allMovements.push({
          id: m.id,
          fromR: this.size - 1 - m.fromIndex, fromC: c,
          toR: this.size - 1 - m.toIndex, toC: c,
          value: m.value,
          merged: m.merged,
          mergedFromIds: m.mergedFromIds,
        });
      }
      totalScore += score;
    }
    this.score += totalScore;
    return { movements: allMovements, score: totalScore };
  }

  checkWin() {
    for (let r = 0; r < this.size; r++) {
      for (let c = 0; c < this.size; c++) {
        if (this.grid[r][c] && this.grid[r][c].value >= this.target) return true;
      }
    }
    return false;
  }

  checkGameOver() {
    // Empty cells remain → not over
    for (let r = 0; r < this.size; r++) {
      for (let c = 0; c < this.size; c++) {
        if (this.grid[r][c] === null) return false;
      }
    }
    // Check for any mergable neighbours
    for (let r = 0; r < this.size; r++) {
      for (let c = 0; c < this.size; c++) {
        const v = this.grid[r][c].value;
        if (c + 1 < this.size && this.grid[r][c + 1].value === v) return false;
        if (r + 1 < this.size && this.grid[r + 1][c].value === v) return false;
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
      won: this.won,
    });
    this.saved = true;
  }
}
