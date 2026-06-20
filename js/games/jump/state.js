import { MAP_CONFIG } from './map.js';
import { saveScore, saveSession } from '../../core/storage.js';
import { ChunkGenerator } from './generator.js';

const GRAVITY = 0.0006;       // 像素/ms^2
const REBOUND = 0.6;          // 反弹阻尼系数
const RADIUS = 8;             // 角色半径

export class JumpState {
  constructor() {
    this.width = MAP_CONFIG.totalWidth;
    this.height = MAP_CONFIG.totalHeight;
    this.platforms = MAP_CONFIG.platforms;
    this.checkpoints = MAP_CONFIG.checkpoints;

    this.x = 180;
    this.y = 3100;
    this.vx = 0;
    this.vy = 0;
    this.radius = RADIUS;

    // 'idle' | 'charging' | 'jumping' | 'falling' | 'sliding'
    this.state = 'idle';

    // 蓄力参数
    this.chargeProgress = 0; // 0 ~ 1
    this.chargeDirX = 0;
    this.chargeDirY = -1;

    // 游戏模式: 'classic' | 'endless'
    this.mode = 'classic';
    this.generator = null;
    this.peakAltitude = 0;

    // 存档点
    this.activeCheckpointIdx = 0;

    // 成绩与用时
    this.score = 0; // 0 ~ 100 进度百分比，无尽模式下为最高爬升高度
    this.bestScore = 0;
    this.bestTime = Infinity;
    this.startTime = Date.now();
    this.elapsedTime = 0; // 毫秒
    this.saved = false;

    // 简谐震荡形变参数
    this.scaleX = 1.0;
    this.scaleY = 1.0;
    this.slimeVelX = 0;
    this.slimeVelY = 0;

    // 碰撞事件状态标志（用于向 index 暴露震动事件）
    this.justBouncedWall = false;
    this.justBouncedCeiling = false;

    this.activeColliders = [];

    this.reset();
  }

  updateActiveColliders() {
    this.activeColliders = [];
    for (let i = 0; i < this.platforms.length; i++) {
      const p = this.platforms[i];
      if (p.type === 'slope') {
        const isBoth = p.slopeDir === 'both';
        const flatW = isBoth 
          ? Math.floor(p.w * 0.55)
          : Math.floor(p.w * 0.6);

        if (isBoth) {
          const slopeW = Math.floor((p.w - flatW) / 2);
          this.activeColliders.push({
            x: p.x + slopeW,
            y: p.y,
            w: flatW,
            h: p.h,
            type: 'wood'
          });
          this.activeColliders.push({
            x: p.x,
            y: p.y,
            w: slopeW,
            h: p.h,
            type: 'slope',
            slopeDir: 'left-down'
          });
          this.activeColliders.push({
            x: p.x + slopeW + flatW,
            y: p.y,
            w: slopeW,
            h: p.h,
            type: 'slope',
            slopeDir: 'right-down'
          });
        } else if (p.slopeDir === 'left-down') {
          this.activeColliders.push({
            x: p.x + p.w - flatW,
            y: p.y,
            w: flatW,
            h: p.h,
            type: 'wood'
          });
          this.activeColliders.push({
            x: p.x,
            y: p.y,
            w: p.w - flatW,
            h: p.h,
            type: 'slope',
            slopeDir: 'left-down'
          });
        } else {
          this.activeColliders.push({
            x: p.x,
            y: p.y,
            w: flatW,
            h: p.h,
            type: 'wood'
          });
          this.activeColliders.push({
            x: p.x + flatW,
            y: p.y,
            w: p.w - flatW,
            h: p.h,
            type: 'slope',
            slopeDir: 'right-down'
          });
        }
      } else {
        this.activeColliders.push(p);
      }
    }
  }

