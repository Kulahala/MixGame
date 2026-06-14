import Button from '../../ui/button.js';
import { contains, drawText, fillRoundRect, strokeRoundRect } from '../../ui/canvas.js';
import { saveScore } from '../../core/storage.js';
import { PUZZLE, SOLUTION } from './puzzle.js';

function cloneGrid(grid) {
  return grid.map((row) => row.slice());
}

export default class SudokuScene {
  constructor(host) {
    this.host = host;
    this.theme = host.theme;
    this.board = cloneGrid(PUZZLE);
    this.fixed = PUZZLE.map((row) => row.map((value) => value !== 0));
    this.selected = { row: 0, col: 2 };
    this.mistakes = 0;
    this.completed = false;
    this.saved = false;
    this.startTime = Date.now();
    this.buttons = [];
  }

  init() {
    const width = this.host.width;
    this.boardSize = Math.min(width - 32, 342);
    this.cell = this.boardSize / 9;
    this.boardX = (width - this.boardSize) / 2;
    this.boardY = 164;
    this.keyY = this.boardY + this.boardSize + 22;
    this.setupButtons();
  }

  setupButtons() {
    const width = this.host.width;
    this.backButton = new Button({
      x: 18,
      y: 34,
      w: 74,
      h: 36,
      label: '返回',
      variant: 'ghost',
      onClick: () => this.host.showMenu(),
    });
    this.resetButton = new Button({
      x: width - 92,
      y: 34,
      w: 74,
      h: 36,
      label: '重开',
      variant: 'ghost',
      onClick: () => this.reset(),
    });
    this.buttons = [this.backButton, this.resetButton];
  }

  reset() {
    this.board = cloneGrid(PUZZLE);
    this.mistakes = 0;
    this.completed = false;
    this.saved = false;
    this.startTime = Date.now();
    this.selected = { row: 0, col: 2 };
  }

  update() {
    if (!this.completed && this.isSolved()) {
      this.completed = true;
      this.saveResult();
    }
  }

  getElapsed() {
    return Math.floor((Date.now() - this.startTime) / 1000);
  }

  saveResult() {
    if (this.saved) return;
    const time = this.getElapsed();
    const score = Math.max(100, 1000 - time * 2 - this.mistakes * 80);
    saveScore('sudoku', {
      score,
      time,
      mistakes: this.mistakes,
      difficulty: 'easy',
    });
    this.saved = true;
  }

  isSolved() {
    for (let row = 0; row < 9; row++) {
      for (let col = 0; col < 9; col++) {
        if (this.board[row][col] !== SOLUTION[row][col]) {
          return false;
        }
      }
    }
    return true;
  }

  render(ctx) {
    const theme = this.theme;
    const reveal = Math.min(1, this.host.sceneAge / 320);
    ctx.clearRect(0, 0, this.host.width, this.host.height);
    ctx.fillStyle = theme.color.bg;
    ctx.fillRect(0, 0, this.host.width, this.host.height);

    ctx.save();
    ctx.globalAlpha = reveal;
    ctx.translate(0, (1 - reveal) * 10);
    this.backButton.render(ctx, theme);
    this.resetButton.render(ctx, theme);
    this.renderHeader(ctx);
    this.renderBoard(ctx);
    this.renderNumberPad(ctx);
    if (this.completed) {
      this.renderComplete(ctx);
    }
    ctx.restore();
  }

  renderHeader(ctx) {
    const theme = this.theme;
    drawText(ctx, '数独', this.host.width / 2, 52, {
      size: 25,
      color: theme.color.ink,
      align: 'center',
      baseline: 'middle',
      font: theme.font.title,
      weight: '600',
    });
    drawText(ctx, `用时 ${this.getElapsed()}s · 错误 ${this.mistakes}`, this.host.width / 2, 102, {
      size: 13,
      color: theme.color.muted,
      align: 'center',
      baseline: 'middle',
      font: theme.font.body,
    });
  }

