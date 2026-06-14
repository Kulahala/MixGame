import Button from '../ui/button.js';
import ConfigModal from '../ui/config-modal.js';
import { drawText, fillRoundRect, strokeRoundRect } from '../ui/canvas.js';
import { getScores } from '../core/storage.js';
import { GAMES } from '../games/registry.js';
import InputDispatcher from '../core/input-dispatcher.js';
import { getRandomQuote } from '../ui/quotes.js';

export default class MenuScene {
  constructor(host) {
    this.host = host;
    this.theme = host.theme;
    this.cards = [];
    this.scores = getScores();
    this.modal = null;
    this.input = new InputDispatcher();

    // 随机语录
    this.bottomQuote = getRandomQuote('menu');

    // Exit Animation States
    this.isExiting = false;
    this.exitTime = 0;
    this.exitDuration = 200; // ms
    this.exitCallback = null;

    // Touch-swipe navigation state
    this.currentPage = 0; // 0 = Classic, 1 = Modern
    this.swipeOffset = 0; // visual horizontal offset during dragging
    this.touchStartX = 0;
    this.touchStartY = 0;
    this.isDragging = false;

    // Swipe animation state
    this.currentOffset = 0; // Current visual offset
    this.targetOffset = 0;  // Target visual offset (0 or -width)
    this.swipeTime = 0;
    this.swipeStartOffset = 0;
  }

  update(dt = 16) {
    const { width } = this.host;

    // Handle horizontal page swiping animation
    if (this.isDragging) {
      this.currentOffset = -this.currentPage * width + this.swipeOffset;
    } else if (this.currentOffset !== this.targetOffset) {
      this.swipeTime += dt;
      const duration = 200; // ms
      const t = Math.min(1, this.swipeTime / duration);
      // easeOutCubic
      const ease = 1 - Math.pow(1 - t, 3);
      this.currentOffset = this.swipeStartOffset + (this.targetOffset - this.swipeStartOffset) * ease;
    }

    // Sync button physical positions for click/hit test and rendering
    this.cards.forEach((btn) => {
      btn.x = btn.baseX + btn.page * width + this.currentOffset;
    });

    // Existing exit animation logic
    if (this.isExiting) {
      this.exitTime = Math.min(this.exitDuration, this.exitTime + dt);
      if (this.exitTime >= this.exitDuration && this.exitCallback) {
        const cb = this.exitCallback;
        this.exitCallback = null;
        cb();
      }
    }
  }

  exit(callback) {
    this.isExiting = true;
    this.exitTime = 0;
    this.exitCallback = callback;
  }