  reset(savedSession = null) {
    this.saved = false;
    this.startTime = Date.now();
    this.elapsedTime = 0;

    if (this.mode === 'endless') {
      this.generator = new ChunkGenerator(Math.random());
      this.activeCheckpointIdx = 0;
      this.x = 180;
      this.y = 3150 - this.radius;
      this.state = 'idle';
      this.vx = 0;
      this.vy = 0;
      this.platforms = [];
      this.peakAltitude = 0;
    } else {
      this.generator = null;
      this.platforms = MAP_CONFIG.platforms;
      this.peakAltitude = 0;
      if (savedSession) {
        this.activeCheckpointIdx = savedSession.checkpointIdx || 0;
        this.x = savedSession.x;
        this.y = savedSession.y;
        this.state = 'idle';
        this.vx = 0;
        this.vy = 0;
      } else {
        this.activeCheckpointIdx = 0;
        const cp = this.checkpoints[0];
        this.x = cp.x;
        this.y = cp.y - this.radius;
        this.state = 'idle';
        this.vx = 0;
        this.vy = 0;
      }
    }

    this.chargeProgress = 0;
    this.scaleX = 1.0;
    this.scaleY = 1.0;
    this.slimeVelX = 0;
    this.slimeVelY = 0;
    this.score = 0;
    this.updateActiveColliders();
  }

  /**
   * 触发一键回滚到篝火复活点
   */
  respawn() {
    if (this.mode === 'endless') return; // 无尽模式禁篝火
    const cp = this.checkpoints[this.activeCheckpointIdx] || this.checkpoints[0];
    this.x = cp.x;
    this.y = cp.y - this.radius;
    this.vx = 0;
    this.vy = 0;
    this.state = 'idle';
    this.chargeProgress = 0;
    this.scaleX = 1.3;
    this.scaleY = 0.7; // 落地压扁瞬间
    this.slimeVelX = 0;
    this.slimeVelY = 0;
  }

  /**
   * 触发跳跃
   */
  jump(dirX, dirY, power) {
    if (this.state !== 'idle' && this.state !== 'sliding') return;

    // 根据蓄力方向和强度计算初始速度
    // 起跳速度范围控制在 [0.2, 0.61] 之间，留出合理的腾空余地，提升操作容错率
    const launchPower = 0.2 + power * 0.41;

    // 如果处于滑坡滑动状态下起跳，叠加原有的滑坡水平初速度惯性
    if (this.state === 'sliding') {
      this.vx = this.vx + dirX * launchPower;
    } else {
      this.vx = dirX * launchPower;
    }
    this.vy = dirY * launchPower;

    this.state = 'jumping';
    this.chargeProgress = 0;

    // 起跳瞬间瞬间拉伸
    this.scaleX = 0.7;
    this.scaleY = 1.35;
    this.slimeVelX = 0;
    this.slimeVelY = 0;
  }

  /**
   * 物理更新主入口（小步长 sub-stepping 防穿墙）
   */
  update(dt) {
    this.justBouncedWall = false;
    this.justBouncedCeiling = false;

    if (this.state === 'idle' || this.state === 'charging') {
      this.vx = 0;
      this.vy = 0;
    }

    if (this.mode === 'endless') {
      // 动态加载角色周围的平台，高度 Y 在 Y - 600 和 Y + 600 之间，GC-free
      this.platforms = this.generator.getPlatformsInRange(this.y - 600, this.y + 600);
      this.updateActiveColliders();
    }

    // 限制单帧最大时间，防止微信小游戏在切后台回来后 dt 过大崩塌
    const maxDt = 100;
    const actualDt = Math.min(dt, maxDt);
    this.elapsedTime += actualDt;

    // 子步模拟更新，每次微步最大推进 4ms
    const stepSize = 4;
    const numSteps = Math.ceil(actualDt / stepSize);

    for (let i = 0; i < numSteps; i++) {
      const substepDt = (i === numSteps - 1) ? (actualDt - stepSize * i) : stepSize;
      if (substepDt <= 0) continue;
      this.updateSubstep(substepDt);
    }

    // 限制形变缩放范围，防止数值爆炸或不可预期的极端变形
    this.scaleX = Math.max(0.3, Math.min(1.7, this.scaleX));
    this.scaleY = Math.max(0.3, Math.min(1.7, this.scaleY));

    // 进度计算 (高度换算，经典 0~100，无尽为最高绝对高度像素数)
    if (this.mode === 'endless') {
      const currentHeight = Math.max(0, Math.floor((3150 - this.radius) - this.y));
      if (currentHeight > this.peakAltitude) {
        this.peakAltitude = currentHeight;
      }
      this.score = this.peakAltitude;
    } else {
      const climbDist = 3100 - this.y;
      const totalDist = 3100 - 120;
      const progress = Math.max(0, Math.min(100, Math.floor((climbDist / totalDist) * 100)));
      this.score = progress;

      // 检查通关 (经典模式)
      if (this.y <= 130 && !this.saved) {
        this.saveResult();
      }
    }
  }

