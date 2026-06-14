import Button from '../../ui/button.js';
import { contains, drawText, fillRoundRect, strokeRoundRect } from '../../ui/canvas.js';
import HuarongdaoState from './state.js';
import InputDispatcher from '../../core/input-dispatcher.js';

export default class HuarongdaoScene {
  constructor(host, options = {}) {
    this.host = host;
    this.theme = host.theme;
    
    this.state = new HuarongdaoState(options.size || 4);
    
    this.buttons = [];
    this.touchStartPoint = null;
    this.touchStartGrid = null;
    this.input = new InputDispatcher();
  }

  init() {
    const width = this.host.width;
    this.boardSize = Math.min(width - 32, 342);
    this.cell = this.boardSize / this.state.size;
    this.boardX = (width - this.boardSize) / 2;
    this.boardY = 164;
    
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
      onClick: () => this.state.reset(),
    });
    this.buttons = [this.backButton, this.resetButton];
    this.buttons.forEach(b => this.input.add(b));
  }

  update() {
    if (!this.state.completed && this.state.isSolved()) {
      this.state.completed = true;
      this.state.saveResult();
      this.host.effects.confetti.fire(this.host.width / 2, this.host.height / 2);
    }
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
    this.buttons.forEach(b => b.render(ctx, theme));
    this.renderHeader(ctx);
    this.renderBoard(ctx);
    if (this.state.completed) {
      this.renderComplete(ctx);
    }
    ctx.restore();
  }

  renderHeader(ctx) {
    const theme = this.theme;
    drawText(ctx, '数字华容道', this.host.width / 2, 52, {
      size: 25,
      color: theme.color.ink,
      align: 'center',
      baseline: 'middle',
      font: theme.font.title,
      weight: '600',
    });
    drawText(ctx, `${this.state.size}x${this.state.size} 难度 · ${this.state.steps} 步 · 用时 ${this.state.getElapsed()}s`, this.host.width / 2, 102, {
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

    const padding = 4;
    const innerCell = this.cell - padding * 2;

    for (let r = 0; r < this.state.size; r++) {
      for (let c = 0; c < this.state.size; c++) {
        const val = this.state.grid[r][c];
        if (val === 0) continue;
        
        const cellX = x + c * this.cell + padding;
        const cellY = y + r * this.cell + padding;

        const isCorrect = val === r * this.state.size + c + 1;
        const bg = isCorrect ? theme.color.sage : theme.color.ink;
        
        fillRoundRect(ctx, cellX, cellY, innerCell, innerCell, 12, bg);
        drawText(ctx, String(val), cellX + innerCell / 2, cellY + innerCell / 2 + 1, {
          size: innerCell * 0.45,
          color: theme.color.white,
          align: 'center',
          baseline: 'middle',
          font: theme.font.body,
          weight: '600',
        });
      }
    }
  }

  renderComplete(ctx) {
    const theme = this.theme;
    const w = this.host.width - 48;
    const h = 86;
    const x = 24;
    const y = this.host.height - h - 30;
    fillRoundRect(ctx, x, y, w, h, 20, theme.color.ink);
    drawText(ctx, '通关', this.host.width / 2, y + 28, {
      size: 20,
      color: theme.color.white,
      align: 'center',
      baseline: 'middle',
      font: theme.font.title,
      weight: '600',
    });
    drawText(ctx, `得分 ${Math.max(100, 1000 - this.state.getElapsed() * 2 - this.state.steps * 10)} · 已保存`, this.host.width / 2, y + 56, {
      size: 13,
      color: '#e8e2d9',
      align: 'center',
      baseline: 'middle',
      font: theme.font.body,
    });
  }

  onTouchStart(point) {
    if (this.input.onTouchStart(point.x, point.y)) return;

    if (contains({ x: this.boardX, y: this.boardY, w: this.boardSize, h: this.boardSize }, point.x, point.y)) {
      this.touchStartPoint = point;
      this.touchStartGrid = {
        r: Math.floor((point.y - this.boardY) / this.cell),
        c: Math.floor((point.x - this.boardX) / this.cell),
      };
    }
  }

  onTouchMove(point) {
    this.input.onTouchMove(point.x, point.y);
  }

  onTouchEnd(point) {
    this.input.onTouchEnd(point.x, point.y);

    if (this.touchStartPoint && this.touchStartGrid) {
      const dx = point.x - this.touchStartPoint.x;
      const dy = point.y - this.touchStartPoint.y;
      
      const dist = Math.sqrt(dx*dx + dy*dy);
      if (dist < 10) {
        // Click
        this.state.tryMoveGrid(this.touchStartGrid.r, this.touchStartGrid.c);
      } else {
        // Swipe
        const tr = this.touchStartGrid.r;
        const tc = this.touchStartGrid.c;
        if (Math.abs(dx) > Math.abs(dy)) {
          // Horizontal swipe
          if (dx > 0 && this.state.emptyPos.r === tr && this.state.emptyPos.c > tc) this.state.tryMoveGrid(tr, tc);
          if (dx < 0 && this.state.emptyPos.r === tr && this.state.emptyPos.c < tc) this.state.tryMoveGrid(tr, tc);
        } else {
          // Vertical swipe
          if (dy > 0 && this.state.emptyPos.c === tc && this.state.emptyPos.r > tr) this.state.tryMoveGrid(tr, tc);
          if (dy < 0 && this.state.emptyPos.c === tc && this.state.emptyPos.r < tr) this.state.tryMoveGrid(tr, tc);
        }
      }
    }
    
    this.touchStartPoint = null;
    this.touchStartGrid = null;
  }

  destroy() {
    this.buttons.forEach((b) => b.destroy && b.destroy());
  }
}
