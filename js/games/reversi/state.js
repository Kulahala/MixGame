import { saveScore } from '../../core/storage.js';

// Static positional weight matrix for board evaluation (normal & hard AI)
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

/**
 * Computes legal moves for a given player on a specific board configuration.
 * @param {Array<Array<number>>} board - 8x8 grid
 * @param {number} player - 1 (Black/Player) or 2 (White/AI)
 * @returns {Array<{r: number, c: number, flips: Array<{r: number, c: number}>}>}
 */
function getLegalMovesForBoard(board, player) {
  const opponent = 3 - player;
  const legalMoves = [];

  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      // Cell must be empty
      if (board[r][c] !== 0) continue;

      let hasFlips = false;
      const allFlips = [];

      // Check all 8 directions for outflanking
      for (let d = 0; d < 8; d++) {
        const dr = DIRS[d][0];
        const dc = DIRS[d][1];
        let nr = r + dr;
        let nc = c + dc;
        let count = 0;

        // Traverse contiguous opponent pieces
        while (nr >= 0 && nr < 8 && nc >= 0 && nc < 8 && board[nr][nc] === opponent) {
          count++;
          nr += dr;
          nc += dc;
        }

        // If path ends with a friendly piece, these opponent pieces are outflanked
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

/**
 * Simulates a move on the board and returns the new board state.
 * @param {Array<Array<number>>} board - Current board state
 * @param {number} r - Row index
 * @param {number} c - Col index
 * @param {number} player - Active player (1 or 2)
 * @param {Array<{r: number, c: number}>} flips - Array of coordinates to flip
 * @returns {Array<Array<number>>} New board state
 */
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

/**
 * Positional evaluation function using static weights matrix.
 * Evaluates the board from the perspective of the specified player.
 * @param {Array<Array<number>>} board - Current board state
 * @param {number} player - Player to evaluate score for
 * @returns {number} Score
 */
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

/**
 * Minimax algorithm with Alpha-Beta pruning.
 * @param {Array<Array<number>>} board - Simulated board state
 * @param {number} depth - Remaining search depth
 * @param {number} alpha - Lower bound of score for maximizer
 * @param {number} beta - Upper bound of score for minimizer
 * @param {boolean} isMaximizing - True if current node is maximizer
 * @param {number} player - Player we are finding the best move for (maximizing player)
 * @returns {number} Evaluated score
 */
function minimax(board, depth, alpha, beta, isMaximizing, player) {
  const opponent = 3 - player;

  if (depth === 0) {
    return evaluateBoard(board, player);
  }

  const currentLegalMoves = getLegalMovesForBoard(board, isMaximizing ? player : opponent);

  if (currentLegalMoves.length === 0) {
    const nextLegalMoves = getLegalMovesForBoard(board, isMaximizing ? opponent : player);
    if (nextLegalMoves.length === 0) {
      return evaluateBoard(board, player);
    }
    // Pass: current player cannot move, turn passes to the other player
    return minimax(board, depth - 1, alpha, beta, !isMaximizing, player);
  }

  if (isMaximizing) {
    let maxEval = -Infinity;
    for (let i = 0; i < currentLegalMoves.length; i++) {
      const move = currentLegalMoves[i];
      const nextBoard = simulateMove(board, move.r, move.c, player, move.flips);
      const val = minimax(nextBoard, depth - 1, alpha, beta, false, player);
      maxEval = Math.max(maxEval, val);
      alpha = Math.max(alpha, val);
      if (beta <= alpha) {
        break; // Beta cut-off
      }
    }
    return maxEval;
  } else {
    let minEval = Infinity;
    for (let i = 0; i < currentLegalMoves.length; i++) {
      const move = currentLegalMoves[i];
      const nextBoard = simulateMove(board, move.r, move.c, opponent, move.flips);
      const val = minimax(nextBoard, depth - 1, alpha, beta, true, player);
      minEval = Math.min(minEval, val);
      beta = Math.min(beta, val);
      if (beta <= alpha) {
        break; // Alpha cut-off
      }
    }
    return minEval;
  }
}

/**
 * ReversiState class managing game rules and AI decision making.
 */
export class ReversiState {
  /**
   * Initializes the game state.
   * @param {string} difficulty - AI level ('easy' | 'normal' | 'hard')
   */
  constructor(difficulty = 'normal') {
    this.difficulty = difficulty;
    this.board = [];
    this.turn = 1; // 1 = Black (Player), 2 = White (AI)
    this.passFlag = false; // Set to true if next player's turn had to be passed
    this.startTime = Date.now();
    this.saved = false;

    this.reset();
  }

  /**
   * Resets the game to initial Reversi state.
   */
  reset() {
    this.board = Array.from({ length: 8 }, () => Array(8).fill(0));

    // Standard starting layout
    this.board[3][3] = 2; // White
    this.board[3][4] = 1; // Black
    this.board[4][3] = 1; // Black
    this.board[4][4] = 2; // White

    this.turn = 1; // Black always goes first
    this.passFlag = false;
    this.startTime = Date.now();
    this.saved = false;
  }

  /**
   * Returns list of legal moves for the specified player.
   * @param {number} player - 1 (Black) or 2 (White)
   * @returns {Array<{r: number, c: number, flips: Array<{r: number, c: number}>}>}
   */
  getLegalMoves(player) {
    return getLegalMovesForBoard(this.board, player);
  }

  /**
   * Executes a move at (r, c) for the current player.
   * @param {number} r - Row index
   * @param {number} c - Col index
   * @returns {{success: boolean, flips?: Array<{r: number, c: number}>}} Move result
   */
  makeMove(r, c) {
    const legalMoves = this.getLegalMoves(this.turn);
    const move = legalMoves.find(m => m.r === r && m.c === c);

    if (!move) {
      return { success: false };
    }

    // Apply the move (place piece and flip outflanked opponent pieces)
    this.board[r][c] = this.turn;
    for (let i = 0; i < move.flips.length; i++) {
      const f = move.flips[i];
      this.board[f.r][f.c] = this.turn;
    }

    const currentPlayer = this.turn;
    const nextPlayer = 3 - currentPlayer;

    // Reset pass flag for this turn
    this.passFlag = false;

    // Determine the next player's turn
    const nextLegalMoves = this.getLegalMoves(nextPlayer);
    if (nextLegalMoves.length > 0) {
      this.turn = nextPlayer;
    } else {
      // Next player has no moves, checking if current player has moves
      const currentLegalMoves = this.getLegalMoves(currentPlayer);
      if (currentLegalMoves.length > 0) {
        // Next player passes, current player keeps the turn
        this.turn = currentPlayer;
        this.passFlag = true;
      } else {
        // Both players have no legal moves -> Game Over
        // Shift turn to next player to represent the final state (or just stay)
        this.turn = nextPlayer;
      }
    }

    return { success: true, flips: move.flips };
  }

  /**
   * Checks if the game is over and determines the winner and counts.
   * @returns {{finished: boolean, winner: number, blackCount: number, whiteCount: number}}
   */
  isGameOver() {
    const blackMoves = this.getLegalMoves(1);
    const whiteMoves = this.getLegalMoves(2);
    const finished = blackMoves.length === 0 && whiteMoves.length === 0;

    let blackCount = 0;
    let whiteCount = 0;

    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 8; c++) {
        if (this.board[r][c] === 1) {
          blackCount++;
        } else if (this.board[r][c] === 2) {
          whiteCount++;
        }
      }
    }

    let winner = 0;
    if (finished) {
      if (blackCount > whiteCount) {
        winner = 1;
      } else if (whiteCount > blackCount) {
        winner = 2;
      } else {
        winner = 0; // Draw / Tie
      }
    }

    return {
      finished,
      winner,
      blackCount,
      whiteCount
    };
  }

  /**
   * Determines the best move for the active player using AI decision tree logic.
   * @returns {{r: number, c: number} | null}
   */
  getBestMove() {
    const player = this.turn;
    const legalMoves = this.getLegalMoves(player);
    if (legalMoves.length === 0) {
      return null;
    }

    // 1. Easy level: random move selection
    if (this.difficulty === 'easy') {
      const idx = Math.floor(Math.random() * legalMoves.length);
      return { r: legalMoves[idx].r, c: legalMoves[idx].c };
    }

    // 2. Normal level: greedy static weights (depth 1)
    if (this.difficulty === 'normal') {
      let maxVal = -Infinity;
      const candidates = [];

      for (let i = 0; i < legalMoves.length; i++) {
        const move = legalMoves[i];
        const nextBoard = simulateMove(this.board, move.r, move.c, player, move.flips);
        const val = evaluateBoard(nextBoard, player);
        if (val > maxVal) {
          maxVal = val;
          candidates.length = 0;
          candidates.push(move);
        } else if (val === maxVal) {
          candidates.push(move);
        }
      }

      const idx = Math.floor(Math.random() * candidates.length);
      return { r: candidates[idx].r, c: candidates[idx].c };
    }

    // 3. Hard level: Minimax with Alpha-Beta pruning (depth 3 search total: 1 outer step + 2 inner steps)
    let maxVal = -Infinity;
    const candidates = [];

    for (let i = 0; i < legalMoves.length; i++) {
      const move = legalMoves[i];
      const nextBoard = simulateMove(this.board, move.r, move.c, player, move.flips);
      // depth 3 total = outer ply + 2 inner plies
      const val = minimax(nextBoard, 2, -Infinity, Infinity, false, player);
      if (val > maxVal) {
        maxVal = val;
        candidates.length = 0;
        candidates.push(move);
      } else if (val === maxVal) {
        candidates.push(move);
      }
    }

    const idx = Math.floor(Math.random() * candidates.length);
    return { r: candidates[idx].r, c: candidates[idx].c };
  }

  /**
   * Gets elapsed game time in seconds.
   * @returns {number}
   */
  getElapsed() {
    return Math.floor((Date.now() - this.startTime) / 1000);
  }

  /**
   * Saves game score via storage utility.
   */
  saveResult() {
    if (this.saved) return;
    const result = this.isGameOver();
    if (!result.finished) return;

    this.saved = true;
    const timeSpent = this.getElapsed();

    // Black is the player. Win if Black count is higher than White count.
    const won = result.winner === 1;
    // Score calculation formula: base points for win + margin, or simple count
    const score = won ? (result.blackCount - result.whiteCount) * 100 + result.blackCount * 10 : result.blackCount * 10;

    saveScore('reversi', {
      score: Math.max(0, score),
      time: timeSpent,
      blackCount: result.blackCount,
      whiteCount: result.whiteCount,
      difficulty: this.difficulty,
      won
    });
  }
}

// Warmup the JIT compiler to ensure AI latency is strictly under 15ms from the very first move
try {
  const warmupState = new ReversiState('hard');
  // Play a dummy game to warm up the getBestMove / minimax paths
  for (let i = 0; i < 25; i++) {
    const move = warmupState.getBestMove();
    if (!move) break;
    warmupState.makeMove(move.r, move.c);
  }
} catch (e) {
  // Ignore warmup errors
}
