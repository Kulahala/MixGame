import BaseGameScene from '../../core/game-scene-base.js';
import { getHistory } from '../../core/storage.js';
import Game2048State from './state.js';
import { contains, drawText, fillRoundRect } from '../../ui/canvas.js';
import { getRandomQuote } from '../../ui/quotes.js';
import { easeOutCubic, easeOutBack } from '../../ui/animation.js';

// ── Tile colour palette ────────────────────────────────
function getTileColor(value, theme) {
  const colors = {
    2:    theme.color.paperDeep,
    4:    '#e0d8c8',
    8:    '#d4a76a',
    16:   '#c4884a',
    32:   '#b06a3a',
    64:   theme.color.danger,
    128:  '#7a8b5d',
    256:  theme.color.sage,
    512:  theme.color.blue,
    1024: theme.color.gold,
    2048: theme.color.accent,
  };
  return colors[value] || '#4b463f';
}

function getTextColor(value, theme) {
  return (value === 2 || value === 4) ? theme.color.ink : theme.color.white;
}

function drawTileAt(ctx, value, x, y, cellSize, scale, theme) {
  const size = cellSize * scale;
  const offset = (cellSize - size) / 2;
  const centerX = x + cellSize / 2;
  const centerY = y + cellSize / 2;
  const tileColor = getTileColor(value, theme);
  const r = theme.radius.sm;

  fillRoundRect(ctx, x + offset, y + offset, size, size, r, tileColor);

  const textColor = getTextColor(value, theme);
  const fontSize = value >= 1000 ? cellSize * 0.32 : cellSize * 0.42;
  drawText(ctx, String(value), centerX, centerY + 1, {
    size: fontSize * scale,
    color: textColor,
    align: 'center',
    baseline: 'middle',
    font: theme.font.body,
    weight: '600',
  });
}

export default class Game2048Scene extends BaseGameScene {
  constructor(host, options = {}) {
    super(host, options);
    this.state = new Game2048State(options.target || 2048);
    this.touchStartPoint = null;
    this.gap = 8;
    this.bottomQuote = getRandomQuote('game2048');
    this.tileAnims = [];
    this.isAnimating = false;
    this.pendingSpawn = null;
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
    this.tileAnims = [];
    this.isAnimating = false;
    this.pendingSpawn = null;
  }

  update(dt) {
    if (super.update(dt)) return;

    // ── Animation tick ────────────────────────────
    if (this.isAnimating) {
      let allDone = true;
      for (const anim of this.tileAnims) {
        anim.progress = Math.min(1, anim.progress + dt / anim.duration);
        if (anim.progress < 1) allDone = false;
      }
      if (allDone) {
        if (this.pendingSpawn) {
          // Slide finished — start spawn animation
          this.tileAnims = [{
            id: this.pendingSpawn.id,
            fromR: this.pendingSpawn.r, fromC: this.pendingSpawn.c,
            toR: this.pendingSpawn.r, toC: this.pendingSpawn.c,
            value: this.pendingSpawn.value,
            progress: 0,
            duration: 200,
            type: 'spawn',
          }];
          this.pendingSpawn = null;
        } else {
          this.tileAnims = [];
          this.isAnimating = false;
        }
      }
    }

    if (this.state.completed && !this.modal && !this.state.saved) {
      this.state.saveResult();

      if (this.state.won) {
        const history = getHistory('game2048', `目标${this.state.target}`).map((h) => ({
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

    // ── Cells (static) ─────────────────────────────
    const { gap, cellSize, gridX, gridY } = this;
    const animIds = new Set(this.tileAnims.map(a => a.id));
    if (this.pendingSpawn) animIds.add(this.pendingSpawn.id);

    for (let r = 0; r < this.state.size; r++) {
      for (let c = 0; c < this.state.size; c++) {
        const cell = this.state.grid[r][c];
        const cx = gridX + gap + c * (cellSize + gap);
        const cy = gridY + gap + r * (cellSize + gap);

        if (cell === null) {
          fillRoundRect(ctx, cx, cy, cellSize, cellSize, theme.radius.sm, theme.color.paperDeep);
        } else if (!animIds.has(cell.id)) {
          drawTileAt(ctx, cell.value, cx, cy, cellSize, 1, theme);
        }
      }
    }

    // ── Animated tiles ────────────────────────────
    for (const anim of this.tileAnims) {
      if (anim.type === 'slide') {
        const fromX = gridX + gap + anim.fromC * (cellSize + gap);
        const fromY = gridY + gap + anim.fromR * (cellSize + gap);
        const toX = gridX + gap + anim.toC * (cellSize + gap);
        const toY = gridY + gap + anim.toR * (cellSize + gap);

        const eased = easeOutCubic(anim.progress);
        const x = fromX + (toX - fromX) * eased;
        const y = fromY + (toY - fromY) * eased;

        // Scale pulse for merged tiles at end of slide
        let scale = 1;
        if (anim.merged && anim.progress >= 0.8) {
          const p = (anim.progress - 0.8) / 0.2;
          scale = 1.1 - p * 0.1;
        }

        drawTileAt(ctx, anim.value, x, y, cellSize, scale, theme);
      } else if (anim.type === 'spawn') {
        const cx = gridX + gap + anim.toC * (cellSize + gap);
        const cy = gridY + gap + anim.toR * (cellSize + gap);
        const scale = easeOutBack(anim.progress);
        const alpha = anim.progress;

        ctx.globalAlpha = alpha;
        drawTileAt(ctx, anim.value, cx, cy, cellSize, scale, theme);
        ctx.globalAlpha = 1;
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
    if (this.isAnimating) return;
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
    if (this.isAnimating) return;
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

    const result = this.state.move(direction);
    if (result.moved) {
      this.tileAnims = result.movements.map(m => ({
        id: m.id,
        fromR: m.fromR, fromC: m.fromC,
        toR: m.toR, toC: m.toC,
        value: m.value,
        merged: m.merged,
        mergedFromIds: m.mergedFromIds,
        progress: 0,
        duration: 160,
        type: 'slide',
      }));
      this.isAnimating = true;
      this.pendingSpawn = result.newTile;
    }
    this.touchStartPoint = null;
  }
}
