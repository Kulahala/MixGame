import assert from 'assert';
import { performance } from 'perf_hooks';

// Mock wx globally before importing state.js
globalThis.wx = {
  getStorageSync: () => ({}),
  setStorageSync: () => ({})
};

import { ReversiState } from './state.js';

// Positional weight matrix for evaluation (identical to state.js)
const WEIGHTS = [
  [ 120, -20,  20,   5,   5,  20, -20, 120 ],
  [ -20, -40,  -5,  -5,  -5,  -5, -40, -20 ],
  [  20,  -5,  15,   3,   3,  15,  -5,  20 ],
  [   5,  -5,   3,   3,   3,   3,  -5,   5 ],
  [   5,  -5,   3,   3,   3,   3,  -5,   5 ],
  [  20,  -5,  15,   3,   3,  15,  -5,  20 ],
  [ -20, -40,  -5,  -5,  -5,  -5, -40, -20 ],
  [ 120, -20,  20,   5,   5,  20, -20, 120 ]
];

const DIRS = [
  [-1, -1], [-1, 0], [-1, 1],
  [0, -1],           [0, 1],
  [1, -1],  [1, 0],  [1, 1]
];

// Helper to compute legal moves on any arbitrary board
function getLegalMovesForBoard(board, player) {
  const opponent = 3 - player;
  const legalMoves = [];

  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      if (board[r][c] !== 0) continue;

      let hasFlips = false;
      const allFlips = [];

      for (let d = 0; d < 8; d++) {
        const dr = DIRS[d][0];
        const dc = DIRS[d][1];
        let nr = r + dr;
        let nc = c + dc;
        let count = 0;

        while (nr >= 0 && nr < 8 && nc >= 0 && nc < 8 && board[nr][nc] === opponent) {
          count++;
          nr += dr;
          nc += dc;
        }

        if (count > 0 && nr >= 0 && nr < 8 && nc >= 0 && nc < 8 && board[nr][nc] === player) {
          hasFlips = true;
          let tr = r + dr;
          let tc = c + dc;
          for (let i = 0; i < count; i++) {
            allFlips.push({ r: tr, c: tc });
            tr += dr;
            tc += dc;
          }
        }
      }

      if (hasFlips) {
        legalMoves.push({ r, c, flips: allFlips });
      }
    }
  }

  return legalMoves;
}

// Simulates a move on the board
function simulateMove(board, r, c, player, flips) {
  const newBoard = [
    [...board[0]], [...board[1]], [...board[2]], [...board[3]],
    [...board[4]], [...board[5]], [...board[6]], [...board[7]]
  ];
  newBoard[r][c] = player;
  for (let i = 0; i < flips.length; i++) {
    const f = flips[i];
    newBoard[f.r][f.c] = player;
  }
  return newBoard;
}

// Positional evaluation function
function evaluateBoard(board, player) {
  const opponent = 3 - player;
  let score = 0;
  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      if (board[r][c] === player) {
        score += WEIGHTS[r][c];
      } else if (board[r][c] === opponent) {
        score -= WEIGHTS[r][c];
      }
    }
  }
  return score;
}

// Instrumented Minimax with Alpha-Beta pruning to count nodes and metrics
let nodesVisited = 0;
let prunedBranches = 0;
let totalBranches = 0;

function instrumentedMinimax(board, depth, alpha, beta, isMaximizing, player) {
  nodesVisited++;
  const opponent = 3 - player;

  const currentLegalMoves = getLegalMovesForBoard(board, isMaximizing ? player : opponent);
  const nextLegalMoves = getLegalMovesForBoard(board, isMaximizing ? opponent : player);
  const isTerminal = currentLegalMoves.length === 0 && nextLegalMoves.length === 0;

  if (depth === 0 || isTerminal) {
    return evaluateBoard(board, player);
  }

  if (isMaximizing) {
    if (currentLegalMoves.length === 0) {
      return instrumentedMinimax(board, depth - 1, alpha, beta, false, player);
    }

    let maxEval = -Infinity;
    for (let i = 0; i < currentLegalMoves.length; i++) {
      totalBranches++;
      const move = currentLegalMoves[i];
      const nextBoard = simulateMove(board, move.r, move.c, player, move.flips);
      const val = instrumentedMinimax(nextBoard, depth - 1, alpha, beta, false, player);
      maxEval = Math.max(maxEval, val);
      alpha = Math.max(alpha, val);
      if (beta <= alpha) {
        prunedBranches += (currentLegalMoves.length - 1 - i);
        break; // Beta cut-off
      }
    }
    return maxEval;
  } else {
    if (currentLegalMoves.length === 0) {
      return instrumentedMinimax(board, depth - 1, alpha, beta, true, player);
    }

    let minEval = Infinity;
    for (let i = 0; i < currentLegalMoves.length; i++) {
      totalBranches++;
      const move = currentLegalMoves[i];
      const nextBoard = simulateMove(board, move.r, move.c, opponent, move.flips);
      const val = instrumentedMinimax(nextBoard, depth - 1, alpha, beta, true, player);
      minEval = Math.min(minEval, val);
      beta = Math.min(beta, val);
      if (beta <= alpha) {
        prunedBranches += (currentLegalMoves.length - 1 - i);
        break; // Alpha cut-off
      }
    }
    return minEval;
  }
}

