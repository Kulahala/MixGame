import Button from './button.js';
import { contains, drawText, fillRoundRect, strokeRoundRect } from './canvas.js';
import { easeOutBack, easeInQuad, smoothLerp } from './animation.js';

export default class ConfigModal {
  constructor(options) {
    this.host = options.host;
    this.game = options.game;
    this.title = options.title || '设置';
    this.options = options.options || [];
    this.onConfirm = options.onConfirm || function() {};
    this.onCancel = options.onCancel || function() {};
    
    this.selectedIndex = 0;
    this.pressedIndex = -1;
    this.buttons = [];

    // Rules States
    this.showRulesMode = false;
    this.rulesAlpha = 0;
    this.scrollY = 0;
    this.maxScrollY = 0;
    this.wrappedLines = [];
    this.isDraggingRules = false;
    this.isDraggingScrollbar = false;
    this.isTextWrapped = false; // Prevent multiple text wraps

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
    
    // Calculate optionsHeight dynamically based on the options length, button height 36, margins
    const optH = 36;
    const gap = 12;
    const btnH = 36;
    this.optionsHeight = 70 + this.options.length * (optH + gap) + 24 + btnH + 24;

    this.h = this.optionsHeight;
    this.targetH = this.optionsHeight;
    this.y = (height - this.h) / 2 - 20;
    this.x = (width - this.w) / 2;

    this.cancelBtn = new Button({
      x: this.x + 16,
      y: this.y + this.h - btnH - 24,
      w: 72,
      h: btnH,
      label: '取消',
      variant: 'ghost',
      onClick: () => this.onCancel()
    });

    this.rulesBtn = new Button({
      x: this.x + 104,
      y: this.y + this.h - btnH - 24,
      w: 72,
      h: btnH,
      label: '规则',
      variant: 'ghost',
      onClick: () => {
        this.showRulesMode = true;
        this.targetH = 320;
        this.scrollY = 0;
        this.pressedIndex = -1;
      }
    });

    this.confirmBtn = new Button({
      x: this.x + 192,
      y: this.y + this.h - btnH - 24,
      w: 72,
      h: btnH,
      label: '开始',
      variant: 'primary',
      onClick: () => this.onConfirm(this.options[this.selectedIndex].value)
    });

    this.backBtn = new Button({
      x: this.x + (this.w - 100) / 2,
      y: this.y + this.h - btnH - 24,
      w: 100,
      h: btnH,
      label: '返回',
      variant: 'primary',
      onClick: () => {
        this.showRulesMode = false;
        this.targetH = this.optionsHeight;
        this.scrollY = 0;
        this.pressedIndex = -1;
      }
    });

    this.buttons = [this.cancelBtn, this.rulesBtn, this.confirmBtn, this.backBtn];

    this.optionRects = [];
    const optYStart = this.y + 70;
    this.options.forEach((opt, idx) => {
      this.optionRects.push({
        x: this.x + 24,
        y: optYStart + idx * (optH + gap),
        w: this.w - 48,
        h: optH,
        index: idx
      });
    });

    this.updatePositions();
  }

  updatePositions() {
    this.y = (this.host.height - this.h) / 2 - 20;
    const btnY = this.y + this.h - 36 - 24;
    this.cancelBtn.y = btnY;
    this.rulesBtn.y = btnY;
    this.confirmBtn.y = btnY;
    this.backBtn.y = btnY;

    const optYStart = this.y + 70;
    const optH = 36;
    const gap = 12;
    this.optionRects.forEach((rect, idx) => {
      rect.y = optYStart + idx * (optH + gap);
    });
  }

  wrapText(ctx, text, maxWidth, fontSize, fontFace) {
    if (!text) return [];
    ctx.save();
    ctx.font = `${fontSize}px ${fontFace || 'sans-serif'}`;
    const lines = [];
    const paragraphs = text.split('\n');
    for (let p of paragraphs) {
      if (p.length === 0) {
        lines.push('');
        continue;
      }
      let currentLine = '';
      for (let i = 0; i < p.length; i++) {
        const char = p[i];
        const testLine = currentLine + char;
        const metrics = ctx.measureText(testLine);
        if (metrics.width > maxWidth && currentLine.length > 0) {
          lines.push(currentLine);
          currentLine = char;
        } else {
          currentLine = testLine;
        }
      }
      if (currentLine.length > 0) {
        lines.push(currentLine);
      }
    }
    ctx.restore();
    return lines;
  }

