// Mock 微信小游戏 API，使单元测试能在 Node 环境中独立运行
global.wx = {
  getStorageSync: () => ({}),
  setStorageSync: () => {}
};

import { JumpState } from './state.js';
import { MAP_CONFIG } from './map.js';

console.log('=== RUNNING JUMP GAME PHYSICS & STATE ENGINE TESTS ===\n');

// 1. 验证初始化与重置
const state = new JumpState();
console.log('[Test 1] Initializing State...');
if (state.x === 180 && state.state === 'idle') {
  console.log('✔ Initial state verified.');
} else {
  console.error('❌ Failed Initial state verification:', state.x, state.state);
  process.exit(1);
}

// 2. 模拟 Sub-stepping 微步长物理循环（确保踩地着陆）
console.log('\n[Test 2] Simulating Leap and Ground Landing...');
state.reset();
// 角色在 (10, Y) 开始下落
state.x = 10;
state.y = 2900;
state.vx = 0;
state.vy = 0.1; // 向下飞速移动
state.state = 'falling';

// 让其模拟 80 帧，应该会落到地面 (Y: 3150) 上并转为 idle 状态
for (let i = 0; i < 80; i++) {
  state.update(16);
}

if (state.state === 'idle' && Math.abs(state.y - (3150 - state.radius)) < 0.1) {
  console.log(`✔ Landing verified. Character height: ${state.y} (Floor Y: 3150)`);
} else {
  console.error('❌ Landing failed. State:', state.state, 'Height:', state.y);
  process.exit(1);
}

// 3. 验证 Sub-stepping 防穿墙（Tunneling）与侧壁反弹
console.log('\n[Test 3] Simulating High Speed Collision & Wall Bounce (Sub-stepping)...');
state.reset();
// 设置高速度向右撞击平台 (x: 140, y: 1850, w: 80, h: 150) 的左侧壁
state.x = 100;
state.y = 1900;
state.vx = 2.5; // 极高速度向右，一帧位移 2.5 * 16 = 40px，比 radius 8 还要大很多，正常会穿墙
state.vy = 0;
state.state = 'jumping';

// 模拟一帧
state.update(16);

// 检查是否被阻挡并向左反弹
if (state.vx < 0 && state.x < 140) {
  console.log(`✔ Wall bounce verified. Position X: ${state.x.toFixed(2)}, Velocity X: ${state.vx.toFixed(4)}`);
} else {
  console.error('❌ Tunneling detected! Character penetrated wall. X:', state.x, 'vx:', state.vx);
  process.exit(1);
}

// 4. 验证篝火 Checkpoint 存档与复活点
console.log('\n[Test 4] Verifying Checkpoint Triggers & Respawn...');
state.reset();
// 人从空中掉落到 Checkpoint 1 (x: 100, y: 2250) 的平台顶部
state.x = 100;
state.y = 2250 - state.radius - 4;
state.state = 'falling';
state.vx = 0;
state.vy = 0.5;

// 运行物理更新以执行落入着陆
state.update(16);

if (state.activeCheckpointIdx === 1) {
  console.log('✔ Checkpoint 1 activated successfully.');
} else {
  console.error('❌ Checkpoint trigger failed. Active Index:', state.activeCheckpointIdx);
  process.exit(1);
}

// 坠落到深渊，模拟一键复活
state.y = 3100;
state.vx = 0;
state.vy = 0;
state.respawn();

if (state.x === 100 && Math.abs(state.y - (2250 - state.radius)) < 0.1) {
  console.log('✔ Respawn successfully returned character to Checkpoint 1.');
} else {
  console.error('❌ Respawn failed. Position:', state.x, state.y);
  process.exit(1);
}

// 5. 验证简谐阻尼震荡的收敛
console.log('\n[Test 5] Verifying Damped Harmonic Oscillation (Elastic Scale Convergence)...');
state.scaleX = 1.4;
state.scaleY = 0.6;
state.slimeVelX = 0;
state.slimeVelY = 0;
state.state = 'jumping'; // 使其在空中，自动进行简谐物理更新

// 模拟 100 帧 (1600ms) 让其收敛
for (let i = 0; i < 100; i++) {
  state.update(16);
}

const diffX = Math.abs(state.scaleX - 1.0);
const diffY = Math.abs(state.scaleY - 1.0);
if (diffX < 0.05 && diffY < 0.05) {
  console.log(`✔ Oscillation convergence verified. scaleX: ${state.scaleX.toFixed(4)}, scaleY: ${state.scaleY.toFixed(4)}`);
} else {
  console.error('❌ Oscillation did not decay properly. scaleX:', state.scaleX, 'scaleY:', state.scaleY);
  process.exit(1);
}

// 6. 验证斜坡滑动与物理状态
console.log('\n[Test 6] Verifying Slope Sliding & Friction...');
state.mode = 'classic';
state.reset();
// 手动塞入一个确定的斜坡平台进行测试，避免随机性影响
state.platforms = [
  { x: 100, y: 2980, w: 200, h: 50, type: 'slope', slopeDir: 'left-down' }
];
state.updateActiveColliders();

// 斜坡左下是 (100, 3030)，右上是 (300, 2980)
// 我们在 x = 140，y = 2950 垂直往下落
state.x = 140;
state.y = 2950;
state.vx = 0;
state.vy = 0.2;
state.state = 'falling';

