import BaseGameScene from '../../core/game-scene-base.js';
import { getHistory } from '../../core/storage.js';
import Button from '../../ui/button.js';
import MinesweeperState from './state.js';
import { drawText, fillRoundRect, strokeRoundRect } from '../../ui/canvas.js';
import { getRandomQuote } from '../../ui/quotes.js';
import { getScreenTier } from '../../core/layout.js';
import { easeOutCubic } from '../../ui/animation.js';

const LONG_PRESS_MS = 400;
const CANCEL_DRAG_PX = 12;
const REVEAL_DURATION = 150;

// 数字颜色映射（使用主题色）
function getNumberColor(num, theme) {
  switch (num) {
    case 1: return theme.color.blue;
    case 2: return theme.color.sage;
    case 3: return theme.color.danger;
    case 4: return '#2c3e50';
    case 5: return theme.color.accent;
    case 6: return '#4a7b7b';
    case 7: return theme.color.ink;
    case 8: return theme.color.muted;
    default: return theme.color.ink;
  }
}

export default class MinesweeperScene extends BaseGameScene {
  constructor(host, options = {}) {
    super(host, options);

    const { rows = 9, cols = 9, mines = 10 } = options;
    this.state = new MinesweeperState(rows, cols, mines);
    this.isFlagMode = false;
    this.resultShown = false;
    this._touch = null;
    this.bottomQuote = getRandomQuote('minesweeper');
    this.revealAnimCells = null; // Map<"r,c", {r,c,progress}> for reveal animation
  }

  init() {
    const width = this.host.width;
    const height = this.host.height;
    const tier = getScreenTier(width, height);
    const isTablet = tier === 'tablet';
    this._screenTier = tier;

    // 计算网格尺寸
    this.cellSize = Math.min(
      (width - 32) / this.state.cols,
      (height - 220) / this.state.rows
    );

    if (isTablet && this.cellSize > 46) {
      this.cellSize = 46;
    }
    if (tier === 'compact' && this.cellSize > 36) {
      this.cellSize = 36;
    }
    if (tier === 'tiny' && this.cellSize > 30) {
      this.cellSize = 30;
    }

    this.boardWidth = this.cellSize * this.state.cols;
    this.boardHeight = this.cellSize * this.state.rows;
    this.boardX = (width - this.boardWidth) / 2;

    let baseOffset, heightPadding;
    if (tier === 'tablet') {
      baseOffset = 180;
      heightPadding = 300;
    } else if (tier === 'standard') {
      baseOffset = 120;
      heightPadding = 220;
    } else if (tier === 'compact') {
      baseOffset = 110;
      heightPadding = 200;
    } else { // tiny
      baseOffset = 100;
      heightPadding = 180;
    }
    this.boardY = this.host.safeTop + baseOffset + Math.max(0, (height - heightPadding - this.boardHeight) / 2);
    this.boardY = Math.max(this.boardY, this.host.safeTop + 130);

    // 模式切换按钮 (移至棋盘下方，更符合大拇指单手交互，并空出顶部避让胶囊)
    this.modeButton = new Button({
      x: width / 2 - 37,
      y: this.boardY + this.boardHeight + (tier === 'tablet' ? 24 : tier === 'compact' ? 14 : tier === 'tiny' ? 10 : 16),
      w: 74,
      h: 36,
      label: '标记',
      variant: 'ghost',
      onClick: () => this.toggleMode(),
    });

    this.createTopButtons([]);
    this.buttons.push(this.modeButton);
    this.input.add(this.modeButton);
  }

  toggleMode() {
    this.isFlagMode = !this.isFlagMode;
    this.modeButton.label = this.isFlagMode ? '揭开' : '标记';
    this.modeButton.variant = this.isFlagMode ? 'secondary' : 'ghost';
  }

  reset() {
    const { rows, cols, totalMines } = this.state;
    this.state = new MinesweeperState(rows, cols, totalMines);
    this.isFlagMode = false;
    this.resultShown = false;
    this.modeButton.label = '标记';
    this.modeButton.variant = 'ghost';
    this.closeModal();
    this.revealAnimCells = null;
    this.bottomQuote = getRandomQuote('minesweeper');
  }

