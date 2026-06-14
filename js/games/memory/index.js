import BaseGameScene from '../../core/game-scene-base.js';
import MemoryState from './state.js';
import { drawText, fillRoundRect, strokeRoundRect, contains } from '../../ui/canvas.js';

const FLIP_DURATION = 200;
const MISMATCH_DELAY = 800;
const COMPLETED_DELAY = 600;

export default class MemoryScene extends BaseGameScene {
  constructor(host, options = {}) {
    super(host, options);
    const { rows = 4, cols = 4 } = options;
    this.state = new MemoryState(rows, cols);
    this.cardAnim = [];
    this.isLocked = false;
    this.mismatchTimer = 0;
    this.mismatchCards = [];
    this.completedTimer = -1;
    this.initAnimations();
  }

  initAnimations() {
    this.cardAnim = [];
    for (let r = 0; r < this.state.rows; r++) {
      this.cardAnim[r] = [];
      for (let c = 0; c < this.state.cols; c++) {
        this.cardAnim[r][c] = { progress: 0 };
      }
    }
  }

  init() {
    const width = this.host.width;
    const height = this.host.height;
    const cols = this.state.cols;
    const rows = this.state.rows;
    const gap = 8;

    this.createTopButtons();

    this.gap = gap;
    this.cardSize = Math.max(50, Math.min(90, Math.floor(Math.min(
      (width - 32 - (cols - 1) * gap) / cols,
      (height - 220 - (rows - 1) * gap) / rows
    ))));

    const gridW = cols * this.cardSize + (cols - 1) * gap;
    this.gridX = (width - gridW) / 2;
    this.gridY = this.host.safeTop + 150;

    this.titleY = this.host.safeTop + 90;
    this.statsY = this.host.safeTop + 125;
  }

  reset() {
    this.closeModal();
    this.state.init();
    this.initAnimations();
    this.isLocked = false;
    this.mismatchTimer = 0;
    this.mismatchCards = [];
    this.completedTimer = -1;
  }