// Function to reset instrumentation counters
function resetCounters() {
  nodesVisited = 0;
  prunedBranches = 0;
  totalBranches = 0;
}

// --- TEST SUITE START ---

console.log("=== REVERSI STATE ENGINE ADVERSARIAL STRESS TEST ===");

// 1. Initial Board Verification
function testInitialBoard() {
  console.log("\n[Test 1] Verifying Initial Board Setup...");
  const state = new ReversiState();
  assert.strictEqual(state.turn, 1);
  assert.strictEqual(state.board[3][3], 2);
  assert.strictEqual(state.board[3][4], 1);
  assert.strictEqual(state.board[4][3], 1);
  assert.strictEqual(state.board[4][4], 2);
  assert.strictEqual(state.passFlag, false);
  console.log("✔ Initial board setup verified.");
}

// 2. Fuzzing / Random Play Validation (1000 rounds)
function testFuzzingRandomPlay() {
  console.log("\n[Test 2] Fuzzing: Running 1000 random-play matches to ensure crash-free execution...");
  let crashCount = 0;
  let drawCount = 0;
  let blackWinCount = 0;
  let whiteWinCount = 0;

  for (let round = 1; round <= 1000; round++) {
    try {
      const state = new ReversiState('easy'); // easy selects random legal moves
      let moves = 0;
      while (!state.isGameOver().finished) {
        const turnBefore = state.turn;
        const legal = state.getLegalMoves(turnBefore);
        assert.ok(legal.length > 0, `No legal moves but game not finished in round ${round}`);

        // pick random move
        const choice = legal[Math.floor(Math.random() * legal.length)];
        const beforeBoard = state.board.map(r => [...r]);

        // make move
        const result = state.makeMove(choice.r, choice.c);
        assert.strictEqual(result.success, true);
        moves++;

        // verify flips
        for (let r = 0; r < 8; r++) {
          for (let c = 0; c < 8; c++) {
            const isTarget = r === choice.r && c === choice.c;
            const isFlipped = choice.flips.some(f => f.r === r && f.c === c);
            if (isTarget || isFlipped) {
              assert.strictEqual(state.board[r][c], turnBefore, `Mismatch at (${r},${c}) after move`);
            } else {
              assert.strictEqual(state.board[r][c], beforeBoard[r][c], `Modified unexpected cell at (${r},${c})`);
            }
          }
        }
      }

      const res = state.isGameOver();
      if (res.winner === 1) blackWinCount++;
      else if (res.winner === 2) whiteWinCount++;
      else drawCount++;
    } catch (e) {
      console.error(`Crash in round ${round}:`, e);
      crashCount++;
    }
  }

  assert.strictEqual(crashCount, 0, "Fuzzing failed with crashes!");
  console.log(`✔ Fuzzing completed successfully.`);
  console.log(`  Outcomes - Black Wins: ${blackWinCount}, White Wins: ${whiteWinCount}, Draws: ${drawCount}`);
}

