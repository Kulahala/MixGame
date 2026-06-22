import BaseGameScene from '../../core/game-scene-base.js';
import { getScores, getSession, saveSession, clearSession, saveScore } from '../../core/storage.js';
import { JumpState } from './state.js';
import { drawText, fillRoundRect, strokeRoundRect } from '../../ui/canvas.js';
import { getRandomQuote } from '../../ui/quotes.js';
import Button from '../../ui/button.js';

// 线性颜色插值函数，用于平滑渐变背景
function interpolateColor(color1, color2, factor) {
  const r1 = parseInt(color1.substring(1, 3), 16);
  const g1 = parseInt(color1.substring(3, 5), 16);
  const b1 = parseInt(color1.substring(5, 7), 16);

  const r2 = parseInt(color2.substring(1, 3), 16);
  const g2 = parseInt(color2.substring(3, 5), 16);
  const b2 = parseInt(color2.substring(5, 7), 16);

  const r = Math.round(r1 + (r2 - r1) * factor);
  const g = Math.round(g1 + (g2 - g1) * factor);
  const b = Math.round(b1 + (b2 - b1) * factor);

  const rHex = r.toString(16).padStart(2, '0');
  const gHex = g.toString(16).padStart(2, '0');
  const bHex = b.toString(16).padStart(2, '0');

  return `#${rHex}${gHex}${bHex}`;
}

// 带有透明度通道的 RGBA 颜色插值函数，用于平滑过渡远云与斜槽斑马线
function interpolateRgba(c1, c2, factor) {
  const r = Math.round(c1.r + (c2.r - c1.r) * factor);
  const g = Math.round(c1.g + (c2.g - c1.g) * factor);
  const b = Math.round(c1.b + (c2.b - c1.b) * factor);
  const a = c1.a + (c2.a - c1.a) * factor;
  return `rgba(${r}, ${g}, ${b}, ${a})`;
}

// 天空昼夜循环的基准静态常量配置，防止高频每帧分配内存产生 GC 抖动
const SKY_TIME_STATES = [
  { // 0: Noon (中午)
    skyTop: '#7bbfea', skyBottom: '#e8f5fd',
    plat: '#fffdf2', stroke: '#ffd54f',
    bubble: '#fffbf2', slideBg: '#fff7d6',
    stripe: { r: 255, g: 213, b: 79, a: 0.5 },
    farCloud: { r: 255, g: 255, b: 255, a: 0.28 }
  },
  { // 1: Dusk (傍晚)
    skyTop: '#e67e80', skyBottom: '#4a374a',
    plat: '#ffe6e6', stroke: '#f06292',
    bubble: '#fff0f0', slideBg: '#fce4ec',
    stripe: { r: 240, g: 98, b: 146, a: 0.5 },
    farCloud: { r: 240, g: 200, b: 210, a: 0.24 }
  },
  { // 2: Night (深夜)
    skyTop: '#0b0f19', skyBottom: '#1a233a',
    plat: '#a9c0d0', stroke: '#29b6f6',
    bubble: '#b8cddc', slideBg: '#455a64',
    stripe: { r: 41, g: 182, b: 246, a: 0.5 },
    farCloud: { r: 150, g: 180, b: 210, a: 0.15 }
  },
  { // 3: Dawn (清晨)
    skyTop: '#ccd9e8', skyBottom: '#fdf6e2',
    plat: '#f5f8fa', stroke: '#b0bec5',
    bubble: '#edf1f5', slideBg: '#eceff1',
    stripe: { r: 176, g: 190, b: 197, a: 0.5 },
    farCloud: { r: 240, g: 245, b: 250, a: 0.26 }
  }
];

// 篝火小粒子效果
class CampfireParticle {
  constructor(x, y) {
    this.x = x + (Math.random() - 0.5) * 12;
    this.y = y - Math.random() * 8;
    this.vx = (Math.random() - 0.5) * 0.15;
    this.vy = -0.05 - Math.random() * 0.1;
    this.size = 2 + Math.random() * 2;
    this.alpha = 1.0;
    this.decay = 0.0015 + Math.random() * 0.0015;
    this.color = Math.random() > 0.4 ? '#ff7c3b' : '#ffd03b'; // 橙色/黄色
  }

  update(dt) {
    this.x += this.vx * dt;
    this.y += this.vy * dt;
    this.alpha -= this.decay * dt;
    if (this.alpha < 0) this.alpha = 0;
  }

  render(ctx) {
    ctx.save();
    ctx.globalAlpha = this.alpha;
    ctx.fillStyle = this.color;
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}

// 物理特效粒子类
class GameParticle {
  constructor(options) {
    this.x = options.x;
    this.y = options.y;
    this.vx = options.vx || 0;
    this.vy = options.vy || 0;
    this.radius = options.radius || 2;
    this.color = options.color || '#ffffff';
    this.alpha = options.alpha !== undefined ? options.alpha : 1.0;
    this.decay = options.decay || 0.002; // 每毫秒衰减
    this.gravity = options.gravity || 0; // 粒子重力
    this.grow = options.grow || 0;       // 半径变化速度
  }

  update(dt) {
    this.x += this.vx * dt;
    this.y += this.vy * dt;
    this.vy += this.gravity * dt;
    this.radius = Math.max(0.1, this.radius + this.grow * dt);
    this.alpha -= this.decay * dt;
    if (this.alpha < 0) this.alpha = 0;
  }

  render(ctx) {
    ctx.save();
    ctx.globalAlpha = this.alpha;
    const speedSq = this.vx * this.vx + this.vy * this.vy;
    if (speedSq >= 0.04) {
      ctx.strokeStyle = this.color;
      ctx.lineWidth = this.radius * 2;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(this.x - this.vx * 18, this.y - this.vy * 18);
      ctx.lineTo(this.x, this.y);
      ctx.stroke();
    } else {
      ctx.fillStyle = this.color;
      ctx.beginPath();
      ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }
}

// 存档提示弹窗 Custom Modal
class SessionModal {
  constructor(options) {
    this.x = options.x;
    this.y = options.y;
    this.w = options.w;
    this.h = options.h;
    this.theme = options.theme;
    this.onContinue = options.onContinue;
    this.onRestart = options.onRestart;

    // 实例化弹窗内按钮
    const btnW = 110;
    const btnH = 38;
    const btnY = this.y + this.h - 58;

    this.continueBtn = new Button({
      x: this.x + this.w / 2 - btnW - 12,
      y: btnY,
      w: btnW,
      h: btnH,
      label: '继续旅程',
      variant: 'primary',
      onClick: () => this.onContinue()
    });

    this.restartBtn = new Button({
      x: this.x + this.w / 2 + 12,
      y: btnY,
      w: btnW,
      h: btnH,
      label: '重新开始',
      variant: 'ghost',
      onClick: () => this.onRestart()
    });
  }

  onTouchStart(x, y) {
    if (this.continueBtn.onTouchStart(x, y)) return true;
    if (this.restartBtn.onTouchStart(x, y)) return true;
    return true; // 拦截所有穿透点击
  }

  onTouchMove(x, y) {
    this.continueBtn.onTouchMove(x, y);
    this.restartBtn.onTouchMove(x, y);
  }

  onTouchEnd(x, y) {
    this.continueBtn.onTouchEnd(x, y);
    this.restartBtn.onTouchEnd(x, y);
  }

  render(ctx, theme) {
    // 1. 半透明黑色背景遮罩
    ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
    ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);

    // 2. 弹窗主背景
    fillRoundRect(ctx, this.x, this.y, this.w, this.h, this.theme.radius.lg, 'rgba(255, 255, 255, 0.95)');
    strokeRoundRect(ctx, this.x, this.y, this.w, this.h, this.theme.radius.lg, 'rgba(255, 255, 255, 0.6)', 1.5);

