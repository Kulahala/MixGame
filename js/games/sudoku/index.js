import BaseGameScene from '../../core/game-scene-base.js';
import { getHistory } from '../../core/storage.js';
import Button from '../../ui/button.js';
import { contains, drawText, fillRoundRect, strokeRoundRect } from '../../ui/canvas.js';
import { PUZZLE, SOLUTION } from './puzzle.js';
import { generateSudoku } from './generator.js';
import SudokuBoardState from './state.js';
import { getRandomQuote } from '../../ui/quotes.js';

export default class SudokuScene extends BaseGameScene {
  constructor(host, options = {}) {
    super(host, options);

    let initialPuzzle, solution;
    if (options.holes) {
      const generated = generateSudoku(options.holes);
      initialPuzzle = generated.puzzle;
      solution = generated.solution;
    } else {
      initialPuzzle = PUZZLE;
      solution = SOLUTION;
    }

    this.state = new SudokuBoardState(initialPuzzle, solution);
    this.selected = { row: 0, col: 2 };
    this.pressedKey = 0;
    this.keyPressTimer = null;
    this.bottomQuote = getRandomQuote('sudoku');
  }

  init() {
    const width = this.host.width;
    const height = this.host.height;
    const isTablet = width >= 500 && height >= 600 && height >= width;

    let boardMargin = 32;
    let topMargin = 140;
    if (!isTablet) {
      if (height < 700) {
        boardMargin = 60;
        topMargin = 70;
      }
      if (height < 600) {
        boardMargin = 64; // 给盘面更多缩放
        topMargin = 55; // Header被压得更扁，棋盘继续上移
      }
    }
    topMargin += this.host.safeTop;

    if (isTablet) {
      this.boardSize = 420;
    } else {
      this.boardSize = Math.min(width - boardMargin, 342);
      if (height < 700 && this.boardSize > 280) this.boardSize = 280;
      if (height < 600 && this.boardSize > 240) this.boardSize = 240;
    }

    this.cell = this.boardSize / 9;
    this.boardX = (width - this.boardSize) / 2;
    this.boardY = topMargin;

    const isTiny = !isTablet && height < 600;
    // 工具按钮所在行
    this.actionBtnY = this.boardY + this.boardSize + (isTiny ? 10 : 16);
    // 数字键盘所在行
    this.keyY = this.actionBtnY + 36 + (isTiny ? 10 : 12);

    // 缓存键盘布局
    this._cacheKeypadLayout();

    // 创建底部操作按钮（撤销、标记、擦除）
    const btnW = width >= 340 ? 64 : 60;
    const btnGap = 12;
    const totalW = btnW * 3 + btnGap * 2;
    const btnStartX = (width - totalW) / 2;

    this.undoButton = new Button({
      x: btnStartX,
      y: this.actionBtnY,
      w: btnW,
      h: 36,
      label: '撤销',
      variant: 'ghost',
      onClick: () => {
        if (this.state.undo()) {
          // 撤销后的UI反馈可在此扩展
        }
      },
    });
    this.noteButton = new Button({
      x: btnStartX + btnW + btnGap,
      y: this.actionBtnY,
      w: btnW,
      h: 36,
      label: '标记',
      variant: 'ghost',
      onClick: () => {
        const isNote = this.state.toggleNoteMode();
        this.noteButton.label = isNote ? '标记: 开' : '标记';
        this.noteButton.variant = isNote ? 'secondary' : 'ghost';
      },
    });
    this.eraseButton = new Button({
      x: btnStartX + (btnW + btnGap) * 2,
      y: this.actionBtnY,
      w: btnW,
      h: 36,
      label: '擦除',
      variant: 'ghost',
      onClick: () => {
        if (this.selected) {
          this.state.erase(this.selected.row, this.selected.col);
        }
      },
    });

    this.createTopButtons([this.undoButton, this.noteButton, this.eraseButton]);
  }

  reset() {
    this.state = new SudokuBoardState(this.state.initialPuzzle, this.state.solution);
    this.selected = { row: 0, col: 2 };
    this.pressedKey = 0;
    this.noteButton.label = '标记';
    this.noteButton.variant = 'ghost';
    this.closeModal();
    this.bottomQuote = getRandomQuote('sudoku');
  }