  /**
   * 单步微物理步运动与碰撞检测
   */
  updateSubstep(substepDt) {
    // 简谐震荡弹性更新 (Damped Harmonic Oscillation)
    if (this.state !== 'charging') {
      const k = 0.005; // 弹簧刚度
      const c = 0.015; // 阻尼系数
      const diffX = this.scaleX - 1.0;
      const diffY = this.scaleY - 1.0;

      // 仅在未完全收敛时计算，收敛后强制归一化以节省 CPU 代数计算
      if (Math.abs(diffX) > 0.001 || Math.abs(this.slimeVelX) > 0.001) {
        this.slimeVelX += (-k * diffX - c * this.slimeVelX) * substepDt;
        this.scaleX += this.slimeVelX * substepDt;
      } else {
        this.scaleX = 1.0;
        this.slimeVelX = 0;
      }

      if (Math.abs(diffY) > 0.001 || Math.abs(this.slimeVelY) > 0.001) {
        this.slimeVelY += (-k * diffY - c * this.slimeVelY) * substepDt;
        this.scaleY += this.slimeVelY * substepDt;
      } else {
        this.scaleY = 1.0;
        this.slimeVelY = 0;
      }
    }

    if (this.state === 'idle' || this.state === 'charging') return;

    // 1. 施加重力
    this.vy += GRAVITY * substepDt;

    // 预测下一帧位置
    let nextX = this.x + this.vx * substepDt;
    let nextY = this.y + this.vy * substepDt;

    // 左右边界的隐形反弹检测
    if (nextX - this.radius < 0) {
      nextX = this.radius;
      this.vx = -this.vx * REBOUND;
      this.justBouncedWall = true;
      this.scaleX = 0.65;
      this.scaleY = 1.35;
    } else if (nextX + this.radius > this.width) {
      nextX = this.width - this.radius;
      this.vx = -this.vx * REBOUND;
      this.justBouncedWall = true;
      this.scaleX = 0.65;
      this.scaleY = 1.35;
    }

    let hitGround = false;
    let hitSlope = false;

    // 遍历处理所有碰撞体进行碰撞检测与求解 (使用 activeColliders 避免高频临时数组分配)
    for (let i = 0; i < this.activeColliders.length; i++) {
      const p = this.activeColliders[i];

      if (p.type === 'slope') {
        // ── A. 斜坡碰撞解算 ──
        // 1. 底边碰撞检测与阻断 (从下方撞击斜坡水平底面，触发头部回弹)
        if (nextY - this.radius < p.y + p.h && nextY > p.y + p.h && nextX >= p.x && nextX <= p.x + p.w) {
          nextY = p.y + p.h + this.radius;
          this.vy = -this.vy * REBOUND;
          this.justBouncedCeiling = true;
          continue;
        }

        // 2. 垂直侧壁碰撞检测与阻断 (从侧壁撞击垂直墙面)
        if (p.slopeDir === 'left-down') {
          // left-down 的垂直墙在右侧 (x = p.x + p.w)
          if (nextX - this.radius < p.x + p.w && nextX > p.x + p.w && nextY >= p.y && nextY <= p.y + p.h) {
            nextX = p.x + p.w + this.radius;
            this.vx = -this.vx * REBOUND;
            this.justBouncedWall = true;
            continue;
          }
        } else if (p.slopeDir === 'right-down') {
          // right-down 的垂直墙在左侧 (x = p.x)
          if (nextX + this.radius > p.x && nextX < p.x && nextY >= p.y && nextY <= p.y + p.h) {
            nextX = p.x - this.radius;
            this.vx = -this.vx * REBOUND;
            this.justBouncedWall = true;
            continue;
          }
        }

        // 3. 斜边 Segment-Vertex 最近点投影解算
        const x1 = p.x;
        const y1 = p.slopeDir === 'left-down' ? p.y + p.h : p.y;
        const x2 = p.x + p.w;
        const y2 = p.slopeDir === 'left-down' ? p.y : p.y + p.h;

        const dx = x2 - x1;
        const dy = y2 - y1;
        const lenSq = dx * dx + dy * dy;

        // 计算圆心 (nextX, nextY) 到斜线段的最近投影点
        let t = ((nextX - x1) * dx + (nextY - y1) * dy) / lenSq;
        t = Math.max(0, Math.min(1, t)); // [0, 1] 限幅实现端点圆角化
        const projX = x1 + t * dx;
        const projY = y1 + t * dy;

        const distSq = (nextX - projX) * (nextX - projX) + (nextY - projY) * (nextY - projY);

        if (distSq < this.radius * this.radius) {
          const dist = Math.sqrt(distSq);

          // 碰撞法线 (指向斜坡外上侧)
          let normalX = dist > 0.001 ? (nextX - projX) / dist : 0;
          let normalY = dist > 0.001 ? (nextY - projY) / dist : -1;

          if (normalY > 0) {
            normalX = -normalX;
            normalY = -normalY;
          }

          const overlap = this.radius - dist;
          nextX += normalX * overlap;
          nextY += normalY * overlap;

          // 判定碰撞方向：若法线倾斜向上，角色踩在斜面上滑行
          if (normalY < -0.1) {
            hitSlope = true;
            if (this.state !== 'sliding') {
              this.justBouncedWall = true;
            }
            this.state = 'sliding';
 
            // 斜坡切线向量 (向下滑动方向)
            let tx = 0, ty = 0;
            const len = Math.sqrt(lenSq);
            if (p.slopeDir === 'left-down') {
              tx = -dx / len;
              ty = -dy / len;
            } else {
              tx = dx / len;
              ty = dy / len;
            }
 
            // 速度在斜面切线上的投影
            let vt = this.vx * tx + this.vy * ty;
 
            // 施加沿斜坡向下的重力分力
            const gSlide = GRAVITY * ty;
            vt += gSlide * substepDt;
 
            // 施加滑行摩擦力
            vt *= Math.pow(0.994, substepDt);
 
            // 更新速度向量
            this.vx = vt * tx;
            this.vy = vt * ty;
          } else {
            // 撞击斜坡的底部或垂直侧壁
            if (normalY > 0.5) {
              nextY = projY + this.radius;
              this.vy = -this.vy * REBOUND;
              this.justBouncedCeiling = true;
            } else if (normalX !== 0) {
              nextX = projX + (normalX > 0 ? this.radius : -this.radius);
              this.vx = -this.vx * REBOUND;
              this.justBouncedWall = true;
            }
          }
        }
      } else {
        // ── B. 普通矩形平台碰撞解算 (原有 MTV 算法) ──
        const closestX = Math.max(p.x, Math.min(nextX, p.x + p.w));
        const closestY = Math.max(p.y, Math.min(nextY, p.y + p.h));
        const distanceSq = (nextX - closestX) * (nextX - closestX) + (nextY - closestY) * (nextY - closestY);

        if (distanceSq < this.radius * this.radius) {
          const dist = Math.sqrt(distanceSq);

          if (dist > 0.001) {
            const diffX = nextX - closestX;
            const diffY = nextY - closestY;
            const normalX = diffX / dist;
            const normalY = diffY / dist;
            const overlap = this.radius - dist;

            nextX += normalX * overlap;
            nextY += normalY * overlap;

            if (Math.abs(normalY) >= Math.abs(normalX)) {
              if (normalY < 0) {
                const impactVy = this.vy;

                nextY = p.y - this.radius;
                this.vy = 0;
                this.vx = 0;
                this.state = 'idle';
                hitGround = true;

                const impactFactor = Math.min(0.25, impactVy * 0.45);
                this.scaleX = 1.35 + impactFactor;
                this.scaleY = 0.65 - impactFactor;
                this.slimeVelX = 0;
                this.slimeVelY = 0;

                this.checkCheckpointTrigger(nextX, nextY);
                break;
              } else {
                nextY = p.y + p.h + this.radius;
                this.vy = -this.vy * REBOUND;
                this.justBouncedCeiling = true;
                this.scaleX = 1.3;
                this.scaleY = 0.7;
              }
            } else {
              if (normalX < 0) {
                nextX = p.x - this.radius;
                this.vx = -this.vx * REBOUND;
                this.justBouncedWall = true;
                this.scaleX = 0.65;
                this.scaleY = 1.35;
              } else {
                nextX = p.x + p.w + this.radius;
                this.vx = -this.vx * REBOUND;
                this.justBouncedWall = true;
                this.scaleX = 0.65;
                this.scaleY = 1.35;
              }
            }
          } else {
            const dl = nextX - p.x;
            const dr = p.x + p.w - nextX;
            const dt = nextY - p.y;
            const db = p.y + p.h - nextY;
            const min = Math.min(dl, dr, dt, db);

            if (min === dt) {
              const impactVy = this.vy;

              nextY = p.y - this.radius;
              this.vy = 0;
              this.vx = 0;
              this.state = 'idle';
              hitGround = true;

              const impactFactor = Math.min(0.25, impactVy * 0.45);
              this.scaleX = 1.35 + impactFactor;
              this.scaleY = 0.65 - impactFactor;
              this.slimeVelX = 0;
              this.slimeVelY = 0;

              this.checkCheckpointTrigger(nextX, nextY);
              break;
            } else if (min === db) {
              nextY = p.y + p.h + this.radius;
              this.vy = -this.vy * REBOUND;
              this.justBouncedCeiling = true;
              this.scaleX = 1.3;
              this.scaleY = 0.7;
            } else if (min === dl) {
              nextX = p.x - this.radius;
              this.vx = -this.vx * REBOUND;
              this.justBouncedWall = true;
              this.scaleX = 0.65;
              this.scaleY = 1.35;
            } else {
              nextX = p.x + p.w + this.radius;
              this.vx = -this.vx * REBOUND;
              this.justBouncedWall = true;
              this.scaleX = 0.65;
              this.scaleY = 1.35;
            }
          }
        }
      }
    }

    this.x = nextX;
    this.y = nextY;

    // 落地与滑坡之外若处于往下掉的速度，状态判定为 falling
    if (!hitGround && !hitSlope && this.vy > 0) {
      this.state = 'falling';
    }
  }

