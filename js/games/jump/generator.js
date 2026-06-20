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

    const platforms = [];
    const baseY = this.startY - idx * this.chunkHeight;

    template.forEach(p => {
      // 局部微调微调
      const xOffset = Math.floor((rng() - 0.5) * 26); // x坐标微调 ±13px
      const wOffset = Math.floor((rng() - 0.5) * 16); // 宽度微调 ±8px

      let newX = p.x + xOffset;
      let newW = p.w + wOffset;

      // 边界约束限制，确保平台不伸出 360px 之外
      newW = Math.max(30, Math.min(newW, 280));
      newX = Math.max(5, Math.min(newX, 360 - newW - 5));

      const platformY = baseY + p.ry;

      platforms.push({
        x: newX,
        y: platformY,
        w: newW,
        h: p.h,
        type: p.type,
        slopeDir: p.slopeDir || null
      });
    });

    return platforms;
  }

  /**
   * 获取指定高度区间内的所有生成平台 (GC-free 缓存加速)
   * @param {number} minY - 视口最小 Y 坐标
   * @param {number} maxY - 视口最大 Y 坐标
   */
  getPlatformsInRange(minY, maxY) {
    // 计算当前视口跨越了哪些 chunk 索引
    // 例如：Y 坐标 3100 以下是 chunk 0，3100 ~ 2600 也是 chunk 0
    const startIdx = Math.max(0, Math.floor((this.startY - maxY) / this.chunkHeight));
    const endIdx = Math.max(0, Math.floor((this.startY - minY) / this.chunkHeight));

    const result = [];
    
    // 加载地面 (始终常驻)
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