  init() {
    const { width, height } = this.host;
    
    // Categorize games in registry
    const classicIds = ['sudoku', 'huarongdao', 'minesweeper', 'slitherlink'];
    this.classicGames = GAMES.filter(g => classicIds.includes(g.id));
    this.modernGames = GAMES.filter(g => !classicIds.includes(g.id));

    const cols = 2;
    const maxRows = Math.max(
      Math.ceil(this.classicGames.length / cols),
      Math.ceil(this.modernGames.length / cols)
    );

    const isSmallScreen = height < 700;
    // Increase topArea slightly to allocate space for category tabs
    const topArea = (isSmallScreen ? 130 : 170) + this.host.safeTop;
    const bottomArea = 42;

    const margin = 16;
    const colGap = 12;
    const rowGap = isSmallScreen ? 10 : 12;

    const cardW = Math.floor((width - margin * 2 - colGap) / 2);

    const availableHeight = height - topArea - bottomArea - rowGap * (maxRows - 1);
    let cardH = Math.floor(availableHeight / maxRows);
    cardH = Math.max(cardH, 80);
    cardH = Math.min(cardH, 140);

    this._layout = { cols, maxRows, margin, colGap, rowGap, cardW, cardH, topArea };
    this.cards = [];

    // Initialize Page 0 (Classic)
    this.classicGames.forEach((game, index) => {
      const col = index % cols;
      const row = Math.floor(index / cols);
      const x = margin + col * (cardW + colGap);
      const y = topArea + row * (cardH + rowGap);

      const scoreData = this.scores[game.id];
      const btn = new Button({
        x,
        y,
        w: cardW,
        h: cardH,
        label: game.name,
        detail: game.formatScore(scoreData),
        variant: 'secondary',
        onClick: () => this.showGameConfig(game),
      });
      btn.page = 0;
      btn.baseX = x;
      btn.game = game;
      btn.pageIndex = index;
      this.input.add(btn);
      this.cards.push(btn);
    });

    // Initialize Page 1 (Modern)
    this.modernGames.forEach((game, index) => {
      const col = index % cols;
      const row = Math.floor(index / cols);
      const x = margin + col * (cardW + colGap);
      const y = topArea + row * (cardH + rowGap);

      const scoreData = this.scores[game.id];
      const btn = new Button({
        x: x + width, // Shifted by width
        y,
        w: cardW,
        h: cardH,
        label: game.name,
        detail: game.formatScore(scoreData),
        variant: 'secondary',
        onClick: () => this.showGameConfig(game),
      });
      btn.page = 1;
      btn.baseX = x;
      btn.game = game;
      btn.pageIndex = index;
      this.input.add(btn);
      this.cards.push(btn);
    });
  }

  showGameConfig(game) {
    if (!game.configOptions || game.configOptions.length === 0) {
      this.exit(() => {
        this.host.startGame(game.id);
      });
      return;
    }

    this.modal = new ConfigModal({
      host: this.host,
      title: game.configTitle || `${game.name} 配置`,
      options: game.configOptions,
      onConfirm: (val) => {
        const options = val || {};
        this.closeModal(() => {
          this.exit(() => {
            this.host.startGame(game.id, options);
          });
        });
      },
      onCancel: () => this.closeModal()
    });
    this.input.add(this.modal);
  }

  closeModal(onClosed) {
    if (this.modal) {
      if (this.modal.close) {
        this.modal.close(() => {
          this.input.remove(this.modal);
          this.modal.destroy();
          this.modal = null;
          if (onClosed) onClosed();
        });
      } else {
        this.input.remove(this.modal);
        this.modal.destroy();
        this.modal = null;
        if (onClosed) onClosed();
      }
    }
  }

  render(ctx) {
    const { width, height } = this.host;
    const theme = this.theme;

    // 进场动画曲线：easeOutQuart (比线性更具阻尼感，快速冲入然后平滑减速)
    const progress = Math.min(1, this.host.sceneAge / 360);
    const ease = 1 - Math.pow(1 - progress, 4);
    const reveal = ease;

    // 退场动画曲线：easeInQuad (加速移出淡出)
    let exitAlpha = 1;
    let exitOffset = 0;
    if (this.isExiting) {
      const p = this.exitTime / this.exitDuration;
      const easeExit = p * p;
      exitAlpha = 1 - easeExit;
      exitOffset = -easeExit * 16;
    }
    ctx.clearRect(0, 0, width, height);
    ctx.fillStyle = theme.color.bg;
    ctx.fillRect(0, 0, width, height);

    ctx.save();
    ctx.globalAlpha = exitAlpha;
    ctx.translate(0, exitOffset);

    // Render Backdrop and Header info
    ctx.save();
    ctx.globalAlpha = exitAlpha * reveal;
    ctx.translate(0, (1 - reveal) * 10);
    this.renderBackdrop(ctx);

    const layout = this._layout || { topArea: 160 };
    const topArea = layout.topArea;
    const titleY = Math.round(topArea * 0.32);
    const subtitleY = Math.round(topArea * 0.52);
    const titleSize = topArea < 140 ? 26 : 32;
    const subtitleSize = topArea < 140 ? 12 : 13;

    drawText(ctx, '静游集', width / 2, titleY, {
      size: titleSize,
      color: theme.color.ink,
      align: 'center',
      baseline: 'middle',
      font: theme.font.title,
      weight: '600',
    });

    drawText(ctx, '安静一点的小游戏合集', width / 2, subtitleY, {
      size: subtitleSize,
      color: theme.color.muted,
      align: 'center',
      baseline: 'middle',
      font: theme.font.body,
    });

    // Draw Category Tabs and the sliding underline inside the header container
    this.renderCategoryTabs(ctx);
    ctx.restore();

    // Render game cards with offscreen culling
    this.cards.forEach((card, index) => {
      // Offscreen culling: skip rendering if cards are shifted completely out of view
      if (card.x + card.w < 0 || card.x > width) {
        return;
      }
      this.renderGameCard(ctx, card, index, exitAlpha);
    });

    drawText(ctx, this.bottomQuote, width / 2, height - 42, {
      size: 12,
      color: theme.color.faint,
      align: 'center',
      baseline: 'middle',
      font: theme.font.body,
    });

    ctx.restore();

    if (this.modal) {
      this.modal.render(ctx, theme);
    }
  }

