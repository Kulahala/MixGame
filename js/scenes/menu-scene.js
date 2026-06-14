import Button from '../ui/button.js';
import ConfigModal from '../ui/config-modal.js';
import { drawText, fillRoundRect, strokeRoundRect } from '../ui/canvas.js';
import { getScores } from '../core/storage.js';
import { GAMES } from '../games/registry.js';
import InputDispatcher from '../core/input-dispatcher.js';

export default class MenuScene {
  constructor(host) {
    this.host = host;
    this.theme = host.theme;
    this.cards = [];
    this.scores = getScores();
    this.modal = null;
    this.input = new InputDispatcher();
  }

  init() {
    const margin = 24;
    const cardW = this.host.width - margin * 2;
    const top = 188;
    const gap = 18;
    const cardH = 128;

    this.cards = GAMES.map((game, index) => {
      const scoreData = this.scores[game.id];
      const btn = new Button({
        x: margin,
        y: top + index * (cardH + gap),
        w: cardW,
        h: cardH,
        label: game.name,
        detail: game.formatScore(scoreData),
        variant: 'secondary',
        onClick: () => this.showGameConfig(game),
      });
      this.input.add(btn);
      return btn;
    });
  }

  showGameConfig(game) {
    if (!game.configOptions || game.configOptions.length === 0) {
      this.host.startGame(game.id);
      return;
    }
    
    this.modal = new ConfigModal({
      host: this.host,
      title: game.configTitle || `${game.name} 配置`,
      options: game.configOptions,
      onConfirm: (val) => {
        const options = val || {};
        this.host.startGame(game.id, options);
        this.closeModal();
      },
      onCancel: () => this.closeModal()
    });
    this.input.add(this.modal);
  }

  closeModal() {
    if (this.modal) {
      this.input.remove(this.modal);
      this.modal.destroy();
      this.modal = null;
    }
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

    if (this.modal) {
      this.modal.render(ctx, theme);
    }
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
    const game = GAMES[index];
    const accent = game.themeColor || theme.color.sage;
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

    drawText(ctx, String(index + 1).padStart(2, '0'), card.x + 28, card.y + 32, {
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

    this.renderCardMark(ctx, game, iconX, iconY, accent);

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

  renderCardMark(ctx, game, x, y, accent) {
    ctx.save();
    ctx.globalAlpha *= 0.8;
    fillRoundRect(ctx, x, y, 36, 36, 8, accent);
    drawText(ctx, game.iconText || '游', x + 18, y + 18 + 1, {
      size: 20,
      color: '#fff',
      align: 'center',
      baseline: 'middle',
      font: this.theme.font.body,
      weight: '600'
    });
    ctx.restore();
  }

  onTouchStart(point) {
    this.input.onTouchStart(point.x, point.y);
  }

  onTouchMove(point) {
    this.input.onTouchMove(point.x, point.y);
  }

  onTouchEnd(point) {
    this.input.onTouchEnd(point.x, point.y);
  }

  destroy() {
    this.cards.forEach((card) => card.destroy && card.destroy());
  }
}
