export function generateSudoku(holes = 30) {
  let board = Array.from({ length: 9 }, () => Array(9).fill(0));

  fillBoard(board);
  const solution = board.map(row => [...row]);

  let puzzle = solution.map(row => [...row]);
  let attempts = holes;

  let positions = [];
  for (let i = 0; i < 9; i++) {
    for (let j = 0; j < 9; j++) {
      positions.push([i, j]);
    }
  }
  positions.sort(() => Math.random() - 0.5);

  // 每次 countSolutionsLimited 的最大迭代次数。
  // 超过此限制时认为"无法确认唯一解"，跳过该位置。
  // 5000 次迭代在低端设备上约需 1-2ms，可避免指数级卡顿。
  const MAX_ITER = 5000;

  for (let i = 0; i < positions.length && attempts > 0; i++) {
    const [r, c] = positions[i];
    const backup = puzzle[r][c];
    puzzle[r][c] = 0;

    // -1=超时不确定(视为不安全), 0=无解, 1=唯一解, 2=多解
    const result = countSolutionsLimited(puzzle, MAX_ITER);

    if (result === 1) {
      attempts--;
    } else {
      puzzle[r][c] = backup;
    }
  }

  return { puzzle, solution };
}

function isValid(board, r, c, val) {
  for (let i = 0; i < 9; i++) {
    if (board[r][i] === val) return false;
    if (board[i][c] === val) return false;
  }
  let boxR = Math.floor(r / 3) * 3;
  let boxC = Math.floor(c / 3) * 3;
  for (let i = 0; i < 3; i++) {
    for (let j = 0; j < 3; j++) {
      if (board[boxR + i][boxC + j] === val) return false;
    }
  }
  return true;
}

function fillBoard(board) {
  for (let r = 0; r < 9; r++) {
    for (let c = 0; c < 9; c++) {
      if (board[r][c] === 0) {
        let nums = [1, 2, 3, 4, 5, 6, 7, 8, 9].sort(() => Math.random() - 0.5);
        for (let num of nums) {
          if (isValid(board, r, c, num)) {
            board[r][c] = num;
            if (fillBoard(board)) return true;
            board[r][c] = 0;
          }
        }
        return false;
      }
    }
  }
  return true;
}

/**
 * 带迭代预算的求解计数。
 * 在回溯求解过程中统计找到的解数量，一旦超过迭代预算立即放弃。
 *
 * @param {number[][]} board  盘面（会被修改，调用方应传入副本）
 * @param {number}     maxIter 最大迭代次数
 * @returns {number}  -1 = 超时（结果不确定，视为不安全）
 *                      0 = 无解
 *                      1 = 唯一解 ✓
 *                      2 = 多个解
 */
function countSolutionsLimited(board, maxIter) {
  const ctx = { iters: 0, count: 0, exceeded: false };

  function search() {
    for (let r = 0; r < 9; r++) {
      for (let c = 0; c < 9; c++) {
        if (board[r][c] === 0) {
          for (let num = 1; num <= 9; num++) {
            ctx.iters++;
            if (ctx.iters > maxIter) {
              ctx.exceeded = true;
              return false;
            }
            if (isValid(board, r, c, num)) {
              board[r][c] = num;
              if (search()) {
                board[r][c] = 0;
                return true;
              }
              board[r][c] = 0;
            }
            if (ctx.count > 1) return true;
          }
          return false;
        }
      }
    }
    ctx.count++;
    return ctx.count > 1;
  }

  search();

  if (ctx.exceeded) return -1;
  return ctx.count;
}
