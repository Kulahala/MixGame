import Button from './button.js';
import { contains, drawText, fillRoundRect, strokeRoundRect } from './canvas.js';

export default class ConfigModal {
  constructor(options) {
    this.host = options.host;
    this.title = options.title || '设置';
    this.options = options.options || [];
    this.onConfirm = options.onConfirm || function() {};
    this.onCancel = options.onCancel || function() {};
    
    this.selectedIndex = 0;
    this.pressedIndex = -1;
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
    this.h = 240;
    this.x = (width - this.w) / 2;
    this.y = (height - this.h) / 2 - 20;

    const btnW = 100;
    const btnH = 36;
    
    this.cancelBtn = new Button({
      x: this.x + 24,
      y: this.y + this.h - btnH - 24,
      w: btnW,
      h: btnH,
      label: '取消',
      variant: 'ghost',
      onClick: () => this.onCancel()
    });

    this.confirmBtn = new Button({
      x: this.x + this.w - btnW - 24,
      y: this.y + this.h - btnH - 24,
      w: btnW,
      h: btnH,
      label: '开始',
      variant: 'primary',
      onClick: () => this.onConfirm(this.options[this.selectedIndex].value)
    });

    this.buttons = [this.cancelBtn, this.confirmBtn];

    this.optionRects = [];
    const optYStart = this.y + 70;
    const optH = 36;
    const gap = 12;
    this.options.forEach((opt, idx) => {
      this.optionRects.push({
        x: this.x + 24,
        y: optYStart + idx * (optH + gap),
        w: this.w - 48,
        h: optH,
        index: idx
      });
    });
    
    this.h = 70 + this.options.length * (optH + gap) + 24 + btnH + 24;
    this.cancelBtn.y = this.y + this.h - btnH - 24;
    this.confirmBtn.y = this.y + this.h - btnH - 24;
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
      size: 18,
      color: theme.color.ink,
      align: 'center',
      baseline: 'middle',
      font: theme.font.title,
      weight: '600'
    });

    this.optionRects.forEach(rect => {
      const isSelected = rect.index === this.selectedIndex;
      const isPressed = rect.index === this.pressedIndex;
      
      let bg = isSelected ? theme.color.paperDeep : theme.color.bg;
      if (isPressed) bg = 'rgba(0, 0, 0, 0.05)';
      
      fillRoundRect(ctx, rect.x, rect.y, rect.w, rect.h, 8, bg);
      strokeRoundRect(ctx, rect.x, rect.y, rect.w, rect.h, 8, isSelected ? theme.color.gold : theme.color.line, isSelected ? 1.5 : 1);
      
      drawText(ctx, this.options[rect.index].label, rect.x + rect.w / 2, rect.y + rect.h / 2, {
        size: 14,
        color: isSelected ? theme.color.accentDeep : theme.color.ink,
        align: 'center',
        baseline: 'middle',
        font: theme.font.body,
        weight: isSelected ? '600' : 'normal'
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
    if (hitBtn) return true;

    const hitOpt = this.optionRects.find(rect => contains(rect, x, y));
    if (hitOpt) {
      this.pressedIndex = hitOpt.index;
      return true;
    }

    return true;
  }

  onTouchMove(x, y) {
    if (this.alpha < 0.9 || this.isClosing) {
      return true;
    }

    this.buttons.forEach(btn => btn.onTouchMove(x, y));
    if (this.pressedIndex !== -1) {
      const hitOpt = this.optionRects.find(rect => contains(rect, x, y));
      if (!hitOpt || hitOpt.index !== this.pressedIndex) {
        this.pressedIndex = -1;
      }
    }
  }

  onTouchEnd(x, y) {
    if (this.alpha < 0.9 || this.isClosing) {
      return true;
    }

    this.buttons.forEach(btn => btn.onTouchEnd(x, y));
    if (this.pressedIndex !== -1) {
      const hitOpt = this.optionRects.find(rect => contains(rect, x, y));
      if (hitOpt && hitOpt.index === this.pressedIndex) {
        this.selectedIndex = this.pressedIndex;
      }
      this.pressedIndex = -1;
    }
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
