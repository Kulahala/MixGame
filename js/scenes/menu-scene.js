import Button from '../ui/button.js';
import { drawText, fillRoundRect, strokeRoundRect } from '../ui/canvas.js';
import { getScores } from '../core/storage.js';

export default class MenuScene {
  constructor(host) {
    this.host = host;
    this.theme = host.theme;
    this.cards = [];
    this.scores = getScores();
  }

  init() {
    const margin = 24;
    const cardW = this.host.width - margin * 2;
    const top = 188;
    const gap = 18;
    const cardH = 128;

    this.cards = [
      new Button({
        x: margin,
        y: top,
        w: cardW,
        h: cardH,
        label: '数独',
        detail: this.formatSudokuScore(),
        variant: 'secondary',
        onClick: () => this.host.startGame('sudoku'),
      }),
      new Button({
        x: margin,
        y: top + cardH + gap,
        w: cardW,
        h: cardH,
        label: '华容道',
        detail: this.formatHuarongdaoScore(),
        variant: 'secondary',
        onClick: () => this.host.startGame('huarongdao'),
      }),
    ];
  }

  formatSudokuScore() {
    const score = this.scores.sudoku || {};
    return score.bestScore ? `最佳 ${score.bestScore} 分 · ${score.bestTime}s` : '九宫格推理 · 简单难度';
  }

  formatHuarongdaoScore() {
    const score = this.scores.huarongdao || {};
    return score.bestScore ? `最佳 ${score.bestScore} 分 · ${score.bestSteps} 步` : '经典横刀立马 · 简单关卡';
  }

  render(ctx) {
    const { width, height } = this.host;
    const theme = this.theme;
    const reveal = Math.min(1, this.host.sceneAge / 360);

    ctx.clearRect(0, 0, width, height);
    ctx.fillStyle = theme.color.bg;
    ctx.fillRect(0, 0, width, height);

    ctx.save();
    ctx.globalAlpha = reveal;
    ctx.translate(0, (1 - reveal) * 10);
    this.renderBackdrop(ctx);

    drawText(ctx, '静游集', width / 2, 72, {
      size: 36,
      color: theme.color.ink,
      align: 'center',
      baseline: 'middle',
      font: theme.font.title,
      weight: '600',
    });

    drawText(ctx, '安静一点的小游戏合集', width / 2, 112, {
      size: 14,
      color: theme.color.muted,
      align: 'center',
      baseline: 'middle',
      font: theme.font.body,
    });
    ctx.restore();

    this.cards.forEach((card, index) => this.renderGameCard(ctx, card, index));

    drawText(ctx, '本地计分 · 无排行 · 后续可接难度选项', width / 2, height - 42, {
      size: 12,
      color: theme.color.faint,
      align: 'center',
      baseline: 'middle',
      font: theme.font.body,
    });
  }

  renderBackdrop(ctx) {
    const theme = this.theme;
    const width = this.host.width;
    fillRoundRect(ctx, 18, 28, width - 36, 112, 24, '#fbfaf6');
    strokeRoundRect(ctx, 18, 28, width - 36, 112, 24, '#e0d8cb', 1);
    ctx.strokeStyle = '#e8e0d4';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(46, 138);
    ctx.lineTo(width - 46, 138);
    ctx.stroke();
    ctx.strokeStyle = theme.color.gold;
    ctx.globalAlpha = 0.28;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(width - 78, 68);
    ctx.lineTo(width - 48, 68);
    ctx.moveTo(width - 63, 53);
    ctx.lineTo(width - 63, 83);
    ctx.stroke();
    ctx.globalAlpha = 1;
  }