    // 3. 文字内容
    drawText(ctx, '旅程记忆', this.x + this.w / 2, this.y + 35, {
      size: 18,
      color: theme.color.ink,
      font: theme.font.title,
      weight: '600',
      align: 'center',
      baseline: 'middle'
    });

    drawText(ctx, '发现您未完成的篝火旅程，\n是否从上一次点亮的篝火处\n继续您的云巅攀登？', this.x + this.w / 2, this.y + 90, {
      size: 13,
      color: theme.color.muted,
      font: theme.font.body,
      align: 'center',
      baseline: 'middle',
      lineHeight: 20
    });

    // 4. 按钮绘制
    this.continueBtn.render(ctx, theme);
    this.restartBtn.render(ctx, theme);
  }

  destroy() {
    this.continueBtn.destroy();
    this.restartBtn.destroy();
  }
}

export default class JumpScene extends BaseGameScene {
  constructor(host, options = {}) {
    super(host, options);
    this.options = options;
    this.gameId = 'jump';
    this.state = new JumpState();
    this.state.mode = options.mode || 'classic';
    this.bottomQuote = getRandomQuote('jump') || '温暖的篝火旁，有新的开始。';

    // 镜头相机 Y
    this.cameraY = 3200 - 540;

    // 拖拽手势状态
    this.dragStart = null; // { x, y } (逻辑坐标)
    this.dragCurrent = null; // { x, y }

    // 篝火火焰粒子数组与物理特效粒子数组
    this.campfireParticles = [];
    this.particles = [];

    // 存档引导 modal
    this.sessionModal = null;

    // 拖拽蓄力轻微触觉震动段落档位
    this.lastVibrateStep = 0;

    // 预分配的天空层昼夜插值色缓存对象，达成绝对零 GC (GC-free)
    this.timeColors = {
      skyTop: '',
      skyBottom: '',
      plat: '',
      stroke: '',
      bubble: '',
      slideBg: '',
      stripe: '',
      farCloud: ''
    };
  }

  init() {
    const { width, height } = this.host;
    const designW = 360;
    const minDesignH = 540;

    // 视口包容适配
    let scale = width / designW;
    const viewportH = height / scale;
    if (viewportH < minDesignH) {
      scale = height / minDesignH;
    }

    this.scale = scale;
    this.designW = designW;
    this.designH = height / scale; // 实际逻辑可视高度
    this.offsetX = (width - designW * scale) / 2;

    const safeTop = this.host.safeTop;
    const topBarY = safeTop + 54;
    const barH = 46;
    const btnW = 86;
    const btnH = 30;

    this.respawnButton = new Button({
      x: width / 2 - btnW / 2,
      y: topBarY + (barH - btnH) / 2,
      w: btnW,
      h: btnH,
      label: '返回篝火',
      variant: 'secondary',
      onClick: () => {
        if (this.modal || this.completed || this.sessionModal) return;
        this.state.respawn();
        this.showToast('已返回最近的篝火');
      }
    });

    if (this.state.mode === 'classic') {
      this.createTopButtons([this.respawnButton]);
    } else {
      this.createTopButtons([]); // 无尽模式不创建返回篝火按钮
    }

    // 篝火复位
    this.cameraY = 3200 - this.designH;
    this.particles = [];

    // 读取存档 (仅在经典模式下加载存档)
    if (this.state.mode === 'classic') {
      const saved = getSession('jump');
      if (saved) {
        const modalW = 270;
        const modalH = 190;
        this.sessionModal = new SessionModal({
          x: (width - modalW) / 2,
          y: (height - modalH) / 2,
          w: modalW,
          h: modalH,
          theme: this.theme,
          onContinue: () => {
            this.state.reset(saved);
            this.cameraY = this.state.y - this.designH * 0.6;
            this.input.remove(this.sessionModal);
            this.sessionModal.destroy();
            this.sessionModal = null;
          },
          onRestart: () => {
            clearSession('jump');
            this.state.reset();
            this.cameraY = 3200 - this.designH;
            this.input.remove(this.sessionModal);
            this.sessionModal.destroy();
            this.sessionModal = null;
          }
        });
        this.input.add(this.sessionModal);
      } else {
        this.state.reset();
      }
    } else {
      // 无尽模式
      this.state.reset();
    }
  }

  reset() {
    this.closeModal();
    if (this.sessionModal) {
      this.input.remove(this.sessionModal);
      this.sessionModal.destroy();
      this.sessionModal = null;
    }

    if (this.state.mode === 'classic') {
      const saved = getSession('jump');
      this.state.reset(saved);
    } else {
      this.state.reset();
    }
    this.cameraY = this.state.y - this.designH * 0.6;
    this.bottomQuote = getRandomQuote('jump') || '每一堆燃起的篝火，都是攀登者的誓言。';
    this.lastVibrateStep = 0;
    this.particles = [];
  }

  exit(callback) {
    if (this.state.mode === 'endless' && this.state.peakAltitude > 0) {
      saveScore('jump', {
        score: this.state.peakAltitude,
        difficulty: 'endless',
        won: true
      });
    }
    super.exit(callback);
  }

  // 物理特效粒子管理（FIFO 限定 120 个上限）
  addParticle(p) {
    if (this.particles.length >= 120) {
      this.particles.shift();
    }
    this.particles.push(p);
  }

