import { MAP_CONFIG } from './map.js';
import { saveScore, saveSession } from '../../core/storage.js';

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

    // 'idle' | 'charging' | 'jumping' | 'falling'
    this.state = 'idle';

    // 蓄力参数
    this.chargeProgress = 0; // 0 ~ 1
    this.chargeDirX = 0;
    this.chargeDirY = -1;

    // 存档点
    this.activeCheckpointIdx = 0;

    // 成绩与用时
    this.score = 0; // 0 ~ 100 进度百分比
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

    this.reset();
  }

  reset(savedSession = null) {
    this.saved = false;
    this.startTime = Date.now();
    this.elapsedTime = 0;

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

    this.chargeProgress = 0;
    this.scaleX = 1.0;
    this.scaleY = 1.0;
    this.slimeVelX = 0;
    this.slimeVelY = 0;
    this.score = 0;
  }

  /**
   * 触发一键回滚到篝火复活点
   */
  respawn() {
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
    if (this.state !== 'idle') return;

    // 根据蓄力方向和强度计算初始速度
    // 起跳速度范围控制在 [0.2, 0.55] 之间，能够覆盖跳跃需求
    const launchPower = 0.2 + power * 0.35;
    this.vx = dirX * launchPower;
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

    // 限制单帧最大时间，防止微信小游戏在切后台回来后 dt 过大崩塌
    const maxDt = 100;
    const actualDt = Math.min(dt, maxDt);
    this.elapsedTime += actualDt;

    // 简谐震荡弹性更新 (Damped Harmonic Oscillation)
    // 蓄力时不执行震荡，由拖拽直接设定扁平形变
    if (this.state !== 'charging') {
      const k = 0.005; // 弹簧刚度
      const c = 0.015; // 阻尼系数
      this.slimeVelX += (-k * (this.scaleX - 1.0) - c * this.slimeVelX) * actualDt;
      this.scaleX += this.slimeVelX * actualDt;

      this.slimeVelY += (-k * (this.scaleY - 1.0) - c * this.slimeVelY) * actualDt;
      this.scaleY += this.slimeVelY * actualDt;
    }

    // 子步模拟更新，每次微步最大推进 4ms
    const stepSize = 4;
    const numSteps = Math.ceil(actualDt / stepSize);

    for (let i = 0; i < numSteps; i++) {
      const substepDt = (i === numSteps - 1) ? (actualDt - stepSize * i) : stepSize;
      if (substepDt <= 0) continue;
      this.updateSubstep(substepDt);
    }

    // 进度计算 (高度换算百分比，Y 在 Y=3200 ➔ Y=120 之间，100% 封顶)
    const climbDist = 3100 - this.y;
    const totalDist = 3100 - 120;
    const progress = Math.max(0, Math.min(100, Math.floor((climbDist / totalDist) * 100)));
    this.score = progress;

    // 检查通关
    if (this.y <= 130 && !this.saved) {
      this.saveResult();
    }
  }

  /**
   * 单步微物理步运动与碰撞检测
   */
  updateSubstep(substepDt) {
    if (this.state === 'idle' || this.state === 'charging') return;

    // 1. 施加重力
    this.vy += GRAVITY * substepDt;

    // 2. 预测下一帧位置
    let nextX = this.x + this.vx * substepDt;
    let nextY = this.y + this.vy * substepDt;

    // 左右边界的隐形反弹检测
    if (nextX - this.radius < 0) {
      nextX = this.radius;
      this.vx = -this.vx * REBOUND;
      this.justBouncedWall = true;
      // 撞墙左侧拉伸变形
      this.scaleX = 0.65;
      this.scaleY = 1.35;
    } else if (nextX + this.radius > this.width) {
      nextX = this.width - this.radius;
      this.vx = -this.vx * REBOUND;
      this.justBouncedWall = true;
      // 撞墙右侧拉伸变形
      this.scaleX = 0.65;
      this.scaleY = 1.35;
    }

    let hitGround = false;

    // 3. 遍历平台碰撞箱进行 AABB 碰撞检测与求解
    for (let i = 0; i < this.platforms.length; i++) {
      const p = this.platforms[i];
      
      // 判断圆与矩形是否重叠
      const closestX = Math.max(p.x, Math.min(nextX, p.x + p.w));
      const closestY = Math.max(p.y, Math.min(nextY, p.y + p.h));
      const distanceSq = (nextX - closestX) * (nextX - closestX) + (nextY - closestY) * (nextY - closestY);

      if (distanceSq < this.radius * this.radius) {
        // 发生了碰撞，采用 MTV (最小穿透深度) 算法计算挤出法线与深度
        const dist = Math.sqrt(distanceSq);

        if (dist > 0.001) {
          // 圆心在矩形外部，但边界重合穿透
          const diffX = nextX - closestX;
          const diffY = nextY - closestY;
          const normalX = diffX / dist;
          const normalY = diffY / dist;
          const overlap = this.radius - dist;

          // 沿法线移出
          nextX += normalX * overlap;
          nextY += normalY * overlap;

          // 决定碰撞反弹的主方向
          if (Math.abs(normalY) >= Math.abs(normalX)) {
            if (normalY < 0) {
              // 1. 向上挤出 -> 踩地着陆
              const impactVy = this.vy; // 记录碰撞前的垂直下落速度

              nextY = p.y - this.radius;
              this.vy = 0;
              this.vx = 0;
              this.state = 'idle';
              hitGround = true;

              // 根据落地前的下落冲击速度动态计算压扁程度 (速度越快，拍得越扁)
              const impactFactor = Math.min(0.25, impactVy * 0.45);
              this.scaleX = 1.35 + impactFactor;
              this.scaleY = 0.65 - impactFactor;
              this.slimeVelX = 0;
              this.slimeVelY = 0;

              this.checkCheckpointTrigger(nextX, nextY);
              break; // 踩地着陆后，本微步结束碰撞检测
            } else {
              // 2. 向下挤出 -> 头部撞底，反弹下坠
              nextY = p.y + p.h + this.radius;
              this.vy = -this.vy * REBOUND;
              this.justBouncedCeiling = true;
              this.scaleX = 1.3;
              this.scaleY = 0.7;
            }
          } else {
            if (normalX < 0) {
              // 3. 向左挤出 -> 撞左侧墙壁反弹
              nextX = p.x - this.radius;
              this.vx = -this.vx * REBOUND;
              this.justBouncedWall = true;
              this.scaleX = 0.65;
              this.scaleY = 1.35;
            } else {
              // 4. 向右挤出 -> 撞右侧墙壁反弹
              nextX = p.x + p.w + this.radius;
              this.vx = -this.vx * REBOUND;
              this.justBouncedWall = true;
              this.scaleX = 0.65;
              this.scaleY = 1.35;
            }
          }
        } else {
          // 极端穿透情况：圆心深入矩形内部
          const dl = nextX - p.x;
          const dr = p.x + p.w - nextX;
          const dt = nextY - p.y;
          const db = p.y + p.h - nextY;
          const min = Math.min(dl, dr, dt, db);

          if (min === dt) {
            // 向上挤出
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
            // 向下挤出
            nextY = p.y + p.h + this.radius;
            this.vy = -this.vy * REBOUND;
            this.justBouncedCeiling = true;
            this.scaleX = 1.3;
            this.scaleY = 0.7;
          } else if (min === dl) {
            // 向左挤出
            nextX = p.x - this.radius;
            this.vx = -this.vx * REBOUND;
            this.justBouncedWall = true;
            this.scaleX = 0.65;
            this.scaleY = 1.35;
          } else {
            // 向右挤出
            nextX = p.x + p.w + this.radius;
            this.vx = -this.vx * REBOUND;
            this.justBouncedWall = true;
            this.scaleX = 0.65;
            this.scaleY = 1.35;
          }
        }
      }
    }

    this.x = nextX;
    this.y = nextY;

    // 落地之外若处于往下掉的速度，状态判定为 falling
    if (!hitGround && this.vy > 0) {
      this.state = 'falling';
    }
  }

  /**
   * 检查踩上地时是否激活了新的篝火存档点
   */
  checkCheckpointTrigger(x, y) {
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
      won: true
    });
  }

  /**
   * 返回当前的攀爬高度百分比
   */
  getProgressPercent() {
    return this.score;
  }
}