  update(dt) {
    if (super.update(dt)) return;

    if (!this.state.completed && this.state.isBoardFull()) {
      if (this.state.isSolved()) {
        this.state.completed = true;
        this.state.saveResult();
        const currentScore = this.state.getScore();
        const history = getHistory('sudoku').map((h) => ({
          label: `${h.score}分 · ${h.time}s`,
          highlight: h.score === currentScore,
        }));
        this.showResult('恭喜通关！', [
          `用时：${this.state.getTimeSpent()}s`,
          `累计填写：${this.state.fills}次`
        ], true, history);
      } else {
        if (this.state.checkMistakes()) {
          if (typeof wx !== 'undefined' && wx.vibrateShort) {
            wx.vibrateShort({ type: 'medium' });
          }
        }
      }
    }
  }

  renderGame(ctx) {
    this.renderHeader(ctx);
    this.renderBoard(ctx);
    this.renderNumberPad(ctx);
  }

  renderHeader(ctx) {
    const theme = this.theme;
    const safeTop = this.host.safeTop;
    const width = this.host.width;
    const height = this.host.height;
    const isTablet = width >= 500 && height >= 600 && height >= width;
    const isSmall = !isTablet && height < 700;
    const isTiny = !isTablet && height < 600;
    const titleY = safeTop + (isTiny ? 25 : (isSmall ? 32 : 52));
    const subY = safeTop + (isTiny ? 42 : (isSmall ? 52 : 102));

    drawText(ctx, '经典数独', this.host.width / 2, titleY, {
      size: isSmall ? 20 : 25,
      color: theme.color.ink,
      align: 'center',
      baseline: 'middle',
      font: theme.font.title,
      weight: '600',
    });
    
    if (!isTiny) {
      drawText(ctx, `用时 ${this.state.getTimeSpent()}s · 累计填写 ${this.state.fills}`, this.host.width / 2, subY, {
        size: 13,
        color: theme.color.muted,
        align: 'center',
        baseline: 'middle',
        font: theme.font.body,
      });
    }
  }

