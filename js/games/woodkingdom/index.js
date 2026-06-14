import BaseGameScene from '../../core/game-scene-base.js';
import { saveScore, getHistory } from '../../core/storage.js';
import { WoodKingdomState, CARD_TYPES } from './state.js';
import { drawText, fillRoundRect, strokeRoundRect, contains, roundRect } from '../../ui/canvas.js';
import { getRandomQuote } from '../../ui/quotes.js';

export default class WoodKingdomScene extends BaseGameScene {
  constructor(host, options = {}) {
    super(host, options);
    this.reset();
  }

  init() {
    const width = this.host.width;
    const height = this.host.height;

    // Top buttons (back + reset)
    this.createTopButtons();

    // Setup grid parameters - 3 rows & compact sizes
    this.slotWidth = 58;
    this.slotHeight = 78;
    this.gap = 8;
    this.gridRowGap = 12;

    const gridW = 4 * this.slotWidth + 3 * this.gap;
    const gridH = 3 * this.slotHeight + 2 * this.gridRowGap; // 3 Rows

    this.gridX = Math.floor((width - gridW) / 2);

    // Ergonomic Layout Center-lower
    this.gridY = Math.floor((height - gridH) / 2) + 35;
    const safeLimit = this.host.safeTop + 125; // Slightly adapted to prevent overlap with notch
    if (this.gridY < safeLimit) {
      this.gridY = safeLimit;
    }

    // Layout for hand cards
    this.handCardWidth = 56;
    this.handCardHeight = 76;
    this.handY = height - 100;

    // Draw piles coordinates
    this.drawY = height - 165;
    this.pileWidth = 58;
    this.pileHeight = 40;

    // Arrange draw piles with balanced margins dynamically
    const drawGap = Math.floor((width - 4 * this.pileWidth - 32) / 3);
    const startDrawX = 16;

    this.squirrelPileRect = { x: startDrawX, y: this.drawY, w: this.pileWidth, h: this.pileHeight };
    this.sproutPileRect = { x: startDrawX + this.pileWidth + drawGap, y: this.drawY, w: this.pileWidth, h: this.pileHeight };
    this.deckPileRect = { x: startDrawX + 2 * (this.pileWidth + drawGap), y: this.drawY, w: this.pileWidth, h: this.pileHeight };
    this.endTurnRect = { x: width - 16 - (this.pileWidth + 14), y: this.drawY, w: this.pileWidth + 14, h: this.pileHeight };
  }

  reset() {
    this.closeModal();

    this.level = 1;
    this.campaignStartTime = Date.now();
    this.campaignDeck = [
      'sapling', 'sapling', 'bird', 'oak',
      'bifurcated_pine', 'deathtouch_mushroom',
      'nut_shield', 'grove_guardian'
    ];

    this.state = new WoodKingdomState(this.level);
    // Overwrite state deck with campaign deck
    this.state.deck = this.campaignDeck.map(id => this.state.createCard(id));
    this.state.deck.sort(() => Math.random() - 0.5);
    this.state.hand = [];
    for (let i = 0; i < 3; i++) {
      if (this.state.deck.length > 0) {
        this.state.hand.push(this.state.deck.shift());
      }
    }

    this.visualOpponentQueue = [null, null, null, null];
    this.syncVisualsWithState();

    this.currentTilt = 0;
    this.particles = [];
    this.floatingTexts = [];
    this.shieldGlowSlot = null;
    this.shieldGlowTimer = 0;

    this.animQueue = [];
    this.currentAnim = null;
    this.animTimer = 0;
    this.isResolvingTurn = false;

    this.selectedCardIndex = -1;
    this.hasDrawnThisTurn = false;
    this.showRewardModal = false;
    this.rewardCards = [];
    this.bottomQuote = getRandomQuote('woodkingdom') || '静心谋划，以草木筑造王国的荣光。';
  }

  syncVisualsWithState() {
    this.visualPlayerSlots = [...this.state.playerSlots].map(c => c ? { ...c } : null);
    this.visualOpponentSlots = [...this.state.opponentSlots].map(c => c ? { ...c } : null);
    this.visualOpponentQueue = [...this.state.opponentQueue].map(c => c ? { ...c } : null);
    this.visualResources = { ...this.state.resources };
    this.visualScaleTilt = this.state.scaleTilt;
  }