  update(dt = 16) {
    if (super.update(dt)) return;

    // Update flip animations
    const { rows, cols } = this.state;
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const anim = this.cardAnim[r][c];
        const card = this.state.cards[r][c];
        if (card.faceUp && anim.progress < 1) {
          anim.progress = Math.min(1, anim.progress + dt / FLIP_DURATION);
        } else if (!card.faceUp && anim.progress > 0) {
          anim.progress = Math.max(0, anim.progress - dt / FLIP_DURATION);
        }
      }
    }

    // Handle mismatch delay
    if (this.isLocked && this.mismatchTimer > 0) {
      this.mismatchTimer -= dt;
      if (this.mismatchTimer <= 0) {
        this.mismatchTimer = 0;
        this.state.hideCards(this.mismatchCards);
        this.mismatchCards = [];
        this.isLocked = false;
      }
    }

    // Handle completed delay
    if (this.completedTimer > 0) {
      this.completedTimer -= dt;
      if (this.completedTimer <= 0) {
        this.completedTimer = -1;
        this.state.saveResult();
        const time = this.state.getElapsed();
        this.showResult(
          '恭喜通关！',
          [
            `用时：${time}s`,
            `步数：${this.state.steps} 步`,
            `难度：${this.state.rows}×${this.state.cols}`,
          ],
          true
        );
      }
    }
  }

  renderGame(ctx) {
    const theme = this.theme;
    const width = this.host.width;
    const { rows, cols } = this.state;
    const size = this.cardSize;
    const gap = this.gap;
    const radius = theme.radius.sm;

    // Header
    drawText(ctx, '记忆翻牌', width / 2, this.titleY, {
      size: 25,
      color: theme.color.ink,
      align: 'center',
      baseline: 'middle',
      font: theme.font.title,
      weight: '600',
    });
    drawText(ctx, `步数 ${this.state.steps} · 用时 ${this.state.getElapsed()}s · ${this.state.rows}×${this.state.cols}`, width / 2, this.statsY, {
      size: 13,
      color: theme.color.muted,
      align: 'center',
      baseline: 'middle',
      font: theme.font.body,
    });

    // Card grid
    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < cols; col++) {
        const card = this.state.cards[row][col];
        const anim = this.cardAnim[row][col];
        const progress = anim.progress;

        const x = this.gridX + col * (size + gap);
        const y = this.gridY + row * (size + gap);
        const cx = x + size / 2;
        const cy = y + size / 2;

        ctx.save();

        // 3D flip effect: scaleX based on progress
        let scaleX;
        if (progress < 0.5) {
          scaleX = 1 - progress / 0.5; // 1 → 0 (back visible)
        } else {
          scaleX = (progress - 0.5) / 0.5; // 0 → 1 (front visible)
        }

        ctx.translate(cx, 0);
        ctx.scale(Math.max(0, scaleX), 1);
        ctx.translate(-cx, 0);

        if (progress < 0.5) {
          // ── Back face ──
          fillRoundRect(ctx, x, y, size, size, radius, theme.color.ink);
          strokeRoundRect(ctx, x, y, size, size, radius, theme.color.strongLine, 1);

          // Decorative diamond
          const d = size * 0.16;
          ctx.fillStyle = theme.color.gold;
          ctx.beginPath();
          ctx.moveTo(cx, cy - d);
          ctx.lineTo(cx + d, cy);
          ctx.lineTo(cx, cy + d);
          ctx.lineTo(cx - d, cy);
          ctx.closePath();
          ctx.fill();
        } else if (scaleX > 0) {
          // ── Front face ──
          const isMatched = card.matched;
          const alpha = isMatched ? 0.75 : 1;
          ctx.globalAlpha = alpha;

          fillRoundRect(ctx, x, y, size, size, radius, theme.color.paper);
          strokeRoundRect(
            ctx, x, y, size, size, radius,
            isMatched ? theme.color.sage : theme.color.line,
            isMatched ? 2 : 1
          );

          // Symbol — always draw when front face is visible
          drawText(ctx, card.symbol, cx, cy + 1, {
            size: size * 0.42,
            color: isMatched ? theme.color.sage : theme.color.ink,
            align: 'center',
            baseline: 'middle',
            font: theme.font.title,
            weight: '600',
          });

          // Matched checkmark
          if (isMatched) {
            const checkSize = size * 0.14;
            ctx.fillStyle = theme.color.sage;
            ctx.font = `${checkSize}px ${theme.font.body}`;
            ctx.textAlign = 'right';
            ctx.textBaseline = 'bottom';
            ctx.fillText('✓', x + size - 4, y + size - 4);
          }
        }

        ctx.restore();
      }
    }
  }

  onTouchStart(point) {
    if (this.isExiting) return;
    if (this.input.onTouchStart(point.x, point.y)) return;
    if (this.isLocked) return;

    const { rows, cols } = this.state;
    const size = this.cardSize;
    const gap = this.gap;

    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const cardX = this.gridX + c * (size + gap);
        const cardY = this.gridY + r * (size + gap);
        const rect = { x: cardX, y: cardY, w: size, h: size };

        if (contains(rect, point.x, point.y)) {
          const result = this.state.flip(r, c);

          if (result.action === 'match') {
            if (this.state.completed) {
              this.completedTimer = COMPLETED_DELAY;
            }
          } else if (result.action === 'mismatch') {
            this.isLocked = true;
            this.mismatchTimer = MISMATCH_DELAY;
            this.mismatchCards = [
              { r: result.card1.r, c: result.card1.c },
              { r: result.card2.r, c: result.card2.c },
            ];
          }
          // 'flip': animation progress catches up automatically
          // 'blocked': silently ignored

          return;
        }
      }
    }
  }

  onTouchMove(point) {
    if (this.isExiting) return;
    this.input.onTouchMove(point.x, point.y);
  }

  onTouchEnd(point) {
    if (this.isExiting) return;
    this.input.onTouchEnd(point.x, point.y);
  }
}
