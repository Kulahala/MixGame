import Button from './button.js';
import { contains, drawText, fillRoundRect, strokeRoundRect } from './canvas.js';

export default class ResultModal {
  constructor(options) {
    this.host = options.host;
    this.title = options.title || '通关！';
    this.stats = options.stats || []; // 格式：['用时：30s', '步数：120步']
    this.history = options.history || [];
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

    let historyExtraH = 0;
    if (this.history.length > 0) {
      historyExtraH = 16 + 20 + this.history.length * 24 + 8;
    }

    this.h = headerH + statsTotalH + padding + btnH + padding + historyExtraH;
    
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
      const progress = this.animTime / this.animDuration; // 从 1 降到 0
      const ease = progress * progress; // ease-in quad
      this.alpha = ease;
      this.scale = 0.8 + 0.2 * ease;
      if (this.animTime === 0 && this.closeCallback) {
        const cb = this.closeCallback;
        this.closeCallback = null;
        cb();
      }
    } else {
      if (this.animTime < this.animDuration) {
        this.animTime = Math.min(this.animDuration, this.animTime + dt);
        const progress = this.animTime / this.animDuration; // 从 0 升到 1
        
        // easeOutBack 弹性曲线
        const c1 = 1.0; // 缓和的弹性系数
        const ease = 1 + (c1 + 1) * Math.pow(progress - 1, 3) + c1 * Math.pow(progress - 1, 2);
        
        this.alpha = Math.min(1, progress * 1.4); // 稍微提前淡入完毕
        this.scale = 0.8 + 0.2 * ease;
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

    // ── History section ──────────────────────────────
    if (this.history.length > 0) {
      const statsEndY = this.y + 70 + this.stats.length * 28;
      let historyY = statsEndY;

      // Divider
      historyY += 8;
      ctx.strokeStyle = theme.color.line;
      ctx.lineWidth = 0.5;
      ctx.beginPath();
      ctx.moveTo(this.x + 24, historyY);
      ctx.lineTo(this.x + this.w - 24, historyY);
      ctx.stroke();

      // Title
      historyY += 8;
      drawText(ctx, '历史最佳', this.x + this.w / 2, historyY + 10, {
        size: 13,
        color: theme.color.muted,
        align: 'center',
        baseline: 'middle',
        font: theme.font.body,
      });

      // History entries
      historyY += 20;
      this.history.forEach((entry) => {
        drawText(ctx, entry.label, this.x + this.w / 2, historyY + 12, {
          size: 14,
          color: entry.highlight ? theme.color.gold : theme.color.ink,
          align: 'center',
          baseline: 'middle',
          font: theme.font.body,
          weight: entry.highlight ? '600' : undefined,
        });
        historyY += 24;
      });
    }

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
