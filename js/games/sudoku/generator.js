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

  for (let i = 0; i < positions.length; i++) {
    if (attempts <= 0) break;
    const [r, c] = positions[i];
    
    let backup = puzzle[r][c];
    puzzle[r][c] = 0;
    
    let solutionsCount = 0;
    countSolutions(puzzle, () => {
      solutionsCount++;
      return solutionsCount > 1; 
    });

    if (solutionsCount === 1) {
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

function countSolutions(board, onSolutionFound) {
  for (let r = 0; r < 9; r++) {
    for (let c = 0; c < 9; c++) {
      if (board[r][c] === 0) {
        for (let num = 1; num <= 9; num++) {
          if (isValid(board, r, c, num)) {
            board[r][c] = num;
            if (countSolutions(board, onSolutionFound)) {
              board[r][c] = 0;
              return true; 
            }
            board[r][c] = 0;
          }
        }
        return false;
      }
    }
  }
  return onSolutionFound();
}
