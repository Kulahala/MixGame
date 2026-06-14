export default class InputDispatcher {
  constructor() {
    this.receivers = [];
    this.activeReceiver = null;
  }

  add(receiver) {
    if (!this.receivers.includes(receiver)) {
      this.receivers.push(receiver);
    }
  }

  remove(receiver) {
    this.receivers = this.receivers.filter((r) => r !== receiver);
    if (this.activeReceiver === receiver) {
      this.activeReceiver = null;
    }
  }

  clear() {
    this.receivers = [];
    this.activeReceiver = null;
  }

  onTouchStart(x, y) {
    this.activeReceiver = null;
    let handled = false;
    // 从后向前遍历，后添加的（通常是处于上层的，如Modal）优先处理
    for (let i = this.receivers.length - 1; i >= 0; i--) {
      const r = this.receivers[i];
      if (r.onTouchStart && r.onTouchStart(x, y)) {
        this.activeReceiver = r;
        handled = true;
        break;
      }
    }
    return handled;
  }

  onTouchMove(x, y) {
    if (this.activeReceiver && this.activeReceiver.onTouchMove) {
      this.activeReceiver.onTouchMove(x, y);
    }
  }

  onTouchEnd(x, y) {
    if (this.activeReceiver && this.activeReceiver.onTouchEnd) {
      this.activeReceiver.onTouchEnd(x, y);
      // 清空激活状态，防止多点触控导致的状态残留
      this.activeReceiver = null;
    }
  }
}
