import BaseGameScene from '../../core/game-scene-base.js';
import { getHistory } from '../../core/storage.js';
import { OneStrokeState } from './state.js';
import { drawText, fillRoundRect, strokeRoundRect, roundRect } from '../../ui/canvas.js';
import { getRandomQuote } from '../../ui/quotes.js';

export default class OneStrokeScene extends BaseGameScene {
  constructor(host, options = {}) {
    super(host, options);
    this.size = options.size || 4;
    this.obstacleCount = options.obstacleCount !== undefined ? options.obstacleCount : 1;
    this.state = new OneStrokeState(this.size, this.obstacleCount);
    this.bottomQuote = getRandomQuote('onestroke');
    this.isDragging = false;
    this.completed = false;
  }

  init() {
    const { width, height, safeTop } = this.host;
    const isTablet = width >= 500 && height >= 600 && height >= width;
    const size = this.size;

    let boardSize, boardY;

    if (isTablet) {
      boardSize = 400;
      boardY = Math.floor((height - boardSize) / 2) + 20;
    } else if (height >= 700) {
      boardSize = Math.min(width - 32, 342);
      boardY = Math.floor((height - boardSize) / 2) + 30;
      if (boardY < safeTop + 130) {
        boardY = safeTop + 130;
      }
    } else {
      boardSize = Math.min(width - 32, height - 250);
      boardY = Math.floor((height - boardSize) / 2) + 15;
      if (boardY < safeTop + 110) {
        boardY = safeTop + 110;
      }
    }

    const gap = size === 4 ? 8 : (size === 5 ? 6 : 5);
    const cellSize = (boardSize - gap * (size + 1)) / size;
    const boardX = (width - boardSize) / 2;

    this.boardSize = boardSize;
    this.boardY = boardY;
    this.gap = gap;
    this.cellSize = cellSize;
    this.boardX = boardX;

    this.createTopButtons();
  }

  reset() {
    this.closeModal();
    this.state.init();
    this.bottomQuote = getRandomQuote('onestroke');
    this.isDragging = false;
    this.completed = false;
  }

  update(dt = 16) {
    if (super.update(dt)) return;

    if (this.state.won && !this.completed) {
      this.completed = true;
      const time = this.state.getElapsed();
      const currentScore = Math.max(100, 1000 - time * 2 - this.state.steps * 3);

      const stats = [
        `得分：${currentScore} 分`,
        `用时：${time}s`,
        `步数：${this.state.steps} 步`,
        `难度：${this.state.size}x${this.state.size}`
      ];

      const history = getHistory('onestroke').map(h => ({
        label: `${h.score}分 · ${h.time}s`,
        highlight: h.score === currentScore
      }));

      this.showResult('恭喜通关！', stats, true, history);
    }
  }

  getCellUnderTouch(x, y) {
    const size = this.size;
    const gap = this.gap;
    const cellSize = this.cellSize;
    const boardX = this.boardX;
    const boardY = this.boardY;

    const c = Math.floor((x - boardX - gap) / (cellSize + gap));
    const r = Math.floor((y - boardY - gap) / (cellSize + gap));

    if (r >= 0 && r < size && c >= 0 && c < size) {
      return { r, c };
    }
    return null;
  }

