import Button from '../../ui/button.js';
import ResultModal from '../../ui/result-modal.js';
import { contains, drawText, fillRoundRect, strokeRoundRect } from '../../ui/canvas.js';
import { PUZZLE, SOLUTION } from './puzzle.js';
import { generateSudoku } from './generator.js';
import SudokuBoardState from './state.js';
import InputDispatcher from '../../core/input-dispatcher.js';

export default class SudokuScene {
  constructor(host, options = {}) {
    this.host = host;
    this.theme = host.theme;
    
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
    this.buttons = [];
    this.pressedKey = 0;
    this.keyPressTimer = null;
    this.input = new InputDispatcher();

    // Exit Animation States
    this.isExiting = false;
    this.exitTime = 0;
    this.exitDuration = 200; // ms
    this.exitCallback = null;
  }

  exit(callback) {
    this.isExiting = true;
    this.exitTime = 0;
    this.exitCallback = callback;
  }

  init() {
    const width = this.host.width;
    const height = this.host.height;
    
    let boardMargin = 32;
    let topMargin = 140;
    if (height < 700) {
      boardMargin = 60;
      topMargin = 70;
    }
    if (height < 600) {
      boardMargin = 64; // 给盘面更多缩放
      topMargin = 55; // Header被压得更扁，棋盘继续上移
    }

    this.boardSize = Math.min(width - boardMargin, 342);
    if (height < 700 && this.boardSize > 280) this.boardSize = 280;
    if (height < 600 && this.boardSize > 240) this.boardSize = 240;

    this.cell = this.boardSize / 9;
    this.boardX = (width - this.boardSize) / 2;
    this.boardY = topMargin;
    
    // 工具按钮所在行
    this.actionBtnY = this.boardY + this.boardSize + (height < 600 ? 10 : 16);
    // 数字键盘所在行
    this.keyY = this.actionBtnY + 36 + (height < 600 ? 10 : 12);
    
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
      onClick: () => this.exit(() => this.host.showMenu()),
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
    this.undoButton = new Button({
      x: width / 2 - 123,
      y: this.actionBtnY,
      w: 74,
      h: 36,
      label: '撤销',
      variant: 'ghost',
      onClick: () => {
        if (this.state.undo()) {
          // 这里可以额外做一些撤销后的UI反馈
        }
      },
    });
    this.eraseButton = new Button({
      x: width / 2 - 37,
      y: this.actionBtnY,
      w: 74,
      h: 36,
      label: '擦除',
      variant: 'ghost',
      onClick: () => this.state.erase(this.selected.row, this.selected.col),
    });
    this.noteButton = new Button({
      x: width / 2 + 49,
      y: this.actionBtnY,
      w: 74,
      h: 36,
      label: '笔记',
      variant: 'ghost',
      onClick: () => {
        const isNote = this.state.toggleNoteMode();
        this.noteButton.label = isNote ? '笔记: 开' : '笔记';
        this.noteButton.variant = isNote ? 'secondary' : 'ghost';
      },
    });
    
    this.buttons = [this.backButton, this.undoButton, this.eraseButton, this.resetButton, this.noteButton];
    this.buttons.forEach(btn => this.input.add(btn));
  }

  reset() {
    this.state = new SudokuBoardState(this.state.initialPuzzle, this.state.solution);
    this.selected = { row: 0, col: 2 };
    this.pressedKey = 0;
    this.noteButton.label = '笔记';
    this.noteButton.variant = 'ghost';
    if (this.modal) {
      this.input.remove(this.modal);
      this.modal = null;
    }
  }

  update(dt = 16) {
    if (this.isExiting) {
      this.exitTime = Math.min(this.exitDuration, this.exitTime + dt);
      if (this.exitTime >= this.exitDuration && this.exitCallback) {
        const cb = this.exitCallback;
        this.exitCallback = null;
        cb();
      }
      return;
    }

    if (!this.state.completed && this.state.isBoardFull()) {
      if (this.state.isSolved()) {
        this.state.completed = true;
        this.state.saveResult();
        this.host.effects.confetti.fire(this.host.width / 2, this.host.height / 2);
        
        this.modal = new ResultModal({
          host: this.host,
          title: '恭喜通关！',
          stats: [
            `用时：${this.state.getTimeSpent()}s`,
            `累计填写：${this.state.fills}次`
          ],
          onMenu: () => {
            if (this.modal && this.modal.close) {
              this.modal.close(() => {
                this.exit(() => this.host.showMenu());
              });
            } else {
              this.exit(() => this.host.showMenu());
            }
          },
          onRestart: () => this.reset()
        });
        this.input.add(this.modal);

      } else {
        if (this.state.checkMistakes()) {
          if (typeof wx !== 'undefined' && wx.vibrateShort) {
            wx.vibrateShort({ type: 'medium' });
          }
        }
      }
    }
  }

