import { SCREEN_WIDTH, SCREEN_HEIGHT, SAFE_TOP } from '../render.js';
import elegantTheme from '../themes/elegant.js';
import MenuScene from '../scenes/menu-scene.js';
import { getGameConfig } from '../games/registry.js';
import Confetti from '../ui/confetti.js';

export default class GameHost {
  constructor(ctx) {
    this.ctx = ctx;
    this.theme = elegantTheme;
    this.width = SCREEN_WIDTH;
    this.height = SCREEN_HEIGHT;
    this.safeTop = SAFE_TOP;
    this.scene = null;
    this.aniId = 0;
    this.lastTime = 0;
    this.sceneAge = 0;
    this.effects = { confetti: new Confetti(this) };
    this._boundLoop = this.loop.bind(this);
    this.bindTouchEvents();
  }

  start() {
    this.showMenu();
    this.aniId = requestAnimationFrame(this._boundLoop);
  }

  bindTouchEvents() {
    const dispatchTouch = (method, e, useChanged = false) => {
      const touches = useChanged ? e.changedTouches : e.touches;
      if (!touches || touches.length === 0) return;
      const touch = touches[0];
      if (this.scene && this.scene[method]) {
        this.scene[method]({ x: touch.clientX, y: touch.clientY });
      }
    };

    wx.onTouchStart((e) => dispatchTouch('onTouchStart', e));
    wx.onTouchMove((e) => dispatchTouch('onTouchMove', e));
    wx.onTouchEnd((e) => dispatchTouch('onTouchEnd', e, true));
    if (wx.onTouchCancel) {
      wx.onTouchCancel((e) => dispatchTouch('onTouchEnd', e, true));
    }
  }

  setScene(scene) {
    if (this.scene && this.scene.destroy) {
      this.scene.destroy();
    }
    this.sceneAge = 0;
    this.scene = scene;
    if (this.scene.init) {
      this.scene.init();
    }
  }

  showMenu() {
    const menu = new MenuScene(this);
    if (this.lastMenuPage !== undefined) {
      menu.currentPage = this.lastMenuPage;
    }
    this.setScene(menu);
  }

  startGame(id, options = {}) {
    const config = getGameConfig(id);
    if (config && config.sceneClass) {
      const SceneClass = config.sceneClass;
      this.setScene(new SceneClass(this, options));
    }
  }

  defer(action, delay = 90) {
    setTimeout(() => {
      if (typeof action === 'function') {
        action();
      }
    }, delay);
  }

  loop(timestamp) {
    const dt = Math.min(50, timestamp - (this.lastTime || timestamp));
    this.lastTime = timestamp;
    this.sceneAge += dt;

    if (this.scene && this.scene.update) {
      this.scene.update(dt);
    }
    
    // Effects update
    Object.values(this.effects).forEach(effect => {
      if (effect.update) effect.update(dt);
    });

    if (this.scene && this.scene.render) {
      this.scene.render(this.ctx);
    }

    // Effects render
    Object.values(this.effects).forEach(effect => {
      if (effect.render) effect.render(this.ctx);
    });

    this.aniId = requestAnimationFrame(this._boundLoop);
  }
}
