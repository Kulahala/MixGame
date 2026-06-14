import { saveScore } from '../../core/storage.js';

export default class SlitherlinkState {
  constructor(rows = 5, cols = 5) {
    this.rows = rows;
    this.cols = cols;
    this.grid = [];     // grid[r][c] 存数字 0-3，或者 -1 表示为空
    this.hLines = [];   // hLines[r][c] 水平边 0, 1, -1
    this.vLines = [];   // vLines[r][c] 垂直边 0, 1, -1
    
    this.steps = 0;
    this.startTime = Date.now();
    this.completed = false;
    this.saved = false;

    this.init();
  }

  init() {
    this.grid = Array.from({ length: this.rows }, () => Array(this.cols).fill(-1));
    this.hLines = Array.from({ length: this.rows + 1 }, () => Array(this.cols).fill(0));
    this.vLines = Array.from({ length: this.rows }, () => Array(this.cols + 1).fill(0));
    
    this.steps = 0;
    this.startTime = Date.now();
    this.completed = false;
    this.saved = false;

    this.generatePuzzle();
  }

  generatePuzzle() {
    // 1. 生成一条随机环
    let path = null;
    for (let i = 0; i < 5; i++) {
      path = this.generateRandomLoop(this.rows, this.cols);
      if (path) break;
    }
    
    // 兜底：如果寻环失败，采用一个固定的环（例如外圈的大环）
    if (!path) {
      path = [];
      // 沿外边缘生成环
      for (let c = 0; c <= this.cols; c++) path.push({ r: 0, c });
      for (let r = 1; r <= this.rows; r++) path.push({ r, c: this.cols });
      for (let c = this.cols - 1; c >= 0; c--) path.push({ r: this.rows, c });
      for (let r = this.rows - 1; r > 0; r--) path.push({ r, c: 0 });
    }

    // 2. 标记环中的边
    const loopH = Array.from({ length: this.rows + 1 }, () => Array(this.cols).fill(0));
    const loopV = Array.from({ length: this.rows }, () => Array(this.cols + 1).fill(0));
    
    for (let i = 0; i < path.length; i++) {
      const p1 = path[i];
      const p2 = path[(i + 1) % path.length];
      if (p1.r === p2.r) {
        loopH[p1.r][Math.min(p1.c, p2.c)] = 1;
      } else if (p1.c === p2.c) {
        loopV[Math.min(p1.r, p2.r)][p1.c] = 1;
      }
    }

    // 3. 计算每个格子周围的连线数
    const fullGrid = [];
    for (let r = 0; r < this.rows; r++) {
      fullGrid[r] = [];
      for (let c = 0; c < this.cols; c++) {
        const top = loopH[r][c];
        const bottom = loopH[r + 1][c];
        const left = loopV[r][c];
        const right = loopV[r][c + 1];
        fullGrid[r][c] = top + bottom + left + right;
      }
    }

    // 4. 挖空数字：打乱格子索引，保留部分数字
    const cells = [];
    for (let r = 0; r < this.rows; r++) {
      for (let c = 0; c < this.cols; c++) {
        cells.push({ r, c });
      }
    }
    cells.sort(() => Math.random() - 0.5);

    // 根据格子总数确定保留的数字数量
    // 5x5 网格保留约 10 个数字，7x7 保留约 18 个数字
    const totalCells = this.rows * this.cols;
    const keepCount = Math.floor(totalCells * 0.4);
    
    for (let i = 0; i < keepCount; i++) {
      const cell = cells[i];
      this.grid[cell.r][cell.c] = fullGrid[cell.r][cell.c];
    }
  }

  generateRandomLoop(rows, cols) {
    const visited = Array.from({ length: rows + 1 }, () => Array(cols + 1).fill(false));
    const path = [];
    
    // 随机选择中间的点作为起点，保证环能往外舒展
    const startR = Math.floor(Math.random() * (rows - 1)) + 1;
    const startC = Math.floor(Math.random() * (cols - 1)) + 1;
    
    let success = false;
    let stepsCount = 0;

    const dfs = (r, c) => {
      stepsCount++;
      if (stepsCount > 1000) return false;

      visited[r][c] = true;
      path.push({ r, c });

      const dirs = [
        { dr: -1, dc: 0 }, { dr: 1, dc: 0 },
        { dr: 0, dc: -1 }, { dr: 0, dc: 1 }
      ];
      dirs.sort(() => Math.random() - 0.5);

      for (let dir of dirs) {
        const nr = r + dir.dr;
        const nc = c + dir.dc;

        if (nr < 0 || nr > rows || nc < 0 || nc > cols) continue;

        // 路径长度必须至少为该网格尺寸的两倍以上（如 5x5 时至少 10 步，避免出现 2x2 的超小微环）
        const minLen = Math.max(10, Math.floor(rows * cols * 0.4));
        if (nr === startR && nc === startC && path.length >= minLen) {
          success = true;
          return true;
        }

        if (!visited[nr][nc]) {
          if (dfs(nr, nc)) return true;
        }
      }

      visited[r][c] = false;
      path.pop();
      return false;
    };

    dfs(startR, startC);
    return success ? path : null;
  }

