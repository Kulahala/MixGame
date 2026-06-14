import Button from './button.js';
import { contains, drawText, fillRoundRect, strokeRoundRect } from './canvas.js';

export default class ResultModal {
  constructor(options) {
    this.host = options.host;
    this.title = options.title || '通关！';
    this.stats = options.stats || []; // 格式：['用时：30s', '步数：120步']
    this.onRestart = options.onRestart || function() {};
    this.onMenu = options.onMenu || function() {};
    
    this.buttons = [];

    // Animation States
    this.scale = 0.82;
    this.alpha = 0;
    this.animTime = 0;
    this.animDuration = 220; // ms
    this.isClosing = false;
    this.closeCallback = null;
    this.lastRenderTime = 0;

    this.init();
  }

  init() {
    const { width, height } = this.host;
    this.w = 280;
    
    const btnW = 100;
    const btnH = 36;
    const padding = 24;
    const headerH = 70;
    const statH = 28;
    const statsTotalH = this.stats.length * statH;

    this.h = headerH + statsTotalH + padding + btnH + padding;
    
    this.x = (width - this.w) / 2;
    this.y = (height - this.h) / 2 - 20;

    this.menuBtn = new Button({
      x: this.x + padding,
      y: this.y + this.h - btnH - padding,
      w: btnW,
      h: btnH,
      label: '返回大厅',
      variant: 'ghost',
      onClick: () => this.onMenu()
    });

    this.restartBtn = new Button({
      x: this.x + this.w - btnW - padding,
      y: this.y + this.h - btnH - padding,
      w: btnW,
      h: btnH,
      label: '再来一局',
      variant: 'primary',
      onClick: () => this.onRestart()
    });

    this.buttons = [this.menuBtn, this.restartBtn];
  }

  render(ctx, theme) {
    const now = Date.now();
    const dt = this.lastRenderTime ? Math.min(50, now - this.lastRenderTime) : 16;
    this.lastRenderTime = now;

    if (this.isClosing) {
      this.animTime = Math.max(0, this.animTime - dt);
      const progress = this.animTime / this.animDuration;
      this.alpha = progress;
      this.scale = 0.82 + 0.18 * progress;
      if (this.animTime === 0 && this.closeCallback) {
        const cb = this.closeCallback;
        this.closeCallback = null;
        cb();
      }
    } else {
      if (this.animTime < this.animDuration) {
        this.animTime = Math.min(this.animDuration, this.animTime + dt);
        const progress = this.animTime / this.animDuration;
        const ease = progress * (2 - progress); // ease-out quad
        this.alpha = ease;
        this.scale = 0.82 + 0.18 * ease;
      }
    }

    ctx.fillStyle = `rgba(0, 0, 0, ${0.45 * this.alpha})`;
    ctx.fillRect(0, 0, this.host.width, this.host.height);

    ctx.save();
    const centerX = this.x + this.w / 2;
    const centerY = this.y + this.h / 2;
    ctx.translate(centerX, centerY);
    ctx.scale(this.scale, this.scale);
    ctx.translate(-centerX, -centerY);

    fillRoundRect(ctx, this.x, this.y, this.w, this.h, theme.radius.lg, theme.color.paper);
    strokeRoundRect(ctx, this.x, this.y, this.w, this.h, theme.radius.lg, theme.color.line, 1);

    drawText(ctx, this.title, this.x + this.w / 2, this.y + 36, {
      size: 20,
      color: theme.color.ink,
      align: 'center',
      baseline: 'middle',
      font: theme.font.title,
      weight: '600'
    });

    this.stats.forEach((stat, idx) => {
      drawText(ctx, stat, this.x + this.w / 2, this.y + 70 + idx * 28, {
        size: 15,
        color: theme.color.muted,
        align: 'center',
        baseline: 'middle',
        font: theme.font.body
      });
    });

    this.buttons.forEach(btn => btn.render(ctx, theme));
    ctx.restore();
  }

  onTouchStart(x, y) {
    if (this.alpha < 0.9 || this.isClosing) {
      return true;
    }

    let hitBtn = false;
    this.buttons.forEach(btn => {
      if (btn.onTouchStart(x, y)) hitBtn = true;
    });
    // 拦截一切触摸，防止穿透
    return true;
  }

  onTouchMove(x, y) {
    if (this.alpha < 0.9 || this.isClosing) {
      return true;
    }
    this.buttons.forEach(btn => btn.onTouchMove(x, y));
  }

  onTouchEnd(x, y) {
    if (this.alpha < 0.9 || this.isClosing) {
      return true;
    }
    this.buttons.forEach(btn => btn.onTouchEnd(x, y));
  }

  close(callback) {
    this.isClosing = true;
    this.closeCallback = callback;
    this.animTime = this.animDuration;
  }

  destroy() {
    this.buttons.forEach(btn => btn.destroy && btn.destroy());
  }
}