  render(ctx, theme) {
    const now = Date.now();
    const dt = this.lastRenderTime ? Math.min(50, now - this.lastRenderTime) : 16;
    this.lastRenderTime = now;

    if (this.isClosing) {
      this.animTime = Math.max(0, this.animTime - dt);
      const progress = this.animTime / this.animDuration;
      const ease = easeInQuad(progress);
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
        const progress = this.animTime / this.animDuration;
        const ease = easeOutBack(progress, 1.0);
        this.alpha = Math.min(1, progress * 1.4);
        this.scale = 0.8 + 0.2 * ease;
      }
    }

    // Smooth transition for height
    const targetHDiff = this.targetH - this.h;
    if (Math.abs(targetHDiff) < 0.1) {
      this.h = this.targetH;
    } else {
      this.h = smoothLerp(this.h, this.targetH, dt, 200);
    }

    // Smooth transition for rulesAlpha
    const targetAlpha = this.showRulesMode ? 1 : 0;
    const alphaDiff = targetAlpha - this.rulesAlpha;
    if (Math.abs(alphaDiff) < 0.001) {
      this.rulesAlpha = targetAlpha;
    } else {
      this.rulesAlpha = smoothLerp(this.rulesAlpha, targetAlpha, dt, 200);
    }

    this.updatePositions();

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

    // Cross-fade title text
    const oldTitleAlpha = ctx.globalAlpha;
    
    ctx.globalAlpha = oldTitleAlpha * (1 - this.rulesAlpha) * this.alpha;
    drawText(ctx, this.title, this.x + this.w / 2, this.y + 36, {
      size: 18,
      color: theme.color.ink,
      align: 'center',
      baseline: 'middle',
      font: theme.font.title,
      weight: '600'
    });

    ctx.globalAlpha = oldTitleAlpha * this.rulesAlpha * this.alpha;
    const gameName = (this.game && this.game.name) || '';
    drawText(ctx, `${gameName}玩法规则`, this.x + this.w / 2, this.y + 36, {
      size: 18,
      color: theme.color.ink,
      align: 'center',
      baseline: 'middle',
      font: theme.font.title,
      weight: '600'
    });

    ctx.globalAlpha = oldTitleAlpha;

    // Render options
    if (1 - this.rulesAlpha > 0.01) {
      const oldOptAlpha = ctx.globalAlpha;
      ctx.globalAlpha = oldOptAlpha * (1 - this.rulesAlpha) * this.alpha;
      
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
      
      ctx.globalAlpha = oldOptAlpha;
    }

    // Render rules text block
    if (this.rulesAlpha > 0.01) {
      const oldRulesAlpha = ctx.globalAlpha;
      ctx.globalAlpha = oldRulesAlpha * this.rulesAlpha * this.alpha;

      if (!this.isTextWrapped && ctx) {
        if (this.game && this.game.rules) {
          this.wrappedLines = this.wrapText(ctx, this.game.rules, this.w - 48, 13, theme.font.body);
        }
        this.isTextWrapped = true;
      }

      const clipX = this.x + 24;
      const clipY = this.y + 60;
      const clipW = this.w - 48;
      const clipH = Math.max(0, this.h - 132);

      ctx.save();
      ctx.beginPath();
      ctx.rect(clipX, clipY, clipW, clipH);
      ctx.clip();

      ctx.fillStyle = theme.color.ink;
      ctx.font = `13px ${theme.font.body || 'sans-serif'}`;
      ctx.textAlign = 'left';
      ctx.textBaseline = 'top';

      const lineHeight = 20;
      const totalHeight = this.wrappedLines.length * lineHeight;

      this.wrappedLines.forEach((line, index) => {
        const lineY = clipY + index * lineHeight - this.scrollY;
        if (lineY + lineHeight >= clipY && lineY <= clipY + clipH) {
          ctx.fillText(line, clipX, lineY);
        }
      });

      ctx.restore();

      this.maxScrollY = Math.max(0, totalHeight - clipH);
      if (this.scrollY > this.maxScrollY) this.scrollY = this.maxScrollY;
      if (totalHeight > clipH) {
        const trackX = this.x + this.w - 12;
        const trackY = clipY;
        const trackH = clipH;
        
        fillRoundRect(ctx, trackX, trackY, 3, trackH, 1.5, theme.color.line);

        const thumbH = Math.max(20, (clipH / totalHeight) * clipH);
        let thumbY = trackY;
        if (this.maxScrollY > 0) {
          thumbY = trackY + (this.scrollY / this.maxScrollY) * (trackH - thumbH);
        }

        fillRoundRect(ctx, trackX, thumbY, 3, thumbH, 1.5, theme.color.muted);
      }

      ctx.globalAlpha = oldRulesAlpha;
    }

    // Render buttons
    const oldBtnAlpha = ctx.globalAlpha;
    