  toggleEdge(type, r, c) {
    if (this.completed) return false;

    // 0 (无线) -> 1 (有线) -> -1 (X标记) -> 0 (无线)
    if (type === 'h') {
      const current = this.hLines[r][c];
      this.hLines[r][c] = current === 0 ? 1 : (current === 1 ? -1 : 0);
    } else if (type === 'v') {
      const current = this.vLines[r][c];
      this.vLines[r][c] = current === 0 ? 1 : (current === 1 ? -1 : 0);
    }
    
    this.steps++;
    return true;
  }

  getElapsed() {
    return Math.floor((Date.now() - this.startTime) / 1000);
  }

  isSolved() {
    // 1. 验证所有有数字的格子，周围的连线数是否等于格子数字
    for (let r = 0; r < this.rows; r++) {
      for (let c = 0; c < this.cols; c++) {
        const num = this.grid[r][c];
        if (num >= 0) {
          const top = this.hLines[r][c] === 1 ? 1 : 0;
          const bottom = this.hLines[r + 1][c] === 1 ? 1 : 0;
          const left = this.vLines[r][c] === 1 ? 1 : 0;
          const right = this.vLines[r][c + 1] === 1 ? 1 : 0;
          if (top + bottom + left + right !== num) return false;
        }
      }
    }

    // 2. 检查格点的连接度数：必须是 0 或 2 (不能分叉、断裂或重叠)
    for (let r = 0; r <= this.rows; r++) {
      for (let c = 0; c <= this.cols; c++) {
        const top = (r > 0 && this.vLines[r - 1][c] === 1) ? 1 : 0;
        const bottom = (r < this.rows && this.vLines[r][c] === 1) ? 1 : 0;
        const left = (c > 0 && this.hLines[r][c - 1] === 1) ? 1 : 0;
        const right = (c < this.cols && this.hLines[r][c] === 1) ? 1 : 0;
        const degree = top + bottom + left + right;
        if (degree !== 0 && degree !== 2) return false;
      }
    }

    // 3. 验证是否只形成了一条单一且自闭合的回路
    return this.isSingleLoop();
  }

  isSingleLoop() {
    const edges = [];
    let totalEdges = 0;

    for (let r = 0; r <= this.rows; r++) {
      for (let c = 0; c < this.cols; c++) {
        if (this.hLines[r][c] === 1) {
          edges.push({ p1: `${r},${c}`, p2: `${r},${c + 1}` });
          totalEdges++;
        }
      }
    }

    for (let r = 0; r < this.rows; r++) {
      for (let c = 0; c <= this.cols; c++) {
        if (this.vLines[r][c] === 1) {
          edges.push({ p1: `${r},${c}`, p2: `${r + 1},${c}` });
          totalEdges++;
        }
      }
    }

    if (totalEdges === 0) return false;

    // 建立邻接表
    const adj = {};
    edges.forEach(e => {
      if (!adj[e.p1]) adj[e.p1] = [];
      if (!adj[e.p2]) adj[e.p2] = [];
      adj[e.p1].push(e.p2);
      adj[e.p2].push(e.p1);
    });

    const startPoint = edges[0].p1;
    const visitedPoints = new Set();
    let visitedEdgesCount = 0;

    let current = startPoint;
    let prev = null;
    visitedPoints.add(current);

    while (true) {
      const neighbors = adj[current] || [];
      const next = neighbors.find(n => n !== prev);
      if (!next) break;

      visitedEdgesCount++;
      if (next === startPoint) break; // 闭合

      if (visitedPoints.has(next)) return false; // 自交

      visitedPoints.add(next);
      prev = current;
      current = next;
    }

    return visitedEdgesCount === totalEdges;
  }

  saveResult() {
    if (this.saved) return;
    const time = this.getElapsed();
    const score = Math.max(100, 1000 - time * 2 - this.steps * 5);
    saveScore('slitherlink', {
      score,
      time,
      steps: this.steps,
      difficulty: `${this.rows}x${this.cols}`,
    });
    this.saved = true;
  }
}
