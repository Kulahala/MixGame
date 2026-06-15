import BaseGameScene from '../../core/game-scene-base.js';
import { getHistory } from '../../core/storage.js';
import Game2048State from './state.js';
import { contains, drawText, fillRoundRect } from '../../ui/canvas.js';
import { getRandomQuote } from '../../ui/quotes.js';

// ── Tile colour palette ────────────────────────────────
const TILE_COLORS = {
  2:    '#ece7dd',
  4:    '#e0d8c8',
  8:    '#d4a76a',
  16:   '#c4884a',
  32:   '#b06a3a',
  64:   '#a54b44',
  128:  '#7a8b5d',
  256:  '#536b5d',
  512:  '#52677a',
  1024: '#b29259',
  2048: '#7a4f3f',
};

function getTileColor(value) {
  return TILE_COLORS[value] || '#4b463f';
}

function getTextColor(value, theme) {
  return (value === 2 || value === 4) ? theme.color.ink : theme.color.white;
}

export default class Game2048Scene extends BaseGameScene {
  constructor(host, options = {}) {
    super(host, options);
    this.state = new Game2048State(options.target || 2048);
    this.touchStartPoint = null;
    this.gap = 8;
    this.bottomQuote = getRandomQuote('game2048');
  }

  // ── Layout ───────────────────────────────────────────

  init() {
    const width = this.host.width;
    const height = this.host.height;
    const isTablet = width >= 500 && height >= 600 && height >= width;

    this.createTopButtons();

    const maxGridSize = isTablet ? 400 : 342;
    const tempCellSize = Math.floor(Math.min((width - 48) / 4, (height - 220) / 4));
    const tempGridSize = tempCellSize * 4 + this.gap * 5;

    if (tempGridSize > maxGridSize) {
      this.cellSize = Math.floor((maxGridSize - this.gap * 5) / 4);
      this.gridSize = this.cellSize * 4 + this.gap * 5;
    } else {
      this.cellSize = tempCellSize;
      this.gridSize = tempGridSize;
    }

    this.gridX = Math.floor((width - this.gridSize) / 2);
    
    // 中下部符合人体工学的垂直居中偏下布局，方便单手游玩
    this.gridY = Math.floor((height - this.gridSize) / 2) + 30;
    if (this.gridY < this.host.safeTop + 130) {
      this.gridY = this.host.safeTop + 130;
    }
  }

  // ── Lifecycle ────────────────────────────────────────

  reset() {
    this.closeModal();
    this.state.init();
    this.touchStartPoint = null;
    this.bottomQuote = getRandomQuote('game2048');
  }

  update(dt) {
    if (super.update(dt)) return;

    if (this.state.completed && !this.modal && !this.state.saved) {
      this.state.saveResult();

      if (this.state.won) {
        const history = getHistory('game2048').map((h) => ({
          label: `${h.score}分 · ${h.steps}步`,
          highlight: h.score === this.state.score,
        }));
        this.showResult(
          `达到 ${this.state.target}！`,
          [
            `分数：${this.state.score}`,
            `步数：${this.state.steps} 步`,
            `用时：${this.state.getElapsed()}s`,
          ],
          true,
          history,
        );
      } else {
        this.showResult(
          '游戏结束',
          [
            `最终分数：${this.state.score}`,
            `步数：${this.state.steps} 步`,
            `用时：${this.state.getElapsed()}s`,
          ],
          false,
        );
      }
    }
  }

  // ── Render ───────────────────────────────────────────

  renderGame(ctx) {
    const theme = this.theme;

    const safeTop = this.host.safeTop;

    // ── Header ──────────────────────────────────────
    drawText(ctx, '2048', this.host.width / 2, safeTop + 90, {
      size: 28,
      color: theme.color.ink,
      align: 'center',
      baseline: 'middle',
      font: theme.font.title,
      weight: '600',
    });

    drawText(ctx, `分数：${this.state.score}`, this.host.width / 2, safeTop + 125, {
      size: 16,
      color: theme.color.muted,
      align: 'center',
      baseline: 'middle',
      font: theme.font.body,
    });

    // ── Grid background ─────────────────────────────
    const r = theme.radius.md;
    fillRoundRect(ctx, this.gridX, this.gridY, this.gridSize, this.gridSize, r, theme.color.paper);

    // ── Cells ───────────────────────────────────────
    const { gap, cellSize, gridX, gridY } = this;
    for (let r = 0; r < this.state.size; r++) {
      for (let c = 0; c < this.state.size; c++) {
        const value = this.state.grid[r][c];
        const cx = gridX + gap + c * (cellSize + gap);
        const cy = gridY + gap + r * (cellSize + gap);

        if (value === 0) {
          fillRoundRect(ctx, cx, cy, cellSize, cellSize, theme.radius.sm, theme.color.paperDeep);
        } else {
          const tileColor = getTileColor(value);
          fillRoundRect(ctx, cx, cy, cellSize, cellSize, theme.radius.sm, tileColor);

          const textColor = getTextColor(value, theme);
          const fontSize = value >= 1000 ? cellSize * 0.32 : cellSize * 0.42;
          drawText(ctx, String(value), cx + cellSize / 2, cy + cellSize / 2 + 1, {
            size: fontSize,
            color: textColor,
            align: 'center',
            baseline: 'middle',
            font: theme.font.body,
            weight: '600',
          });
        }
      }
    }

    // ── Bottom hint ─────────────────────────────────
    drawText(ctx, this.bottomQuote, this.host.width / 2, this.host.height - 42, {
      size: 12,
      color: theme.color.faint,
      align: 'center',
      baseline: 'middle',
      font: theme.font.body,
    });
  }

  // ── Touch ────────────────────────────────────────────

  onTouchStart(point) {
    if (this.isExiting) return;
    if (this.input.onTouchStart(point.x, point.y)) {
      this.touchStartPoint = null;
      return;
    }

    // Only track swipes that start inside the grid area
    if (contains({ x: this.gridX, y: this.gridY, w: this.gridSize, h: this.gridSize }, point.x, point.y)) {
      this.touchStartPoint = { x: point.x, y: point.y };
    }
  }

  onTouchMove(point) {
    if (this.isExiting) return;
    this.input.onTouchMove(point.x, point.y);
  }

  onTouchEnd(point) {
    if (this.isExiting) return;
    this.input.onTouchEnd(point.x, point.y);

    if (!this.touchStartPoint) return;

    const start = this.touchStartPoint;
    const dx = point.x - start.x;
    const dy = point.y - start.y;
    const absDx = Math.abs(dx);
    const absDy = Math.abs(dy);

    // Ignore taps (very small movement)
    if (absDx < 10 && absDy < 10) {
      this.touchStartPoint = null;
      return;
    }

    // Minimum swipe threshold
    if (absDx < 25 && absDy < 25) {
      this.touchStartPoint = null;
      return;
    }

    let direction;
    if (absDx > absDy * 1.5) {
      direction = dx > 0 ? 'right' : 'left';
    } else if (absDy > absDx * 1.5) {
      direction = dy > 0 ? 'down' : 'up';
    } else {
      this.touchStartPoint = null;
      return; // diagonal, ignore
    }

    this.state.move(direction);
    this.touchStartPoint = null;
  }
}