    ctx.globalAlpha = oldBtnAlpha * (1 - this.rulesAlpha) * this.alpha;
    this.cancelBtn.render(ctx, theme);
    this.rulesBtn.render(ctx, theme);
    this.confirmBtn.render(ctx, theme);
    
    ctx.globalAlpha = oldBtnAlpha * this.rulesAlpha * this.alpha;
    this.backBtn.render(ctx, theme);
    
    ctx.globalAlpha = oldBtnAlpha;

    ctx.restore();
  }

  onTouchStart(x, y) {
    if (this.alpha < 0.9 || this.isClosing) {
      return true;
    }

    let hitBtn = false;
    if (this.showRulesMode && this.rulesAlpha > 0.9) {
      if (this.backBtn.onTouchStart(x, y)) {
        hitBtn = true;
      }
    } else if (!this.showRulesMode && this.rulesAlpha < 0.1) {
      if (this.cancelBtn.onTouchStart(x, y) || 
          this.rulesBtn.onTouchStart(x, y) || 
          this.confirmBtn.onTouchStart(x, y)) {
        hitBtn = true;
      }
    }
    if (hitBtn) return true;

    if (this.showRulesMode && this.rulesAlpha > 0.9) {
      const clipY = this.y + 60;
      const clipH = Math.max(0, this.h - 132);
      if (y >= clipY && y <= clipY + clipH && x >= this.x && x <= this.x + this.w) {
        if (x >= this.x + this.w - 24) {
          this.isDraggingScrollbar = true;
        } else {
          this.isDraggingRules = true;
        }
        this.touchStartY = y;
        this.startScrollY = this.scrollY;
        return true;
      }
    }

    if (!this.showRulesMode && this.rulesAlpha < 0.1) {
      const hitOpt = this.optionRects.find(rect => contains(rect, x, y));
      if (hitOpt) {
        this.pressedIndex = hitOpt.index;
        return true;
      }
    }

    return true;
  }

  onTouchMove(x, y) {
    if (this.alpha < 0.9 || this.isClosing) {
      return true;
    }

    if (this.showRulesMode && this.rulesAlpha > 0.9) {
      this.backBtn.onTouchMove(x, y);
    } else if (!this.showRulesMode && this.rulesAlpha < 0.1) {
      this.cancelBtn.onTouchMove(x, y);
      this.rulesBtn.onTouchMove(x, y);
      this.confirmBtn.onTouchMove(x, y);
    }

    if (this.showRulesMode && (this.isDraggingRules || this.isDraggingScrollbar)) {
      const dy = y - this.touchStartY;
      if (this.isDraggingRules) {
        this.scrollY = this.startScrollY - dy;
      } else if (this.isDraggingScrollbar) {
        const clipH = Math.max(0, this.h - 132);
        const lineHeight = 20;
        const totalHeight = this.wrappedLines.length * lineHeight;
        const thumbH = Math.max(20, (clipH / totalHeight) * clipH);
        const scrollRange = clipH - thumbH;
        if (scrollRange > 0) {
          const scrollFactor = this.maxScrollY / scrollRange;
          this.scrollY = this.startScrollY + dy * scrollFactor;
        }
      }
      if (this.scrollY < 0) this.scrollY = 0;
      if (this.scrollY > this.maxScrollY) this.scrollY = this.maxScrollY;
    }

    if (!this.showRulesMode && this.rulesAlpha < 0.1) {
      if (this.pressedIndex !== -1) {
        const hitOpt = this.optionRects.find(rect => contains(rect, x, y));
        if (!hitOpt || hitOpt.index !== this.pressedIndex) {
          this.pressedIndex = -1;
        }
      }
    }
  }

  onTouchEnd(x, y) {
    if (this.alpha < 0.9 || this.isClosing) {
      return true;
    }

    if (this.showRulesMode && this.rulesAlpha > 0.9) {
      this.backBtn.onTouchEnd(x, y);
    } else if (!this.showRulesMode && this.rulesAlpha < 0.1) {
      this.cancelBtn.onTouchEnd(x, y);
      this.rulesBtn.onTouchEnd(x, y);
      this.confirmBtn.onTouchEnd(x, y);
    }

    this.isDraggingRules = false;
    this.isDraggingScrollbar = false;

    if (!this.showRulesMode && this.rulesAlpha < 0.1) {
      if (this.pressedIndex !== -1) {
        const hitOpt = this.optionRects.find(rect => contains(rect, x, y));
        if (hitOpt && hitOpt.index === this.pressedIndex) {
          this.selectedIndex = this.pressedIndex;
        }
        this.pressedIndex = -1;
      }
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