  renderGame(ctx) {
    const theme = this.theme;
    const { width, height, safeTop } = this.host;
    const size = this.size;
    const gap = this.gap;
    const cellSize = this.cellSize;
    const boardX = this.boardX;
    const boardY = this.boardY;
    const boardSize = this.boardSize;

    // ── Header ──────────────────────────────────────
    const isTablet = width >= 500 && height >= 600 && height >= width;
    const titleY = safeTop + (isTablet ? 100 : (height >= 700 ? 90 : 65));
    const statsY = safeTop + (isTablet ? 140 : (height >= 700 ? 125 : 95));

    drawText(ctx, '一笔画', width / 2, titleY, {
      size: height >= 700 ? 28 : 22,
      color: theme.color.ink,
      align: 'center',
      baseline: 'middle',
      font: theme.font.title,
      weight: '600',
    });

    drawText(ctx, `步数：${this.state.steps} · 用时：${this.state.getElapsed()}s`, width / 2, statsY, {
      size: height >= 700 ? 16 : 14,
      color: theme.color.muted,
      align: 'center',
      baseline: 'middle',
      font: theme.font.body,
    });

    // ── Board Background ────────────────────────────
    fillRoundRect(ctx, boardX, boardY, boardSize, boardSize, theme.radius.lg, theme.color.paper);
    strokeRoundRect(ctx, boardX, boardY, boardSize, boardSize, theme.radius.lg, theme.color.line, 1);

    // ── Grid Cells ──────────────────────────────────
    for (let r = 0; r < size; r++) {
      for (let c = 0; c < size; c++) {
        const type = this.state.grid[r][c];
        const isStart = type === 1; // CELL_TYPES.START
        const isObstacle = type === 2; // CELL_TYPES.OBSTACLE
        const isVisited = this.state.path.some(p => p.r === r && p.c === c);

        const cellX = boardX + gap + c * (cellSize + gap);
        const cellY = boardY + gap + r * (cellSize + gap);
        const radius = theme.radius.sm;

        if (isStart) {
          fillRoundRect(ctx, cellX, cellY, cellSize, cellSize, radius, theme.color.gold);
        } else if (isObstacle) {
          ctx.save();
          fillRoundRect(ctx, cellX, cellY, cellSize, cellSize, radius, theme.color.paperDeep);

          roundRect(ctx, cellX, cellY, cellSize, cellSize, radius);
          ctx.clip();

          // Diagonal hatch lines at 45 degrees
          ctx.strokeStyle = theme.color.line;
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          const spacing = 8;
          for (let offset = -cellSize; offset < cellSize * 2; offset += spacing) {
            ctx.moveTo(cellX + offset, cellY);
            ctx.lineTo(cellX + offset + cellSize, cellY + cellSize);
          }
          ctx.stroke();
          ctx.restore();

          strokeRoundRect(ctx, cellX, cellY, cellSize, cellSize, radius, theme.color.muted, 1);
        } else if (isVisited) {
          fillRoundRect(ctx, cellX, cellY, cellSize, cellSize, radius, theme.color.sage);
        } else {
          fillRoundRect(ctx, cellX, cellY, cellSize, cellSize, radius, theme.color.paperDeep);
        }
      }
    }

    // ── Path Line ───────────────────────────────────
    if (this.state.path.length > 1) {
      ctx.save();
      ctx.strokeStyle = theme.color.accent;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.lineWidth = cellSize * 0.22;

      ctx.beginPath();
      const firstCell = this.state.path[0];
      const startX = boardX + gap + firstCell.c * (cellSize + gap) + cellSize / 2;
      const startY = boardY + gap + firstCell.r * (cellSize + gap) + cellSize / 2;
      ctx.moveTo(startX, startY);

      for (let i = 1; i < this.state.path.length; i++) {
        const cell = this.state.path[i];
        const cx = boardX + gap + cell.c * (cellSize + gap) + cellSize / 2;
        const cy = boardY + gap + cell.r * (cellSize + gap) + cellSize / 2;
        ctx.lineTo(cx, cy);
      }
      ctx.stroke();
      ctx.restore();
    }

    // ── Bottom Quote ────────────────────────────────
    drawText(ctx, this.bottomQuote, width / 2, height - 42, {
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

    const cell = this.getCellUnderTouch(point.x, point.y);
    if (cell) {
      const { r, c } = cell;
      const lastCell = this.state.path[this.state.path.length - 1];
      const startCell = this.state.solutionPath[0];
      const isLast = r === lastCell.r && c === lastCell.c;
      const isStart = r === startCell.r && c === startCell.c;
      const isVisited = this.state.path.some(p => p.r === r && p.c === c);
      const isAdjacent = Math.abs(r - lastCell.r) + Math.abs(c - lastCell.c) === 1;
      const isObstacle = this.state.grid[r][c] === 2; // CELL_TYPES.OBSTACLE

      if (isLast || isStart || (isAdjacent && !isObstacle && !isVisited) || (isVisited && !isObstacle)) {
        this.state.dragTo(r, c);
        if (typeof wx !== 'undefined' && wx.vibrateShort) {
          wx.vibrateShort({ type: 'light' });
        }
        this.isDragging = true;
      }
    }
  }

  onTouchMove(point) {
    if (this.isExiting) return;
    this.input.onTouchMove(point.x, point.y);

    if (this.isDragging) {
      const cell = this.getCellUnderTouch(point.x, point.y);
      if (cell) {
        const { r, c } = cell;
        const lastCell = this.state.path[this.state.path.length - 1];
        if (r !== lastCell.r || c !== lastCell.c) {
          const success = this.state.dragTo(r, c);
          if (success) {
            if (typeof wx !== 'undefined' && wx.vibrateShort) {
              wx.vibrateShort({ type: 'light' });
            }
          }
        }
      }
    }
  }

  onTouchEnd(point) {
    if (this.isExiting) return;
    this.input.onTouchEnd(point.x, point.y);
    this.isDragging = false;
  }
}