  renderBoard(ctx) {
    const theme = this.theme;
    const x = this.boardX;
    const y = this.boardY;

    fillRoundRect(ctx, x - 8, y - 8, this.boardSize + 16, this.boardSize + 16, 18, theme.color.paper);
    strokeRoundRect(ctx, x - 8, y - 8, this.boardSize + 16, this.boardSize + 16, 18, theme.color.line, 1);

    const selectedValue = this.board[this.selected.row][this.selected.col];
    for (let row = 0; row < 9; row++) {
      for (let col = 0; col < 9; col++) {
        const cellX = x + col * this.cell;
        const cellY = y + row * this.cell;
        const value = this.board[row][col];
        const sameValue = selectedValue && value === selectedValue;
        if (row === this.selected.row && col === this.selected.col) {
          ctx.fillStyle = '#e7ddce';
          ctx.fillRect(cellX, cellY, this.cell, this.cell);
        } else if (sameValue) {
          ctx.fillStyle = '#f1ebe1';
          ctx.fillRect(cellX, cellY, this.cell, this.cell);
        }
        if (value) {
          drawText(ctx, String(value), cellX + this.cell / 2, cellY + this.cell / 2, {
            size: 20,
            color: this.fixed[row][col] ? theme.color.ink : theme.color.accent,
            align: 'center',
            baseline: 'middle',
            font: theme.font.body,
            weight: this.fixed[row][col] ? '600' : '500',
          });
        }
      }
    }

    for (let i = 0; i <= 9; i++) {
      ctx.strokeStyle = i % 3 === 0 ? theme.color.strongLine : theme.color.line;
      ctx.lineWidth = i % 3 === 0 ? 1.6 : 0.7;
      ctx.beginPath();
      ctx.moveTo(x, y + i * this.cell);
      ctx.lineTo(x + this.boardSize, y + i * this.cell);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(x + i * this.cell, y);
      ctx.lineTo(x + i * this.cell, y + this.boardSize);
      ctx.stroke();
    }
  }

  renderNumberPad(ctx) {
    const theme = this.theme;
    const gap = 8;
    const size = (this.boardSize - gap * 8) / 9;

    for (let i = 1; i <= 9; i++) {
      const x = this.boardX + (i - 1) * (size + gap);
      const y = this.keyY;
      fillRoundRect(ctx, x, y, size, 46, 12, theme.color.paper);
      strokeRoundRect(ctx, x, y, size, 46, 12, theme.color.line, 1);
      drawText(ctx, String(i), x + size / 2, y + 23, {
        size: 18,
        color: theme.color.ink,
        align: 'center',
        baseline: 'middle',
        font: theme.font.body,
        weight: '600',
      });
    }

    drawText(ctx, '选格 · 入数 · 完成自动计分', this.host.width / 2, this.keyY + 74, {
      size: 12,
      color: theme.color.faint,
      align: 'center',
      baseline: 'middle',
      font: theme.font.body,
    });
  }

  renderComplete(ctx) {
    const theme = this.theme;
    const w = this.host.width - 48;
    const h = 86;
    const x = 24;
    const y = this.host.height - h - 30;
    fillRoundRect(ctx, x, y, w, h, 20, theme.color.ink);
    drawText(ctx, '完成', this.host.width / 2, y + 28, {
      size: 20,
      color: theme.color.white,
      align: 'center',
      baseline: 'middle',
      font: theme.font.title,
      weight: '600',
    });
    drawText(ctx, `得分 ${Math.max(100, 1000 - this.getElapsed() * 2 - this.mistakes * 80)} · 已保存到本地`, this.host.width / 2, y + 56, {
      size: 13,
      color: '#e8e2d9',
      align: 'center',
      baseline: 'middle',
      font: theme.font.body,
    });
  }

  onTouchStart(point) {
    const button = this.buttons.find((item) => item.hit(point.x, point.y));
    if (button) {
      button.onClick();
      return;
    }

    if (contains({ x: this.boardX, y: this.boardY, w: this.boardSize, h: this.boardSize }, point.x, point.y)) {
      this.selected = {
        row: Math.floor((point.y - this.boardY) / this.cell),
        col: Math.floor((point.x - this.boardX) / this.cell),
      };
      return;
    }

    this.handleNumberPad(point);
  }

  handleNumberPad(point) {
    if (this.completed) return;
    const gap = 8;
    const size = (this.boardSize - gap * 8) / 9;
    for (let i = 1; i <= 9; i++) {
      const rect = {
        x: this.boardX + (i - 1) * (size + gap),
        y: this.keyY,
        w: size,
        h: 46,
      };
      if (contains(rect, point.x, point.y)) {
        const { row, col } = this.selected;
        if (this.fixed[row][col]) return;
        if (SOLUTION[row][col] !== i) {
          this.mistakes++;
          return;
        }
        this.board[row][col] = i;
      }
    }
  }
}