  /**
   * 检查踩上地时是否激活了新的篝火存档点
   */
  checkCheckpointTrigger(x, y) {
    if (this.mode === 'endless') return; // 无尽模式取消存档篝火

    for (let i = 0; i < this.checkpoints.length; i++) {
      const cp = this.checkpoints[i];
      // 1. 高度匹配：判断当前落地的 Y 坐标是否和该篝火所在平台一致
      if (Math.abs(y - (cp.y - this.radius)) < 2) {
        // 2. 寻找到相同 Y 轴高度的篝火承载平台
        const plat = this.platforms.find(p => Math.abs(p.y - cp.y) < 2);
        if (plat) {
          // 3. 范围匹配：判断角色是否在这个平台的宽度 x 范围内
          if (x >= plat.x && x <= plat.x + plat.w) {
            if (this.activeCheckpointIdx !== cp.id) {
              this.activeCheckpointIdx = cp.id;
              // 点亮新篝火，进行 Session 持久化
              saveSession('jump', {
                checkpointIdx: cp.id,
                x: cp.x,
                y: cp.y - this.radius
              });
            }
            break;
          }
        }
      }
    }
  }

  /**
   * 关卡结束持久化结算
   */
  saveResult() {
    if (this.saved) return;
    this.saved = true;
    const timeSpent = Math.floor((Date.now() - this.startTime) / 1000);

    saveScore('jump', {
      score: 100,
      time: timeSpent,
      difficulty: 'classic', // 经典模式
      won: true
    });
  }

  /**
   * 返回当前的攀爬高度百分比或海拔高度
   */
  getProgressPercent() {
    return this.score;
  }
}
