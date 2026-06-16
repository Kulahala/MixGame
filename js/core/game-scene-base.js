import Button from '../ui/button.js';
import ResultModal from '../ui/result-modal.js';
import InputDispatcher from './input-dispatcher.js';
import { easeOutQuart, easeInQuad } from '../ui/animation.js';

/**
 * BaseGameScene — 游戏场景基类
 *
 * 封装了所有场景通用的生命周期逻辑：
 * - 进场/退场动画
 * - 顶部按钮（返回 + 重开）
 * - ResultModal 创建与销毁
 * - 输入分发与销毁清理
 *
 * 子类需实现：
 *   reset()         — 重置游戏状态
 *   renderGame(ctx) — 在动画包裹层内渲染游戏内容
 */
export default class BaseGameScene {
  constructor(host, options = {}) {
    this.host = host;
    this.theme = host.theme;
    this.input = new InputDispatcher();
    this.buttons = [];
    this.modal = null;

    // Exit animation state
    this.isExiting = false;
    this.exitTime = 0;
    this.exitDuration = 200;
    this.exitCallback = null;
  }

  // ── 退场动画 ────────────────────────────────────

  /**
   * 触发退场动画，动画结束后调用 callback
   * @param {Function} callback
   */
  exit(callback) {
    this.isExiting = true;
    this.exitTime = 0;
    this.exitCallback = callback;
  }

  // ── 子类必须实现 ────────────────────────────────

  /** 重置游戏状态（重开后调用） */
  reset() {
    throw new Error('Subclass must implement reset()');
  }

  /** 渲染游戏内容（已在进场/退场动画包裹内） */
  renderGame(ctx) {
    throw new Error('Subclass must implement renderGame(ctx)');
  }

  // ── 顶部按钮 ────────────────────────────────────

  /**
   * 创建标准的顶部按钮（返回 + 重开）
   * @param {Array} extraButtons — 插入在返回与重开之间的额外按钮
   */
  createTopButtons(extraButtons = []) {
    const width = this.host.width;
    const topY = this.host.safeTop + 8;

    this.backButton = new Button({
      x: 18, y: topY, w: 74, h: 36,
      label: '返回', variant: 'ghost',
      onClick: () => this.exit(() => this.host.showMenu()),
    });

    this.buttons = [this.backButton, ...extraButtons];
    this.buttons.forEach(b => this.input.add(b));
  }

  // ── 结果弹窗 ────────────────────────────────────

  /**
   * 展示结果弹窗（胜利/失败），胜利时自动撒花
   * @param {string} title — 弹窗标题
   * @param {Array}  stats — 统计项 [{label, value}]
   * @param {boolean} isWin — 是否胜利
   * @param {Array}  history — 历史最佳记录 [{label, highlight}]
   */
  showResult(title, stats, isWin = true, history = []) {
    // 防止重复调用
    if (this.modal) return;

    if (isWin) {
      this.host.effects.confetti.fire(this.host.width / 2, this.host.height / 2);
    }

    this.modal = new ResultModal({
      host: this.host,
      title: title,
      stats: stats,
      history: history,
      onMenu: () => {
        this.modal.close(() => {
          this.exit(() => this.host.showMenu());
        });
      },
      onRestart: () => this.reset(),
    });

    this.input.add(this.modal);
  }

  /**
   * 关闭当前弹窗（重置场景时用）
   */
  closeModal() {
    if (this.modal) {
      this.input.remove(this.modal);
      this.modal.destroy();
      this.modal = null;
    }
  }

  // ── 更新循环 ────────────────────────────────────

  /**
   * 标准 update：处理退场动画
   * @param {number} dt — 帧间隔（ms）
   * @returns {boolean} true = 正在退场，子类应跳过游戏逻辑更新
   */
  update(dt = 16) {
    if (this.isExiting) {
      this.exitTime = Math.min(this.exitDuration, this.exitTime + dt);
      if (this.exitTime >= this.exitDuration && this.exitCallback) {
        const cb = this.exitCallback;
        this.exitCallback = null;
        cb();
      }
      return true; // 正在退场，跳过游戏逻辑
    }
    return false; // 正常更新
  }

  // ── 渲染 ────────────────────────────────────────

  /**
   * 标准 render：背景 + 进场/退场动画 + 按钮 + 游戏内容 + 弹窗
   */
  render(ctx) {
    const theme = this.theme;

    // 进场动画
    const progress = Math.min(1, this.host.sceneAge / 320);
    const ease = easeOutQuart(progress);
    const reveal = ease;

    // 退场动画
    let exitAlpha = 1;
    let exitOffset = 0;
    if (this.isExiting) {
      const p = this.exitTime / this.exitDuration;
      const easeExit = easeInQuad(p);
      exitAlpha = 1 - easeExit;
      exitOffset = easeExit * 16;
    }
    // 背景
    ctx.clearRect(0, 0, this.host.width, this.host.height);
    ctx.fillStyle = theme.color.bg;
    ctx.fillRect(0, 0, this.host.width, this.host.height);

    // 退场动画包裹
    ctx.save();
    ctx.globalAlpha = exitAlpha;
    ctx.translate(0, exitOffset);

    // 进场动画包裹
    ctx.save();
    ctx.globalAlpha = exitAlpha * reveal;
    ctx.translate(0, (1 - reveal) * 10);

    // 顶部按钮
    this.buttons.forEach(b => b.render(ctx, theme));

    // 子类游戏内容
    this.renderGame(ctx);

    ctx.restore();
    ctx.restore();

    // 弹窗（不受动画影响）
    if (this.modal) {
      this.modal.render(ctx, theme);
    }
  }

  // ── 触摸事件 ────────────────────────────────────

  onTouchStart(point) {
    if (this.isExiting) return;
    this.input.onTouchStart(point.x, point.y);
  }

  onTouchMove(point) {
    if (this.isExiting) return;
    this.input.onTouchMove(point.x, point.y);
  }

  onTouchEnd(point) {
    if (this.isExiting) return;
    this.input.onTouchEnd(point.x, point.y);
  }

  // ── 销毁 ────────────────────────────────────────

  destroy() {
    this.buttons.forEach(b => b.destroy && b.destroy());
    this.closeModal();
    this.input.clear();
    this.buttons = [];
  }
}