  renderBackdrop(ctx) {
    const theme = this.theme;
    const width = this.host.width;
    const topArea = (this._layout && this._layout.topArea) || 160;

    const frameY = Math.round(topArea * 0.12);
    const frameH = Math.round(topArea * 0.65);
    const frameBottom = frameY + frameH;
    const lineY = frameBottom - 2;
    const crossY = Math.round(frameY + frameH * 0.46);

    fillRoundRect(ctx, 18, frameY, width - 36, frameH, 24, theme.color.paper);
    strokeRoundRect(ctx, 18, frameY, width - 36, frameH, 24, theme.color.line, 1);

    ctx.strokeStyle = theme.color.line;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(46, lineY);
    ctx.lineTo(width - 46, lineY);
    ctx.stroke();

    ctx.save();
    ctx.strokeStyle = theme.color.gold;
    ctx.globalAlpha = 0.28;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(width - 78, crossY);
    ctx.lineTo(width - 48, crossY);
    ctx.moveTo(width - 63, crossY - 15);
    ctx.lineTo(width - 63, crossY + 15);
    ctx.stroke();
    ctx.restore();
  }

  renderCategoryTabs(ctx) {
    const { width } = this.host;
    const theme = this.theme;
    const layout = this._layout || { topArea: 160 };
    const topArea = layout.topArea;
    const tabY = topArea - 28;

    // Calculate progress fraction (0 = Classic, 1 = Modern)
    const progress = -this.currentOffset / width;

    // Tab text colors
    const tab0Color = progress < 0.5 ? theme.color.ink : theme.color.muted;
    const tab1Color = progress >= 0.5 ? theme.color.ink : theme.color.muted;

    // Tab 0: 经典
    drawText(ctx, '经典', width / 2 - 60, tabY, {
      size: 15,
      color: tab0Color,
      align: 'center',
      baseline: 'middle',
      font: theme.font.title,
      weight: progress < 0.5 ? '600' : 'normal',
    });

    // Tab 1: 现代
    drawText(ctx, '现代', width / 2 + 60, tabY, {
      size: 15,
      color: tab1Color,
      align: 'center',
      baseline: 'middle',
      font: theme.font.title,
      weight: progress >= 0.5 ? '600' : 'normal',
    });

    // Sliding underline
    const underlineW = 32;
    const underlineH = 3;
    const underlineX = (width / 2 - 60) + progress * 120;
    const underlineY = tabY + 12;

    fillRoundRect(
      ctx,
      underlineX - underlineW / 2,
      underlineY - underlineH / 2,
      underlineW,
      underlineH,
      underlineH / 2,
      theme.color.accent
    );
  }