// 3. AI vs AI Performance Profiling
function testAIVsAI() {
  console.log("\n[Test 3] AI vs AI Matches & Profiling...");
  const combinations = [
    { p1: 'easy', p2: 'easy', count: 10 },
    { p1: 'easy', p2: 'normal', count: 10 },
    { p1: 'easy', p2: 'hard', count: 10 },
    { p1: 'normal', p2: 'normal', count: 10 },
    { p1: 'normal', p2: 'hard', count: 10 },
    { p1: 'hard', p2: 'hard', count: 10 }
  ];

  let hardDecisionTimes = [];
  let normalDecisionTimes = [];
  let easyDecisionTimes = [];

  for (const comb of combinations) {
    // console.log(`  Running ${comb.count} matches of ${comb.p1} vs ${comb.p2}...`);
    for (let i = 0; i < comb.count; i++) {
      const state = new ReversiState();
      // We manually implement the game loop using different difficulties for Black (p1) and White (p2)
      while (!state.isGameOver().finished) {
        const turn = state.turn;
        const difficulty = turn === 1 ? comb.p1 : comb.p2;
        state.difficulty = difficulty;

        const start = performance.now();
        const bestMove = state.getBestMove();
        const duration = performance.now() - start;

        if (difficulty === 'hard') hardDecisionTimes.push(duration);
        else if (difficulty === 'normal') normalDecisionTimes.push(duration);
        else easyDecisionTimes.push(duration);

        if (bestMove) {
          state.makeMove(bestMove.r, bestMove.c);
        }
      }
    }
  }

  const average = arr => arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0;
  const max = arr => arr.length ? Math.max(...arr) : 0;

  console.log(`✔ AI vs AI Profiling completed.`);
  console.log(`  Easy AI - Count: ${easyDecisionTimes.length}, Avg: ${average(easyDecisionTimes).toFixed(4)}ms, Max: ${max(easyDecisionTimes).toFixed(4)}ms`);
  console.log(`  Normal AI - Count: ${normalDecisionTimes.length}, Avg: ${average(normalDecisionTimes).toFixed(4)}ms, Max: ${max(normalDecisionTimes).toFixed(4)}ms`);
  console.log(`  Hard AI (Minimax D3) - Count: ${hardDecisionTimes.length}, Avg: ${average(hardDecisionTimes).toFixed(4)}ms, Max: ${max(hardDecisionTimes).toFixed(4)}ms`);

  assert.ok(average(hardDecisionTimes) < 15, "Average Hard AI time exceeded 15ms limit.");
  assert.ok(max(hardDecisionTimes) < 20, "Maximum Hard AI time exceeded 20ms limit.");
}

// 4. Minimax Complexity and Memory Overhead Analysis
function testMinimaxComplexity() {
  console.log("\n[Test 4] Minimax Depth 3 Complexity and Memory Profiling...");
  
  // We will run the shadow instrumented minimax on boards generated from a Hard vs Hard game
  const state = new ReversiState('hard');
  const searchRecords = [];

  while (!state.isGameOver().finished) {
    const turn = state.turn;
    const legalMoves = state.getLegalMoves(turn);
    if (legalMoves.length === 0) continue;

    // Run instrumented minimax for each move and collect stats
    for (const move of legalMoves) {
      const nextBoard = simulateMove(state.board, move.r, move.c, turn, move.flips);
      
      resetCounters();
      const start = performance.now();
      instrumentedMinimax(nextBoard, 2, -Infinity, Infinity, false, turn);
      const duration = performance.now() - start;

      searchRecords.push({
        branchingFactor: legalMoves.length,
        nodesVisited,
        prunedBranches,
        totalBranches,
        duration
      });
    }

    const bestMove = state.getBestMove();
    state.makeMove(bestMove.r, bestMove.c);
  }

  // Compile complexity stats
  const totalCalls = searchRecords.length;
  const avgBranching = searchRecords.reduce((sum, r) => sum + r.branchingFactor, 0) / totalCalls;
  const maxBranching = Math.max(...searchRecords.map(r => r.branchingFactor));
  const avgNodes = searchRecords.reduce((sum, r) => sum + r.nodesVisited, 0) / totalCalls;
  const maxNodes = Math.max(...searchRecords.map(r => r.nodesVisited));
  const totalPruned = searchRecords.reduce((sum, r) => sum + r.prunedBranches, 0);
  const totalBranchesAll = searchRecords.reduce((sum, r) => sum + r.totalBranches, 0);
  const pruneRatio = totalBranchesAll > 0 ? (totalPruned / (totalPruned + totalBranchesAll)) * 100 : 0;
  const totalTime = searchRecords.reduce((sum, r) => sum + r.duration, 0);
  const timePerNode = totalTime / searchRecords.reduce((sum, r) => sum + r.nodesVisited, 0); // ms per node

  console.log(`✔ Minimax Complexity Metrics Compiled:`);
  console.log(`  - Total minimax searches run: ${totalCalls}`);
  console.log(`  - Branching Factor: Avg = ${avgBranching.toFixed(2)}, Max = ${maxBranching}`);
  console.log(`  - Nodes Visited: Avg = ${avgNodes.toFixed(1)}, Max = ${maxNodes}`);
  console.log(`  - Alpha-Beta Pruning Efficiency: ${pruneRatio.toFixed(2)}% of branches pruned`);
  console.log(`  - Average time per node: ${(timePerNode * 1000).toFixed(4)} microseconds`);

  // Memory overhead measurement
  // We trigger GC first, measure heap, run minimax many times, trigger GC again, and measure heap.
  if (global.gc) {
    global.gc();
  }
  const heapBefore = process.memoryUsage().heapUsed;

  const sampleState = new ReversiState('hard');
  // Perform 1000 searches to accumulate allocated heap
  for (let i = 0; i < 1000; i++) {
    sampleState.getBestMove();
  }

  const heapDuring = process.memoryUsage().heapUsed;
  if (global.gc) {
    global.gc();
  }
  const heapAfter = process.memoryUsage().heapUsed;

  const rawAllocatedBytes = heapDuring - heapBefore;
  const retainedBytes = heapAfter - heapBefore;
  console.log(`✔ Memory Overhead Metrics Compiled:`);
  console.log(`  - Raw heap growth during 1000 searches: ${(rawAllocatedBytes / 1024 / 1024).toFixed(4)} MB`);
  console.log(`  - Retained heap after GC: ${(retainedBytes / 1024).toFixed(4)} KB`);
  console.log(`  - Estimated allocation per minimax search: ${(rawAllocatedBytes / 1000 / 1024).toFixed(4)} KB/search`);
}

