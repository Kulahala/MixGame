import { SCREEN_WIDTH, SCREEN_HEIGHT } from '../render.js';
import elegantTheme from '../themes/elegant.js';
import MenuScene from '../scenes/menu-scene.js';
import SudokuScene from '../games/sudoku/index.js';
import HuarongdaoScene from '../games/huarongdao/index.js';

export default class GameHost {
  constructor(ctx) {
    this.ctx = ctx;
    this.theme = elegantTheme;
    this.width = SCREEN_WIDTH;
    this.height = SCREEN_HEIGHT;
    this.scene = null;
    this.aniId = 0;
    this.lastTime = 0;
    this.sceneAge = 0;
    this.bindTouchEvents();
  }

  start() {
    this.showMenu();
    this.aniId = requestAnimationFrame(this.loop.bind(this));
  }

  bindTouchEvents() {
    wx.onTouchStart((event) => this.dispatchTouch('onTouchStart', event));
    wx.onTouchMove((event) => this.dispatchTouch('onTouchMove', event));
    wx.onTouchEnd((event) => this.dispatchTouch('onTouchEnd', event));
    wx.onTouchCancel((event) => this.dispatchTouch('onTouchEnd', event));
  }

  dispatchTouch(method, event) {
    if (!this.scene || !this.scene[method]) return;
    const touch = event.touches && event.touches[0] ? event.touches[0] : event.changedTouches && event.changedTouches[0];
    if (!touch) return;
    this.scene[method]({
      x: touch.clientX,
      y: touch.clientY,
      raw: event,
    });
  }

  setScene(scene) {
    if (this.scene && this.scene.destroy) {
      this.scene.destroy();
    }
    this.scene = scene;
    this.sceneAge = 0;
    if (this.scene.init) {
      this.scene.init();
    }
  }

  showMenu() {
    this.setScene(new MenuScene(this));
  }

  startGame(id) {
    if (id === 'sudoku') {
      this.setScene(new SudokuScene(this));
      return;
    }
    if (id === 'huarongdao') {
      this.setScene(new HuarongdaoScene(this));
    }
  }

  loop(timestamp) {
    const dt = Math.min(50, timestamp - (this.lastTime || timestamp));
    this.lastTime = timestamp;
    this.sceneAge += dt;

    if (this.scene && this.scene.update) {
      this.scene.update(dt);
    }
    if (this.scene && this.scene.render) {
      this.scene.render(this.ctx);
    }

    this.aniId = requestAnimationFrame(this.loop.bind(this));
  }
}
