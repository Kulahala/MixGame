import './render.js';
import { PIXEL_RATIO } from './render.js';
import GameHost from './core/game-host.js';

const ctx = GameGlobal.canvas.getContext('2d');

// 缩放上下文，使绘制坐标与逻辑像素一致
ctx.scale(PIXEL_RATIO, PIXEL_RATIO);

export default class Main {
  constructor() {
    this.host = new GameHost(ctx);
    this.host.start();
  }
}
