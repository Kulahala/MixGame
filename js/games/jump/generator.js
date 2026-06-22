// Deterministic Seeded Pseudo-Random Platform Generator
// Supports segment templates, micro-adjustments, and GC-free caching.

export function createMulberry32(seed) {
  return function() {
    let t = seed += 0x6D2B79F5;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
}

// 12 种 500px 高度的 Section 模板 (相对坐标 ry，ry 范围在 0 ~ -500px)
const SECTION_TEMPLATES = [
  // 模板 0: 起步林荫台
  [
    { x: 80, ry: -150, w: 90, h: 15, type: 'wood' },
    { x: 210, ry: -320, w: 90, h: 15, type: 'wood' },
    { x: 60, ry: -470, w: 100, h: 15, type: 'wood' }
  ],
  // 模板 1: 森林滑坡初试
  [
    { x: 190, ry: -120, w: 130, h: 50, type: 'slope', slopeDir: 'left-down' },
    { x: 30, ry: -290, w: 80, h: 15, type: 'wood' },
    { x: 180, ry: -440, w: 90, h: 15, type: 'wood' }
  ],
  // 模板 2: 遗迹石壁阻挡
  [
    { x: 140, ry: -230, w: 80, h: 100, type: 'stone' },
    { x: 20, ry: -120, w: 70, h: 15, type: 'stone' },
    { x: 270, ry: -370, w: 70, h: 15, type: 'stone' }
  ],
  // 模板 3: 夹击双斜坡
  [
    { x: 20, ry: -150, w: 110, h: 55, type: 'slope', slopeDir: 'both' },
    { x: 230, ry: -310, w: 110, h: 55, type: 'slope', slopeDir: 'both' },
    { x: 110, ry: -460, w: 130, h: 15, type: 'wood' }
  ],
  // 模板 4: 细石柱跳台
  [
    { x: 160, ry: -280, w: 45, h: 180, type: 'stone' },
    { x: 40, ry: -110, w: 60, h: 15, type: 'stone' },
    { x: 260, ry: -240, w: 60, h: 15, type: 'stone' },
    { x: 50, ry: -440, w: 80, h: 15, type: 'stone' }
  ],
  // 模板 5: 云霄细雨台
  [
    { x: 250, ry: -130, w: 60, h: 12, type: 'cloud' },
    { x: 50, ry: -280, w: 60, h: 12, type: 'cloud' },
    { x: 150, ry: -430, w: 70, h: 12, type: 'cloud' }
  ],
  // 模板 6: 倒悬滑滑梯
  [
    { x: 30, ry: -140, w: 150, h: 60, type: 'slope', slopeDir: 'right-down' },
    { x: 180, ry: -320, w: 150, h: 60, type: 'slope', slopeDir: 'left-down' },
    { x: 90, ry: -460, w: 80, h: 15, type: 'wood' }
  ],
  // 模板 7: 废墟险境
  [
    { x: 210, ry: -140, w: 90, h: 15, type: 'stone' },
    { x: 30, ry: -290, w: 90, h: 15, type: 'stone' },
    { x: 150, ry: -440, w: 130, h: 50, type: 'slope', slopeDir: 'both' }
  ],
  // 模板 8: 三段高石崖
  [
    { x: 150, ry: -150, w: 65, h: 15, type: 'stone' },
    { x: 20, ry: -330, w: 75, h: 15, type: 'stone' },
    { x: 265, ry: -440, w: 75, h: 15, type: 'stone' }
  ],
  // 模板 9: 天井落石关卡
  [
    { x: 80, ry: -200, w: 200, h: 40, type: 'stone' },
    { x: 10, ry: -330, w: 60, h: 15, type: 'stone' },
    { x: 290, ry: -440, w: 60, h: 15, type: 'stone' }
  ],
  // 模板 10: 巅峰大滑梯
  [
    { x: 50, ry: -180, w: 260, h: 80, type: 'slope', slopeDir: 'both' },
    { x: 10, ry: -350, w: 60, h: 15, type: 'wood' },
    { x: 290, ry: -460, w: 60, h: 15, type: 'wood' }
  ],
  // 模板 11: 云顶大跨越
  [
    { x: 140, ry: -130, w: 80, h: 12, type: 'cloud' },
    { x: 30, ry: -270, w: 60, h: 12, type: 'cloud' },
    { x: 270, ry: -400, w: 60, h: 12, type: 'cloud' }
  ]
];

export class ChunkGenerator {
  constructor(seed) {
    this.seed = seed || Math.random();
    this.chunkCache = new Map(); // GC-free 区块缓存 Map: chunkIdx -> platforms
    this.chunkHeight = 500;
    this.startY = 3150; // 最低地面绝对坐标
  }

  // 释放缓存（切模式或重置时调用）
  clearCache() {
    this.chunkCache.clear();
  }

  /**
   * 生成指定 Section 索引的平台数据
   * @param {number} idx - 区块索引 (从 0 开始往上)
   */
  generateChunk(idx) {
    // 确定性随机数发生器
    const chunkSeed = Math.floor(this.seed * 100000) + idx;
    const rng = createMulberry32(chunkSeed);

    // 挑选模板
    const templateIdx = Math.floor(rng() * SECTION_TEMPLATES.length);
    const template = SECTION_TEMPLATES[templateIdx];

    // 获取上一个区块的最顶端平台，用来做跨区块边界错位与高度可达性约束
    let prevTopPlat = null;
    if (idx > 0 && this.chunkCache.has(idx - 1)) {
      const prevPlatforms = this.chunkCache.get(idx - 1);
      if (prevPlatforms && prevPlatforms.length > 0) {
        prevTopPlat = prevPlatforms.reduce((min, p) => p.y < min.y ? p : min, prevPlatforms[0]);
      }
    } else if (idx === 0) {
      // 0 号区块以地面为起跳基准
      prevTopPlat = { x: 0, y: 3150, w: 360, h: 50, type: 'wood' };
    }

    const platforms = [];
    const baseY = this.startY - idx * this.chunkHeight;

    template.forEach(p => {
      // 局部微调
      const xOffset = Math.floor((rng() - 0.5) * 26); // x坐标微调 ±13px
      const wOffset = Math.floor((rng() - 0.5) * 16); // 宽度微调 ±8px

      let newX = p.x + xOffset;
      let newW = p.w + wOffset;

      // 边界约束限制，确保平台不伸出 360px 之外
      newW = Math.max(30, Math.min(newW, 280));
      newX = Math.max(5, Math.min(newX, 360 - newW - 5));

      const platformY = baseY + p.ry;

      // 根据 chunk 索引 idx 动态匹配当前阶段材质，消除混杂平台的违和感
      let platformType = p.type;
      if (p.type !== 'slope') {
        if (idx <= 3) {
          platformType = 'wood';
        } else if (idx <= 7) {
          platformType = 'stone';
        } else {
          platformType = 'cloud';
        }
      }

      platforms.push({
        x: newX,
        y: platformY,
        w: newW,
        h: p.h,
        type: platformType,
        slopeDir: p.slopeDir || null
      });
    });

    // ─── 物理可达性与错位链式修整算法 (Accessibility Resolution) ───
    // 将平台按 Y 坐标从大到小（从底到顶）排序进行逐级物理修整
    platforms.sort((a, b) => b.y - a.y);

    for (let i = 0; i < platforms.length; i++) {
      const curr = platforms[i];
      const prev = (i === 0) ? prevTopPlat : platforms[i - 1];

      if (prev) {
        // 1. 计算最窄水平跨度 dx
        let dx = 0;
        if (curr.x + curr.w < prev.x) {
          dx = prev.x - (curr.x + curr.w);
        } else if (prev.x + prev.w < curr.x) {
          dx = curr.x - (prev.x + prev.w);
        }

        // 2. 根据水平跨度线性约束最大安全垂直跳跃高度 dy_max
        // 确保斜跳时高度差收拢，直跳时保留适当冗余高度 (保留 205px 左右舒适高度，物理极限是 310px)
        const maxSafeDy = Math.max(90, 205 - dx * 0.45);
        const dy = prev.y - curr.y;

        if (dy > maxSafeDy) {
          curr.y = prev.y - maxSafeDy; // 超限则强制拉低，使其处于安全可达距离内
        }

        // 3. 防撞头重叠与横向错位约束 (如果高度差在撞头范围内，且重叠度高，执行横向推开)
        const currentDy = prev.y - curr.y;
        if (currentDy < 175) {
          const mid1 = prev.x + prev.w / 2;
          const mid2 = curr.x + curr.w / 2;
          if (Math.abs(mid1 - mid2) < 80) {
            if (mid1 < 180) {
              curr.x = Math.max(prev.x + prev.w - 10, curr.x); // 下方偏左，把当前往右推
            } else {
              curr.x = Math.min(prev.x - curr.w + 10, curr.x); // 下方偏右，把当前往左推
            }
            curr.w = Math.max(30, Math.min(curr.w, 280));
            curr.x = Math.max(5, Math.min(curr.x, 360 - curr.w - 5));
          }
        }

        // 4. 垂直高度下限约束 (防止平台太矮发生几何重合)
        const minHeightLimit = 75;
        if (prev.y - curr.y < minHeightLimit) {
          curr.y = prev.y - minHeightLimit;
        }
      }
    }

    return platforms;
  }

  /**
   * 获取指定高度区间内的所有生成平台 (GC-free 缓存加速)
   * @param {number} minY - 视口最小 Y 坐标
   * @param {number} maxY - 视口最大 Y 坐标
   */
  getPlatformsInRange(minY, maxY) {
    const startIdx = Math.max(0, Math.floor((this.startY - maxY) / this.chunkHeight));
    const endIdx = Math.max(0, Math.floor((this.startY - minY) / this.chunkHeight));

    const result = [];
    result.push({ x: 0, y: 3150, w: 360, h: 50, type: 'wood' });

    for (let idx = startIdx; idx <= endIdx; idx++) {
      if (!this.chunkCache.has(idx)) {
        this.chunkCache.set(idx, this.generateChunk(idx));
      }
      result.push(...this.chunkCache.get(idx));
    }

    return result;
  }
}
