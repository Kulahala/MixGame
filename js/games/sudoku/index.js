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
    this.mistakeMap = PUZZLE.map((row) => row.map(() => false));
    this.fixed = PUZZLE.map((row) => row.map((value) => value !== 0));
    this.selected = { row: 0, col: 2 };
    this.mistakes = 0;
    this.completed = false;
    this.saved = false;
    this.startTime = Date.now();
    this.buttons = [];
    this.pressedKey = 0;
    this.keyPressTimer = null;
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
    this.mistakeMap = PUZZLE.map((row) => row.map(() => false));
    this.mistakes = 0;
    this.completed = false;
    this.saved = false;
    this.startTime = Date.now();
    this.selected = { row: 0, col: 2 };
    this.pressedKey = 0;
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
        } else if (this.mistakeMap[row][col]) {
          ctx.fillStyle = '#f6dfdb';
          ctx.fillRect(cellX, cellY, this.cell, this.cell);
        } else if (sameValue) {
          ctx.fillStyle = '#f1ebe1';
          ctx.fillRect(cellX, cellY, this.cell, this.cell);
        }
        if (value) {
          drawText(ctx, String(value), cellX + this.cell / 2, cellY + this.cell / 2, {
            size: 20,
            color: this.getCellColor(row, col, value),
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
    const layout = this.getKeypadLayout();

    for (let row = 0; row < 3; row++) {
      for (let col = 0; col < 3; col++) {
        const value = row * 3 + col + 1;
        const rect = this.getKeyRect(layout, row, col, value);
        const isPressed = this.pressedKey === value;
        const depth = isPressed ? 3 : 0;

        ctx.save();
        ctx.translate(rect.x + rect.w / 2, rect.y + rect.h / 2);
        ctx.scale(isPressed ? 0.97 : 1, isPressed ? 0.97 : 1);
        ctx.translate(-rect.x - rect.w / 2, -rect.y - rect.h / 2 + depth);
        fillRoundRect(ctx, rect.x, rect.y, rect.w, rect.h, 16, isPressed ? theme.color.paperDeep : theme.color.paper);
        strokeRoundRect(ctx, rect.x, rect.y, rect.w, rect.h, 16, isPressed ? theme.color.gold : theme.color.line, isPressed ? 1.6 : 1);
        drawText(ctx, String(value), rect.x + rect.w / 2, rect.y + rect.h / 2 + 1, {
          size: 24,
          color: isPressed ? theme.color.accentDeep : theme.color.ink,
          align: 'center',
          baseline: 'middle',
          font: theme.font.body,
          weight: '600',
        });
        ctx.restore();
      }
    }

    drawText(ctx, '选格 · 入数 · 错误会标红', this.host.width / 2, layout.y + layout.size * 3 + layout.gap * 2 + 28, {
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
      button.press();
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

  destroy() {
    this.buttons.forEach((button) => button.destroy && button.destroy());
  }

  handleNumberPad(point) {
    if (this.completed) return;
    const layout = this.getKeypadLayout();
    for (let rowIndex = 0; rowIndex < 3; rowIndex++) {
      for (let colIndex = 0; colIndex < 3; colIndex++) {
        const i = rowIndex * 3 + colIndex + 1;
        const rect = this.getKeyRect(layout, rowIndex, colIndex, i);
        if (contains(rect, point.x, point.y)) {
          const { row, col } = this.selected;
          if (this.fixed[row][col]) return;
          this.pressKey(i);
          this.board[row][col] = i;
          this.mistakeMap[row][col] = SOLUTION[row][col] !== i;
          if (this.mistakeMap[row][col]) {
            this.mistakes++;
          }
          return;
        }
      }
    }
  }

  getCellColor(row, col) {
    if (this.fixed[row][col]) {
      return this.theme.color.ink;
    }
    if (this.mistakeMap[row][col]) {
      return this.theme.color.danger;
    }
    return this.theme.color.accent;
  }

  pressKey(value) {
    if (this.keyPressTimer) {
      clearTimeout(this.keyPressTimer);
      this.keyPressTimer = null;
    }

    this.pressedKey = value;
    this.keyPressTimer = setTimeout(() => {
      this.pressedKey = 0;
      this.keyPressTimer = null;
    }, 120);
  }

  getKeypadLayout() {
    const gap = 10;
    const size = Math.min(72, Math.floor((this.host.width - 96 - gap * 2) / 3));
    const padWidth = size * 3 + gap * 2;
    return {
      x: (this.host.width - padWidth) / 2,
      y: this.keyY,
      gap,
      size,
    };
  }

  getKeyRect(layout, row, col, value) {
    return {
      x: layout.x + col * (layout.size + layout.gap),
      y: layout.y + row * (layout.size + layout.gap),
      w: layout.size,
      h: layout.size,
      value,
    };
  }

  destroy() {
    this.buttons.forEach((button) => button.destroy && button.destroy());
    if (this.keyPressTimer) {
      clearTimeout(this.keyPressTimer);
      this.keyPressTimer = null;
    }
  }
}
