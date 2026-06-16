import BaseGameScene from '../../core/game-scene-base.js';
import { getHistory } from '../../core/storage.js';
import SlitherlinkState from './state.js';
import { drawText, fillRoundRect, strokeRoundRect } from '../../ui/canvas.js';
import { getRandomQuote } from '../../ui/quotes.js';

export default class SlitherlinkScene extends BaseGameScene {
  constructor(host, options = {}) {
    super(host, options);
    const { rows = 5, cols = 5 } = options;
    this.state = new SlitherlinkState(rows, cols);
    this.bottomQuote = getRandomQuote('slitherlink');
  }

  init() {
    const width = this.host.width;
    const height = this.host.height;

    this.createTopButtons();

    // 计算网格尺寸和布局位置 (自适应居中偏下布局，符合人体工学)
    const boardMargin = 40;
    const boardMax = 320;
    const boardSize = Math.min(width - boardMargin, boardMax);
    
    this.cellSize = boardSize / this.state.cols;
    this.boardX = (width - boardSize) / 2;
    
    this.boardY = Math.floor((height - boardSize) / 2) + 30;
    if (this.boardY < this.host.safeTop + 140) {
      this.boardY = this.host.safeTop + 140; // 保护顶部标题和按钮
    }
  }

  reset() {
    this.closeModal();
    this.state.init();
    this.bottomQuote = getRandomQuote('slitherlink');
  }

  update(dt = 16) {
    if (super.update(dt)) return;

    if (!this.state.completed && this.state.isSolved()) {
      this.state.completed = true;
      this.state.saveResult();

      const time = this.state.getElapsed();
      const currentScore = Math.max(100, 1000 - time * 2 - this.state.steps * 5);
      const history = getHistory('slitherlink', `${this.state.rows}x${this.state.cols}`).map(h => ({
        label: `${h.score}分 · ${h.time}s`,
        highlight: h.score === currentScore
      }));

      this.showResult('恭喜通关！', [
        `用时：${time}s`,
        `步数：${this.state.steps} 步`,
        `难度：${this.state.rows}x${this.state.cols}`
      ], true, history);
    }
  }