  update(dt = 16) {
    // 弹窗状态下阻断更新
    if (this.sessionModal) return;
    if (super.update(dt)) return;

    const prevState = this.state.state;
    const prevVy = this.state.vy;

    this.state.update(dt);

    const currState = this.state.state;
    if (prevState === 'falling' && currState === 'idle') {
      // 成功踩地着陆，触发分级震动反馈
      if (typeof wx !== 'undefined' && wx.vibrateShort) {
        if (prevVy > 0.3) {
          wx.vibrateShort({ type: 'medium' }); // 高空摔落
        } else {
          wx.vibrateShort({ type: 'light' });  // 轻微着陆
        }
      }

      // 生成落地冲击尘土环
      const px = this.state.x;
      const py = this.state.y + this.state.radius;
      for (let i = 0; i < 12; i++) {
        const vx = (Math.random() > 0.5 ? 1 : -1) * (0.05 + Math.random() * 0.12);
        const vy = -0.01 - Math.random() * 0.03;
        this.addParticle(new GameParticle({
          x: px,
          y: py,
          vx: vx,
          vy: vy,
          radius: 2.5 + Math.random() * 2,
          color: 'rgba(220, 220, 220, 0.8)',
          decay: 0.0015 + Math.random() * 0.0015,
          grow: -0.0015,
          gravity: 0.0001
        }));
      }
    }

    // 监听撞击反弹事件，触发轻微触觉反馈并生成撞击碎屑
    if (this.state.justBouncedWall || this.state.justBouncedCeiling) {
      if (typeof wx !== 'undefined' && wx.vibrateShort) {
        wx.vibrateShort({ type: 'light' });
      }

      const isWall = this.state.justBouncedWall;
      let px = this.state.x;
      let py = this.state.y;
      if (isWall) {
        px = this.state.vx > 0 ? this.state.x - this.state.radius : this.state.x + this.state.radius;
      } else {
        py = this.state.y - this.state.radius;
      }

      // 确定碎屑颜色
      let sparkColor = '#ffffff';
      if (this.cameraY >= 1650 - this.designH) {
        sparkColor = Math.random() > 0.4 ? '#8b5a2b' : '#cd853f'; // 森林阶段：木屑色
      } else if (this.cameraY >= 1100 - this.designH) {
        sparkColor = Math.random() > 0.4 ? '#9c9c9c' : '#8b7d6b'; // 遗迹阶段：石屑色
      } else {
        sparkColor = Math.random() > 0.4 ? '#ffffff' : '#b0e2ff'; // 天空阶段：光屑色
      }

      // 生成 10 个碎屑粒子
      for (let i = 0; i < 10; i++) {
        const angle = Math.random() * Math.PI * 2;
        const speed = 0.06 + Math.random() * 0.12;
        this.addParticle(new GameParticle({
          x: px,
          y: py,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed,
          radius: 1.2 + Math.random() * 1.5,
          color: sparkColor,
          decay: 0.003 + Math.random() * 0.003,
          grow: -0.001,
          gravity: 0.0003 // 碎屑受重力下落
        }));
      }
    }

    // 生成空中拖尾粒子
    if (this.state.state === 'jumping' || this.state.state === 'falling' || this.state.state === 'sliding') {
      this.addParticle(new GameParticle({
        x: this.state.x + (Math.random() - 0.5) * 4,
        y: this.state.y + (Math.random() - 0.5) * 4,
        vx: -this.state.vx * 0.1,
        vy: -this.state.vy * 0.1,
        radius: this.state.radius * 0.8,
        color: 'rgba(126, 163, 140, 0.35)',
        decay: 0.003,
        grow: -0.01,
        gravity: 0
      }));
    }

    // 平滑镜头追随 (60% 屏幕处)
    const targetCameraY = this.state.y - this.designH * 0.6;
    const maxCamY = 3200 - this.designH;
    const limitCamY = this.state.mode === 'endless'
      ? Math.min(maxCamY, targetCameraY)
      : Math.max(0, Math.min(maxCamY, targetCameraY));
    this.cameraY += (limitCamY - this.cameraY) * 0.08;

    // 火焰与物理特效粒子更新
    this.campfireParticles.forEach(p => p.update(dt));
    this.campfireParticles = this.campfireParticles.filter(p => p.alpha > 0);

    this.particles.forEach(p => p.update(dt));
    this.particles = this.particles.filter(p => p.alpha > 0);

    // 经典模式下，周期性往点亮的篝火里扔火焰粒子
    if (this.state.mode === 'classic') {
      const activeCp = this.state.checkpoints[this.state.activeCheckpointIdx];
      if (activeCp && Math.random() < 0.25) {
        this.campfireParticles.push(new CampfireParticle(activeCp.x, activeCp.y));
      }
    }

    // 在无尽模式天空层的深夜段，定时生成高速流星粒子（复用 GameParticle 拉丝特效）
    if (this.state.mode === 'endless') {
      const skyY = -850 - this.designH;
      if (this.cameraY < skyY) {
        const skyAltitude = Math.max(0, skyY - this.cameraY);
        const periodProgress = (skyAltitude % 4000) / 4000;
        if (periodProgress >= 0.5 && periodProgress <= 0.75 && Math.random() < 0.008) {
          this.addParticle(new GameParticle({
            x: Math.random() * this.designW * 0.8,
            y: this.cameraY + Math.random() * 200,
            vx: 0.35 + Math.random() * 0.15,
            vy: 0.2 + Math.random() * 0.1,
            radius: 1.2 + Math.random() * 0.8,
            color: '#ffffff',
            decay: 0.0006 + Math.random() * 0.0004,
            gravity: 0
          }));
        }
      }
    }

    // 终局胜利检测 (仅在经典模式下有 3200px 顶峰结算)
    if (this.state.mode === 'classic' && this.state.saved && !this.completed) {
      this.completed = true;
      const stats = [
        `攀爬高度：100% (云巅峰顶)`,
        `挑战结果：胜利通关`,
        `用时时长：${Math.floor(this.state.elapsedTime / 1000)}s`
      ];

      const scoreObj = getScores()['jump'] || {};
      const history = [];
      if (scoreObj.bestTime && scoreObj.bestTime !== Infinity) {
        history.push({ label: `最佳速通 ${scoreObj.bestTime}s`, highlight: true });
      }

      // 清除本次会话存档，下次进来重新开始
      clearSession('jump');

      this.showResult('登上顶峰！', stats, true, history);
    }
  }

  onTouchStart(point) {
    if (this.isExiting) return;
    if (this.sessionModal) {
      this.sessionModal.onTouchStart(point.x, point.y);
      return;
    }
    if (this.input.onTouchStart(point.x, point.y)) return;

    if (this.modal || this.completed || this.state.state !== 'idle') return;

    // 转换至逻辑坐标
    const lx = (point.x - this.offsetX) / this.scale;
    const ly = point.y / this.scale;

    // 任意屏幕位置拖拽起跳，但必须按在可见平台或者任意处
    this.dragStart = { x: lx, y: ly };
    this.dragCurrent = { x: lx, y: ly };
    this.state.state = 'charging';
  }

  onTouchMove(point) {
    if (this.isExiting) return;
    if (this.sessionModal) {
      this.sessionModal.onTouchMove(point.x, point.y);
      return;
    }
    this.input.onTouchMove(point.x, point.y);

    if (!this.dragStart || this.state.state !== 'charging') return;

    const lx = (point.x - this.offsetX) / this.scale;
    const ly = point.y / this.scale;
    this.dragCurrent = { x: lx, y: ly };

    // 计算弹弓拖拽进度
    const dx = this.dragStart.x - lx;
    const dy = this.dragStart.y - ly;
    const dist = Math.hypot(dx, dy);
    const maxDrag = 110;
    const progress = Math.max(0, Math.min(1.0, dist / maxDrag));
    this.state.chargeProgress = progress;

    // 拖拽触觉震动段落反馈 (分成 4 档，拉力增加时触发)
    const step = Math.floor(progress * 4);
    if (step !== this.lastVibrateStep) {
      if (typeof wx !== 'undefined' && wx.vibrateShort) {
        if (step > this.lastVibrateStep) {
          wx.vibrateShort({ type: 'light' });
        }
      }
      this.lastVibrateStep = step;
    }

    // 拖拽时 Slime 发生扁平挤压
    this.state.scaleX = 1.0 + progress * 0.35;
    this.state.scaleY = 1.0 - progress * 0.35;
  }

  onTouchEnd(point) {
    if (this.isExiting) return;
    if (this.sessionModal) {
      this.sessionModal.onTouchEnd(point.x, point.y);
      return;
    }
    this.input.onTouchEnd(point.x, point.y);

    if (!this.dragStart || this.state.state !== 'charging') return;

    const lx = (point.x - this.offsetX) / this.scale;
    const ly = point.y / this.scale;

    // 计算发射速度向量
    const dx = this.dragStart.x - lx;
    const dy = this.dragStart.y - ly;
    const dist = Math.hypot(dx, dy);

    this.dragStart = null;
    this.dragCurrent = null;

    if (dist < 8) {
      // 拖拽距离太短，视为取消跳跃
      this.state.state = 'idle';
      this.state.chargeProgress = 0;
      this.state.scaleX = 1.0;
      this.state.scaleY = 1.0;
      return;
    }

    const dirX = dx / dist;
    // 强制往上起跳（防止倒着跳）
    const dirY = -Math.abs(dy / dist);

    this.state.state = 'idle'; // 先临时改回 idle 以触发 jump 判定
    this.state.jump(dirX, dirY, Math.min(1.0, dist / 110));

    // 起跳扬尘粒子
    const px = this.state.x;
    const py = this.state.y + this.state.radius;
    for (let i = 0; i < 8; i++) {
      const angle = Math.PI + (Math.random() - 0.5) * (Math.PI * 0.5);
      const speed = 0.05 + Math.random() * 0.08;
      this.addParticle(new GameParticle({
        x: px,
        y: py,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        radius: 1.5 + Math.random() * 1.5,
        color: 'rgba(240, 240, 240, 0.75)',
        decay: 0.002,
        grow: -0.002,
        gravity: 0
      }));
    }
  }

