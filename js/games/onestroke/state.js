import { saveScore } from '../../core/storage.js';

export const CELL_TYPES = {
  WALKABLE: 0,
  START: 1,
  OBSTACLE: 2
};

export class OneStrokeState {
  constructor(size = 4, obstacleCount = 1) {
    if (![4, 5, 6].includes(size)) {
      throw new Error('Unsupported grid size. Must be 4x4, 5x5, or 6x6.');
    }
    if (obstacleCount < 1 || obstacleCount > 3) {
      throw new Error('Obstacle count must be between 1 and 3.');
    }
    this.size = size;
    this.obstacleCount = obstacleCount;
    this.grid = [];
    this.solutionPath = [];
    this.path = [];
    this.totalWalkable = 0;
    this.startTime = Date.now();
    this.steps = 0;
    this.won = false;
    this.saved = false;

    this.init();
  }

  init() {
    this.solutionPath = this.generateBoardPath(this.size, this.obstacleCount);
    this.totalWalkable = this.size * this.size - this.obstacleCount;
    
    // Initialize 2D grid with OBSTACLEs
    this.grid = Array.from({ length: this.size }, () => Array(this.size).fill(CELL_TYPES.OBSTACLE));
    
    // Mark the path cells on the grid
    this.solutionPath.forEach((cell, index) => {
      this.grid[cell.r][cell.c] = index === 0 ? CELL_TYPES.START : CELL_TYPES.WALKABLE;
    });

    // Reset game path to start cell
    this.path = [this.solutionPath[0]];
    this.startTime = Date.now();
    this.steps = 0;
    this.won = false;
    this.saved = false;
  }

  generateBoardPath(size, obstacleCount) {
    const targetLength = size * size - obstacleCount;

    const getUnvisitedNeighbors = (r, c, pathSet) => {
      const dirs = [
        { r: -1, c: 0 },
        { r: 1, c: 0 },
        { r: 0, c: -1 },
        { r: 0, c: 1 }
      ];
      const neighbors = [];
      for (const d of dirs) {
        const nr = r + d.r;
        const nc = c + d.c;
        if (nr >= 0 && nr < size && nc >= 0 && nc < size) {
          if (!pathSet.has(`${nr},${nc}`)) {
            neighbors.push({ r: nr, c: nc });
          }
        }
      }
      return neighbors;
    };

    for (let attempt = 0; attempt < 200; attempt++) {
      const startR = Math.floor(Math.random() * size);
      const startC = Math.floor(Math.random() * size);

      const path = [{ r: startR, c: startC }];
      const pathSet = new Set([`${startR},${startC}`]);

      const dfs = (r, c) => {
        if (path.length === targetLength) {
          return true;
        }

        const neighbors = getUnvisitedNeighbors(r, c, pathSet);
        if (neighbors.length === 0) {
          return false;
        }

        // Calculate Warnsdorff's degree for each neighbor
        for (const neighbor of neighbors) {
          const neighborKey = `${neighbor.r},${neighbor.c}`;
          pathSet.add(neighborKey);
          const nextNeighbors = getUnvisitedNeighbors(neighbor.r, neighbor.c, pathSet);
          neighbor.degree = nextNeighbors.length;
          pathSet.delete(neighborKey);
        }

        // Shuffle neighbors to guarantee randomness
        for (let i = neighbors.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          const temp = neighbors[i];
          neighbors[i] = neighbors[j];
          neighbors[j] = temp;
        }

        // Sort by degree (Warnsdorff's heuristic)
        neighbors.sort((a, b) => a.degree - b.degree);

        for (const neighbor of neighbors) {
          const key = `${neighbor.r},${neighbor.c}`;
          path.push(neighbor);
          pathSet.add(key);

          if (dfs(neighbor.r, neighbor.c)) {
            return true;
          }

          // Backtrack
          path.pop();
          pathSet.delete(key);
        }

        return false;
      };

      if (dfs(startR, startC)) {
        return path.map(cell => ({ r: cell.r, c: cell.c }));
      }
    }

    throw new Error(`Failed to generate Hamiltonian path after 200 attempts for size ${size} with ${obstacleCount} obstacles.`);
  }

  dragTo(r, c) {
    if (this.won) return false;

    // Boundary check
    if (r < 0 || r >= this.size || c < 0 || c >= this.size) {
      return false;
    }

    // Obstacle check
    if (this.grid[r][c] === CELL_TYPES.OBSTACLE) {
      return false;
    }

    const lastCell = this.path[this.path.length - 1];

    // Check if dragging to the same cell as current end of path
    if (r === lastCell.r && c === lastCell.c) {
      return false;
    }

    // If path length > 1 and (r,c) is the second-to-last cell, undo the last step (back-sliding erase).
    if (this.path.length > 1) {
      const secondLast = this.path[this.path.length - 2];
      if (r === secondLast.r && c === secondLast.c) {
        this.path.pop();
        return true;
      }
    }

    // Check if (r,c) is already visited
    const visitedIndex = this.path.findIndex(cell => cell.r === r && cell.c === c);

    if (visitedIndex === -1) {
      // If (r,c) is adjacent and unvisited, append to path
      const isAdjacent = Math.abs(r - lastCell.r) + Math.abs(c - lastCell.c) === 1;
      if (isAdjacent) {
        this.path.push({ r, c });
        this.steps++;
        // Check victory condition
        if (this.path.length === this.totalWalkable) {
          this.won = true;
          this.saveResult();
        }
        return true;
      }
    } else {
      // If (r,c) is already visited, check if it's in the path (excluding the last two cells).
      // If so, truncate the path up to that index (history rollback).
      if (visitedIndex < this.path.length - 2) {
        this.path = this.path.slice(0, visitedIndex + 1);
        return true;
      }
    }

    return false;
  }

  undo() {
    if (this.path.length > 1) {
      this.path.pop();
      this.won = false;
      return true;
    }
    return false;
  }

  resetPath() {
    if (this.path.length > 1) {
      this.path = [this.solutionPath[0]];
      this.won = false;
      return true;
    }
    return false;
  }

  getElapsed() {
    return Math.floor((Date.now() - this.startTime) / 1000);
  }

  saveResult() {
    if (this.saved) return;
    const time = this.getElapsed();
    const score = Math.max(100, 1000 - time * 2 - this.steps * 3);
    saveScore('onestroke', {
      score,
      time,
      steps: this.steps,
      difficulty: `${this.size}x${this.size}`,
      won: true
    });
    this.saved = true;
  }
}
