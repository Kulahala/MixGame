import Button from '../../ui/button.js';
import { contains, drawText, fillRoundRect, strokeRoundRect } from '../../ui/canvas.js';
import { saveScore } from '../../core/storage.js';
import { LEVELS } from './levels.js';

function clonePieces(pieces) {
  return pieces.map((piece) => Object.assign({}, piece));
}

export default class HuarongdaoScene {
  constructor(host) {
    this.host = host;
    this.theme = host.theme;
    this.level = LEVELS[0];
    this.pieces = clonePieces(this.level.pieces);
    this.selectedId = 'cao';
    this.steps = 0;
    this.completed = false;
    this.saved = false;
    this.startTime = Date.now();
    this.buttons = [];
  }

  init() {
    const width = this.host.width;
    this.boardW = Math.min(width - 64, 320);
    this.cell = this.boardW / this.level.width;
    this.boardH = this.cell * this.level.height;
    this.boardX = (width - this.boardW) / 2;
    this.boardY = 146;
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
      onClick: () => this.reset(),
    });
    this.buttons = [this.backButton, this.resetButton];
  }

  reset() {
    this.pieces = clonePieces(this.level.pieces);
    this.selectedId = 'cao';
    this.steps = 0;
    this.completed = false;
    this.saved = false;
    this.startTime = Date.now();
  }

  update() {
    if (!this.completed && this.isSolved()) {
      this.completed = true;
      this.saveResult();
    }
  }

  getElapsed() {
    return Math.floor((Date.now() - this.startTime) / 1000);
  }

  saveResult() {
    if (this.saved) return;
    const time = this.getElapsed();
    const score = Math.max(100, 1200 - this.steps * 12 - time * 2);
    saveScore('huarongdao', {
      score,
      steps: this.steps,
      time,
      difficulty: 'easy',
      levelId: this.level.id,
    });
    this.saved = true;
  }

  isSolved() {
    const cao = this.pieces.find((piece) => piece.id === 'cao');
    return cao.x === 1 && cao.y === 3;
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
    this.backButton.render(ctx, theme);
    this.resetButton.render(ctx, theme);
    this.renderHeader(ctx);
    this.renderBoard(ctx);
    this.renderControls(ctx);
    if (this.completed) {
      this.renderComplete(ctx);
    }
    ctx.restore();
  }

  renderHeader(ctx) {
    const theme = this.theme;
    drawText(ctx, '华容道', this.host.width / 2, 52, {
      size: 25,
      color: theme.color.ink,
      align: 'center',
      baseline: 'middle',
      font: theme.font.title,
      weight: '600',
    });
    drawText(ctx, `${this.level.title} · ${this.steps} 步 · ${this.getElapsed()}s`, this.host.width / 2, 102, {
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

    fillRoundRect(ctx, x - 10, y - 10, this.boardW + 20, this.boardH + 20, 20, theme.color.paper);
    strokeRoundRect(ctx, x - 10, y - 10, this.boardW + 20, this.boardH + 20, 20, theme.color.line, 1);

    ctx.fillStyle = '#e8dfd2';
    ctx.fillRect(x + this.cell, y + this.cell * 4 + 4, this.cell * 2, 10);
    drawText(ctx, '出口', x + this.boardW / 2, y + this.boardH + 24, {
      size: 12,
      color: theme.color.gold,
      align: 'center',
      baseline: 'middle',
      font: theme.font.body,
    });

    for (let i = 0; i <= this.level.width; i++) {
      ctx.strokeStyle = '#eee8df';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(x + i * this.cell, y);
      ctx.lineTo(x + i * this.cell, y + this.boardH);
      ctx.stroke();
    }
    for (let i = 0; i <= this.level.height; i++) {
      ctx.beginPath();
      ctx.moveTo(x, y + i * this.cell);
      ctx.lineTo(x + this.boardW, y + i * this.cell);
      ctx.stroke();
    }

    this.pieces.forEach((piece) => this.renderPiece(ctx, piece));
  }

  renderPiece(ctx, piece) {
    const theme = this.theme;
    const padding = 6;
    const x = this.boardX + piece.x * this.cell + padding;
    const y = this.boardY + piece.y * this.cell + padding;
    const w = piece.w * this.cell - padding * 2;
    const h = piece.h * this.cell - padding * 2;
    const selected = piece.id === this.selectedId;
    const colorMap = {
      king: theme.color.accent,
      vertical: theme.color.sage,
      horizontal: theme.color.blue,
      small: theme.color.paperDeep,
    };
    const textColor = piece.role === 'small' ? theme.color.ink : theme.color.white;

    fillRoundRect(ctx, x, y, w, h, 12, colorMap[piece.role]);
    strokeRoundRect(ctx, x, y, w, h, 12, selected ? theme.color.gold : '#00000022', selected ? 2 : 1);
    drawText(ctx, piece.name, x + w / 2, y + h / 2, {
      size: piece.role === 'small' ? 18 : 19,
      color: textColor,
      align: 'center',
      baseline: 'middle',
      font: theme.font.body,
      weight: '600',
    });
  }

  renderControls(ctx) {
    const theme = this.theme;
    const y = this.boardY + this.boardH + 54;
    drawText(ctx, '选棋 · 点空位 · 曹操至出口', this.host.width / 2, y, {
      size: 12,
      color: theme.color.faint,
      align: 'center',
      baseline: 'middle',
      font: theme.font.body,
    });
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
    drawText(ctx, `得分 ${Math.max(100, 1200 - this.steps * 12 - this.getElapsed() * 2)} · 已保存到本地`, this.host.width / 2, y + 56, {
      size: 13,
      color: '#e8e2d9',
      align: 'center',
      baseline: 'middle',
      font: theme.font.body,
    });
  }

  onTouchStart(point) {
    const button = this.buttons.find((item) => item.hit(point.x, point.y));
    if (button) {
      button.press();
      return;
    }

    if (!contains({ x: this.boardX, y: this.boardY, w: this.boardW, h: this.boardH }, point.x, point.y)) {
      return;
    }

    const gridX = Math.floor((point.x - this.boardX) / this.cell);
    const gridY = Math.floor((point.y - this.boardY) / this.cell);
    const piece = this.findPieceAt(gridX, gridY);

    if (piece) {
      this.selectedId = piece.id;
      return;
    }

    this.tryMoveSelected(gridX, gridY);
  }

  destroy() {
    this.buttons.forEach((button) => button.destroy && button.destroy());
  }

  findPieceAt(x, y) {
    return this.pieces.find((piece) => x >= piece.x && x < piece.x + piece.w && y >= piece.y && y < piece.y + piece.h);
  }

  tryMoveSelected(targetX, targetY) {
    if (this.completed) return;
    const piece = this.pieces.find((item) => item.id === this.selectedId);
    if (!piece) return;

    const directions = [
      { dx: 0, dy: -1 },
      { dx: 0, dy: 1 },
      { dx: -1, dy: 0 },
      { dx: 1, dy: 0 },
    ];

    for (let i = 0; i < directions.length; i++) {
      const direction = directions[i];
      const nx = piece.x + direction.dx;
      const ny = piece.y + direction.dy;
      if (!this.pieceWouldContain(piece, nx, ny, targetX, targetY)) continue;
      if (this.canMove(piece, direction.dx, direction.dy)) {
        piece.x = nx;
        piece.y = ny;
        this.steps++;
      }
      return;
    }
  }

  pieceWouldContain(piece, x, y, targetX, targetY) {
    return targetX >= x && targetX < x + piece.w && targetY >= y && targetY < y + piece.h;
  }

  canMove(piece, dx, dy) {
    const next = {
      x: piece.x + dx,
      y: piece.y + dy,
      w: piece.w,
      h: piece.h,
    };

    if (next.x < 0 || next.y < 0 || next.x + next.w > this.level.width || next.y + next.h > this.level.height) {
      return false;
    }

    return !this.pieces.some((other) => {
      if (other.id === piece.id) return false;
      return this.overlap(next, other);
    });
  }

  overlap(a, b) {
    return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
  }
}
