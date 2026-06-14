import { contains, drawText, fillRoundRect, strokeRoundRect } from './canvas.js';

export default class Button {
  constructor(options) {
    this.x = options.x || 0;
    this.y = options.y || 0;
    this.w = options.w || 0;
    this.h = options.h || 0;
    this.label = options.label || '';
    this.detail = options.detail || '';
    this.variant = options.variant || 'primary';
    this.onClick = options.onClick || function noop() {};
    this.isPressed = false;
  }

  setFrame(x, y, w, h) {
    this.x = x;
    this.y = y;
    this.w = w;
    this.h = h;
  }

  hit(x, y) {
    return contains(this, x, y);
  }

  onTouchStart(x, y) {
    if (this.hit(x, y)) {
      this.isPressed = true;
      return true;
    }
    return false;
  }

  onTouchMove(x, y) {
    if (!this.isPressed) return;
    if (!this.hit(x, y)) {
      this.isPressed = false;
    }
  }

  onTouchEnd(x, y) {
    if (this.isPressed) {
      this.isPressed = false;
      if (this.hit(x, y)) {
        this.onClick();
      }
    }
  }

  release() {
    this.isPressed = false;
  }

  render(ctx, theme) {
    const isPrimary = this.variant === 'primary';
    const isGhost = this.variant === 'ghost';
    const bg = isPrimary ? theme.color.ink : isGhost ? theme.color.paper : theme.color.paperDeep;
    const border = isPrimary ? theme.color.ink : theme.color.line;
    const text = isPrimary ? theme.color.white : theme.color.ink;
    const pressDepth = this.isPressed ? 2 : 0;
    const scale = this.isPressed ? 0.985 : 1;

    ctx.save();
    ctx.translate(this.x + this.w / 2, this.y + this.h / 2);
    ctx.scale(scale, scale);
    ctx.translate(-this.x - this.w / 2, -this.y - this.h / 2 + pressDepth);

    fillRoundRect(ctx, this.x, this.y, this.w, this.h, theme.radius.md, bg);
    strokeRoundRect(ctx, this.x, this.y, this.w, this.h, theme.radius.md, border, 1);

    if (this.isPressed) {
      ctx.fillStyle = 'rgba(0, 0, 0, 0.04)';
      fillRoundRect(ctx, this.x, this.y, this.w, this.h, theme.radius.md, 'rgba(0, 0, 0, 0.04)');
    }

    drawText(ctx, this.label, this.x + this.w / 2, this.y + this.h / 2 - (this.detail ? 7 : 0), {
      size: this.detail ? 16 : 15,
      color: text,
      align: 'center',
      baseline: 'middle',
      font: theme.font.body,
      weight: isPrimary ? '600' : '500',
    });

    if (this.detail) {
      drawText(ctx, this.detail, this.x + this.w / 2, this.y + this.h / 2 + 14, {
        size: 11,
        color: isPrimary ? '#e8e2d9' : theme.color.muted,
        align: 'center',
        baseline: 'middle',
        font: theme.font.body,
      });
    }

    ctx.restore();
  }

  destroy() {
    this.release();
  }
}