  renderGameCard(ctx, card, index, exitAlpha) {
    const theme = this.theme;
    const game = card.game;
    const accent = game.themeColor || theme.color.sage;
    const layout = this._layout || { cols: 1 };
    const cols = layout.cols;

    // 瀑布式弹性微弹进入动效：采用 easeOutBack 轻回弹
    const t = Math.min(1, Math.max(0, (this.host.sceneAge - index * 70) / 340));
    const c1 = 0.5; // 低调的回弹幅度
    const ease = t === 1 ? 1 : 1 + (c1 + 1) * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
    const reveal = Math.min(1, t * 1.5);

    const pressDepth = card.isPressed ? 3 : 0;
    const scale = card.isPressed ? 0.985 : 1;

    ctx.save();
    ctx.globalAlpha = exitAlpha * reveal;
    ctx.translate(0, (1 - ease) * 16);
    ctx.translate(card.x + card.w / 2, card.y + card.h / 2);
    ctx.scale(scale, scale);
    ctx.translate(-card.x - card.w / 2, -card.y - card.h / 2 + pressDepth);

    fillRoundRect(ctx, card.x, card.y, card.w, card.h, theme.radius.lg, theme.color.paper);
    strokeRoundRect(ctx, card.x, card.y, card.w, card.h, theme.radius.lg, theme.color.line, 1);
    if (card.isPressed) {
      fillRoundRect(ctx, card.x, card.y, card.w, card.h, theme.radius.lg, 'rgba(0, 0, 0, 0.035)');
    }

    ctx.fillStyle = accent;
    ctx.globalAlpha = exitAlpha * 0.08;
    ctx.fillRect(card.x, card.y + 18, 4, card.h - 36);
    ctx.globalAlpha = exitAlpha * reveal;

    // Card numbering and texts
    const displayIndex = card.pageIndex + 1; // 01, 02 per page style
    if (cols === 2) {
      const padX = 12;
      const numSize = 11;
      const nameSize = 16;
      const detailSize = 10;
      const iconSize = 32;
      const iconRadius = 6;
      const iconX = card.x + card.w - iconSize - 10;
      const iconY = card.y + card.h * 0.35 - iconSize / 2;

      drawText(ctx, String(displayIndex).padStart(2, '0'), card.x + padX, card.y + 16, {
        size: numSize,
        color: theme.color.gold,
        align: 'left',
        baseline: 'middle',
        font: theme.font.body,
        weight: '600',
      });

      drawText(ctx, card.label, card.x + padX, card.y + card.h * 0.45, {
        size: nameSize,
        color: theme.color.ink,
        align: 'left',
        baseline: 'middle',
        font: theme.font.title,
        weight: '600',
      });

      drawText(ctx, card.detail, card.x + padX, card.y + card.h * 0.72, {
        size: detailSize,
        color: theme.color.muted,
        align: 'left',
        baseline: 'middle',
        font: theme.font.body,
      });

      this.renderCardMark(ctx, game, iconX, iconY, accent, iconSize, iconRadius);

      const arrowCx = iconX + iconSize / 2;
      const arrowCy = iconY + iconSize + 10;
      ctx.strokeStyle = accent;
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(arrowCx - 10, arrowCy);
      ctx.lineTo(arrowCx + 10, arrowCy);
      ctx.lineTo(arrowCx + 2, arrowCy - 6);
      ctx.moveTo(arrowCx + 10, arrowCy);
      ctx.lineTo(arrowCx + 2, arrowCy + 6);
      ctx.stroke();
    } else {
      const iconX = card.x + card.w - 68;
      const iconY = card.y + 34;

      drawText(ctx, String(displayIndex).padStart(2, '0'), card.x + 28, card.y + 32, {
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
    }

    ctx.restore();
  }

  renderCardMark(ctx, game, x, y, accent, size = 36, radius = 8) {
    ctx.save();
    ctx.globalAlpha *= 0.8;
    fillRoundRect(ctx, x, y, size, size, radius, accent);
    drawText(ctx, game.iconText || '游', x + size / 2, y + size / 2 + 1, {
      size: Math.round(size * 0.55),
      color: this.theme.color.white,
      align: 'center',
      baseline: 'middle',
      font: this.theme.font.body,
      weight: '600'
    });
    ctx.restore();
  }

  onTouchStart(point) {
    if (this.isExiting) return;

    // Check if configuration modal is active
    if (this.modal) {
      this.input.onTouchStart(point.x, point.y);
      return;
    }

    const { width } = this.host;
    const layout = this._layout || { topArea: 160 };
    const topArea = layout.topArea;

    // Interactive Tab Clicking: Check if click is on the Category Tabs
    const tabY = topArea - 28;
    if (Math.abs(point.y - tabY) < 20) {
      // Tab 0 (Classic)
      if (Math.abs(point.x - (width / 2 - 60)) < 40) {
        if (this.currentPage !== 0) {
          this.currentPage = 0;
          this.targetOffset = 0;
          this.swipeStartOffset = this.currentOffset;
          this.swipeTime = 0;
        }
        return;
      }
      // Tab 1 (Modern)
      if (Math.abs(point.x - (width / 2 + 60)) < 40) {
        if (this.currentPage !== 1) {
          this.currentPage = 1;
          this.targetOffset = -width;
          this.swipeStartOffset = this.currentOffset;
          this.swipeTime = 0;
        }
        return;
      }
    }

    // Record swipe start details
    this.touchStartX = point.x;
    this.touchStartY = point.y;
    this.isDragging = false;
    this.swipeOffset = 0;

    // Also pass to button hit-testing
    this.input.onTouchStart(point.x, point.y);
  }

  onTouchMove(point) {
    if (this.isExiting) return;

    // Check if configuration modal is active
    if (this.modal) {
      this.input.onTouchMove(point.x, point.y);
      return;
    }

    const deltaX = point.x - this.touchStartX;
    const deltaY = point.y - this.touchStartY;

    if (!this.isDragging) {
      // Horizontal swipe threshold: 10px, and horizontal move must be dominant
      if (Math.abs(deltaX) > 10 && Math.abs(deltaX) > Math.abs(deltaY)) {
        this.isDragging = true;

        // Cancel any active button receiver (prevent clicking while swiping)
        if (this.input.activeReceiver) {
          if (this.input.activeReceiver.release) {
            this.input.activeReceiver.release();
          }
          this.input.activeReceiver = null;
        }
      }
    }

    if (this.isDragging) {
      // Apply rubber band resistance at boundaries
      if (this.currentPage === 0 && deltaX > 0) {
        this.swipeOffset = deltaX * 0.3;
      } else if (this.currentPage === 1 && deltaX < 0) {
        this.swipeOffset = deltaX * 0.3;
      } else {
        this.swipeOffset = deltaX;
      }
    } else {
      this.input.onTouchMove(point.x, point.y);
    }
  }

  onTouchEnd(point) {
    if (this.isExiting) return;

    // Check if configuration modal is active
    if (this.modal) {
      this.input.onTouchEnd(point.x, point.y);
      return;
    }

    if (this.isDragging) {
      const { width } = this.host;
      let targetPage = this.currentPage;
      const threshold = width * 0.25;

      if (this.swipeOffset < -threshold && this.currentPage === 0) {
        targetPage = 1;
      } else if (this.swipeOffset > threshold && this.currentPage === 1) {
        targetPage = 0;
      }

      this.currentPage = targetPage;
      this.targetOffset = -this.currentPage * width;
      this.swipeStartOffset = this.currentOffset;
      this.swipeTime = 0;
      this.isDragging = false;
      this.swipeOffset = 0;
    } else {
      this.input.onTouchEnd(point.x, point.y);
    }
  }

  destroy() {
    this.cards.forEach((card) => card.destroy && card.destroy());
    if (this.modal) {
      this.input.remove(this.modal);
      this.modal.destroy();
      this.modal = null;
    }
    this.input.clear();
  }
}
