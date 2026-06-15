import assert from 'assert';
import { performance } from 'perf_hooks';

// Mock wx globally before importing state.js
globalThis.wx = {
  getStorageSync: () => ({}),
  setStorageSync: () => ({})
};

import { OneStrokeState, CELL_TYPES } from './state.js';

console.log('Running One Stroke Game State Engine Unit Tests (500 iterations)...');

const startTotal = performance.now();

for (let i = 1; i <= 500; i++) {
  // Random size from [4, 5, 6]
  const sizes = [4, 5, 6];
  const size = sizes[Math.floor(Math.random() * sizes.length)];
  
  // Random obstacle count from [1, 2, 3]
  const obstacleCount = Math.floor(Math.random() * 3) + 1;

  // Measure map generation time
  const startGen = performance.now();
  const state = new OneStrokeState(size, obstacleCount);
  const genDuration = performance.now() - startGen;

  // 1. Assert map generation takes less than 15ms
  assert.ok(genDuration < 15, `Iteration ${i}: Generation took too long: ${genDuration.toFixed(2)}ms`);

  // 2. Assert number of obstacles is between 1 and 3
  assert.ok(state.obstacleCount >= 1 && state.obstacleCount <= 3, `Iteration ${i}: Obstacle count must be 1 to 3`);

  // Count obstacles on the grid
  let actualObstacleCount = 0;
  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      if (state.grid[r][c] === CELL_TYPES.OBSTACLE) {
        actualObstacleCount++;
      }
    }
  }
  assert.strictEqual(actualObstacleCount, obstacleCount, `Iteration ${i}: Grid obstacles count mismatch`);

  // 3. Assert all non-obstacle cells match the generated Hamiltonian path exactly
  assert.strictEqual(state.solutionPath.length, size * size - obstacleCount, `Iteration ${i}: Solution path length mismatch`);
  
  const pathCoords = new Set();
  state.solutionPath.forEach((cell, idx) => {
    // Assert coordinates within boundary
    assert.ok(cell.r >= 0 && cell.r < size, `Iteration ${i}: Row out of bounds: ${cell.r}`);
    assert.ok(cell.c >= 0 && cell.c < size, `Iteration ${i}: Col out of bounds: ${cell.c}`);
    
    // Assert unique coordinates
    const key = `${cell.r},${cell.c}`;
    assert.ok(!pathCoords.has(key), `Iteration ${i}: Duplicate cell in solution path: ${key}`);
    pathCoords.add(key);

    // Assert grid type matches
    const expectedType = idx === 0 ? CELL_TYPES.START : CELL_TYPES.WALKABLE;
    assert.strictEqual(state.grid[cell.r][cell.c], expectedType, `Iteration ${i}: Grid cell type mismatch at index ${idx}`);
  });

  // 4. Test movements, undo, rollback
  const sol = state.solutionPath;
  assert.strictEqual(state.path.length, 1);
  assert.deepStrictEqual(state.path[0], sol[0]);

  // Test dragTo adjacent unvisited cell
  let changed = state.dragTo(sol[1].r, sol[1].c);
  assert.strictEqual(changed, true, `Iteration ${i}: Failed to drag to sol[1]`);
  assert.strictEqual(state.path.length, 2);
  assert.deepStrictEqual(state.path[1], sol[1]);

  // Test dragTo adjacent unvisited cell again
  changed = state.dragTo(sol[2].r, sol[2].c);
  assert.strictEqual(changed, true, `Iteration ${i}: Failed to drag to sol[2]`);
  assert.strictEqual(state.path.length, 3);

  // Test dragTo second-to-last cell (back-sliding erase)
  changed = state.dragTo(sol[1].r, sol[1].c);
  assert.strictEqual(changed, true, `Iteration ${i}: Back-sliding erase failed`);
  assert.strictEqual(state.path.length, 2);
  assert.deepStrictEqual(state.path[state.path.length - 1], sol[1]);

  // Redo the move to sol[2]
  changed = state.dragTo(sol[2].r, sol[2].c);
  assert.strictEqual(changed, true, `Iteration ${i}: Failed to redo move to sol[2]`);

  // Move to sol[3] and sol[4] if available
  if (sol.length > 4) {
    changed = state.dragTo(sol[3].r, sol[3].c);
    assert.strictEqual(changed, true);
    changed = state.dragTo(sol[4].r, sol[4].c);
    assert.strictEqual(changed, true);
    assert.strictEqual(state.path.length, 5);

    // Test history rollback: drag to sol[1] which is index 1, less than length - 2 (3)
    changed = state.dragTo(sol[1].r, sol[1].c);
    assert.strictEqual(changed, true, `Iteration ${i}: History rollback to index 1 failed`);
    assert.strictEqual(state.path.length, 2);
    assert.deepStrictEqual(state.path[0], sol[0]);
    assert.deepStrictEqual(state.path[1], sol[1]);
    
    // Move forward again
    changed = state.dragTo(sol[2].r, sol[2].c);
    assert.strictEqual(changed, true);
    changed = state.dragTo(sol[3].r, sol[3].c);
    assert.strictEqual(changed, true);
    assert.strictEqual(state.path.length, 4);

    // Test undo
    changed = state.undo();
    assert.strictEqual(changed, true, `Iteration ${i}: Undo failed`);
    assert.strictEqual(state.path.length, 3);
  }

  // Test reset
  changed = state.resetPath();
  assert.strictEqual(changed, true, `Iteration ${i}: Reset path failed`);
  assert.strictEqual(state.path.length, 1);
  assert.deepStrictEqual(state.path[0], sol[0]);

  // Drag to win
  for (let idx = 1; idx < sol.length; idx++) {
    changed = state.dragTo(sol[idx].r, sol[idx].c);
    assert.strictEqual(changed, true, `Iteration ${i}: Failed dragging to index ${idx} during win run`);
  }

  // Assert victory state
  assert.strictEqual(state.won, true, `Iteration ${i}: Game should be won`);
  assert.strictEqual(state.saved, true, `Iteration ${i}: Game result should be saved`);
  assert.strictEqual(state.path.length, state.totalWalkable, `Iteration ${i}: Path length must equal totalWalkable at win`);

  // Dragging after win should fail
  changed = state.dragTo(sol[0].r, sol[0].c);
  assert.strictEqual(changed, false, `Iteration ${i}: Dragging after win should return false`);
}

const totalDuration = performance.now() - startTotal;
console.log(`\n\x1b[32m✔ SUCCESS: All 500 test cases passed successfully in ${totalDuration.toFixed(2)}ms! (Average: ${(totalDuration / 500).toFixed(2)}ms per generation + test run)\x1b[0m`);