  spawnParticles(x, y, color) {
    // Spawn 10-15 particles from slot center
    const count = 10 + Math.floor(Math.random() * 6);
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 1.0 + Math.random() * 2.5;
      this.particles.push({
        x: x,
        y: y,
        vx: Math.cos(angle) * speed * 0.1,
        vy: Math.sin(angle) * speed * 0.1 - 0.08, // slightly upwards force
        color: color || this.theme.color.accent,
        size: 3 + Math.random() * 4,
        life: 180 + Math.random() * 40, // 150-220ms
        maxLife: 220
      });
    }
  }

  spawnFloatingText(text, x, y, color) {
    this.floatingTexts.push({
      text: text,
      x: x,
      y: y,
      color: color || this.theme.color.ink,
      life: 800,
      maxLife: 800
    });
  }

  update(dt = 16) {
    if (super.update(dt)) return;

    // Smooth tilt interpolation
    this.currentTilt += (this.visualScaleTilt - this.currentTilt) * 0.08;

    // Particle update
    if (this.particles.length > 0) {
      for (const p of this.particles) {
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.vy += 0.003 * dt; // gravity
        p.vx *= 0.95; // damping
        p.vy *= 0.95;
        p.life -= dt;
      }
      this.particles = this.particles.filter(p => p.life > 0);
    }

    // Floating text update
    if (this.floatingTexts.length > 0) {
      for (const ft of this.floatingTexts) {
        ft.y -= 0.02 * dt;
        ft.life -= dt;
      }
      this.floatingTexts = this.floatingTexts.filter(ft => ft.life > 0);
    }

    // Shield glow update
    if (this.shieldGlowTimer > 0) {
      this.shieldGlowTimer -= dt;
      if (this.shieldGlowTimer <= 0) {
        this.shieldGlowSlot = null;
      }
    }

    // Queue animation step update
    if (this.animQueue.length > 0 && !this.currentAnim) {
      this.currentAnim = this.animQueue.shift();
      this.animTimer = 0;
      this.animDuration = 180; // standard 180ms
      this.applyAnimStartEffects(this.currentAnim);
    }

    if (this.currentAnim) {
      this.animTimer += dt;
      if (this.animTimer >= this.animDuration) {
        this.currentAnim = null;
      }
    } else if (this.animQueue.length === 0 && this.isResolvingTurn) {
      this.isResolvingTurn = false;
      this.checkGameStatus();
    }
  }

  applyAnimStartEffects(anim) {
    const theme = this.theme;
    if (anim.type === 'opponent_play') {
      const card = { ...anim.card };
      this.visualOpponentQueue[anim.slotIndex] = card;
      const slotX = this.gridX + anim.slotIndex * (this.slotWidth + this.gap) + this.slotWidth / 2;
      this.spawnFloatingText(`敌方预备 ${card.name}`, slotX, this.gridY + this.slotHeight / 2, theme.color.danger);
    } else if (anim.type === 'opponent_advance') {
      const card = { ...anim.card };
      this.visualOpponentSlots[anim.slotIndex] = card;
      this.visualOpponentQueue[anim.slotIndex] = null;
      const slotX = this.gridX + anim.slotIndex * (this.slotWidth + this.gap) + this.slotWidth / 2;
      const slotY = this.gridY + this.slotHeight + this.gridRowGap + this.slotHeight / 2;
      this.spawnFloatingText('进击！', slotX, slotY - 20, theme.color.sage);
    } else if (anim.type === 'shield_break') {
      this.shieldGlowSlot = { side: anim.side, index: anim.slotIndex };
      this.shieldGlowTimer = 200; // Glow duration
      const slotX = this.gridX + anim.slotIndex * (this.slotWidth + this.gap) + this.slotWidth / 2;
      const slotY = (anim.side === 'player' ? this.gridY + 2 * (this.slotHeight + this.gridRowGap) : this.gridY + this.slotHeight + this.gridRowGap) + this.slotHeight / 2;
      this.spawnFloatingText('护盾破碎', slotX, slotY, theme.color.gold);

      const slots = anim.side === 'player' ? this.visualPlayerSlots : this.visualOpponentSlots;
      if (slots[anim.slotIndex]) {
        slots[anim.slotIndex].shieldActive = false;
      }
    } else if (anim.type === 'deathtouch_trigger') {
      const slotX = this.gridX + anim.slotIndex * (this.slotWidth + this.gap) + this.slotWidth / 2;
      const slotY = (anim.side === 'player' ? this.gridY + 2 * (this.slotHeight + this.gridRowGap) : this.gridY + this.slotHeight + this.gridRowGap) + this.slotHeight / 2;
      this.spawnFloatingText('剧毒致命！', slotX, slotY, theme.color.danger);
    } else if (anim.type === 'card_death') {
      const slotX = this.gridX + anim.slotIndex * (this.slotWidth + this.gap) + this.slotWidth / 2;
      const slotY = (anim.side === 'player' ? this.gridY + 2 * (this.slotHeight + this.gridRowGap) : this.gridY + this.slotHeight + this.gridRowGap) + this.slotHeight / 2;
      this.spawnParticles(slotX, slotY, anim.side === 'player' ? theme.color.accent : theme.color.muted);

      if (anim.side === 'player') {
        this.visualPlayerSlots[anim.slotIndex] = null;
      } else {
        this.visualOpponentSlots[anim.slotIndex] = null;
      }
    } else if (anim.type === 'combat_attack') {
      if (anim.direct) {
        this.visualScaleTilt = anim.scaleTilt;
        const scaleX = anim.attackerSide === 'player' ? this.host.width / 2 + 55 : this.host.width / 2 - 55;
        const scaleY = this.host.safeTop + 120;
        this.spawnFloatingText(`${anim.attackerSide === 'player' ? '+' : '-'}${anim.damage}`, scaleX, scaleY, anim.attackerSide === 'player' ? theme.color.sage : theme.color.danger);
      } else {
        const slots = anim.attackerSide === 'player' ? this.visualOpponentSlots : this.visualPlayerSlots;
        const targetCard = slots[anim.targetSlot];
        if (targetCard) {
          if (!anim.blocked) {
            targetCard.hp = Math.max(0, targetCard.hp - anim.damage);
          }
          const slotX = this.gridX + anim.targetSlot * (this.slotWidth + this.gap) + this.slotWidth / 2;
          const slotY = (anim.attackerSide === 'player' ? this.gridY + this.slotHeight + this.gridRowGap : this.gridY + 2 * (this.slotHeight + this.gridRowGap)) + this.slotHeight / 2;
          this.spawnFloatingText(anim.blocked ? '抵挡' : `-${anim.damage}`, slotX, slotY, anim.blocked ? theme.color.gold : theme.color.danger);
        }
      }
    } else if (anim.type === 'resource_gain') {
      this.visualResources[anim.resource] += anim.amount;
      const resIdx = anim.resource === 'raindrop' ? 0 : anim.resource === 'wood' ? 1 : anim.resource === 'acorn' ? 2 : 3;
      const resX = this.host.width / 2 - 110 + resIdx * 65;
      this.spawnFloatingText(`+${anim.amount}`, resX, this.gridY - 20, theme.color.sage);
    }
  }

  checkGameStatus() {
    const status = this.state.isGameOver();
    if (status.finished) {
      if (status.won) {
        if (this.state.level === 3) {
          const elapsed = Math.floor((Date.now() - this.campaignStartTime) / 1000);
          saveScore('woodkingdom', { score: 100, time: elapsed, won: true });
          const history = getHistory('woodkingdom').map(h => ({
            label: `${h.time}s`,
            highlight: h.time === elapsed
          }));
          this.showResult('战役大胜利！', [
            `总用时：${elapsed}s`,
            `战绩：完美通关`
          ], true, history);
        } else {
          // Card choice reward
          const pool = ['oak', 'bird', 'bifurcated_pine', 'deathtouch_mushroom', 'nut_shield', 'grove_guardian'];
          const shuffled = pool.sort(() => Math.random() - 0.5);
          this.rewardCards = shuffled.slice(0, 3);
          this.showRewardModal = true;
        }
      } else {
        // Lose
        this.showResult('挑战失败', [
          `败于第 ${this.state.level} 关`
        ], false, []);
      }
    }
  }

  drawMechanicalScale(ctx) {
    const theme = this.theme;
    const centerX = this.host.width / 2;
    const pivotY = this.host.safeTop + 85;
    const beamHalfLength = 45;
    const hangingLength = 18;

    const angle = this.currentTilt * 0.05; // rad
    const cosA = Math.cos(angle);
    const sinA = Math.sin(angle);

    ctx.save();

    // 1. Draw Stand/Base
    ctx.strokeStyle = theme.color.muted;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(centerX, pivotY);
    ctx.lineTo(centerX, pivotY + 25);
    ctx.moveTo(centerX - 15, pivotY + 25);
    ctx.lineTo(centerX + 15, pivotY + 25);
    ctx.stroke();

    ctx.fillStyle = theme.color.accent;
    ctx.beginPath();
    ctx.arc(centerX, pivotY, 4, 0, Math.PI * 2);
    ctx.fill();

    // 2. Draw Beam
    const lx = centerX - beamHalfLength * cosA;
    const ly = pivotY - beamHalfLength * sinA;
    const rx = centerX + beamHalfLength * cosA;
    const ry = pivotY + beamHalfLength * sinA;

    ctx.strokeStyle = theme.color.ink;
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(lx, ly);
    ctx.lineTo(rx, ry);
    ctx.stroke();

    // 3. Draw Pans
    const opponentPanX = lx;
    const opponentPanY = ly + hangingLength;
    ctx.strokeStyle = theme.color.muted;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(lx, ly);
    ctx.lineTo(opponentPanX - 10, opponentPanY);
    ctx.moveTo(lx, ly);
    ctx.lineTo(opponentPanX + 10, opponentPanY);
    ctx.moveTo(opponentPanX - 14, opponentPanY);
    ctx.lineTo(opponentPanX + 14, opponentPanY);
    ctx.stroke();

    const playerPanX = rx;
    const playerPanY = ry + hangingLength;
    ctx.beginPath();
    ctx.moveTo(rx, ry);
    ctx.lineTo(playerPanX - 10, playerPanY);
    ctx.moveTo(rx, ry);
    ctx.lineTo(playerPanX + 10, playerPanY);
    ctx.moveTo(playerPanX - 14, playerPanY);
    ctx.lineTo(playerPanX + 14, playerPanY);
    ctx.stroke();

    // 4. Draw Weights
    const weightsCount = Math.floor(Math.abs(this.visualScaleTilt));
    if (weightsCount > 0) {
      const heavierPanX = this.visualScaleTilt > 0 ? playerPanX : opponentPanX;
      const heavierPanY = this.visualScaleTilt > 0 ? playerPanY : opponentPanY;

      ctx.fillStyle = theme.color.gold;
      for (let i = 0; i < weightsCount; i++) {
        const bx = heavierPanX - 5 + (i % 3) * 4;
        const by = heavierPanY - 4 - Math.floor(i / 3) * 4;
        ctx.fillRect(bx, by, 3, 3);
      }
    }

    ctx.restore();

    // Draw scale text indicator
    const tiltText = this.visualScaleTilt > 0 ? `+${this.visualScaleTilt}` : `${this.visualScaleTilt}`;
    drawText(ctx, `天平: ${tiltText}`, centerX, pivotY - 16, {
      size: 11,
      color: this.visualScaleTilt > 0 ? theme.color.sage : this.visualScaleTilt < 0 ? theme.color.danger : theme.color.ink,
      align: 'center',
      baseline: 'middle',
      font: theme.font.title,
      weight: 'bold'
    });
  }

  drawEmptySlot(ctx, x, y, w, h, index, isPlayerSide, label = '') {
    const theme = this.theme;
    const radius = theme.radius.sm;

    fillRoundRect(ctx, x, y, w, h, radius, theme.color.bg);

    ctx.save();
    ctx.strokeStyle = theme.color.line;
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 4]);
    roundRect(ctx, x, y, w, h, radius);
    ctx.stroke();
    ctx.restore();

    if (label) {
      drawText(ctx, label, x + w / 2, y + h / 2, {
        size: 12,
        color: theme.color.line,
        align: 'center',
        baseline: 'middle',
        font: theme.font.body
      });
    }
  }

  drawCard(ctx, card, x, y, w, h, isPlayerSide, isQueue = false) {
    const theme = this.theme;
    const radius = theme.radius.sm;

    ctx.save();
    if (isQueue) {
      ctx.globalAlpha = 0.65; // Fade opponent queue cards slightly
    }

    fillRoundRect(ctx, x, y, w, h, radius, theme.color.paper);

    let borderColor = theme.color.line;
    let borderWidth = 1;

    if (card.shieldActive) {
      borderColor = theme.color.gold;
      borderWidth = 2.0;
    } else if (isPlayerSide) {
      borderColor = theme.color.sage;
      borderWidth = 1.5;
    } else {
      borderColor = theme.color.accent;
      borderWidth = 1.5;
    }

    strokeRoundRect(ctx, x, y, w, h, radius, borderColor, borderWidth);

    // Name
    drawText(ctx, card.name, x + w / 2, y + 14, {
      size: 11,
      color: theme.color.ink,
      align: 'center',
      baseline: 'middle',
      font: theme.font.title,
      weight: 'bold'
    });

    // Sigils
    if (card.sigils && card.sigils.length > 0) {
      const sigilNames = card.sigils.map(s => {
        if (s === 'airborne') return '飞行';
        if (s === 'bifurcated') return '分叉';
        if (s === 'deathtouch') return '剧毒';
        if (s === 'shield') return '护盾';
        return s;
      }).join(' ');

      drawText(ctx, sigilNames, x + w / 2, y + h / 2 - 2, {
        size: 9,
        color: theme.color.muted,
        align: 'center',
        baseline: 'middle',
        font: theme.font.body
      });
    }

    // Stats
    drawText(ctx, `${card.attack}`, x + 8, y + h - 10, {
      size: 11,
      color: theme.color.accent,
      align: 'left',
      baseline: 'middle',
      font: theme.font.title,
      weight: 'bold'
    });

    drawText(ctx, `${card.hp}/${card.maxHp}`, x + w - 8, y + h - 10, {
      size: 11,
      color: theme.color.sage,
      align: 'right',
      baseline: 'middle',
      font: theme.font.title,
      weight: 'bold'
    });

    ctx.restore();
  }

  drawHandCard(ctx, card, x, y, w, h, isSelected) {
    const theme = this.theme;
    const radius = theme.radius.sm;

    fillRoundRect(ctx, x, y, w, h, radius, isSelected ? theme.color.paperDeep : theme.color.paper);

    const borderColor = isSelected ? theme.color.gold : theme.color.line;
    const borderWidth = isSelected ? 2.5 : 1;
    strokeRoundRect(ctx, x, y, w, h, radius, borderColor, borderWidth);

    // Name
    drawText(ctx, card.name, x + w / 2, y + 16, {
      size: 11,
      color: theme.color.ink,
      align: 'center',
      baseline: 'middle',
      font: theme.font.title,
      weight: 'bold'
    });

    // Cost
    let costStr = '';
    const cost = card.cost || {};
    if (cost.raindrop > 0) costStr += `💧${cost.raindrop}`;
    if (cost.wood > 0) costStr += `🪵${cost.wood}`;
    if (cost.acorn > 0) costStr += `🌰${cost.acorn}`;
    if (cost.leaves > 0) costStr += `🍃${cost.leaves}`;
    if (!costStr) costStr = '免费';

    drawText(ctx, costStr, x + w / 2, y + 36, {
      size: 9,
      color: theme.color.muted,
      align: 'center',
      baseline: 'middle',
      font: theme.font.body
    });

    // Sigils
    if (card.sigils && card.sigils.length > 0) {
      const sigilsText = card.sigils.map(s => {
        if (s === 'airborne') return '飞行';
        if (s === 'bifurcated') return '分叉';
        if (s === 'deathtouch') return '剧毒';
        if (s === 'shield') return '护盾';
        return s;
      }).join(' ');

      drawText(ctx, sigilsText, x + w / 2, y + h / 2 + 10, {
        size: 9,
        color: theme.color.blue,
        align: 'center',
        baseline: 'middle',
        font: theme.font.body
      });
    }

    // Stats
    drawText(ctx, `${card.attack}`, x + 8, y + h - 10, {
      size: 11,
      color: theme.color.accent,
      align: 'left',
      baseline: 'middle',
      font: theme.font.title,
      weight: 'bold'
    });

    drawText(ctx, `${card.hp}`, x + w - 8, y + h - 10, {
      size: 11,
      color: theme.color.sage,
      align: 'right',
      baseline: 'middle',
      font: theme.font.title,
      weight: 'bold'
    });
  }

  renderGame(ctx) {
    const theme = this.theme;
    const width = this.host.width;
    const height = this.host.height;

    // Compact Title & Level info
    drawText(ctx, `森之王国 · 第 ${this.state.level}/3 关 · 回合 ${this.state.turn}`, width / 2, this.host.safeTop + 40, {
      size: 14,
      color: theme.color.ink,
      align: 'center',
      baseline: 'middle',
      font: theme.font.title,
      weight: 'bold'
    });

    // Draw mechanical scale
    this.drawMechanicalScale(ctx);

    // Draw resources bar (just above grid Row 0)
    const resY = this.gridY - 16;
    const rx1 = width / 2 - 105;
    const rx2 = width / 2 - 40;
    const rx3 = width / 2 + 25;
    const rx4 = width / 2 + 90;

    ctx.fillStyle = theme.color.blue;
    ctx.beginPath();
    ctx.arc(rx1, resY, 4, 0, Math.PI * 2);
    ctx.fill();
    drawText(ctx, `雨露:${this.visualResources.raindrop}`, rx1 + 8, resY, {
      size: 10, color: theme.color.ink, align: 'left', baseline: 'middle', font: theme.font.body
    });

    ctx.fillStyle = theme.color.accent;
    ctx.beginPath();
    ctx.arc(rx2, resY, 4, 0, Math.PI * 2);
    ctx.fill();
    drawText(ctx, `木材:${this.visualResources.wood}`, rx2 + 8, resY, {
      size: 10, color: theme.color.ink, align: 'left', baseline: 'middle', font: theme.font.body
    });

    ctx.fillStyle = theme.color.gold;
    ctx.beginPath();
    ctx.arc(rx3, resY, 4, 0, Math.PI * 2);
    ctx.fill();
    drawText(ctx, `橡果:${this.visualResources.acorn}`, rx3 + 8, resY, {
      size: 10, color: theme.color.ink, align: 'left', baseline: 'middle', font: theme.font.body
    });

    ctx.fillStyle = theme.color.sage;
    ctx.beginPath();
    ctx.arc(rx4, resY, 4, 0, Math.PI * 2);
    ctx.fill();
    drawText(ctx, `树叶:${this.visualResources.leaves}`, rx4 + 8, resY, {
      size: 10, color: theme.color.ink, align: 'left', baseline: 'middle', font: theme.font.body
    });

    // Draw 3x4 card grid
    // Row 0: Opponent Queue (预备区)
    for (let i = 0; i < 4; i++) {
      const slotX = this.gridX + i * (this.slotWidth + this.gap);
      const slotY = this.gridY;
      const card = this.visualOpponentQueue[i];

      if (!card) {
        this.drawEmptySlot(ctx, slotX, slotY, this.slotWidth, this.slotHeight, i, false, '备');
      } else {
        ctx.save();
        if (this.currentAnim && this.currentAnim.type === 'opponent_play' && this.currentAnim.slotIndex === i) {
          const p = this.animTimer / this.animDuration;
          ctx.globalAlpha = p * 0.7; // fade-in
        }
        this.drawCard(ctx, card, slotX, slotY, this.slotWidth, this.slotHeight, false, true);
        ctx.restore();
      }
    }

    // Row 1: Opponent Frontline (敌方前线)
    for (let i = 0; i < 4; i++) {
      const slotX = this.gridX + i * (this.slotWidth + this.gap);
      const slotY = this.gridY + this.slotHeight + this.gridRowGap;
      const card = this.visualOpponentSlots[i];

      if (!card) {
        this.drawEmptySlot(ctx, slotX, slotY, this.slotWidth, this.slotHeight, i, false, '');
      } else {
        ctx.save();
        if (this.currentAnim && this.currentAnim.type === 'opponent_advance' && this.currentAnim.slotIndex === i) {
          const p = this.animTimer / this.animDuration;
          const easeP = 1 - Math.pow(1 - p, 3); // easeOutCubic
          const startY = this.gridY;
          const currentY = startY + (slotY - startY) * easeP;
          ctx.translate(0, currentY - slotY);
        } else if (this.currentAnim && this.currentAnim.type === 'combat_attack' && this.currentAnim.attackerSide === 'opponent' && this.currentAnim.fromSlot === i) {
          const p = this.animTimer / this.animDuration;
          const t = Math.sin(p * Math.PI);
          let tx = 0, ty = 0;
          if (this.currentAnim.direct) {
            ty = t * 25; // lunge down towards player side
          } else {
            const targetX = this.gridX + this.currentAnim.targetSlot * (this.slotWidth + this.gap);
            tx = t * (targetX - slotX);
            ty = t * (this.slotHeight + this.gridRowGap); // hit player frontline
          }
          if (card.sigils.includes('airborne')) {
            ty -= 10 * Math.sin(p * Math.PI);
          }
          if (card.sigils.includes('bifurcated')) {
            tx += Math.sin(p * Math.PI * 5) * 5;
          }
          ctx.translate(tx, ty);
        }
        this.drawCard(ctx, card, slotX, slotY, this.slotWidth, this.slotHeight, false, false);
        ctx.restore();
      }

      // Shield glow
      if (this.shieldGlowSlot && this.shieldGlowSlot.side === 'opponent' && this.shieldGlowSlot.index === i) {
        ctx.save();
        ctx.strokeStyle = theme.color.gold;
        ctx.lineWidth = 2.5;
        roundRect(ctx, slotX - 1.5, slotY - 1.5, this.slotWidth + 3, this.slotHeight + 3, theme.radius.sm);
        ctx.stroke();
        ctx.restore();
      }
    }

    // Row 2: Player Frontline (玩家前线)
    for (let i = 0; i < 4; i++) {
      const slotX = this.gridX + i * (this.slotWidth + this.gap);
      const slotY = this.gridY + 2 * (this.slotHeight + this.gridRowGap);
      const card = this.visualPlayerSlots[i];

      if (!card) {
        this.drawEmptySlot(ctx, slotX, slotY, this.slotWidth, this.slotHeight, i, true, `${i}`);
      } else {
        ctx.save();
        if (this.currentAnim && this.currentAnim.type === 'combat_attack' && this.currentAnim.attackerSide === 'player' && this.currentAnim.fromSlot === i) {
          const p = this.animTimer / this.animDuration;
          const t = Math.sin(p * Math.PI);
          let tx = 0, ty = 0;
          if (this.currentAnim.direct) {
            ty = -t * 25; // lunge up towards opponent side
          } else {
            const targetX = this.gridX + this.currentAnim.targetSlot * (this.slotWidth + this.gap);
            tx = t * (targetX - slotX);
            ty = -t * (this.slotHeight + this.gridRowGap); // hit opponent frontline (Row 1)
          }
          if (card.sigils.includes('airborne')) {
            ty -= 10 * Math.sin(p * Math.PI);
          }
          if (card.sigils.includes('bifurcated')) {
            tx += Math.sin(p * Math.PI * 5) * 5;
          }
          ctx.translate(tx, ty);
        }
        this.drawCard(ctx, card, slotX, slotY, this.slotWidth, this.slotHeight, true, false);
        ctx.restore();

        // Sacrifice button
        if (!this.isResolvingTurn && !this.showRewardModal && !this.modal) {
          const btnSize = 16;
          const bx = slotX + this.slotWidth - btnSize - 2;
          const by = slotY + 2;
          fillRoundRect(ctx, bx, by, btnSize, btnSize, 4, theme.color.danger);
          drawText(ctx, '祭', bx + btnSize / 2, by + btnSize / 2 + 1, {
            size: 9,
            color: theme.color.paper,
            align: 'center',
            baseline: 'middle',
            font: theme.font.body,
            weight: 'bold'
          });
        }
      }

      // Shield glow
      if (this.shieldGlowSlot && this.shieldGlowSlot.side === 'player' && this.shieldGlowSlot.index === i) {
        ctx.save();
        ctx.strokeStyle = theme.color.gold;
        ctx.lineWidth = 2.5;
        roundRect(ctx, slotX - 1.5, slotY - 1.5, this.slotWidth + 3, this.slotHeight + 3, theme.radius.sm);
        ctx.stroke();
        ctx.restore();
      }
    }

    // Particles
    if (this.particles.length > 0) {
      for (const p of this.particles) {
        ctx.save();
        ctx.globalAlpha = p.life / p.maxLife;
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size / 2, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }
    }

    // Floating texts
    for (const ft of this.floatingTexts) {
      ctx.save();
      ctx.globalAlpha = ft.life / ft.maxLife;
      drawText(ctx, ft.text, ft.x, ft.y, {
        size: 12,
        color: ft.color,
        align: 'center',
        baseline: 'middle',
        font: theme.font.title,
        weight: 'bold'
      });
      ctx.restore();
    }

    // Draw piles & hand cards
    if (!this.showRewardModal) {
      // Squirrel Pile
      fillRoundRect(ctx, this.squirrelPileRect.x, this.squirrelPileRect.y, this.squirrelPileRect.w, this.squirrelPileRect.h, theme.radius.sm, theme.color.paper);
      strokeRoundRect(ctx, this.squirrelPileRect.x, this.squirrelPileRect.y, this.squirrelPileRect.w, this.squirrelPileRect.h, theme.radius.sm, theme.color.line);
      drawText(ctx, '松鼠堆', this.squirrelPileRect.x + this.pileWidth / 2, this.squirrelPileRect.y + 13, {
        size: 10, color: theme.color.ink, align: 'center', baseline: 'middle', font: theme.font.title, weight: 'bold'
      });
      drawText(ctx, '∞', this.squirrelPileRect.x + this.pileWidth / 2, this.squirrelPileRect.y + 27, {
        size: 11, color: theme.color.muted, align: 'center', baseline: 'middle', font: theme.font.body
      });

      // Sprout Pile
      fillRoundRect(ctx, this.sproutPileRect.x, this.sproutPileRect.y, this.sproutPileRect.w, this.sproutPileRect.h, theme.radius.sm, theme.color.paper);
      strokeRoundRect(ctx, this.sproutPileRect.x, this.sproutPileRect.y, this.sproutPileRect.w, this.sproutPileRect.h, theme.radius.sm, theme.color.line);
      drawText(ctx, '嫩芽堆', this.sproutPileRect.x + this.pileWidth / 2, this.sproutPileRect.y + 13, {
        size: 10, color: theme.color.ink, align: 'center', baseline: 'middle', font: theme.font.title, weight: 'bold'
      });
      drawText(ctx, '∞', this.sproutPileRect.x + this.pileWidth / 2, this.sproutPileRect.y + 27, {
        size: 11, color: theme.color.muted, align: 'center', baseline: 'middle', font: theme.font.body
      });

      // Deck Pile
      fillRoundRect(ctx, this.deckPileRect.x, this.deckPileRect.y, this.deckPileRect.w, this.deckPileRect.h, theme.radius.sm, theme.color.paper);
      strokeRoundRect(ctx, this.deckPileRect.x, this.deckPileRect.y, this.deckPileRect.w, this.deckPileRect.h, theme.radius.sm, theme.color.line);
      drawText(ctx, '牌组堆', this.deckPileRect.x + this.pileWidth / 2, this.deckPileRect.y + 13, {
        size: 10, color: theme.color.ink, align: 'center', baseline: 'middle', font: theme.font.title, weight: 'bold'
      });
      drawText(ctx, `${this.state.deck.length}张`, this.deckPileRect.x + this.pileWidth / 2, this.deckPileRect.y + 27, {
        size: 9, color: theme.color.muted, align: 'center', baseline: 'middle', font: theme.font.body
      });

      // End Turn Button
      const isDActive = !this.isResolvingTurn && !this.modal;
      fillRoundRect(ctx, this.endTurnRect.x, this.endTurnRect.y, this.endTurnRect.w, this.endTurnRect.h, theme.radius.sm, isDActive ? theme.color.accent : theme.color.paperDeep);
      strokeRoundRect(ctx, this.endTurnRect.x, this.endTurnRect.y, this.endTurnRect.w, this.endTurnRect.h, theme.radius.sm, isDActive ? theme.color.accent : theme.color.line);
      drawText(ctx, '回合结束', this.endTurnRect.x + this.endTurnRect.w / 2, this.endTurnRect.y + this.endTurnRect.h / 2, {
        size: 11, color: isDActive ? theme.color.paper : theme.color.muted, align: 'center', baseline: 'middle', font: theme.font.title, weight: 'bold'
      });

      // Hand cards
      const hand = this.state.hand;
      const cardW = this.handCardWidth;
      const cardH = this.handCardHeight;
      const gap = 8;
      const totalW = hand.length * cardW + (hand.length - 1) * gap;
      const startX = Math.floor((width - totalW) / 2);

      for (let i = 0; i < hand.length; i++) {
        const cx = startX + i * (cardW + gap);
        const cy = this.handY;
        const isSelected = (this.selectedCardIndex === i);

        if (isSelected) {
          ctx.save();
          this.drawHandCard(ctx, hand[i], cx, cy - 8, cardW, cardH, true);
          ctx.restore();
        } else {
          this.drawHandCard(ctx, hand[i], cx, cy, cardW, cardH, false);
        }
      }
    }

    // Bottom Quote
    drawText(ctx, this.bottomQuote, width / 2, height - 12, {
      size: 10,
      color: theme.color.faint || '#8c8476',
      align: 'center',
      baseline: 'middle',
      font: theme.font.body
    });

    // Reward Modal
    if (this.showRewardModal) {
      ctx.fillStyle = 'rgba(37, 34, 29, 0.6)';
      ctx.fillRect(0, 0, width, height);

      const modalW = Math.floor(width * 0.85);
      const modalH = Math.floor(height * 0.45);
      const modalX = Math.floor((width - modalW) / 2);
      const modalY = Math.floor((height - modalH) / 2);

      fillRoundRect(ctx, modalX, modalY, modalW, modalH, theme.radius.lg, theme.color.paper);
      strokeRoundRect(ctx, modalX, modalY, modalW, modalH, theme.radius.lg, theme.color.gold, 2);

      drawText(ctx, '战役关卡完成！请选择一张卡牌', modalX + modalW / 2, modalY + 30, {
        size: 14, color: theme.color.ink, align: 'center', baseline: 'middle', font: theme.font.title, weight: 'bold'
      });
      drawText(ctx, '加入你的牌组以晋级下一关', modalX + modalW / 2, modalY + 50, {
        size: 11, color: theme.color.muted, align: 'center', baseline: 'middle', font: theme.font.body
      });

      const rCardW = 64;
      const rCardH = 90;
      const rGap = 12;
      const rTotalW = 3 * rCardW + 2 * rGap;
      const rStartX = modalX + Math.floor((modalW - rTotalW) / 2);
      const rStartY = modalY + 80;

      for (let i = 0; i < 3; i++) {
        const rx = rStartX + i * (rCardW + rGap);
        const ry = rStartY;
        const cardId = this.rewardCards[i];
        const cardTemplate = CARD_TYPES[cardId];

        if (cardTemplate) {
          const mockCard = {
            ...cardTemplate,
            hp: cardTemplate.maxHp
          };
          this.drawHandCard(ctx, mockCard, rx, ry, rCardW, rCardH, false);
        }
      }
    }
  }

  onTouchStart(point) {
    if (this.isExiting) return;
    if (this.input.onTouchStart(point.x, point.y)) return;
    if (this.isResolvingTurn) return;

    const theme = this.theme;

    // 1. Reward Choice Modal
    if (this.showRewardModal) {
      const width = this.host.width;
      const height = this.host.height;
      const modalW = Math.floor(width * 0.85);
      const modalH = Math.floor(height * 0.45);
      const modalX = Math.floor((width - modalW) / 2);
      const modalY = Math.floor((height - modalH) / 2);

      const rCardW = 64;
      const rCardH = 90;
      const rGap = 12;
      const rTotalW = 3 * rCardW + 2 * rGap;
      const rStartX = modalX + Math.floor((modalW - rTotalW) / 2);
      const rStartY = modalY + 80;

      for (let i = 0; i < 3; i++) {
        const rx = rStartX + i * (rCardW + rGap);
        const ry = rStartY;
        if (point.x >= rx && point.x <= rx + rCardW && point.y >= ry && point.y <= ry + rCardH) {
          const chosen = this.rewardCards[i];
          this.campaignDeck.push(chosen);

          this.state.nextLevel();
          this.state.deck = this.campaignDeck.map(id => this.state.createCard(id));
          this.state.deck.sort(() => Math.random() - 0.5);
          this.state.hand = [];
          for (let d = 0; d < 3; d++) {
            if (this.state.deck.length > 0) {
              this.state.hand.push(this.state.deck.shift());
            }
          }
          this.syncVisualsWithState();

          this.showRewardModal = false;
          this.hasDrawnThisTurn = false;
          this.selectedCardIndex = -1;
          this.bottomQuote = getRandomQuote('woodkingdom') || '静心谋划，以草木筑造王国的荣光。';
          break;
        }
      }
      return;
    }

    // 2. Click Sacrifice (祭) Button on player cards
    for (let i = 0; i < 4; i++) {
      const card = this.state.playerSlots[i];
      if (card) {
        const slotX = this.gridX + i * (this.slotWidth + this.gap);
        const slotY = this.gridY + 2 * (this.slotHeight + this.gridRowGap);
        const btnSize = 16;
        const bx = slotX + this.slotWidth - btnSize - 2;
        const by = slotY + 2;

        if (point.x >= bx && point.x <= bx + btnSize && point.y >= by && point.y <= by + btnSize) {
          try {
            const res = this.state.sacrificeCard(i);
            this.syncVisualsWithState();
            this.spawnFloatingText('祭献', slotX + this.slotWidth / 2, slotY + this.slotHeight / 2, theme.color.danger);

            const gained = res.gained;
            let gainStr = '';
            if (gained.raindrop > 0) gainStr += `💧+${gained.raindrop} `;
            if (gained.wood > 0) gainStr += `🪵+${gained.wood} `;
            if (gained.acorn > 0) gainStr += `🌰+${gained.acorn} `;
            if (gained.leaves > 0) gainStr += `🍃+${gained.leaves} `;
            if (gainStr) {
              this.spawnFloatingText(gainStr, slotX + this.slotWidth / 2, slotY - 15, theme.color.sage);
            }
            this.selectedCardIndex = -1; // Deselect hand card
          } catch (e) {
            this.spawnFloatingText(e.message, slotX + this.slotWidth / 2, slotY + this.slotHeight / 2, theme.color.danger);
          }
          return;
        }
      }
    }

    // 3. Click Player Slots (to play card)
    for (let i = 0; i < 4; i++) {
      const slotX = this.gridX + i * (this.slotWidth + this.gap);
      const slotY = this.gridY + 2 * (this.slotHeight + this.gridRowGap);

      if (point.x >= slotX && point.x <= slotX + this.slotWidth && point.y >= slotY && point.y <= slotY + this.slotHeight) {
        if (this.selectedCardIndex !== -1) {
          const cardToPlay = this.state.hand[this.selectedCardIndex];
          try {
            this.state.playCard(this.selectedCardIndex, i);
            this.syncVisualsWithState();
            this.spawnFloatingText(`派遣 ${cardToPlay.name}`, slotX + this.slotWidth / 2, slotY + this.slotHeight / 2, theme.color.sage);
            this.selectedCardIndex = -1; // Reset selection
          } catch (e) {
            this.spawnFloatingText(e.message, slotX + this.slotWidth / 2, slotY + this.slotHeight / 2, theme.color.danger);
          }
        }
        return;
      }
    }

    // 4. Click Draw Piles
    // Squirrel Pile
    if (contains(this.squirrelPileRect, point.x, point.y)) {
      if (this.hasDrawnThisTurn) {
        this.spawnFloatingText('本回合已摸牌', this.squirrelPileRect.x + this.pileWidth / 2, this.squirrelPileRect.y - 12, theme.color.gold);
      } else if (this.state.hand.length >= 6) {
        this.spawnFloatingText('手牌已满', this.squirrelPileRect.x + this.pileWidth / 2, this.squirrelPileRect.y - 12, theme.color.danger);
      } else {
        const card = this.state.drawCard('squirrel');
        if (card) {
          this.hasDrawnThisTurn = true;
          this.syncVisualsWithState();
          this.spawnFloatingText('+松鼠', this.squirrelPileRect.x + this.pileWidth / 2, this.squirrelPileRect.y - 12, theme.color.sage);
        }
      }
      return;
    }

    // Sprout Pile
    if (contains(this.sproutPileRect, point.x, point.y)) {
      if (this.hasDrawnThisTurn) {
        this.spawnFloatingText('本回合已摸牌', this.sproutPileRect.x + this.pileWidth / 2, this.sproutPileRect.y - 12, theme.color.gold);
      } else if (this.state.hand.length >= 6) {
        this.spawnFloatingText('手牌已满', this.sproutPileRect.x + this.pileWidth / 2, this.sproutPileRect.y - 12, theme.color.danger);
      } else {
        const card = this.state.drawCard('sprout');
        if (card) {
          this.hasDrawnThisTurn = true;
          this.syncVisualsWithState();
          this.spawnFloatingText('+嫩芽', this.sproutPileRect.x + this.pileWidth / 2, this.sproutPileRect.y - 12, theme.color.sage);
        }
      }
      return;
    }

    // Deck Pile
    if (contains(this.deckPileRect, point.x, point.y)) {
      if (this.hasDrawnThisTurn) {
        this.spawnFloatingText('本回合已摸牌', this.deckPileRect.x + this.pileWidth / 2, this.deckPileRect.y - 12, theme.color.gold);
      } else if (this.state.hand.length >= 6) {
        this.spawnFloatingText('手牌已满', this.deckPileRect.x + this.pileWidth / 2, this.deckPileRect.y - 12, theme.color.danger);
      } else if (this.state.deck.length === 0) {
        this.spawnFloatingText('牌组已空', this.deckPileRect.x + this.pileWidth / 2, this.deckPileRect.y - 12, theme.color.danger);
      } else {
        const card = this.state.drawCard('deck');
        if (card) {
          this.hasDrawnThisTurn = true;
          this.syncVisualsWithState();
          this.spawnFloatingText(`+${card.name}`, this.deckPileRect.x + this.pileWidth / 2, this.deckPileRect.y - 12, theme.color.sage);
        }
      }
      return;
    }

    // End Turn Button
    if (contains(this.endTurnRect, point.x, point.y)) {
      if (!this.hasDrawnThisTurn && (this.state.deck.length > 0 || this.state.hand.length < 6)) {
        this.spawnFloatingText('请先选择卡牌堆摸牌', this.endTurnRect.x + this.endTurnRect.w / 2, this.endTurnRect.y - 12, theme.color.gold);
        return;
      }

      this.isResolvingTurn = true;
      this.selectedCardIndex = -1;

      // Resolve turn and queue animations
      const log = this.state.resolveTurn();
      this.animQueue = log;
      this.hasDrawnThisTurn = false;
      return;
    }

    // 5. Select Hand Cards
    const hand = this.state.hand;
    const cardW = this.handCardWidth;
    const cardH = this.handCardHeight;
    const gap = 8;
    const totalW = hand.length * cardW + (hand.length - 1) * gap;
    const startX = Math.floor((this.host.width - totalW) / 2);

    for (let i = 0; i < hand.length; i++) {
      const cx = startX + i * (cardW + gap);
      const cy = this.handY;

      if (point.x >= cx && point.x <= cx + cardW && point.y >= cy && point.y <= cy + cardH) {
        if (this.selectedCardIndex === i) {
          this.selectedCardIndex = -1;
        } else {
          this.selectedCardIndex = i;
        }
        return;
      }
    }
  }

  onTouchMove(point) {
    if (this.isExiting) return;
    this.input.onTouchMove(point.x, point.y);
  }

  onTouchEnd(point) {
    if (this.isExiting) return;
    this.input.onTouchEnd(point.x, point.y);
  }

  destroy() {
    super.destroy();
    this.particles = [];
    this.floatingTexts = [];
  }
}
