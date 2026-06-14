const canvas = document.getElementById('game');
const storage = new Map();
const handlers = {
  touchstart: [],
  touchmove: [],
  touchend: [],
  touchcancel: [],
};

/**
 * 根据容器 CSS 尺寸和 devicePixelRatio 调整 canvas 物理尺寸，
 * 确保与 render.js 的 pixelRatio 方案一致。
 */
function resizeCanvas() {
  const rect = canvas.getBoundingClientRect();
  const dpr = window.devicePixelRatio || 1;
  canvas.width = rect.width * dpr;
  canvas.height = rect.height * dpr;
  // canvas 的 CSS 尺寸由 style 控制，与 getBoundingClientRect 一致
}
window.addEventListener('resize', resizeCanvas);
resizeCanvas();

function toTouchEvent(event, active) {
  const rect = canvas.getBoundingClientRect();
  // clientX/Y 本身就是 CSS 逻辑像素，与 ctx.scale(pixelRatio) 后的坐标体系一致
  const touch = {
    clientX: event.clientX - rect.left,
    clientY: event.clientY - rect.top,
  };

  return active
    ? {
        touches: [touch],
        changedTouches: [touch],
      }
    : {
        touches: [],
        changedTouches: [touch],
      };
}

function emit(name, event, active) {
  handlers[name].forEach((handler) => handler(toTouchEvent(event, active)));
}

canvas.addEventListener('pointerdown', (event) => {
  canvas.setPointerCapture(event.pointerId);
  emit('touchstart', event, true);
});

canvas.addEventListener('pointermove', (event) => {
  if (event.buttons) {
    emit('touchmove', event, true);
  }
});

canvas.addEventListener('pointerup', (event) => {
  emit('touchend', event, false);
});

canvas.addEventListener('pointercancel', (event) => {
  emit('touchcancel', event, false);
});

globalThis.GameGlobal = {};
globalThis.wx = {
  createCanvas() {
    return canvas;
  },
  getWindowInfo() {
    const rect = canvas.getBoundingClientRect();
    return {
      windowWidth: rect.width,
      windowHeight: rect.height,
      screenWidth: rect.width,
      screenHeight: rect.height,
      pixelRatio: window.devicePixelRatio || 1,
      safeArea: { top: 0, bottom: rect.height, left: 0, right: rect.width },
      statusBarHeight: 0,
    };
  },
  getSystemInfoSync() {
    return this.getWindowInfo();
  },
  onTouchStart(handler) {
    handlers.touchstart.push(handler);
  },
  onTouchMove(handler) {
    handlers.touchmove.push(handler);
  },
  onTouchEnd(handler) {
    handlers.touchend.push(handler);
  },
  onTouchCancel(handler) {
    handlers.touchcancel.push(handler);
  },
  getStorageSync(key) {
    return storage.get(key) || '';
  },
  setStorageSync(key, value) {
    storage.set(key, value);
  },
};

await import('../game.js');