  renderGame(ctx) {
    const theme = this.theme;
    const x = this.boardX;
    const y = this.boardY;
    const size = this.cellSize * this.state.cols;
    const safeTop = this.host.safeTop;

    // ── Header ──────────────────────────────────────
    drawText(ctx, '数回', this.host.width / 2, safeTop + 90, {
      size: 28,
      color: theme.color.ink,
      align: 'center',
      baseline: 'middle',
      font: theme.font.title,
      weight: '600',
    });

    drawText(ctx, `步数：${this.state.steps} · 用时：${this.state.getElapsed()}s`, this.host.width / 2, safeTop + 125, {
      size: 16,
      color: theme.color.muted,
      align: 'center',
      baseline: 'middle',
      font: theme.font.body,
    });

    // ── Grid Background ─────────────────────────────
    fillRoundRect(ctx, x - 12, y - 12, size + 24, size + 24, theme.radius.lg, theme.color.paper);
    strokeRoundRect(ctx, x - 12, y - 12, size + 24, size + 24, theme.radius.lg, theme.color.line, 1);

    // ── Render Numbers ──────────────────────────────
    for (let r = 0; r < this.state.rows; r++) {
      for (let c = 0; c < this.state.cols; c++) {
        const num = this.state.grid[r][c];
        if (num >= 0) {
          const cx = x + (c + 0.5) * this.cellSize;
          const cy = y + (r + 0.5) * this.cellSize;
          drawText(ctx, String(num), cx, cy + 1, {
            size: this.cellSize * 0.42,
            color: theme.color.ink,
            align: 'center',
            baseline: 'middle',
            font: theme.font.body,
            weight: '600'
          });
        }
      }
    }

    // ── Render Horizontal Lines ─────────────────────
    for (let r = 0; r <= this.state.rows; r++) {
      for (let c = 0; c < this.state.cols; c++) {
        const state = this.state.hLines[r][c];
        const lx = x + c * this.cellSize;
        const ly = y + r * this.cellSize;

        if (state === 1) {
          // 已连接：加粗实线，熟褐色
          ctx.strokeStyle = theme.color.accent;
          ctx.lineWidth = 4;
          ctx.lineCap = 'round';
          ctx.beginPath();
          ctx.moveTo(lx, ly);
          ctx.lineTo(lx + this.cellSize, ly);
          ctx.stroke();
        } else if (state === -1) {
          // 标记为 X
          ctx.strokeStyle = theme.color.danger;
          ctx.lineWidth = 1.6;
          const cx = lx + this.cellSize / 2;
          const cy = ly;
          const sz = 4;
          ctx.beginPath();
          ctx.moveTo(cx - sz, cy - sz);
          ctx.lineTo(cx + sz, cy + sz);
          ctx.moveTo(cx + sz, cy - sz);
          ctx.lineTo(cx - sz, cy + sz);
          ctx.stroke();
        } else {
          // 无线：极淡提示线
          ctx.strokeStyle = 'rgba(0, 0, 0, 0.04)';
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(lx + 6, ly);
          ctx.lineTo(lx + this.cellSize - 6, ly);
          ctx.stroke();
        }
      }
    }

    // ── Render Vertical Lines ───────────────────────
    for (let r = 0; r < this.state.rows; r++) {
      for (let c = 0; c <= this.state.cols; c++) {
        const state = this.state.vLines[r][c];
        const lx = x + c * this.cellSize;
        const ly = y + r * this.cellSize;

        if (state === 1) {
          ctx.strokeStyle = theme.color.accent;
          ctx.lineWidth = 4;
          ctx.lineCap = 'round';
          ctx.beginPath();
          ctx.moveTo(lx, ly);
          ctx.lineTo(lx, ly + this.cellSize);
          ctx.stroke();
        } else if (state === -1) {
          ctx.strokeStyle = theme.color.danger;
          ctx.lineWidth = 1.6;
          const cx = lx;
          const cy = ly + this.cellSize / 2;
          const sz = 4;
          ctx.beginPath();
          ctx.moveTo(cx - sz, cy - sz);
          ctx.lineTo(cx + sz, cy + sz);
          ctx.moveTo(cx + sz, cy - sz);
          ctx.lineTo(cx - sz, cy + sz);
          ctx.stroke();
        } else {
          ctx.strokeStyle = 'rgba(0, 0, 0, 0.04)';
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(lx, ly + 6);
          ctx.lineTo(lx, ly + this.cellSize - 6);
          ctx.stroke();
        }
      }
    }

    // ── Render Grid Dots ────────────────────────────
    for (let r = 0; r <= this.state.rows; r++) {
      for (let c = 0; c <= this.state.cols; c++) {
        const cx = x + c * this.cellSize;
        const cy = y + r * this.cellSize;
        ctx.fillStyle = theme.color.strongLine;
        ctx.beginPath();
        ctx.arc(cx, cy, 3, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // ── Render Bottom Hint/Quote ─────────────────────
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

    // 寻找离触碰坐标最近的边缘
    const edge = this.findClosestEdge(point.x, point.y);
    if (edge) {
      this.state.toggleEdge(edge.type, edge.r, edge.c);
    }
  }

  findClosestEdge(px, py) {
    let closestEdge = null;
    let minDist = 24; // 触碰感应热区半径 (px)
    
    const cellSize = this.cellSize;
    const boardX = this.boardX;
    const boardY = this.boardY;
    
    // 检查水平边
    for (let r = 0; r <= this.state.rows; r++) {
      for (let c = 0; c < this.state.cols; c++) {
        const cx = boardX + (c + 0.5) * cellSize;
        const cy = boardY + r * cellSize;
        const dist = Math.sqrt((px - cx) * (px - cx) + (py - cy) * (py - cy));
        if (dist < minDist) {
          minDist = dist;
          closestEdge = { type: 'h', r, c };
        }
      }
    }
    
    // 检查垂直边
    for (let r = 0; r < this.state.rows; r++) {
      for (let c = 0; c <= this.state.cols; c++) {
        const cx = boardX + c * cellSize;
        const cy = boardY + (r + 0.5) * cellSize;
        const dist = Math.sqrt((px - cx) * (px - cx) + (py - cy) * (py - cy));
        if (dist < minDist) {
          minDist = dist;
          closestEdge = { type: 'v', r, c };
        }
      }
    }
    
    return closestEdge;
  }
}
