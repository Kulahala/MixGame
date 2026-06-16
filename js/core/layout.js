/**
 * Screen tier detection for responsive layout.
 * Used by all game scenes to determine layout parameters.
 */

/**
 * @param {number} width - screen logical width
 * @param {number} height - screen logical height
 * @returns {'tablet'|'standard'|'compact'|'tiny'}
 */
export function getScreenTier(width, height) {
  const isTablet = width >= 500 && height >= 600 && height >= width;
  if (isTablet) return 'tablet';
  if (height >= 700) return 'standard';
  if (height >= 600) return 'compact';
  return 'tiny';
}
