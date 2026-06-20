import BaseGameScene from '../../core/game-scene-base.js';
import { getScores, getSession, saveSession, clearSession } from '../../core/storage.js';
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
    this.gameId = 'jump';
    this.state = new JumpState();
    this.bottomQuote = getRandomQuote('jump') || '温暖的篝火旁，有新的开始。';

    // 镜头相机 Y
    this.cameraY = 3200 - 540;

    // 拖拽手势状态
    this.dragStart = null; // { x, y } (逻辑坐标)
    this.dragCurrent = null; // { x, y }

    // 篝火火焰例子数组
    this.campfireParticles = [];

    // 存档引导 modal
    this.sessionModal = null;

    // 拖拽蓄力轻微触觉震动段落档位
    this.lastVibrateStep = 0;
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
    this.createTopButtons([this.respawnButton]);

    // 篝火复位
    this.cameraY = 3200 - this.designH;

    // 读取存档
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
  }

  reset() {
    this.closeModal();
    if (this.sessionModal) {
      this.input.remove(this.sessionModal);
      this.sessionModal.destroy();
      this.sessionModal = null;
    }

    const saved = getSession('jump');
    this.state.reset(saved);
    this.cameraY = this.state.y - this.designH * 0.6;
    this.bottomQuote = getRandomQuote('jump') || '每一堆燃起的篝火，都是攀登者的誓言。';
    this.lastVibrateStep = 0;
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
    }

    // 监听撞击反弹事件，触发轻微触觉反馈
    if (this.state.justBouncedWall || this.state.justBouncedCeiling) {
      if (typeof wx !== 'undefined' && wx.vibrateShort) {
        wx.vibrateShort({ type: 'light' });
      }
    }

    // 平滑镜头追随 (60% 屏幕处)
    const targetCameraY = this.state.y - this.designH * 0.6;
    const maxCamY = 3200 - this.designH;
    const limitCamY = Math.max(0, Math.min(maxCamY, targetCameraY));
    this.cameraY += (limitCamY - this.cameraY) * 0.08;

    // 篝火火焰粒子更新
    this.campfireParticles.forEach(p => p.update(dt));
    this.campfireParticles = this.campfireParticles.filter(p => p.alpha > 0);

    // 周期性往点亮的篝火里扔火焰粒子
    const activeCp = this.state.checkpoints[this.state.activeCheckpointIdx];
    if (activeCp && Math.random() < 0.25) {
      this.campfireParticles.push(new CampfireParticle(activeCp.x, activeCp.y));
    }

    // 终局胜利检测
    if (this.state.saved && !this.completed) {
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
    const forestY = 3200 - this.designH;
    const ruinsY = 1650 - this.designH;
    const skyY = 0;

    let colorTop = '#e5ebd7';
    let colorBottom = '#d8e5d9';

    const colors = {
      forest: { top: '#e5ebd7', bottom: '#d8e5d9' },
      ruins:  { top: '#ebdecb', bottom: '#e6ebd5' },
      sky:    { top: '#d1e6f5', bottom: '#ebe0ca' }
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

    // Y轴的视口投影转换 (世界 Y ➔ 视口 Y)
    ctx.save();
    ctx.translate(0, -this.cameraY);

    // 绘制篝火 (Checkpoint)
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

    // 粒子渲染
    this.campfireParticles.forEach(p => p.render(ctx));

    // 绘制所有平台
    this.state.platforms.forEach(p => {
      let platColor = '#6d8a76'; // 木质 (森)
      let strokeColor = '#4f6957';
      if (p.type === 'stone') {
        platColor = '#a89e90'; // 石质 (遗迹)
        strokeColor = '#80776b';
      } else if (p.type === 'cloud') {
        platColor = '#ffffff'; // 云朵 (顶)
        strokeColor = '#ccdbe3';
      }

      fillRoundRect(ctx, p.x, p.y, p.w, p.h, 3, platColor);
      strokeRoundRect(ctx, p.x, p.y, p.w, p.h, 3, strokeColor, 1.5);

      // 云顶轻柔修饰线
      if (p.type === 'cloud') {
        ctx.fillStyle = '#ebf3f7';
        ctx.beginPath();
        ctx.arc(p.x + p.w * 0.25, p.y + p.h * 0.5, p.h * 0.3, 0, Math.PI * 2);
        ctx.arc(p.x + p.w * 0.75, p.y + p.h * 0.5, p.h * 0.3, 0, Math.PI * 2);
        ctx.fill();
      }
    });

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

    // 高光
    ctx.fillStyle = 'rgba(255, 255, 255, 0.28)';
    ctx.beginPath();
    ctx.arc(-this.state.radius * 0.35, -this.state.radius * 0.35, this.state.radius * 0.25, 0, Math.PI * 2);
    ctx.fill();

    // 呆萌眼睛
    ctx.fillStyle = '#2c2c2c';
    ctx.beginPath();
    ctx.arc(-this.state.radius * 0.22, -this.state.radius * 0.1, 1.1, 0, Math.PI * 2);
    ctx.arc(this.state.radius * 0.28, -this.state.radius * 0.1, 1.1, 0, Math.PI * 2);
    ctx.fill();
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
    // 左右留白
    drawText(ctx, `高度进度：${this.state.score}%`, paddingX + 16, textCenterY, {
      size: 14,
      color: theme.color.ink,
      font: theme.font.body,
      weight: 'bold',
      align: 'left',
      baseline: 'middle'
    });

    const activeCpName = this.state.checkpoints[this.state.activeCheckpointIdx].name;
    drawText(ctx, activeCpName, paddingX + barW - 16, textCenterY, {
      size: 13,
      color: theme.color.sage,
      font: theme.font.body,
      weight: 'bold',
      align: 'right',
      baseline: 'middle'
    });

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
