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

console.log('\n✔ ALL STATE & PHYSICS ENGINE UNIT TESTS PASSED!');
