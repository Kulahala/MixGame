import assert from 'assert';
import { performance } from 'perf_hooks';

// Mock wx globally before importing state.js
globalThis.wx = {
  getStorageSync: () => ({}),
  setStorageSync: () => ({})
};

import { ReversiState } from './state.js';

// Helper to compute legal moves on any arbitrary board (independent copy for validation)
function getLegalMovesForBoard(board, player) {
  const opponent = 3 - player;
  const legalMoves = [];
  const dirs = [
    [-1, -1], [-1, 0], [-1, 1],
    [0, -1],           [0, 1],
    [1, -1],  [1, 0],  [1, 1]
  ];

  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      if (board[r][c] !== 0) continue;
      let allFlips = [];

      for (const [dr, dc] of dirs) {
        let nr = r + dr;
        let nc = c + dc;
        const path = [];

        while (nr >= 0 && nr < 8 && nc >= 0 && nc < 8 && board[nr][nc] === opponent) {
          path.push({ r: nr, c: nc });
          nr += dr;
          nc += dc;
        }

        if (nr >= 0 && nr < 8 && nc >= 0 && nc < 8 && board[nr][nc] === player) {
          if (path.length > 0) {
            allFlips = allFlips.concat(path);
          }
        }
      }

      if (allFlips.length > 0) {
        legalMoves.push({ r, c, flips: allFlips });
      }
    }
  }
  return legalMoves;
}

console.log('Running Reversi State Engine Unit & AI self-play Tests (100 rounds)...');

const startTotal = performance.now();

// AI latency performance metrics
let totalAITime = 0;
let maxAITime = 0;
let totalAICalls = 0;
let under15msCount = 0;