  renderBoard(ctx) {
    const theme = this.theme;
    const x = this.boardX;
    const y = this.boardY;

    fillRoundRect(ctx, x - 8, y - 8, this.boardSize + 16, this.boardSize + 16, 18, theme.color.paper);
    strokeRoundRect(ctx, x - 8, y - 8, this.boardSize + 16, this.boardSize + 16, 18, theme.color.line, 1);

    const selectedValue = this.state.board[this.selected.row][this.selected.col];
    for (let row = 0; row < 9; row++) {
      for (let col = 0; col < 9; col++) {
        const cellX = x + col * this.cell;
        const cellY = y + row * this.cell;
        const value = this.state.board[row][col];
        const sameValue = selectedValue && value === selectedValue;
        if (row === this.selected.row && col === this.selected.col) {
          ctx.fillStyle = theme.color.selected;
          ctx.fillRect(cellX, cellY, this.cell, this.cell);
        } else if (this.state.mistakeMap[row][col]) {
          ctx.fillStyle = theme.color.dangerLight;
          ctx.fillRect(cellX, cellY, this.cell, this.cell);
        } else if (sameValue) {
          ctx.fillStyle = theme.color.highlight;
          ctx.fillRect(cellX, cellY, this.cell, this.cell);
        }
        if (value) {
          drawText(ctx, String(value), cellX + this.cell / 2, cellY + this.cell / 2, {
            size: 20,
            color: this.getCellColor(row, col, value),
            align: 'center',
            baseline: 'middle',
            font: theme.font.body,
            weight: this.state.fixed[row][col] ? '600' : '500',
          });
        } else if (this.state.board[row][col] === 0 && this.state.notesMap[row][col] && this.state.notesMap[row][col].length > 0) {
          const notes = this.state.notesMap[row][col];
          for (let note of notes) {
            const nx = cellX + ((note - 1) % 3) * (this.cell / 3) + this.cell / 6;
            const ny = cellY + Math.floor((note - 1) / 3) * (this.cell / 3) + this.cell / 6;
            drawText(ctx, String(note), nx, ny, {
              size: 10,
              color: theme.color.muted,
              align: 'center',
              baseline: 'middle',
              font: theme.font.body,
            });
          }
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
        const rect = this.getKeyRect(layout, row, col);
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

    drawText(ctx, this.bottomQuote, this.host.width / 2, this.host.height - 42, {
      size: 12,
      color: theme.color.faint,
      align: 'center',
      baseline: 'middle',
      font: theme.font.body,
    });
  }



  onTouchStart(point) {
    if (this.isExiting) return;
    if (this.input.onTouchStart(point.x, point.y)) return;

    if (contains({ x: this.boardX, y: this.boardY, w: this.boardSize, h: this.boardSize }, point.x, point.y)) {
      this.selected = {
        row: Math.floor((point.y - this.boardY) / this.cell),
        col: Math.floor((point.x - this.boardX) / this.cell),
      };
      return;
    }

    this.handleNumberPad(point);
  }

  onTouchEnd(point) {
    if (this.isExiting) return;
    this.input.onTouchEnd(point.x, point.y);

    if (this.state.completed) return;

    // 检测是否仍在数字键盘区域内，是则填数
    const layout = this.getKeypadLayout();
    for (let rowIndex = 0; rowIndex < 3; rowIndex++) {
      for (let colIndex = 0; colIndex < 3; colIndex++) {
        const i = rowIndex * 3 + colIndex + 1;
        const rect = this.getKeyRect(layout, rowIndex, colIndex);
        if (contains(rect, point.x, point.y)) {
          this.state.fillNumber(this.selected.row, this.selected.col, i);
          return;
        }
      }
    }
  }

  handleNumberPad(point) {
    if (this.state.completed) return;
    const layout = this.getKeypadLayout();
    for (let rowIndex = 0; rowIndex < 3; rowIndex++) {
      for (let colIndex = 0; colIndex < 3; colIndex++) {
        const i = rowIndex * 3 + colIndex + 1;
        const rect = this.getKeyRect(layout, rowIndex, colIndex);
        if (contains(rect, point.x, point.y)) {
          this.pressKey(i);
          return;
        }
      }
    }
  }

  getCellColor(row, col) {
    if (this.state.fixed[row][col]) return this.theme.color.ink;
    if (this.state.mistakeMap[row][col]) return this.theme.color.danger;
    return this.theme.color.accent;
  }

  pressKey(value) {
    if (this.keyPressTimer) {
      clearTimeout(this.keyPressTimer);
    }
    this.pressedKey = value;
    this.keyPressTimer = setTimeout(() => {
      this.pressedKey = 0;
      this.keyPressTimer = null;
    }, 120);
  }

  _cacheKeypadLayout() {
    const width = this.host.width;
    const height = this.host.height;
    const isTablet = width >= 500 && height >= 600 && height >= width;

    let gap = 10;
    let maxKeySize = 72;

    if (isTablet) {
      gap = 12;
      maxKeySize = 76;
    } else {
      const isTiny = height < 600;
      gap = isTiny ? 6 : 10;
      if (height < 700) maxKeySize = 56;
      if (isTiny) maxKeySize = 48;
    }

    const size = Math.min(maxKeySize, Math.floor((this.host.width - 96 - gap * 2) / 3));
    const padWidth = size * 3 + gap * 2;
    this._keypadLayout = {
      x: (this.host.width - padWidth) / 2,
      y: this.keyY,
      gap,
      size,
    };
    this._keyRects = [];
    for (let row = 0; row < 3; row++) {
      for (let col = 0; col < 3; col++) {
        const value = row * 3 + col + 1;
        this._keyRects.push({
          x: this._keypadLayout.x + col * (this._keypadLayout.size + this._keypadLayout.gap),
          y: this._keypadLayout.y + row * (this._keypadLayout.size + this._keypadLayout.gap),
          w: this._keypadLayout.size,
          h: this._keypadLayout.size,
          value,
        });
      }
    }
  }

  getKeypadLayout() {
    return this._keypadLayout;
  }

  getKeyRect(layout, row, col) {
    return this._keyRects[row * 3 + col];
  }

  destroy() {
    super.destroy();
    if (this.keyPressTimer) {
      clearTimeout(this.keyPressTimer);
      this.keyPressTimer = null;
    }
  }
}