// 更新几帧，让它撞在斜坡上并开始滑落
for (let i = 0; i < 20; i++) {
  state.update(16);
}

// 检查是否进入了 sliding 状态
if (state.state === 'sliding') {
  console.log(`✔ Slope sliding state verified. Speed vx: ${state.vx.toFixed(4)}, vy: ${state.vy.toFixed(4)}`);
} else {
  console.error('❌ Failed sliding state verification. State:', state.state);
  process.exit(1);
}

// 7. 验证斜面顶点圆角碰撞
console.log('\n[Test 7] Verifying Rounded Slope Vertex Collision...');
state.mode = 'classic';
state.reset();
state.platforms = [
  { x: 100, y: 2980, w: 200, h: 50, type: 'slope', slopeDir: 'left-down' }
];
state.updateActiveColliders();
// 将圆心放置在极其接近顶点 (300, 2980) 的地方（稍微偏右偏上，如 (305, 2975)），向顶点方向高速运动
state.x = 305;
state.y = 2975;
state.vx = -1.0;
state.vy = 1.0;
state.state = 'falling';

state.update(4); // 运行一小步物理

// 应该能被圆角弹开，不会直接穿透卡在斜坡里面
if (state.x > 300 && state.y < 2980) {
  console.log(`✔ Vertex collision verified. Position: (${state.x.toFixed(2)}, ${state.y.toFixed(2)})`);
} else {
  console.error('❌ Vertex collision failed or penetrated. Position:', state.x, state.y);
  process.exit(1);
}

// 8. 验证无尽模式 Chunk 加载与 GC-free 缓存
console.log('\n[Test 8] Verifying Endless Chunk Loading & Cache Hit...');
state.mode = 'endless';
state.reset(); // 初始化生成器和无尽数据

// 先在初始底部位置更新一次，加载并缓存最底部的 chunks
state.update(16);
const cacheSizeBefore = state.generator.chunkCache.size;

// 向上爬升 1200px (即 Y 变小)
state.y -= 1200;
state.update(16); // 触发更高平台的生成与缓存

const cacheSizeAfter = state.generator.chunkCache.size;
if (cacheSizeAfter > cacheSizeBefore) {
  console.log(`✔ GC-free Chunk loaded. Cached count: ${cacheSizeAfter}`);
} else {
  console.error('❌ Chunk loading failed to populate cache.');
  process.exit(1);
}

// 再次坠落到底部 (折返)
state.y = 3100;
state.update(16);
const cacheSizeFinal = state.generator.chunkCache.size;

// 此时因为底部 chunk 已经缓存在 Map 中，缓存大小不应该增加
if (cacheSizeFinal === cacheSizeAfter) {
  console.log('✔ Cache hit verified (GC-free cache working).');
} else {
  console.error('❌ Cache size changed, indicating chunk was re-instantiated. Final:', cacheSizeFinal, 'After:', cacheSizeAfter);
  process.exit(1);
}

// 9. 验证斜坡底部和垂直侧边撞击阻断 (防穿透)
console.log('\n[Test 9] Verifying Slope Bottom & Wall Collision Blockers (Anti-Penetration)...');
state.mode = 'classic';
state.reset();
state.platforms = [
  { x: 100, y: 2980, w: 200, h: 50, type: 'slope', slopeDir: 'left-down' }
];
state.updateActiveColliders();

// 9a. 测试从下方垂直撞击底面 Y=3030
state.x = 200;
state.y = 3050;
state.vx = 0;
state.vy = -0.5; // 向上高速运动
state.state = 'jumping';

// 运行 3 帧以确保有足够的时间发生接触碰撞，中途截获事件
let hitCeiling = false;
for (let i = 0; i < 3; i++) {
  state.update(16);
  if (state.justBouncedCeiling) {
    hitCeiling = true;
  }
}

// 应该被底边阻挡并向下弹回，y 应该在 3030 + radius = 3038 或下方，vy 应该变成正数 (向下)
if (state.y >= 3038 && state.vy > 0 && hitCeiling) {
  console.log(`✔ Slope bottom blocker verified. Position Y: ${state.y.toFixed(2)}, Velocity Y: ${state.vy.toFixed(4)}`);
} else {
  console.error('❌ Slope bottom blocker failed! Character penetrated. Y:', state.y, 'vy:', state.vy, 'hitCeiling:', hitCeiling);
  process.exit(1);
}

// 9b. 测试撞击垂直墙面 (left-down 垂直墙在右侧 x=300)
state.x = 315;
state.y = 3000;
state.vx = -1.0;
state.vy = 0;
state.state = 'jumping';

let hitWall = false;
for (let i = 0; i < 3; i++) {
  state.update(16);
  if (state.justBouncedWall) {
    hitWall = true;
  }
}

// 应该被右侧垂直墙阻挡并向右反弹，x 应该在 300 + radius = 308 或右侧，vx 应该变成正数 (向右)
if (state.x >= 308 && state.vx > 0 && hitWall) {
  console.log(`✔ Slope vertical wall blocker verified. Position X: ${state.x.toFixed(2)}, Velocity X: ${state.vx.toFixed(4)}`);
} else {
  console.error('❌ Slope vertical wall blocker failed! Character penetrated. X:', state.x, 'vx:', state.vx);
  process.exit(1);
}

console.log('\n✔ ALL STATE & PHYSICS ENGINE UNIT TESTS PASSED!');
