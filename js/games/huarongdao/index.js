import BaseGameScene from '../../core/game-scene-base.js';
import { getHistory } from '../../core/storage.js';
import { contains, drawText, fillRoundRect, strokeRoundRect } from '../../ui/canvas.js';
import HuarongdaoState from './state.js';
import { getRandomQuote } from '../../ui/quotes.js';
import Button from '../../ui/button.js';

export default class HuarongdaoScene extends BaseGameScene {
  constructor(host, options = {}) {
    super(host, options);

    this.state = new HuarongdaoState(options.size || 4);

    this.touchStartPoint = null;
    this.touchStartGrid = null;
    this.bottomQuote = getRandomQuote('huarongdao');
  }

  init() {
    const width = this.host.width;
    const height = this.host.height;
    const isTablet = width >= 500 && height >= 600 && height >= width;

    // 三阶自适应棋盘尺寸
    if (isTablet) {
      this.boardSize = 400;
    } else if (height < 600) {
      this.boardSize = Math.min(width - 32, 240);
    } else if (height < 700) {
      this.boardSize = Math.min(width - 32, 280);
    } else {
      this.boardSize = Math.min(width - 32, 342);
    }

    this.cell = this.boardSize / this.state.size;
    this.boardX = (width - this.boardSize) / 2;

    // 中下部符合人体工学的垂直居中偏下布局，方便单手游玩
    this.boardY = Math.floor((height - this.boardSize) / 2) + 30;
    const safeLimit = this.host.safeTop + 130;
    if (this.boardY < safeLimit) this.boardY = safeLimit;

    // 初始化所有方块渲染动画状态
    this.tileAnimations = {};

    this.createTopButtons();
  }

  reset() {
    this.state.reset();
    if (this.modal) {
      this.input.remove(this.modal);
      this.modal = null;
    }
    // 重置所有动画状态
    this.tileAnimations = {};
    this.bottomQuote = getRandomQuote('huarongdao');
  }

  getTilePositions() {
    const positions = {};
    for (let r = 0; r < this.state.size; r++) {
      for (let c = 0; c < this.state.size; c++) {
        const val = this.state.grid[r][c];
        if (val !== 0) {
          positions[val] = { r, c };
        }
      }
    }
    return positions;
  }

  moveTile(r, c) {
    const oldPos = this.getTilePositions();
    const moved = this.state.tryMoveGrid(r, c);
    if (moved) {
      const newPos = this.getTilePositions();
      for (let val in newPos) {
        const oldP = oldPos[val];
        const newP = newPos[val];
        if (oldP && (oldP.r !== newP.r || oldP.c !== newP.c)) {
          const diffC = oldP.c - newP.c;
          const diffR = oldP.r - newP.r;
          
          this.tileAnimations[val] = {
            startX: diffC * this.cell,
            startY: diffR * this.cell,
            currentX: diffC * this.cell,
            currentY: diffR * this.cell,
            time: 0,
            duration: 160 // 160ms 动画时长
          };
        }
      }
    }
    return moved;
  }

  update(dt) {
    if (super.update(dt)) return;

    if (!this.state.completed && this.state.isSolved()) {
      this.state.completed = true;
      this.state.saveResult();
      const currentScore = this.state.getScore();
      const history = getHistory('huarongdao', `${this.state.size}x${this.state.size}`).map((h) => ({
        label: `${h.score}分 · ${h.steps}步`,
        highlight: h.score === currentScore,
      }));
      this.showResult('恭喜通关！', [
        `用时：${this.state.getElapsed()}s`,
        `总步数：${this.state.steps}步`
      ], true, history);
    }

    // 每一帧平滑地更新方块渲染动画偏移量
    for (let val in this.tileAnimations) {
      const anim = this.tileAnimations[val];
      anim.time = Math.min(anim.duration, anim.time + dt);
      const progress = anim.time / anim.duration;
      
      // 使用 easeOutCubic 曲线：f(t) = 1 - (1 - t)^3
      // 这会让方块在滑动的后半段带有极度丝滑优雅的摩擦阻尼感
      const ease = 1 - Math.pow(1 - progress, 3);
      
      anim.currentX = anim.startX * (1 - ease);
      anim.currentY = anim.startY * (1 - ease);
      
      if (anim.time >= anim.duration) {
        delete this.tileAnimations[val];
      }
    }
  }

  renderGame(ctx) {
    const theme = this.theme;
    this.buttons.forEach(b => b.render(ctx, theme));
    this.renderHeader(ctx);
    this.renderBoard(ctx);

    // ── Bottom hint ─────────────────────────────────
    drawText(ctx, this.bottomQuote, this.host.width / 2, this.host.height - 42, {
      size: 12,
      color: theme.color.faint,
      align: 'center',
      baseline: 'middle',
      font: theme.font.body,
    });
  }

  renderHeader(ctx) {
    const theme = this.theme;
    const safeTop = this.host.safeTop;
    drawText(ctx, '数字华容道', this.host.width / 2, safeTop + 52, {
      size: 25,
      color: theme.color.ink,
      align: 'center',
      baseline: 'middle',
      font: theme.font.title,
      weight: '600',
    });
    drawText(ctx, `${this.state.size}x${this.state.size} 难度 · ${this.state.steps} 步 · 用时 ${this.state.getElapsed()}s`, this.host.width / 2, safeTop + 102, {
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
        
        const anim = this.tileAnimations[val];
        const offsetX = anim ? anim.currentX : 0;
        const offsetY = anim ? anim.currentY : 0;
        const cellX = x + c * this.cell + padding + offsetX;
        const cellY = y + r * this.cell + padding + offsetY;

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


  onTouchStart(point) {
    if (this.isExiting) return;
    if (this.input.onTouchStart(point.x, point.y)) return;

    if (contains({ x: this.boardX, y: this.boardY, w: this.boardSize, h: this.boardSize }, point.x, point.y)) {
      this.touchStartPoint = point;
      this.touchStartGrid = {
        r: Math.floor((point.y - this.boardY) / this.cell),
        c: Math.floor((point.x - this.boardX) / this.cell),
      };
    }
  }

  onTouchEnd(point) {
    if (this.isExiting) return;
    this.input.onTouchEnd(point.x, point.y);

    if (this.touchStartPoint && this.touchStartGrid) {
      const dx = point.x - this.touchStartPoint.x;
      const dy = point.y - this.touchStartPoint.y;
      
      const dist = Math.sqrt(dx*dx + dy*dy);
      if (dist < 16) {
        // Click
        this.moveTile(this.touchStartGrid.r, this.touchStartGrid.c);
      } else {
        // Swipe
        const tr = this.touchStartGrid.r;
        const tc = this.touchStartGrid.c;
        if (Math.abs(dx) > Math.abs(dy)) {
          // Horizontal swipe
          if (dx > 0 && this.state.emptyPos.r === tr && this.state.emptyPos.c > tc) this.moveTile(tr, tc);
          if (dx < 0 && this.state.emptyPos.r === tr && this.state.emptyPos.c < tc) this.moveTile(tr, tc);
        } else {
          // Vertical swipe
          if (dy > 0 && this.state.emptyPos.c === tc && this.state.emptyPos.r > tr) this.moveTile(tr, tc);
          if (dy < 0 && this.state.emptyPos.c === tc && this.state.emptyPos.r < tr) this.moveTile(tr, tc);
        }
      }
    }
    
    this.touchStartPoint = null;
    this.touchStartGrid = null;
  }

}
