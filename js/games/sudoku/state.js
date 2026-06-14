import { saveScore } from '../../core/storage.js';

function cloneGrid(grid) {
  return grid.map((row) => row.slice());
}

export default class SudokuBoardState {
  constructor(initialPuzzle, solution) {
    this.initialPuzzle = initialPuzzle;
    this.solution = solution;
    
    this.board = cloneGrid(initialPuzzle);
    this.mistakeMap = initialPuzzle.map((row) => row.map(() => false));
    this.fixed = initialPuzzle.map((row) => row.map((value) => value !== 0));
    
    this.mistakes = 0;
    this.history = [];
    this.isNoteMode = false;
    this.notesMap = Array.from({length: 9}, () => Array(9).fill().map(() => []));
    
    this.completed = false;
    this.saved = false;
    this.startTime = Date.now();
  }

  fillNumber(r, c, val) {
    if (this.fixed[r][c] || this.completed) return false;

    if (this.isNoteMode) {
      if (this.board[r][c] !== 0) return false;
      
      this.history.push({
        r, c, 
        prevVal: this.board[r][c], 
        prevMistake: this.mistakeMap[r][c],
        prevNotes: [...this.notesMap[r][c]]
      });

      const notes = this.notesMap[r][c];
      const idx = notes.indexOf(val);
      if (idx >= 0) {
        notes.splice(idx, 1);
      } else {
        notes.push(val);
        notes.sort((a, b) => a - b);
      }
      return true;
    }

    this.history.push({
      r, c, 
      prevVal: this.board[r][c], 
      prevMistake: this.mistakeMap[r][c],
      prevNotes: [...this.notesMap[r][c]]
    });

    this.board[r][c] = val;
    this.notesMap[r][c] = []; // 填入真实数字时清空草稿
    if (val !== this.solution[r][c]) {
      this.mistakeMap[r][c] = true;
      this.mistakes++;
    } else {
      this.mistakeMap[r][c] = false;
    }
    return true;
  }

  erase(r, c) {
    if (this.fixed[r][c] || this.completed) return false;
    if (this.board[r][c] !== 0 || this.notesMap[r][c].length > 0) {
      this.history.push({
        r, c, 
        prevVal: this.board[r][c], 
        prevMistake: this.mistakeMap[r][c],
        prevNotes: [...this.notesMap[r][c]]
      });
      this.board[r][c] = 0;
      this.mistakeMap[r][c] = false;
      this.notesMap[r][c] = [];
      return true;
    }
    return false;
  }

  undo() {
    if (this.history.length === 0 || this.completed) return false;
    const action = this.history.pop();
    this.board[action.r][action.c] = action.prevVal;
    this.mistakeMap[action.r][action.c] = action.prevMistake;
    this.notesMap[action.r][action.c] = [...action.prevNotes];
    return true;
  }

  toggleNoteMode() {
    this.isNoteMode = !this.isNoteMode;
    return this.isNoteMode;
  }

  isBoardFull() {
    for (let r = 0; r < 9; r++) {
      for (let c = 0; c < 9; c++) {
        if (this.board[r][c] === 0) return false;
      }
    }
    return true;
  }

  isSolved() {
    for (let r = 0; r < 9; r++) {
      for (let c = 0; c < 9; c++) {
        if (this.board[r][c] !== this.solution[r][c]) return false;
      }
    }
    return true;
  }

  getScore() {
    const timeSpent = this.getTimeSpent();
    return Math.max(0, 10000 - timeSpent * 10 - this.mistakes * 200);
  }

  saveResult() {
    if (this.saved) return;
    this.saved = true;
    const timeSpent = this.getTimeSpent();
    const score = this.getScore();
    saveScore('sudoku', { 
      score, 
      time: timeSpent, 
      mistakes: this.mistakes 
    });
  }

  getTimeSpent() {
    return Math.floor((Date.now() - this.startTime) / 1000);
  }
}
