/**
 * Easing functions used across scenes and modals.
 * All take t in [0,1] and return a value in [0,1] (may overshoot for back).
 */

export function easeOutQuart(t) {
  return 1 - Math.pow(1 - t, 4);
}

export function easeInQuad(t) {
  return t * t;
}

export function easeOutBack(t, c1 = 1.70158) {
  return 1 + (c1 + 1) * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
}

export function easeOutCubic(t) {
  return 1 - Math.pow(1 - t, 3);
}

/**
 * Smooth lerp for animated transitions (height, alpha, etc.)
 * Uses exponential decay: converges toward target with a speed factor.
 * Formula extracted from config-modal.js smooth height/alpha transitions.
 *
 * @param {number} current - current value
 * @param {number} target - target value
 * @param {number} dt - delta time in ms
 * @param {number} speed - convergence speed factor (larger = slower)
 * @returns {number} new value after one frame of interpolation
 */
export function smoothLerp(current, target, dt, speed) {
  const factor = 1 - Math.pow(0.05, dt / speed);
  return current + (target - current) * factor;
}