  getPhaseAlphas() {
    let forestAlpha = 1.0;
    let ruinsAlpha = 0.0;
    let skyAlpha = 0.0;

    const isEndless = this.state.mode === 'endless';
    const forestY = 3200 - this.designH;
    const ruinsY = isEndless ? (1150 - this.designH) : (1650 - this.designH);
    const skyY = isEndless ? (-850 - this.designH) : 0;

    if (this.cameraY >= ruinsY) {
      const range = forestY - ruinsY;
      const factor = range > 0 ? Math.max(0, Math.min(1.0, (this.cameraY - ruinsY) / range)) : 1.0;
      forestAlpha = factor;
      ruinsAlpha = 1 - factor;
      skyAlpha = 0;
    } else {
      const range = ruinsY - skyY;
      const factor = range > 0 ? Math.max(0, Math.min(1.0, (this.cameraY - skyY) / range)) : 0.0;
      forestAlpha = 0;
      ruinsAlpha = factor;
      skyAlpha = 1 - factor;
    }

    return { forestAlpha, ruinsAlpha, skyAlpha };
  }

  // 森林阶段远山树影视差绘制 (支持无缝取模滚动)
  drawForestParallax(ctx, forestAlpha) {
    if (forestAlpha <= 0.01) return;
    ctx.save();
    ctx.globalAlpha = forestAlpha;

    const speed = 0.15;
    const loopH = 600;
    let yOffset = -(this.cameraY * speed) % loopH;
    if (yOffset > 0) yOffset -= loopH;

    for (let offset = yOffset; offset < this.designH; offset += loopH) {
      // 远山
      ctx.fillStyle = 'rgba(95, 122, 103, 0.22)';
      ctx.beginPath();
      ctx.moveTo(0, offset + loopH * 2);
      ctx.lineTo(0, offset + 350);
      ctx.quadraticCurveTo(this.designW * 0.25, offset + 250, this.designW * 0.5, offset + 320);
      ctx.quadraticCurveTo(this.designW * 0.75, offset + 280, this.designW, offset + 240);
      ctx.lineTo(this.designW, offset + loopH * 2);
      ctx.fill();

      // 近山/树影
      ctx.fillStyle = 'rgba(79, 102, 85, 0.3)';
      ctx.beginPath();
      ctx.moveTo(0, offset + loopH * 2);
      ctx.lineTo(0, offset + 450);
      ctx.quadraticCurveTo(this.designW * 0.35, offset + 380, this.designW * 0.7, offset + 430);
      ctx.quadraticCurveTo(this.designW * 0.85, offset + 400, this.designW, offset + 460);
      ctx.lineTo(this.designW, offset + loopH * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  // 遗迹阶段巨石墙影视差绘制 (支持无缝取模滚动)
  drawRuinsParallax(ctx, ruinsAlpha) {
    if (ruinsAlpha <= 0.01) return;
    ctx.save();
    ctx.globalAlpha = ruinsAlpha;

    const speed = 0.25;
    const loopH = 700;
    let yOffset = -(this.cameraY * speed) % loopH;
    if (yOffset > 0) yOffset -= loopH;

    for (let offset = yOffset; offset < this.designH; offset += loopH) {
      ctx.fillStyle = 'rgba(168, 158, 144, 0.18)';
      
      // 左石柱
      ctx.fillRect(40, offset + 100, 20, 500);
      ctx.fillRect(35, offset + 90, 30, 10);
      ctx.fillRect(35, offset + 590, 30, 10);

      // 右石柱
      ctx.fillRect(this.designW - 70, offset + 250, 25, 450);
      ctx.fillRect(this.designW - 75, offset + 240, 35, 10);
      
      // 废墟拱门背景影
      ctx.strokeStyle = 'rgba(168, 158, 144, 0.12)';
      ctx.lineWidth = 15;
      ctx.beginPath();
      ctx.arc(this.designW / 2, offset + 500, 80, Math.PI, 0);
      ctx.stroke();
    }
    ctx.restore();
  }

  // 计算天空层昼夜循环的颜色配置 (中午->傍晚->深夜->清晨)
  getSkyTimeColors(p) {
    const states = SKY_TIME_STATES;
    const stateCount = states.length;
    const scaled = p * stateCount;
    const index1 = Math.floor(scaled) % stateCount;
    const index2 = (index1 + 1) % stateCount;
    const t = scaled - Math.floor(scaled);

    const s1 = states[index1];
    const s2 = states[index2];

    const target = this.timeColors;
    target.skyTop = interpolateColor(s1.skyTop, s2.skyTop, t);
    target.skyBottom = interpolateColor(s1.skyBottom, s2.skyBottom, t);
    target.plat = interpolateColor(s1.plat, s2.plat, t);
    target.stroke = interpolateColor(s1.stroke, s2.stroke, t);
    target.bubble = interpolateColor(s1.bubble, s2.bubble, t);
    target.slideBg = interpolateColor(s1.slideBg, s2.slideBg, t);
    target.stripe = interpolateRgba(s1.stripe, s2.stripe, t);
    target.farCloud = interpolateRgba(s1.farCloud, s2.farCloud, t);

    return target;
  }

  // 天空阶段星宿恒星视差绘制
  drawSkyParallax(ctx, skyAlpha) {
    if (skyAlpha <= 0.01) return;
    ctx.save();
    ctx.globalAlpha = skyAlpha;

    // 计算昼夜循环进度 p
    const isEndless = this.state.mode === 'endless';
    const skyLimitY = isEndless ? -850 : 1100;
    const skyAltitude = Math.max(0, skyLimitY - this.cameraY);
    const periodProgress = (skyAltitude % 4000) / 4000;

    // 获取插值后的远云与天空阶段颜色
    const timeColors = this.getSkyTimeColors(periodProgress);

    // 1. 太阳与月亮物理移动 (Alpha 乘以 skyAlpha，防止闪现)
    // 太阳判定 (白日 d 在 0 ~ 1)
    let d = -1;
    if (periodProgress >= 0.75) d = (periodProgress - 0.75) / 0.75;
    else if (periodProgress < 0.5) d = (periodProgress + 0.25) / 0.75;

    if (d >= 0) {
      const sunX = 40 + (this.designW - 80) * d;
      const sunY = 300 - 240 * Math.sin(d * Math.PI);
      const sunAlpha = Math.sin(d * Math.PI) * skyAlpha;

      // 太阳颜色插值 (从清晨/傍晚的暖红 #e65a3c 到中午的暖黄 #fff5cc)
      const sunColor = d <= 0.5 
        ? interpolateColor('#e65a3c', '#fff5cc', d / 0.5)
        : interpolateColor('#fff5cc', '#e65a3c', (d - 0.5) / 0.5);

      ctx.save();
      ctx.globalAlpha = sunAlpha;
      
      // 太阳暖光晕
      const radGrad = ctx.createRadialGradient(sunX, sunY, 4, sunX, sunY, 30);
      radGrad.addColorStop(0, sunColor);
      radGrad.addColorStop(0.3, sunColor);
      radGrad.addColorStop(1, 'rgba(255, 235, 180, 0)');
      ctx.fillStyle = radGrad;
      ctx.beginPath();
      ctx.arc(sunX, sunY, 30, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    // 月亮判定 (深夜 n 在 0 ~ 1)
    if (periodProgress >= 0.25 && periodProgress <= 0.75) {
      const n = (periodProgress - 0.25) / 0.5;
      const moonX = this.designW - 40 - (this.designW - 80) * n;
      const moonY = 300 - 200 * Math.sin(n * Math.PI);
      const moonAlpha = Math.sin(n * Math.PI) * skyAlpha;

      ctx.save();
      ctx.globalAlpha = moonAlpha;
      
      // 精致弯月的贝塞尔画法 (优化锯齿与性能)
      ctx.fillStyle = '#ffdf6d';
      ctx.shadowColor = 'rgba(255, 223, 109, 0.4)';
      ctx.shadowBlur = 10;
      ctx.beginPath();
      ctx.arc(moonX, moonY, 15, -Math.PI * 0.5, Math.PI * 0.5, false);
      ctx.quadraticCurveTo(moonX + 15 * 0.25, moonY, moonX, moonY - 15);
      ctx.fill();
      ctx.restore();
    }

    // 2. 星空 (星星透明度受昼夜阶段调制)
    let starPhaseAlpha = 0;
    if (periodProgress >= 0.25 && periodProgress < 0.5) {
      starPhaseAlpha = (periodProgress - 0.25) / 0.25;
    } else if (periodProgress >= 0.5 && periodProgress < 0.75) {
      starPhaseAlpha = 1.0;
    } else if (periodProgress >= 0.75 && periodProgress < 1.0) {
      starPhaseAlpha = 1.0 - (periodProgress - 0.75) / 0.25;
    }

    if (starPhaseAlpha > 0.01) {
      const starSpeed = 0.05;
      const starLoopH = 400;
      let starYOffset = -(this.cameraY * starSpeed) % starLoopH;
      if (starYOffset > 0) starYOffset -= starLoopH;

      const starSeeds = [
        { x: 30, y: 50, r: 1.2 },
        { x: 120, y: 150, r: 1.8 },
        { x: 280, y: 80, r: 1 },
        { x: 210, y: 220, r: 1.5 },
        { x: 80, y: 320, r: 1 },
        { x: 320, y: 350, r: 1.6 },
      ];

      ctx.fillStyle = '#ffffff';
      for (let offset = starYOffset; offset < this.designH; offset += starLoopH) {
        starSeeds.forEach(star => {
          const flash = 0.6 + 0.4 * Math.sin((Date.now() / 300) + star.x);
          ctx.save();
          ctx.globalAlpha = skyAlpha * starPhaseAlpha * flash;
          ctx.beginPath();
          ctx.arc(star.x, offset + star.y, star.r, 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();
        });
      }
    }

    // 3. 远云 (同步变色)
    const cloudSpeed = 0.2;
    const cloudLoopH = 500;
    let cloudYOffset = -(this.cameraY * cloudSpeed) % cloudLoopH;
    if (cloudYOffset > 0) cloudYOffset -= cloudLoopH;

    ctx.fillStyle = timeColors.farCloud;
    for (let offset = cloudYOffset; offset < this.designH; offset += cloudLoopH) {
      this.drawSingleCloud(ctx, 70, offset + 120, 50);
      this.drawSingleCloud(ctx, this.designW - 90, offset + 330, 65);
    }

    ctx.restore();
  }

  drawSingleCloud(ctx, cx, cy, w) {
    ctx.beginPath();
    ctx.arc(cx, cy, w * 0.3, 0, Math.PI * 2);
    ctx.arc(cx - w * 0.22, cy + w * 0.05, w * 0.22, 0, Math.PI * 2);
    ctx.arc(cx + w * 0.22, cy + w * 0.05, w * 0.22, 0, Math.PI * 2);
    ctx.fill();
  }

  // 绘制森林藤蔓墙壁分段 (左/右侧边缘)
  drawVineSegment(ctx, y, h) {
    ctx.save();
    
    // 1. 绘制左侧藤蔓主干
    ctx.strokeStyle = '#384c3f';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(3, y);
    ctx.bezierCurveTo(6, y + h * 0.25, 0, y + h * 0.75, 3, y + h);
    ctx.stroke();

    // 2. 绘制右侧藤蔓主干
    ctx.beginPath();
    ctx.moveTo(this.designW - 3, y);
    ctx.bezierCurveTo(this.designW - 6, y + h * 0.25, this.designW, y + h * 0.75, this.designW - 3, y + h);
    ctx.stroke();

    // 3. 绘制装饰叶片
    const drawLeaf = (lx, ly, isLeftWall, angle) => {
      ctx.save();
      ctx.translate(lx, ly);
      ctx.rotate(isLeftWall ? angle : -angle - Math.PI);
      ctx.fillStyle = '#4f6957';
      ctx.strokeStyle = '#2d3b32';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.quadraticCurveTo(8, -5, 12, 0);
      ctx.quadraticCurveTo(8, 5, 0, 0);
      ctx.fill();
      ctx.stroke();
      ctx.restore();
    };

    // 在左右侧主干的固定高度处长出叶片
    drawLeaf(4, y + 25, true, -Math.PI / 6);
    drawLeaf(2, y + 65, true, Math.PI / 8);
    drawLeaf(4, y + 95, true, -Math.PI / 4);

    drawLeaf(this.designW - 4, y + 15, false, -Math.PI / 5);
    drawLeaf(this.designW - 2, y + 55, false, Math.PI / 6);
    drawLeaf(this.designW - 4, y + 85, false, -Math.PI / 3);

    ctx.restore();
  }

  // 绘制遗迹石壁墙壁分段 (左/右侧边缘)
  drawRuinsWallSegment(ctx, y, h) {
    ctx.save();
    ctx.fillStyle = '#8a7e70';
    ctx.strokeStyle = '#5a5146';
    ctx.lineWidth = 1.5;

    // 左侧石壁轮廓 (凹凸有致)
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(10, y);
    ctx.lineTo(7, y + h * 0.25);
    ctx.lineTo(12, y + h * 0.5);
    ctx.lineTo(8, y + h * 0.75);
    ctx.lineTo(11, y + h);
    ctx.lineTo(0, y + h);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // 绘制左侧石块缝隙缝合线
    ctx.beginPath();
    ctx.moveTo(0, y + h * 0.3);
    ctx.lineTo(9, y + h * 0.3);
    ctx.moveTo(0, y + h * 0.7);
    ctx.lineTo(10, y + h * 0.7);
    ctx.stroke();

    // 右侧石壁轮廓
    ctx.beginPath();
    ctx.moveTo(this.designW, y);
    ctx.lineTo(this.designW - 10, y);
    ctx.lineTo(this.designW - 7, y + h * 0.25);
    ctx.lineTo(this.designW - 12, y + h * 0.5);
    ctx.lineTo(this.designW - 8, y + h * 0.75);
    ctx.lineTo(this.designW - 11, y + h);
    ctx.lineTo(this.designW, y + h);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // 绘制右侧石块缝隙缝合线
    ctx.beginPath();
    ctx.moveTo(this.designW, y + h * 0.3);
    ctx.lineTo(this.designW - 9, y + h * 0.3);
    ctx.moveTo(this.designW, y + h * 0.7);
    ctx.lineTo(this.designW - 10, y + h * 0.7);
    ctx.stroke();

    ctx.restore();
  }

  // 绘制天空云壁墙壁分段 (左/右侧边缘)
  drawSkyCloudSegment(ctx, y, h) {
    ctx.save();
    ctx.fillStyle = 'rgba(255, 255, 255, 0.92)';
    ctx.strokeStyle = '#ccdbe3';
    ctx.lineWidth = 1.5;

    // 绘制左侧云层边界 (由多个重叠半圆组成)
    const drawCloudBubbleLeft = (cx, cy, r) => {
      ctx.beginPath();
      ctx.arc(cx, cy, r, -Math.PI / 2, Math.PI / 2);
      ctx.fill();
      ctx.stroke();
    };

    // 绘制右侧云层边界
    const drawCloudBubbleRight = (cx, cy, r) => {
      ctx.beginPath();
      ctx.arc(cx, cy, r, Math.PI / 2, -Math.PI / 2);
      ctx.fill();
      ctx.stroke();
    };

    // 绘制左侧泡泡云
    drawCloudBubbleLeft(0, y + 20, 11);
    drawCloudBubbleLeft(-2, y + 55, 14);
    drawCloudBubbleLeft(1, y + 95, 10);

    // 绘制右侧泡泡云
    drawCloudBubbleRight(this.designW, y + 25, 10);
    drawCloudBubbleRight(this.designW + 2, y + 60, 15);
    drawCloudBubbleRight(this.designW - 1, y + 90, 11);

    ctx.restore();
  }

  renderGame(ctx) {
    const theme = this.theme;
    const width = this.host.width;
    const height = this.host.height;

    // 1. 在等比缩放和 Letterbox 居中偏移行内进行场景渲染
    ctx.save();
    ctx.translate(this.offsetX, 0);
    ctx.scale(this.scale, this.scale);

    // 绘制垂直大地图背景（根据 cameraY 的位置计算无缝色彩线性渐变，实现超平滑的阶段过渡）
    const isEndless = this.state.mode === 'endless';
    const forestY = 3200 - this.designH;
    const ruinsY = isEndless ? (1150 - this.designH) : (1650 - this.designH);
    const skyY = isEndless ? (-850 - this.designH) : 0;

    // 计算高空昼夜流转的时间因子与各阶段插值色
    const skyAltitude = Math.max(0, skyY - this.cameraY);
    const periodProgress = (skyAltitude % 4000) / 4000;
    const timeColors = this.getSkyTimeColors(periodProgress);

    let colorTop = '#e5ebd7';
    let colorBottom = '#d8e5d9';

    const colors = {
      forest: { top: '#e5ebd7', bottom: '#d8e5d9' },
      ruins:  { top: '#ebdecb', bottom: '#e6ebd5' },
      sky:    { top: timeColors.skyTop, bottom: timeColors.skyBottom }
    };

    if (this.cameraY >= ruinsY) {
      // 宁静之森 ➔ 险峻遗迹 渐变
      const range = forestY - ruinsY;
      const factor = range > 0 ? Math.max(0, Math.min(1.0, (this.cameraY - ruinsY) / range)) : 1.0;
      colorTop = interpolateColor(colors.ruins.top, colors.forest.top, factor);
      colorBottom = interpolateColor(colors.ruins.bottom, colors.forest.bottom, factor);
    } else {
      // 险峻遗迹 ➔ 云霄之巅 渐变
      const range = ruinsY - skyY;
      const factor = range > 0 ? Math.max(0, Math.min(1.0, (this.cameraY - skyY) / range)) : 0.0;
      colorTop = interpolateColor(colors.sky.top, colors.ruins.top, factor);
      colorBottom = interpolateColor(colors.sky.bottom, colors.ruins.bottom, factor);
    }

    const grad = ctx.createLinearGradient(0, 0, 0, this.designH);
    grad.addColorStop(0, colorTop);
    grad.addColorStop(1, colorBottom);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, this.designW, this.designH);

    // 绘制三层视差背景
    const { forestAlpha, ruinsAlpha, skyAlpha } = this.getPhaseAlphas();
    this.drawForestParallax(ctx, forestAlpha);
    this.drawRuinsParallax(ctx, ruinsAlpha);
    this.drawSkyParallax(ctx, skyAlpha);

    // Y轴的视口投影转换 (世界 Y ➔ 视口 Y)
    ctx.save();
    ctx.translate(0, -this.cameraY);

    // 绘制篝火 (仅在经典模式下)
    if (this.state.mode === 'classic') {
      this.state.checkpoints.forEach(cp => {
        const active = this.state.activeCheckpointIdx === cp.id;
        ctx.save();
        ctx.translate(cp.x, cp.y);

        // 绘制石头堆
        ctx.fillStyle = '#6e6e6e';
        ctx.beginPath();
        ctx.arc(-8, 3, 4, 0, Math.PI * 2);
        ctx.arc(8, 3, 4, 0, Math.PI * 2);
        ctx.arc(0, 4, 5, 0, Math.PI * 2);
        ctx.fill();

        // 绘制木柴
        ctx.strokeStyle = '#5a3d28';
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.moveTo(-6, 2);
        ctx.lineTo(6, -4);
        ctx.moveTo(6, 2);
        ctx.lineTo(-6, -4);
        ctx.stroke();

        if (active) {
          // 激活状态下点亮，绘制一个小闪烁核心
          const flameSize = 6 + Math.sin(Date.now() / 80) * 1.5;
          ctx.fillStyle = '#ff5100';
          ctx.beginPath();
          ctx.arc(0, -5, flameSize, 0, Math.PI * 2);
          ctx.fill();

          ctx.fillStyle = '#ffbf00';
          ctx.beginPath();
          ctx.arc(0, -4, flameSize * 0.65, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.restore();
      });
    }

    // 粒子渲染
    this.campfireParticles.forEach(p => p.render(ctx));
    this.particles.forEach(p => p.render(ctx));

    // 绘制所有平台
    this.state.platforms.forEach(p => {
      let theme = 'wood';
      const isEndless = this.state.mode === 'endless';
      const ruinsLimitY = isEndless ? 1150 : 2150;
      const skyLimitY = isEndless ? -850 : 1100;

      if (p.type === 'stone' || (p.type === 'slope' && p.y >= skyLimitY && p.y < ruinsLimitY)) {
        theme = 'stone';
      } else if (p.type === 'cloud' || (p.type === 'slope' && p.y < skyLimitY)) {
        theme = 'cloud';
      }

      if (p.type === 'slope') {
        ctx.save();
        const isBoth = p.slopeDir === 'both';
        const flatW = isBoth 
          ? Math.floor(p.w * 0.55)
          : Math.floor(p.w * 0.6);
        const slopeW = isBoth ? Math.floor((p.w - flatW) / 2) : (p.w - flatW);

        // 确定当前高度对应的主题材质参数
        let flatColor = '#6d8a76';    // 平顶背景色
        let grainColor = 'rgba(0, 0, 0, 0.1)'; // 木纹/石纹色
        let slideBgColor = '#3d4d42'; // 滑面背景色
        let stripeColor = 'rgba(126, 163, 140, 0.4)'; // 滑槽细线色
        let strokeColor = '#4f6957';  // 平台轮廓描边色

        if (theme === 'stone') {
          flatColor = '#a89e90';
          grainColor = 'rgba(0, 0, 0, 0.12)';
          slideBgColor = '#5c564f';
          stripeColor = 'rgba(238, 235, 230, 0.3)';
          strokeColor = '#80776b';
        } else if (theme === 'cloud') {
          flatColor = timeColors.plat;
          grainColor = timeColors.bubble; // 云朵内泡泡色
          slideBgColor = timeColors.slideBg;
          stripeColor = timeColors.stripe;
          strokeColor = timeColors.stroke;
        }

        // 1. 绘制平顶平台部分 (Safe Landing Deck)
        let flatX = p.x;
        if (isBoth) {
          flatX = p.x + slopeW;
        } else if (p.slopeDir === 'left-down') {
          flatX = p.x + p.w - flatW;
        } else {
          flatX = p.x;
        }

        // 填充平顶背景色
        ctx.fillStyle = flatColor;
        ctx.fillRect(flatX, p.y, flatW, p.h);

        // 平顶表面细节纹理
        if (theme === 'wood' || theme === 'stone') {
          ctx.strokeStyle = grainColor;
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(flatX + 4, p.y + p.h * 0.3);
          ctx.lineTo(flatX + flatW - 4, p.y + p.h * 0.3);
          ctx.moveTo(flatX + 8, p.y + p.h * 0.7);
          ctx.lineTo(flatX + flatW - 8, p.y + p.h * 0.7);
          ctx.stroke();
        } else {
          // 云朵平顶轻柔泡泡
          ctx.fillStyle = grainColor;
          ctx.beginPath();
          ctx.arc(flatX + flatW * 0.5, p.y + p.h * 0.5, p.h * 0.3, 0, Math.PI * 2);
          ctx.fill();
        }

        // 顶部高光微光线
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(flatX, p.y);
        ctx.lineTo(flatX + flatW, p.y);
        ctx.stroke();

        // 2. 绘制直角三角形滑动区域
        const drawSlopeSection = (sx, sy, sw, sh, sdir) => {
          ctx.save();
          // Clip 剪切限制于直角三角形内
          ctx.beginPath();
          if (sdir === 'left-down') {
            ctx.moveTo(sx, sy + sh);
            ctx.lineTo(sx + sw, sy);
            ctx.lineTo(sx + sw, sy + sh);
          } else {
            ctx.moveTo(sx, sy);
            ctx.lineTo(sx, sy + sh);
            ctx.lineTo(sx + sw, sy + sh);
          }
          ctx.closePath();
          ctx.clip();

          // 填充滑动底色
          ctx.fillStyle = slideBgColor;
          ctx.fillRect(sx, sy, sw, sh);

          // 绘制细密雅致的 45 度防滑凹槽槽线 (宽度 1.5px)
          ctx.strokeStyle = stripeColor;
          ctx.lineWidth = 1.5;
          const step = (theme === 'wood') ? 8 : 10;
          for (let x = sx - sh; x < sx + sw + sh; x += step) {
            ctx.beginPath();
            ctx.moveTo(x, sy);
            ctx.lineTo(x + sh, sy + sh);
            ctx.stroke();
          }
          ctx.restore();
        };

        if (isBoth) {
          drawSlopeSection(p.x, p.y, slopeW, p.h, 'left-down');
          drawSlopeSection(p.x + slopeW + flatW, p.y, slopeW, p.h, 'right-down');
        } else {
          if (p.slopeDir === 'left-down') {
            drawSlopeSection(p.x, p.y, slopeW, p.h, 'left-down');
          } else {
            drawSlopeSection(p.x + flatW, p.y, slopeW, p.h, 'right-down');
          }
        }

        // 3. 绘制整体斜坡平台的边界描边轮廓
        ctx.strokeStyle = strokeColor;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        if (isBoth) {
          ctx.moveTo(p.x, p.y + p.h);
          ctx.lineTo(p.x + slopeW, p.y);
          ctx.lineTo(p.x + slopeW + flatW, p.y);
          ctx.lineTo(p.x + p.w, p.y + p.h);
        } else if (p.slopeDir === 'left-down') {
          ctx.moveTo(p.x, p.y + p.h);
          ctx.lineTo(p.x + p.w - flatW, p.y);
          ctx.lineTo(p.x + p.w, p.y);
          ctx.lineTo(p.x + p.w, p.y + p.h);
        } else {
          ctx.moveTo(p.x, p.y + p.h);
          ctx.lineTo(p.x, p.y);
          ctx.lineTo(p.x + flatW, p.y);
          ctx.lineTo(p.x + p.w, p.y + p.h);
        }
        ctx.closePath();
        ctx.stroke();
        ctx.restore();
      } else {
        let platColor = '#6d8a76'; // 木质 (森)
        let strokeColor = '#4f6957';
        if (theme === 'stone') {
          platColor = '#a89e90'; // 石质 (遗迹)
          strokeColor = '#80776b';
        } else if (theme === 'cloud') {
          platColor = timeColors.plat; // 云朵 (顶)
          strokeColor = timeColors.stroke;
        }

        fillRoundRect(ctx, p.x, p.y, p.w, p.h, 4, platColor);
        strokeRoundRect(ctx, p.x, p.y, p.w, p.h, 4, strokeColor, 1.5);

        ctx.save();
        if (theme === 'stone') {
          // 石台加裂缝纹理
          ctx.strokeStyle = 'rgba(0, 0, 0, 0.12)';
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(p.x + p.w * 0.3, p.y);
          ctx.lineTo(p.x + p.w * 0.25, p.y + p.h * 0.5);
          ctx.lineTo(p.x + p.w * 0.35, p.y + p.h);
          ctx.stroke();

          // 顶部高光
          ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
          ctx.beginPath();
          ctx.moveTo(p.x + 2, p.y + 1);
          ctx.lineTo(p.x + p.w - 2, p.y + 1);
          ctx.stroke();
        } else if (theme === 'cloud') {
          // 云朵柔和内圈泡泡
          ctx.fillStyle = '#ebf3f7';
          ctx.beginPath();
          ctx.arc(p.x + p.w * 0.25, p.y + p.h * 0.5, p.h * 0.3, 0, Math.PI * 2);
          ctx.arc(p.x + p.w * 0.75, p.y + p.h * 0.5, p.h * 0.3, 0, Math.PI * 2);
          ctx.fill();
        } else {
          // 木台质感高光线与木纹暗线
          ctx.strokeStyle = 'rgba(255, 255, 255, 0.25)';
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(p.x + 4, p.y + 2);
          ctx.lineTo(p.x + p.w - 4, p.y + 2);
          ctx.stroke();

          ctx.strokeStyle = 'rgba(0, 0, 0, 0.1)';
          ctx.beginPath();
          ctx.moveTo(p.x + 6, p.y + p.h * 0.5);
          ctx.lineTo(p.x + p.w - 6, p.y + p.h * 0.5);
          ctx.stroke();
        }
        ctx.restore();
      }
    });

    // 绘制两侧主题墙壁装饰（藤蔓、石壁、云层），代替空气墙
    const wallLoopH = 120;
    const startWallY = Math.floor(this.cameraY / wallLoopH) * wallLoopH;
    const endWallY = this.cameraY + this.designH + wallLoopH;

    for (let wy = startWallY; wy < endWallY; wy += wallLoopH) {
      if (forestAlpha > 0.01) {
        ctx.save();
        ctx.globalAlpha = forestAlpha;
        this.drawVineSegment(ctx, wy, wallLoopH);
        ctx.restore();
      }
      if (ruinsAlpha > 0.01) {
        ctx.save();
        ctx.globalAlpha = ruinsAlpha;
        this.drawRuinsWallSegment(ctx, wy, wallLoopH);
        ctx.restore();
      }
      if (skyAlpha > 0.01) {
        ctx.save();
        ctx.globalAlpha = skyAlpha;
        this.drawSkyCloudSegment(ctx, wy, wallLoopH);
        ctx.restore();
      }
    }

    // 绘制起跳弹弓拉线轨迹抛物线
    if (this.state.state === 'charging' && this.dragStart && this.dragCurrent) {
      const dx = this.dragStart.x - this.dragCurrent.x;
      const dy = this.dragStart.y - this.dragCurrent.y;
      const dist = Math.hypot(dx, dy);

      if (dist > 8) {
        const dirX = dx / dist;
        const dirY = -Math.abs(dy / dist);
        const power = Math.min(1.0, dist / 110);
        const launchPower = 0.2 + power * 0.35;

        // 起步初速
        let trajVx = dirX * launchPower;
        let trajVy = dirY * launchPower;
        let trajX = this.state.x;
        let trajY = this.state.y;
        const trajG = 0.0006;
        const step = 40; // 每步 40ms

        ctx.save();
        for (let stepIdx = 1; stepIdx <= 12; stepIdx++) {
          // 下一步位置
          trajX += trajVx * step;
          trajVy += trajG * step;
          trajY += trajVy * step;

          // 越界弹回判定
          if (trajX - this.state.radius < 0) {
            trajX = this.state.radius;
            trajVx = -trajVx * 0.6;
          } else if (trajX + this.state.radius > this.designW) {
            trajX = this.designW - this.state.radius;
            trajVx = -trajVx * 0.6;
          }

          const alpha = 0.7 * (1.0 - stepIdx / 13);
          ctx.fillStyle = `rgba(44, 44, 44, ${alpha})`;
          ctx.beginPath();
          ctx.arc(trajX, trajY, 3.5 - (stepIdx * 0.15), 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.restore();
      }
    }

    // 绘制 Slime 弹性粘液球
    ctx.save();
    ctx.translate(this.state.x, this.state.y);

    // 腾空状态下根据当前速度旋转拉伸
    if (this.state.state === 'jumping' || this.state.state === 'falling') {
      const angle = Math.atan2(this.state.vy, this.state.vx);
      ctx.rotate(angle);
    }

    ctx.scale(this.state.scaleX, this.state.scaleY);

    // Slime 饭团主体
    ctx.fillStyle = '#7ea38c';
    ctx.beginPath();
    ctx.arc(0, 0, this.state.radius, 0, Math.PI * 2);
    ctx.fill();

    // 外描边轮廓以提高在深色背景下的对比度
    ctx.strokeStyle = '#25221d';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // 高光
    ctx.fillStyle = 'rgba(255, 255, 255, 0.28)';
    ctx.beginPath();
    ctx.arc(-this.state.radius * 0.35, -this.state.radius * 0.35, this.state.radius * 0.25, 0, Math.PI * 2);
    ctx.fill();

    // 呆萌表情眼睛 (旋转与缩放对齐)
    const R = this.state.radius;
    const cx1 = -R * 0.22;
    const cy1 = -R * 0.1;
    const cx2 = R * 0.28;
    const cy2 = -R * 0.1;

    ctx.save();
    ctx.strokeStyle = '#2c2c2c';
    ctx.lineWidth = 1.2;
    ctx.lineCap = 'round';
    ctx.fillStyle = '#2c2c2c';

    if (this.state.dizzyTimer > 0) {
      // 1. 晕眩眼 X X
      const drawX = (cx, cy) => {
        ctx.beginPath();
        ctx.moveTo(cx - 1.2, cy - 1.2);
        ctx.lineTo(cx + 1.2, cy + 1.2);
        ctx.moveTo(cx + 1.2, cy - 1.2);
        ctx.lineTo(cx - 1.2, cy + 1.2);
        ctx.stroke();
      };
      drawX(cx1, cy1);
      drawX(cx2, cy2);
    } else if (this.state.state === 'charging') {
      // 2. 蓄力眯眼 > <
      ctx.beginPath();
      // 左眼 >
      ctx.moveTo(cx1 - 1.2, cy1 - 1.2);
      ctx.lineTo(cx1 + 1.0, cy1);
      ctx.lineTo(cx1 - 1.2, cy1 + 1.2);
      // 右眼 <
      ctx.moveTo(cx2 + 1.2, cy2 - 1.2);
      ctx.lineTo(cx2 - 1.0, cy2);
      ctx.lineTo(cx2 + 1.2, cy2 + 1.2);
      ctx.stroke();
    } else if (this.state.state === 'jumping') {
      // 3. 起跳惊恐圆眼 (大，含高光)
      ctx.beginPath();
      ctx.arc(cx1, cy1, 1.4, 0, Math.PI * 2);
      ctx.arc(cx2, cy2, 1.4, 0, Math.PI * 2);
      ctx.fill();

      // 小白高光
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(cx1 - 0.4, cy1 - 0.4, 0.4, 0, Math.PI * 2);
      ctx.arc(cx2 - 0.4, cy2 - 0.4, 0.4, 0, Math.PI * 2);
      ctx.fill();
    } else if (this.state.state === 'falling') {
      // 4. 下落眼 ∩ ∩
      ctx.beginPath();
      ctx.arc(cx1, cy1 + 0.5, 1.2, Math.PI, 0);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(cx2, cy2 + 0.5, 1.2, Math.PI, 0);
      ctx.stroke();
    } else if (this.state.state === 'sliding') {
      // 5. 滑行惬意波浪眼 ~ ~
      const drawWave = (cx, cy) => {
        ctx.beginPath();
        ctx.moveTo(cx - 1.5, cy);
        ctx.quadraticCurveTo(cx - 0.75, cy - 0.8, cx, cy);
        ctx.quadraticCurveTo(cx + 0.75, cy + 0.8, cx + 1.5, cy);
        ctx.stroke();
      };
      drawWave(cx1, cy1);
      drawWave(cx2, cy2);
    } else {
      // 6. 默认常态高光眼
      ctx.beginPath();
      ctx.arc(cx1, cy1, 1.1, 0, Math.PI * 2);
      ctx.arc(cx2, cy2, 1.1, 0, Math.PI * 2);
      ctx.fill();

      // 白光亮点
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(cx1 - 0.3, cy1 - 0.3, 0.3, 0, Math.PI * 2);
      ctx.arc(cx2 - 0.3, cy2 - 0.3, 0.3, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.restore();
    ctx.restore();

    ctx.restore(); // 还原 Camera 偏移行
    ctx.restore(); // 还原 Letterbox 比例缩放行

    // 2. 绘制屏幕上层 UI 面板 (独立于 Camera，自适应)
    const paddingX = 18;
    const topBarY = this.host.safeTop + 54;
    const barW = width - paddingX * 2;
    const barH = 46;

    // 毛玻璃统计条
    fillRoundRect(ctx, paddingX, topBarY, barW, barH, theme.radius.md, 'rgba(255, 255, 255, 0.45)');
    strokeRoundRect(ctx, paddingX, topBarY, barW, barH, theme.radius.md, 'rgba(255, 255, 255, 0.6)', 1.5);

    const textCenterY = topBarY + barH / 2;
    if (this.state.mode === 'endless') {
      const scores = getScores()['jump'] || {};
      const bestH = scores.bestEndlessHeight || 0;
      drawText(ctx, `无尽攀爬：${this.state.score} px`, paddingX + 16, textCenterY, {
        size: 14,
        color: theme.color.ink,
        font: theme.font.body,
        weight: 'bold',
        align: 'left',
        baseline: 'middle'
      });
      drawText(ctx, `最佳记录：${bestH} px`, paddingX + barW - 16, textCenterY, {
        size: 13,
        color: theme.color.sage,
        font: theme.font.body,
        weight: 'bold',
        align: 'right',
        baseline: 'middle'
      });
    } else {
      drawText(ctx, `高度进度：${this.state.score}%`, paddingX + 16, textCenterY, {
        size: 14,
        color: theme.color.ink,
        font: theme.font.body,
        weight: 'bold',
        align: 'left',
        baseline: 'middle'
      });
      const activeCp = this.state.checkpoints[this.state.activeCheckpointIdx];
      const activeCpName = activeCp ? activeCp.name : '初始地面';
      drawText(ctx, activeCpName, paddingX + barW - 16, textCenterY, {
        size: 13,
        color: theme.color.sage,
        font: theme.font.body,
        weight: 'bold',
        align: 'right',
        baseline: 'middle'
      });
    }

    // 3. 在最边缘绘制 Letterbox 的黑色背景（如果屏幕特别宽，左右黑边进行物理遮罩，确保不透光）
    if (this.offsetX > 0) {
      ctx.fillStyle = '#1c1c1c';
      ctx.fillRect(0, 0, this.offsetX, height);
      ctx.fillRect(width - this.offsetX, 0, this.offsetX, height);
    }

    // 4. 自定义弹窗绘制
    if (this.sessionModal) {
      this.sessionModal.render(ctx, theme);
    }

    // 5. 手动重绘顶部按钮，置于最上层以防被背景和黑边覆盖
    this.buttons.forEach(b => b.render(ctx, theme));

    // 6. 绘制 Toast 气泡
    if (this.toastText && this.toastTimer > 0) {
      const alpha = Math.min(1.0, this.toastTimer / 300);
      ctx.save();
      ctx.globalAlpha = alpha;
      const toastW = 160;
      const toastH = 36;
      const toastX = (width - toastW) / 2;
      const toastY = height - 120; // 弹出在底部偏上处

      fillRoundRect(ctx, toastX, toastY, toastW, toastH, 6, 'rgba(0, 0, 0, 0.75)');
      drawText(ctx, this.toastText, width / 2, toastY + toastH / 2, {
        size: 13,
        color: '#ffffff',
        align: 'center',
        baseline: 'middle',
        font: theme.font.body
      });
      ctx.restore();
    }
  }

  destroy() {
    super.destroy();
    if (this.sessionModal) {
      this.sessionModal.destroy();
      this.sessionModal = null;
    }
  }
}