  update(dt = 16) {
    if (super.update(dt)) return;

    // 方块揭开动画进度更新
    if (this.revealAnimCells) {
      let allDone = true;
      for (const cell of this.revealAnimCells.values()) {
        cell.progress += dt / REVEAL_DURATION;
        if (cell.progress < 1) allDone = false;
      }
      if (allDone) {
        this.revealAnimCells = null;
      }
    }

    // 游戏完成时展示结果弹窗（由 state.reveal 触发 completed）
    if (this.state.completed && !this.resultShown) {
      this.resultShown = true;
      if (this.state.won) {
        const currentScore = this.state.getScore();
        const history = getHistory('minesweeper').map((h) => ({
          label: `${h.score}分 · ${h.time}s`,
          highlight: h.score === currentScore,
        }));
        this.showResult('恭喜通关！', [
          `用时 ${this.state.getElapsed()}s`,
          `步数 ${this.state.steps} 步`,
          `已标记数 ${this.state.getFlagCount()}`,
        ], true, history);
      } else {
        this.showResult('踩雷了！', [
          `用时 ${this.state.getElapsed()}s`,
          `步数 ${this.state.steps} 步`,
        ], false);
      }
    }
  }

  renderGame(ctx) {
    this.renderHeader(ctx);
    this.renderBoard(ctx);

    // ── Bottom hint ─────────────────────────────────
    const theme = this.theme;
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
    const width = this.host.width;
    const height = this.host.height;
    const tier = this._screenTier || getScreenTier(width, height);
    const flagged = this.state.getFlagCount();

    let titleY, statsY;
    if (tier === 'tablet') {
      titleY = safeTop + 110;
      statsY = safeTop + 140;
    } else if (tier === 'standard') {
      titleY = safeTop + 90;
      statsY = safeTop + 116;
    } else if (tier === 'compact') {
      titleY = safeTop + 80;
      statsY = safeTop + 106;
    } else { // tiny
      titleY = safeTop + 70;
      statsY = safeTop + 96;
    }

    drawText(ctx, '扫雷', this.host.width / 2, titleY, {
      size: 23,
      color: theme.color.ink,
      align: 'center',
      baseline: 'middle',
      font: theme.font.title,
      weight: '600',
    });

    drawText(ctx, `已标记 ${flagged} · 用时 ${this.state.getElapsed()}s`, this.host.width / 2, statsY, {
      size: 13,
      color: theme.color.muted,
      align: 'center',
      baseline: 'middle',
      font: theme.font.body,
    });
  }

  renderBoard(ctx) {
    const theme = this.theme;
    const { boardX, boardY, cellSize, state } = this;
    const radius = Math.min(theme.radius.sm, cellSize * 0.35);
    const gap = 1.5;

    // 1. 绘制棋盘底板 (略深于页面背景的暖米色，为方格边缘缝隙提供平滑自然的分界底色)
    fillRoundRect(
      ctx,
      boardX - 2,
      boardY - 2,
      this.boardWidth + 4,
      this.boardHeight + 4,
      radius + 2,
      theme.color.line
    );

    // 2. 绘制每个扫雷方格
    for (let r = 0; r < state.rows; r++) {
      for (let c = 0; c < state.cols; c++) {
        const cx = boardX + c * cellSize;
        const cy = boardY + r * cellSize;

        if (state.revealed[r][c]) {
          // ── 动画：缩放 + 淡入 ──────────────────────────
          const animKey = `${r},${c}`;
          const animCell = this.revealAnimCells ? this.revealAnimCells.get(animKey) : null;
          if (animCell) {
            const eased = easeOutCubic(Math.min(animCell.progress, 1));
            const scale = 0.5 + 0.5 * eased;
            const alpha = eased;
            ctx.save();
            ctx.globalAlpha *= alpha;
            const cxCenter = cx + cellSize / 2;
            const cyCenter = cy + cellSize / 2;
            ctx.translate(cxCenter, cyCenter);
            ctx.scale(scale, scale);
            ctx.translate(-cxCenter, -cyCenter);
          }

          // 已揭开：暖灰底色（表现为凹陷沉底状态）
          fillRoundRect(ctx, cx + gap, cy + gap, cellSize - gap * 2, cellSize - gap * 2, radius, theme.color.paperDeep);

          if (state.grid[r][c] === -1) {
            // 地雷：黑色圆点
            this.drawMine(ctx, cx + cellSize / 2, cy + cellSize / 2, cellSize);
          } else if (state.grid[r][c] > 0) {
            // 数字
            const num = state.grid[r][c];
            drawText(ctx, String(num), cx + cellSize / 2, cy + cellSize / 2 + 1, {
              size: cellSize * 0.48,
              color: getNumberColor(num, theme),
              align: 'center',
              baseline: 'middle',
              font: theme.font.body,
              weight: '600',
            });
          }

          if (animCell) {
            ctx.restore();
          }
        } else {
          // 未揭开：纸白底色（表现为立体凸起状态）
          fillRoundRect(ctx, cx + gap, cy + gap, cellSize - gap * 2, cellSize - gap * 2, radius, theme.color.paper);

          if (state.flagged[r][c]) {
            // 旗子标记
            this.drawFlag(ctx, cx + cellSize / 2, cy + cellSize / 2, cellSize);
          }
        }
      }
    }
  }