  renderGameCard(ctx, card, index) {
    const theme = this.theme;
    const accent = index === 0 ? theme.color.sage : theme.color.blue;
    const reveal = Math.min(1, Math.max(0, (this.host.sceneAge - index * 90) / 380));
    const iconX = card.x + card.w - 68;
    const iconY = card.y + 34;
    const pressDepth = card.isPressed ? 3 : 0;
    const scale = card.isPressed ? 0.985 : 1;

    ctx.save();
    ctx.globalAlpha = reveal;
    ctx.translate(0, (1 - reveal) * 16);
    ctx.translate(card.x + card.w / 2, card.y + card.h / 2);
    ctx.scale(scale, scale);
    ctx.translate(-card.x - card.w / 2, -card.y - card.h / 2 + pressDepth);
    fillRoundRect(ctx, card.x, card.y, card.w, card.h, theme.radius.lg, theme.color.paper);
    strokeRoundRect(ctx, card.x, card.y, card.w, card.h, theme.radius.lg, theme.color.line, 1);
    if (card.isPressed) {
      fillRoundRect(ctx, card.x, card.y, card.w, card.h, theme.radius.lg, 'rgba(0, 0, 0, 0.035)');
    }
    ctx.fillStyle = accent;
    ctx.globalAlpha = 0.08;
    ctx.fillRect(card.x, card.y + 18, 4, card.h - 36);
    ctx.globalAlpha = reveal;

    drawText(ctx, index === 0 ? '01' : '02', card.x + 28, card.y + 32, {
      size: 13,
      color: theme.color.gold,
      align: 'left',
      baseline: 'middle',
      font: theme.font.body,
      weight: '600',
    });

    drawText(ctx, card.label, card.x + 28, card.y + 68, {
      size: 25,
      color: theme.color.ink,
      align: 'left',
      baseline: 'middle',
      font: theme.font.title,
      weight: '600',
    });

    drawText(ctx, card.detail, card.x + 28, card.y + 98, {
      size: 13,
      color: theme.color.muted,
      align: 'left',
      baseline: 'middle',
      font: theme.font.body,
    });

    this.renderCardMark(ctx, index, iconX, iconY, accent);

    ctx.strokeStyle = accent;
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.moveTo(card.x + card.w - 58, card.y + 72);
    ctx.lineTo(card.x + card.w - 31, card.y + 72);
    ctx.lineTo(card.x + card.w - 39, card.y + 65);
    ctx.moveTo(card.x + card.w - 31, card.y + 72);
    ctx.lineTo(card.x + card.w - 39, card.y + 79);
    ctx.stroke();
    ctx.restore();
  }

  renderCardMark(ctx, index, x, y, accent) {
    ctx.save();
    ctx.strokeStyle = accent;
    ctx.lineWidth = 1.2;
    ctx.globalAlpha *= 0.55;
    if (index === 0) {
      const size = 36;
      strokeRoundRect(ctx, x, y, size, size, 3, accent, 1);
      ctx.beginPath();
      ctx.moveTo(x + size / 3, y);
      ctx.lineTo(x + size / 3, y + size);
      ctx.moveTo(x + (size * 2) / 3, y);
      ctx.lineTo(x + (size * 2) / 3, y + size);
      ctx.moveTo(x, y + size / 3);
      ctx.lineTo(x + size, y + size / 3);
      ctx.moveTo(x, y + (size * 2) / 3);
      ctx.lineTo(x + size, y + (size * 2) / 3);
      ctx.stroke();
    } else {
      const blocks = [
        [0, 0, 2, 2],
        [2.3, 0, 1, 2],
        [0, 2.3, 1, 1],
        [1.2, 2.3, 2.1, 1],
      ];
      blocks.forEach((item) => {
        const unit = 10;
        strokeRoundRect(ctx, x + item[0] * unit, y + item[1] * unit, item[2] * unit, item[3] * unit, 4, accent, 1);
      });
    }
    ctx.restore();
  }

  onTouchStart(point) {
    const card = this.cards.find((item) => item.hit(point.x, point.y));
    if (card) {
      card.press();
    }
  }

  destroy() {
    this.cards.forEach((card) => card.destroy && card.destroy());
  }
}