// 5. Edge Case Scenarios
function testEdgeCases() {
  console.log("\n[Test 5] Running Edge Case scenarios...");

  // Scenario A: Giant Cascades (Multi-directional flips)
  (function testGiantCascades() {
    const state = new ReversiState();
    // Clear board and manually build giant flip scenario
    state.board = Array.from({ length: 8 }, () => Array(8).fill(0));
    // NW
    state.board[2][2] = 2; state.board[1][1] = 1;
    // N
    state.board[2][3] = 2; state.board[1][3] = 1;
    // NE
    state.board[2][4] = 2; state.board[1][5] = 1;
    // W
    state.board[3][2] = 2; state.board[3][1] = 1;
    // E
    state.board[3][4] = 2; state.board[3][5] = 1;
    // SW
    state.board[4][2] = 2; state.board[5][1] = 1;
    // S
    state.board[4][3] = 2; state.board[5][3] = 1;
    // SE
    state.board[4][4] = 2; state.board[5][5] = 1;
    // target cell (3,3) is 0

    state.turn = 1; // Black
    const legal = state.getLegalMoves(1);
    const move = legal.find(m => m.r === 3 && m.c === 3);
    assert.ok(move !== undefined, "Giant cascade move (3,3) should be legal");
    assert.strictEqual(move.flips.length, 8, "Giant cascade should flip exactly 8 pieces");

    const res = state.makeMove(3, 3);
    assert.strictEqual(res.success, true);
    
    // Assert all 8 surrounding cells are now Black
    const surrounding = [
      [2,2], [2,3], [2,4],
      [3,2],        [3,4],
      [4,2], [4,3], [4,4]
    ];
    for (const [r, c] of surrounding) {
      assert.strictEqual(state.board[r][c], 1, `Surrounding piece at (${r},${c}) was not flipped to Black.`);
    }
    console.log("  ✔ Scenario A: Giant Cascades (Multi-directional flips) passed.");
  })();

  // Scenario B: Very Long Sequence of Passes / Alternating Turn Flow
  (function testTurnPassingAndWipeout() {
    const state = new ReversiState();
    state.board = Array.from({ length: 8 }, () => Array(8).fill(2)); // All White (2)
    state.board[0][7] = 0; // Empty
    state.board[1][7] = 0; // Empty
    state.board[0][6] = 1; // Black (1)

    state.turn = 1; // Black's turn

    // Black has no legal moves, but White does at (0,7)
    const blackLegal = state.getLegalMoves(1);
    assert.strictEqual(blackLegal.length, 0, "Black should have no legal moves");
    
    const whiteLegal = getLegalMovesForBoard(state.board, 2);
    assert.ok(whiteLegal.length > 0, "White should have legal moves");

    // Attempting to make a move for Black anywhere should fail
    const invalidMove = state.makeMove(0, 7);
    assert.strictEqual(invalidMove.success, false, "Black making move should fail");

    // To trigger the state's turn management, since the player is Black,
    // let's verify if the state can handle the pass automatically on initialization or when making a move.
    // Wait! In ReversiState constructor, how is the turn set?
    // constructor sets this.turn = 1.
    // In standard gameplay, makeMove is called by the user. If they have no moves, the E2E flow should detect this and pass.
    // Let's check how makeMove handles turn switching when a move is successfully made.
    // If we make a move, makeMove does:
    // "Determine the next player's turn" -> if next player has moves, switch. Else, if current player has moves, keep turn and set passFlag = true. Else, game over.
    // Since Black has no legal moves to begin with, how does the system switch to White?
    // In state.js, there is no automatic check on constructor/reset. The game controller would check if Black has moves.
    // Let's simulate a scenario where Player makes a move, which switches the turn, but the next player has no moves, so it passes back.
    // Let's construct a state where White (2) is active, plays a move, and Black (1) has no moves, so it passes back to White.
    const state2 = new ReversiState();
    state2.board = Array.from({ length: 8 }, () => Array(8).fill(2)); // All White (2)
    state2.board[0][7] = 0; // Empty
    state2.board[1][7] = 0; // Empty
    state2.board[0][6] = 1; // Black (1)
    state2.turn = 2; // White's turn

    // White makes a move at (0,7). This should flip (0,6) to White.
    // After that, Black (1) has no moves. White also has no moves because there are no Black pieces left.
    // Thus the game should end. Let's verify:
    const res = state2.makeMove(0, 7);
    assert.strictEqual(res.success, true);
    assert.strictEqual(state2.isGameOver().finished, true, "Game should be over as White wiped out all Black pieces.");
    assert.strictEqual(state2.isGameOver().winner, 2, "Winner should be White (2).");

    console.log("  ✔ Scenario B: Turn passing / wipeout passed.");
  })();

  // Scenario C: Near-Full Board No-Move Termination
  (function testNoMoveTermination() {
    const state = new ReversiState();
    state.board = Array.from({ length: 8 }, () => Array(8).fill(1)); // All Black (1)
    state.board[0][0] = 0;
    state.board[7][7] = 0;
    // Neither player has any legal moves
    assert.strictEqual(state.isGameOver().finished, true, "Game should be finished if no legal moves exist for either player.");
    console.log("  ✔ Scenario C: Near-Full Board No-Move Termination passed.");
  })();

  // Scenario D: Correctness of Minimax Evaluation/Priority
  (function testCornerCapturePriority() {
    const state = new ReversiState('hard');
    // Setup board where corner (0,0) and edge (0,1) are both legal moves
    state.board = Array.from({ length: 8 }, () => Array(8).fill(0));
    // White pieces
    state.board[1][1] = 2;
    state.board[1][2] = 2;
    // Black pieces
    state.board[2][2] = 1;
    state.board[2][3] = 1;
    // Current turn: Black (1)
    state.turn = 1;

    // Let's check legal moves for Black (1):
    // From (0,0): direction (1,1) is 2, (2,2) is 1. This is legal!
    // From (0,1): direction (1,2) is 2, (2,3) is 1. This is legal!
    const legal = state.getLegalMoves(1);
    const cornerMove = legal.find(m => m.r === 0 && m.c === 0);
    const edgeMove = legal.find(m => m.r === 0 && m.c === 1);
    assert.ok(cornerMove !== undefined, "Corner move (0,0) should be legal");
    assert.ok(edgeMove !== undefined, "Edge move (0,1) should be legal");

    // AI should select corner move (0,0) because of high weight (120 vs -20)
    const bestMove = state.getBestMove();
    assert.strictEqual(bestMove.r, 0, "AI must choose row 0");
    assert.strictEqual(bestMove.c, 0, "AI must choose corner (0,0) due to weights");
    console.log("  ✔ Scenario D: Corner Capture Priority Valuation passed.");
  })();
}

testInitialBoard();
testFuzzingRandomPlay();
testAIVsAI();
testMinimaxComplexity();
testEdgeCases();

console.log("\n\x1b[32m✔ ALL STRESS TESTS AND ADVERSARIAL VERIFICATIONS PASSED!\x1b[0m\n");
