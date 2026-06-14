const canvas = document.getElementById('game');
const storage = new Map();
const handlers = {
  touchstart: [],
  touchmove: [],
  touchend: [],
  touchcancel: [],
};

function toTouchEvent(event, active) {
  const rect = canvas.getBoundingClientRect();
  const touch = {
    clientX: ((event.clientX - rect.left) / rect.width) * canvas.width,
    clientY: ((event.clientY - rect.top) / rect.height) * canvas.height,
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
    return {
      screenWidth: canvas.width,
      screenHeight: canvas.height,
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
