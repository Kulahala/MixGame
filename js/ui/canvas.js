export function roundRect(ctx, x, y, w, h, r) {
  const radius = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + w, y, x + w, y + h, radius);
  ctx.arcTo(x + w, y + h, x, y + h, radius);
  ctx.arcTo(x, y + h, x, y, radius);
  ctx.arcTo(x, y, x + w, y, radius);
  ctx.closePath();
}

export function fillRoundRect(ctx, x, y, w, h, r, color) {
  ctx.fillStyle = color;
  roundRect(ctx, x, y, w, h, r);
  ctx.fill();
}

export function strokeRoundRect(ctx, x, y, w, h, r, color, width = 1) {
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  roundRect(ctx, x, y, w, h, r);
  ctx.stroke();
}

export function drawText(ctx, text, x, y, options = {}) {
  const {
    size = 16,
    color = '#25221d', // theme.color.ink
    align = 'left',
    baseline = 'middle',
    font = 'sans-serif',
    weight = 'normal',
  } = options;

  ctx.fillStyle = color;
  ctx.textAlign = align;
  ctx.textBaseline = baseline;
  ctx.font = `${weight} ${size}px ${font}`;
  ctx.fillText(text, x, y);
}

/**
 * Apply scale transform around a center point.
 * Replaces the translate→scale→translate pattern.
 */
export function scaleAround(ctx, cx, cy, scale) {
  ctx.translate(cx, cy);
  ctx.scale(scale, scale);
  ctx.translate(-cx, -cy);
}

/**
 * Clamp a value between min and max.
 */
export function clamp(val, min, max) {
  return Math.max(min, Math.min(max, val));
}

/**
 * Hit-test a point against a grid layout.
 * @param {{ x: number, y: number }} point
 * @param {number} gridX - grid origin X
 * @param {number} gridY - grid origin Y
 * @param {number} cellSize - width/height of each cell
 * @param {number} gap - space between cells
 * @param {number} rows
 * @param {number} cols
 * @returns {{ row: number, col: number } | null}
 */
export function hitTestGrid(point, gridX, gridY, cellSize, gap, rows, cols) {
  const col = Math.floor((point.x - gridX) / (cellSize + gap));
  const row = Math.floor((point.y - gridY) / (cellSize + gap));
  if (row < 0 || row >= rows || col < 0 || col >= cols) return null;
  // Verify point is within the cell (not in the gap)
  const cellX = gridX + col * (cellSize + gap);
  const cellY = gridY + row * (cellSize + gap);
  if (point.x > cellX + cellSize || point.y > cellY + cellSize) return null;
  return { row, col };
}

export function contains(rect, x, y) {
  return x >= rect.x && x <= rect.x + rect.w && y >= rect.y && y <= rect.y + rect.h;
}
