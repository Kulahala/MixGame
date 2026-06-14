import './render.js';
import GameHost from './core/game-host.js';

const ctx = GameGlobal.canvas.getContext('2d');

export default class Main {
  constructor() {
    this.host = new GameHost(ctx);
    this.host.start();
  }
}
