import BaseGameScene from '../../core/game-scene-base.js';
import { getHistory } from '../../core/storage.js';
import Button from '../../ui/button.js';
import MinesweeperState from './state.js';
import { drawText, fillRoundRect, strokeRoundRect } from '../../ui/canvas.js';

// 数字颜色映射
const NUMBER_COLORS = {
  1: '#52677a',  // 蓝
  2: '#536b5d',  // 绿
  3: '#a54b44',  // 红
  4: '#2c3e50',  // 深蓝
  5: '#7a4f3f',  // 棕
  6: '#4a7b7b',  // 青
  7: '#25221d',  // 黑
  8: '#756f64',  // 灰
};

export default class MinesweeperScene extends BaseGameScene {
  constructor(host, options = {}) {
    super(host, options);

    const { rows = 9, cols = 9, mines = 10 } = options;
    this.state = new MinesweeperState(rows, cols, mines);
    this.isFlagMode = false;
    this.resultShown = false;
  }

  init() {
    const width = this.host.width;
    const height = this.host.height;

    // 计算网格尺寸
    this.cellSize = Math.min(
      (width - 32) / this.state.cols,
      (height - 220) / this.state.rows
    );
    this.boardWidth = this.cellSize * this.state.cols;
    this.boardHeight = this.cellSize * this.state.rows;
    this.boardX = (width - this.boardWidth) / 2;
    this.boardY = this.host.safeTop + 120 + Math.max(0, (height - 220 - this.boardHeight) / 2);

    // 模式切换按钮
    this.modeButton = new Button({
      x: width / 2 - 37,
      y: this.host.safeTop + 8,
      w: 74,
      h: 36,
      label: '揭开',
      variant: 'ghost',
      onClick: () => this.toggleMode(),
    });

    this.createTopButtons([this.modeButton]);
  }

  toggleMode() {
    this.isFlagMode = !this.isFlagMode;
    this.modeButton.label = this.isFlagMode ? '标记' : '揭开';
    this.modeButton.variant = this.isFlagMode ? 'secondary' : 'ghost';
  }

  reset() {
    const { rows, cols, totalMines } = this.state;
    this.state = new MinesweeperState(rows, cols, totalMines);
    this.isFlagMode = false;
    this.resultShown = false;
    this.modeButton.label = '揭开';
    this.modeButton.variant = 'ghost';
    this.closeModal();
  }

  update(dt = 16) {
    if (super.update(dt)) return;

    // 游戏完成时展示结果弹窗（由 state.reveal 触发 completed）
    if (this.state.completed && !this.resultShown) {
      this.resultShown = true;
      if (this.state.won) {
        const currentScore = this.state.won ? Math.max(100, 1000 - this.state.getElapsed() * 2 - this.state.steps) : 0;
        const history = getHistory('minesweeper').map((h) => ({
          label: `${h.score}分 · ${h.time}s`,
          highlight: h.score === currentScore,
        }));
        this.showResult('恭喜通关！', [
          `用时 ${this.state.getElapsed()}s`,
          `步数 ${this.state.steps} 步`,
          `剩余雷数 ${this.state.totalMines - this.state.getFlagCount()}`,
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
  }

  renderHeader(ctx) {
    const theme = this.theme;
    const remaining = this.state.totalMines - this.state.getFlagCount();

    drawText(ctx, '扫雷', this.host.width / 2, 90, {
      size: 23,
      color: theme.color.ink,
      align: 'center',
      baseline: 'middle',
      font: theme.font.title,
      weight: '600',
    });

    drawText(ctx, `剩余 ${remaining} · 用时 ${this.state.getElapsed()}s`, this.host.width / 2, 116, {
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
    const radius = Math.min(theme.radius.sm, cellSize * 0.3);

    for (let r = 0; r < state.rows; r++) {
      for (let c = 0; c < state.cols; c++) {
        const cx = boardX + c * cellSize;
        const cy = boardY + r * cellSize;
        const gap = 1;

        if (state.revealed[r][c]) {
          // 已揭开
          fillRoundRect(ctx, cx + gap, cy + gap, cellSize - gap * 2, cellSize - gap * 2, radius, theme.color.bg);

          if (state.grid[r][c] === -1) {
            // 地雷：黑色圆点
            this.drawMine(ctx, cx + cellSize / 2, cy + cellSize / 2, cellSize);
          } else if (state.grid[r][c] > 0) {
            // 数字
            const num = state.grid[r][c];
            drawText(ctx, String(num), cx + cellSize / 2, cy + cellSize / 2 + 1, {
              size: cellSize * 0.48,
              color: NUMBER_COLORS[num] || theme.color.ink,
              align: 'center',
              baseline: 'middle',
              font: theme.font.body,
              weight: '600',
            });
          }
        } else {
          // 未揭开
          fillRoundRect(ctx, cx + gap, cy + gap, cellSize - gap * 2, cellSize - gap * 2, radius, theme.color.paperDeep);

          if (state.flagged[r][c]) {
            // 旗子标记
            this.drawFlag(ctx, cx + cellSize / 2, cy + cellSize / 2, cellSize);
          }
        }
      }
    }

    // 网格边框（在格子间隙上画线形成整洁网格）
    ctx.strokeStyle = theme.color.line;
    ctx.lineWidth = 0.5;
    for (let r = 0; r <= state.rows; r++) {
      const y = boardY + r * cellSize;
      ctx.beginPath();
      ctx.moveTo(boardX, y);
      ctx.lineTo(boardX + this.boardWidth, y);
      ctx.stroke();
    }
    for (let c = 0; c <= state.cols; c++) {
      const x = boardX + c * cellSize;
      ctx.beginPath();
      ctx.moveTo(x, boardY);
      ctx.lineTo(x, boardY + this.boardHeight);
      ctx.stroke();
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
    ctx.fillStyle = '#c0392b';
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

      if (this.isFlagMode) {
        state.toggleFlag(row, col);
      } else {
        state.reveal(row, col);
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

  destroy() {
    super.destroy();
    // BaseGameScene.destroy 已清理 buttons 和 modal
  }
}