  render(ctx) {
    const theme = this.theme;
    
    // 进场动画：使用 easeOutQuart 缓动 (比原本线性更具优雅的减速滑行质感)
    const progress = Math.min(1, this.host.sceneAge / 320);
    const ease = 1 - Math.pow(1 - progress, 4);
    const reveal = ease;

    // 退场动画：向下掉落淡出
    let exitAlpha = 1;
    let exitOffset = 0;
    if (this.isExiting) {
      const p = this.exitTime / this.exitDuration;
      const easeExit = p * p; // easeInQuad
      exitAlpha = 1 - easeExit;
      exitOffset = easeExit * 16;
    }

    ctx.clearRect(0, 0, this.host.width, this.host.height);
    ctx.fillStyle = theme.color.bg;
    ctx.fillRect(0, 0, this.host.width, this.host.height);

    ctx.save();
    ctx.globalAlpha = exitAlpha;
    ctx.translate(0, exitOffset);

    ctx.save();
    ctx.globalAlpha = reveal;
    ctx.translate(0, (1 - reveal) * 10);
    this.backButton.render(ctx, theme);
    this.undoButton.render(ctx, theme);
    this.eraseButton.render(ctx, theme);
    this.resetButton.render(ctx, theme);
    this.noteButton.render(ctx, theme);
    this.renderHeader(ctx);
    this.renderBoard(ctx);
    this.renderNumberPad(ctx);
    ctx.restore();

    ctx.restore();

    if (this.modal) {
      this.modal.render(ctx, theme);
    }
  }

  renderHeader(ctx) {
    const theme = this.theme;
    const isSmall = this.host.height < 700;
    const isTiny = this.host.height < 600;
    const titleY = isTiny ? 25 : (isSmall ? 32 : 52);
    const subY = isTiny ? 42 : (isSmall ? 52 : 102);

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
          ctx.fillStyle = '#e7ddce';
          ctx.fillRect(cellX, cellY, this.cell, this.cell);
        } else if (this.state.mistakeMap[row][col]) {
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

    drawText(ctx, '选格 · 入数 · 错误会标红', this.host.width / 2, layout.y + layout.size * 3 + layout.gap * 2 + (this.host.height < 600 ? 18 : 28), {
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

  onTouchMove(point) {
    if (this.isExiting) return;
    this.input.onTouchMove(point.x, point.y);
  }

  onTouchEnd(point) {
    if (this.isExiting) return;
    this.input.onTouchEnd(point.x, point.y);
  }

  handleNumberPad(point) {
    if (this.state.completed) return;
    const layout = this.getKeypadLayout();
    for (let rowIndex = 0; rowIndex < 3; rowIndex++) {
      for (let colIndex = 0; colIndex < 3; colIndex++) {
        const i = rowIndex * 3 + colIndex + 1;
        const rect = this.getKeyRect(layout, rowIndex, colIndex, i);
        if (contains(rect, point.x, point.y)) {
          this.pressKey(i);
          this.state.fillNumber(this.selected.row, this.selected.col, i);
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

  getKeypadLayout() {
    const isTiny = this.host.height < 600;
    const gap = isTiny ? 6 : 10;
    let maxKeySize = 72;
    if (this.host.height < 700) maxKeySize = 56;
    if (isTiny) maxKeySize = 48;
    const size = Math.min(maxKeySize, Math.floor((this.host.width - 96 - gap * 2) / 3));
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
    if (this.modal) {
      this.input.remove(this.modal);
      this.modal.destroy();
      this.modal = null;
    }
    if (this.keyPressTimer) {
      clearTimeout(this.keyPressTimer);
      this.keyPressTimer = null;
    }
  }
}
