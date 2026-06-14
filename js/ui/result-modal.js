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
    ctx.fillStyle = 'rgba(0,0,0,0.4)';
    ctx.fillRect(0, 0, this.host.width, this.host.height);

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
  }

  onTouchStart(x, y) {
    let hitBtn = false;
    this.buttons.forEach(btn => {
      if (btn.onTouchStart(x, y)) hitBtn = true;
    });
    // 拦截一切触摸，防止穿透
    return true;
  }

  onTouchMove(x, y) {
    this.buttons.forEach(btn => btn.onTouchMove(x, y));
  }

  onTouchEnd(x, y) {
    this.buttons.forEach(btn => btn.onTouchEnd(x, y));
  }

  destroy() {
    this.buttons.forEach(btn => btn.destroy && btn.destroy());
  }
}