  drawMine(ctx, cx, cy, cellSize) {
    const r = cellSize * 0.16;
    ctx.fillStyle = this.theme.color.ink;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fill();
    // 高光
    ctx.fillStyle = this.theme.color.white;
    ctx.beginPath();
    ctx.arc(cx - r * 0.3, cy - r * 0.3, r * 0.3, 0, Math.PI * 2);
    ctx.fill();
  }

  drawFlag(ctx, cx, cy, cellSize) {
    const size = cellSize * 0.4;
    const poleX = cx - size * 0.1;
    // 旗杆
    ctx.strokeStyle = this.theme.color.strongLine;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(poleX, cy - size * 0.3);
    ctx.lineTo(poleX, cy + size * 0.35);
    ctx.stroke();
    // 旗面（三角）
    ctx.fillStyle = this.theme.color.danger;
    ctx.beginPath();
    ctx.moveTo(poleX, cy - size * 0.3);
    ctx.lineTo(poleX + size * 0.6, cy - size * 0.05);
    ctx.lineTo(poleX, cy + size * 0.2);
    ctx.closePath();
    ctx.fill();
  }

  onTouchStart(point) {
    if (this.isExiting) return;
    if (this.input.onTouchStart(point.x, point.y)) return;

    // 检测网格触摸
    const { boardX, boardY, cellSize, state } = this;
    if (point.x >= boardX && point.x < boardX + this.boardWidth &&
        point.y >= boardY && point.y < boardY + this.boardHeight) {
      const col = Math.floor((point.x - boardX) / cellSize);
      const row = Math.floor((point.y - boardY) / cellSize);

      if (row < 0 || row >= state.rows || col < 0 || col >= state.cols) return;

      // 记录触摸状态，用于长按检测和短按分发
      const touch = {
        startX: point.x,
        startY: point.y,
        row,
        col,
        longPressTriggered: false,
        timer: setTimeout(() => {
          touch.longPressTriggered = true;
          touch.timer = null;
          state.toggleFlag(row, col);
        }, LONG_PRESS_MS),
      };
      this._touch = touch;
    }
  }

  onTouchMove(point) {
    if (this.isExiting) return;
    this.input.onTouchMove(point.x, point.y);

    // 手指移动超过阈值取消长按，同时取消本次触摸的短按
    const touch = this._touch;
    if (touch && touch.timer) {
      const dx = point.x - touch.startX;
      const dy = point.y - touch.startY;
      if (Math.sqrt(dx * dx + dy * dy) > CANCEL_DRAG_PX) {
        clearTimeout(touch.timer);
        touch.timer = null;
        this._touch = null;
      }
    }
  }

  onTouchEnd(point) {
    if (this.isExiting) return;
    this.input.onTouchEnd(point.x, point.y);

    const touch = this._touch;
    this._touch = null;

    if (!touch) return;

    // 清理定时器
    if (touch.timer) {
      clearTimeout(touch.timer);
    }

    // 长按已触发 → 跳过短按逻辑
    if (touch.longPressTriggered) return;

    // 短按：根据当前模式执行操作
    if (this.isFlagMode) {
      this.state.toggleFlag(touch.row, touch.col);
    } else {
      // 快照当前已揭开状态，用于动画差异计算
      const prevRevealed = this.state.revealed.map(row => [...row]);
      this.state.reveal(touch.row, touch.col);

      // 仅在游戏未结束时收集新揭开的格子做动画（踩雷/通关时弹窗覆盖，不额外做动画）
      if (!this.state.completed) {
        const newCells = [];
        for (let r = 0; r < this.state.rows; r++) {
          for (let c = 0; c < this.state.cols; c++) {
            if (this.state.revealed[r][c] && !prevRevealed[r][c]) {
              newCells.push({ r, c, progress: 0 });
            }
          }
        }
        if (newCells.length > 0) {
          const map = new Map();
          for (const cell of newCells) {
            map.set(`${cell.r},${cell.c}`, cell);
          }
          this.revealAnimCells = map;
        }
      }
    }
  }

  destroy() {
    if (this._touch && this._touch.timer) {
      clearTimeout(this._touch.timer);
    }
    this._touch = null;
    super.destroy();
  }
}