for (let round = 1; round <= 100; round++) {
  // Rotate/assign difficulty combinations to test different AI levels
  let difficulty = 'normal';
  if (round <= 30) difficulty = 'easy';
  else if (round <= 60) difficulty = 'normal';
  else if (round <= 90) difficulty = 'hard';
  else {
    // Mixed: round 91-100 will run 'hard'
    difficulty = 'hard';
  }

  const state = new ReversiState(difficulty);

  // Assert initial board setup
  assert.strictEqual(state.turn, 1, `Round ${round}: Black must go first.`);
  assert.strictEqual(state.board[3][3], 2, `Round ${round}: Center cell (3,3) must be White.`);
  assert.strictEqual(state.board[4][4], 2, `Round ${round}: Center cell (4,4) must be White.`);
  assert.strictEqual(state.board[3][4], 1, `Round ${round}: Center cell (3,4) must be Black.`);
  assert.strictEqual(state.board[4][3], 1, `Round ${round}: Center cell (4,3) must be Black.`);
  assert.strictEqual(state.passFlag, false, `Round ${round}: Initial passFlag must be false.`);

  let moveCount = 0;

  // Play until game over
  while (!state.isGameOver().finished) {
    const currentTurn = state.turn;
    const legalMoves = state.getLegalMoves(currentTurn);

    // Invariant: If game is not finished, there must be at least one legal move for the active player
    assert.ok(legalMoves.length > 0, `Round ${round}, Move ${moveCount}: Active player ${currentTurn} must have legal moves.`);

    // Performance audit on AI getBestMove()
    const startBestMove = performance.now();
    const bestMove = state.getBestMove();
    const duration = performance.now() - startBestMove;

    totalAITime += duration;
    totalAICalls++;
    if (duration > maxAITime) {
      maxAITime = duration;
    }
    if (duration < 15) {
      under15msCount++;
    }

    // Verify AI selected a move and it is indeed legal
    assert.ok(bestMove !== null, `Round ${round}, Move ${moveCount}: getBestMove must return a move.`);
    const matchingMove = legalMoves.find(m => m.r === bestMove.r && m.c === bestMove.c);
    assert.ok(matchingMove !== undefined, `Round ${round}, Move ${moveCount}: Selected move (${bestMove.r}, ${bestMove.c}) is not legal.`);

    // Clone the board to check flip cascade correctness
    const beforeBoard = state.board.map(row => [...row]);

    // Make the move
    const result = state.makeMove(bestMove.r, bestMove.c);
    moveCount++;

    // Assert move success and correct flips array returned
    assert.strictEqual(result.success, true, `Round ${round}, Move ${moveCount}: makeMove failed.`);
    assert.deepStrictEqual(result.flips, matchingMove.flips, `Round ${round}, Move ${moveCount}: Returned flips mismatch.`);

    // Verify flip cascade correctness:
    // 1. Placed cell must be set to player's color.
    // 2. Flipped cells must be set to player's color.
    // 3. All other cells must remain unchanged.
    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 8; c++) {
        const isPlaced = (r === bestMove.r && c === bestMove.c);
        const isFlipped = matchingMove.flips.some(f => f.r === r && f.c === c);

        if (isPlaced || isFlipped) {
          assert.strictEqual(state.board[r][c], currentTurn, `Round ${round}, Cell (${r},${c}) was not correctly set to ${currentTurn}.`);
        } else {
          assert.strictEqual(state.board[r][c], beforeBoard[r][c], `Round ${round}, Cell (${r},${c}) was incorrectly modified.`);
        }
      }
    }

    // Verify Pass rules and state transitions
    const nextPlayer = 3 - currentTurn;
    const nextLegalMoves = getLegalMovesForBoard(state.board, nextPlayer);
    const currentLegalMovesAgain = getLegalMovesForBoard(state.board, currentTurn);

    if (nextLegalMoves.length > 0) {
      assert.strictEqual(state.turn, nextPlayer, `Round ${round}: Turn should have switched to next player.`);
      assert.strictEqual(state.passFlag, false, `Round ${round}: passFlag should be false when turn switches normally.`);
    } else if (currentLegalMovesAgain.length > 0) {
      assert.strictEqual(state.turn, currentTurn, `Round ${round}: Turn should remain with current player (automatic pass).`);
      assert.strictEqual(state.passFlag, true, `Round ${round}: passFlag should be true when next player has to pass.`);
    } else {
      // Both players have no legal moves -> game should be over
      assert.strictEqual(state.isGameOver().finished, true, `Round ${round}: Game should be over if both players pass.`);
    }
  }

  // End of game assertions
  const finalResult = state.isGameOver();
  assert.strictEqual(finalResult.finished, true, `Round ${round}: finalResult.finished must be true.`);

  // Verify score count correctness
  let actualBlackCount = 0;
  let actualWhiteCount = 0;
  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      if (state.board[r][c] === 1) actualBlackCount++;
      else if (state.board[r][c] === 2) actualWhiteCount++;
    }
  }
  assert.strictEqual(finalResult.blackCount, actualBlackCount, `Round ${round}: blackCount mismatch.`);
  assert.strictEqual(finalResult.whiteCount, actualWhiteCount, `Round ${round}: whiteCount mismatch.`);

  // Verify winner logic
  let expectedWinner = 0;
  if (actualBlackCount > actualWhiteCount) expectedWinner = 1;
  else if (actualWhiteCount > actualBlackCount) expectedWinner = 2;

  assert.strictEqual(finalResult.winner, expectedWinner, `Round ${round}: winner mismatch.`);

  // Test saveResult method doesn't throw
  state.saveResult();
}

const totalDuration = performance.now() - startTotal;
const averageAITime = totalAITime / totalAICalls;
const under15msPercentage = (under15msCount / totalAICalls) * 100;

console.log(`\x1b[32m✔ 100 rounds AI self-play completed successfully.\x1b[0m`);
console.log(`--- TIMING AUDIT ---`);
console.log(`Total AI decisions: ${totalAICalls}`);
console.log(`Average AI decision time: ${averageAITime.toFixed(4)}ms`);
console.log(`Max AI decision time: ${maxAITime.toFixed(4)}ms`);
console.log(`Decisions under 15ms limit: ${under15msPercentage.toFixed(2)}%`);

// Timing assertions
assert.ok(averageAITime < 15, `Average AI decision time (${averageAITime.toFixed(2)}ms) exceeded 15ms limit.`);
assert.ok(maxAITime < 15, `Maximum AI decision time (${maxAITime.toFixed(2)}ms) exceeded 15ms limit.`);

console.log(`\x1b[32m✔ All Reversi State Engine Unit Tests Passed!\x1b[0m\n`);
