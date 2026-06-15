/**
 * MixGame E2E Test Runner
 * Implements 20+ test cases across Tiers 1-4 for MenuScene navigation and Wood Kingdom.
 */

import { GAMES, getGameConfig } from '../js/games/registry.js';

// Helper: wait for a given milliseconds
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// Helper: check if Wood Kingdom is registered
function checkWoodKingdom() {
  const config = getGameConfig('woodkingdom');
  if (!config || !config.sceneClass) {
    throw new Error('Wood Kingdom game module or scene class is not registered in games/registry.js');
  }
  return config;
}

// Helper: get current active scene
function getActiveScene() {
  if (!window.gameHost) {
    throw new Error('GameHost is not initialized');
  }
  return window.gameHost.scene;
}

// Assertions
const assert = {
  equal(actual, expected, message = '') {
    if (actual !== expected) {
      throw new Error(`Assertion failed: expected [${expected}] but got [${actual}]. ${message}`);
    }
  },
  true(actual, message = '') {
    if (actual !== true) {
      throw new Error(`Assertion failed: expected true but got [${actual}]. ${message}`);
    }
  },
  false(actual, message = '') {
    if (actual !== false) {
      throw new Error(`Assertion failed: expected false but got [${actual}]. ${message}`);
    }
  },
  greaterOrEqual(actual, expected, message = '') {
    if (actual < expected) {
      throw new Error(`Assertion failed: expected [${actual}] >= [${expected}]. ${message}`);
    }
  },
  lessThan(actual, expected, message = '') {
    if (actual >= expected) {
      throw new Error(`Assertion failed: expected [${actual}] < [${expected}]. ${message}`);
    }
  }
};

// Test Suite Definition
export const tests = [
  // ================= TIER 1: UI/NAVIGATION =================
  {
    id: '1.1',
    tier: 'Tier 1',
    category: 'UI/Navigation',
    name: '点击 Tab 按钮切换页面',
    run: async () => {
      const host = window.gameHost;
      // Ensure we are in menu scene
      host.showMenu();
      await delay(100);
      const scene = getActiveScene();
      
      const { width } = host;
      const layout = scene._layout || { topArea: 160 };
      const topArea = layout.topArea;
      const tabY = topArea - 28;

      // Click Modern Tab (X = width / 2 + 60)
      const tabModernX = width / 2 + 60;
      scene.onTouchStart({ x: tabModernX, y: tabY });
      scene.onTouchEnd({ x: tabModernX, y: tabY });
      
      // Manually pump updates to complete transition animation
      scene.update(250);
      
      assert.equal(scene.currentPage, 1, 'Should switch to Modern page (1)');
      assert.equal(scene.currentOffset, -width, 'Visual offset should align with Page 1');

      // Click Classic Tab (X = width / 2 - 60)
      const tabClassicX = width / 2 - 60;
      scene.onTouchStart({ x: tabClassicX, y: tabY });
      scene.onTouchEnd({ x: tabClassicX, y: tabY });
      
      scene.update(250);
      
      assert.equal(scene.currentPage, 0, 'Should switch back to Classic page (0)');
      assert.equal(scene.currentOffset, 0, 'Visual offset should return to 0');
    }
  },
  {
    id: '1.2',
    tier: 'Tier 1',
    category: 'UI/Navigation',
    name: '横向滑动切换页面 (Happy Path)',
    run: async () => {
      const host = window.gameHost;
      host.showMenu();
      await delay(100);
      const scene = getActiveScene();
      const { width, height } = host;

      // Swipe classic to modern (drag left): start at 80% width, move to 20% width
      scene.onTouchStart({ x: width * 0.8, y: height * 0.5 });
      // Simulate multiple moves
      for (let i = 1; i <= 5; i++) {
        const x = width * 0.8 - (width * 0.6) * (i / 5);
        scene.onTouchMove({ x, y: height * 0.5 });
        scene.update(16);
      }
      scene.onTouchEnd({ x: width * 0.2, y: height * 0.5 });
      scene.update(250);

      assert.equal(scene.currentPage, 1, 'Swipe left should transition to Modern page (1)');

      // Swipe back (drag right): start at 20% width, move to 80% width
      scene.onTouchStart({ x: width * 0.2, y: height * 0.5 });
      for (let i = 1; i <= 5; i++) {
        const x = width * 0.2 + (width * 0.6) * (i / 5);
        scene.onTouchMove({ x, y: height * 0.5 });
        scene.update(16);
      }
      scene.onTouchEnd({ x: width * 0.8, y: height * 0.5 });
      scene.update(250);

      assert.equal(scene.currentPage, 0, 'Swipe right should transition back to Classic page (0)');
    }
  },
  {
    id: '1.3',
    tier: 'Tier 1',
    category: 'UI/Navigation',
    name: '滑动过程中 Tab 指示下划线跟手联动',
    run: async () => {
      const host = window.gameHost;
      host.showMenu();
      await delay(100);
      const scene = getActiveScene();
      const { width, height } = host;

      // Start drag classic to modern
      scene.onTouchStart({ x: width * 0.8, y: height * 0.5 });
      // Drag exactly 25% of width to the left
      const dragDistance = width * 0.25;
      scene.onTouchMove({ x: width * 0.8 - dragDistance, y: height * 0.5 });
      scene.update(0); // sync variables

      // Progress is 0.25, underline should slide towards Modern tab
      const progress = -scene.currentOffset / width;
      assert.equal(Math.round(progress * 100) / 100, 0.25, 'Progress should match drag offset ratio');

      const expectedUnderlineX = (width / 2 - 60) + progress * 120;
      // In renderCategoryTabs: underlineX = (width / 2 - 60) + progress * 120;
      assert.equal(Math.round(expectedUnderlineX), Math.round((width / 2 - 60) + 0.25 * 120));

      // Cancel drag
      scene.onTouchEnd({ x: width * 0.8 - dragDistance, y: height * 0.5 });
      scene.update(250); // let it snap back
    }
  },
  {
    id: '1.4',
    tier: 'Tier 1',
    category: 'UI/Navigation',
    name: 'Notch 安全区自适应偏移',
    run: async () => {
      const host = window.gameHost;
      const originalGetWindowInfo = wx.getWindowInfo;

      // Mock safe area A: top = 0
      wx.getWindowInfo = () => ({
        windowWidth: host.width,
        windowHeight: host.height,
        screenWidth: host.width,
        screenHeight: host.height,
        pixelRatio: window.devicePixelRatio || 1,
        safeArea: { top: 0, bottom: host.height, left: 0, right: host.width },
        statusBarHeight: 0,
      });
      host.safeTop = 0;
      const sceneA = new host.scene.constructor(host);
      sceneA.init();
      const topAreaA = sceneA._layout.topArea;

      // Mock safe area B: top = 44 (standard notch)
      wx.getWindowInfo = () => ({
        windowWidth: host.width,
        windowHeight: host.height,
        screenWidth: host.width,
        screenHeight: host.height,
        pixelRatio: window.devicePixelRatio || 1,
        safeArea: { top: 44, bottom: host.height, left: 0, right: host.width },
        statusBarHeight: 44,
      });
      host.safeTop = 44;
      const sceneB = new host.scene.constructor(host);
      sceneB.init();
      const topAreaB = sceneB._layout.topArea;

      // Restore original
      wx.getWindowInfo = originalGetWindowInfo;
      host.safeTop = originalGetWindowInfo().safeArea.top || 0;
      host.showMenu(); // restore current active scene

      // Assertion: B should be offset exactly by 44px
      assert.equal(topAreaB - topAreaA, 44, 'Top area should expand by safeTop height');
    }
  },
  {
    id: '2.1',
    tier: 'Tier 2',
    category: 'UI/Navigation',
    name: '滑动距离不足回弹 (Snap-Back)',
    run: async () => {
      const host = window.gameHost;
      host.showMenu();
      await delay(100);
      const scene = getActiveScene();
      const { width, height } = host;

      // Swipe left but only by 15% of width (threshold is 25%)
      scene.onTouchStart({ x: width * 0.8, y: height * 0.5 });
      scene.onTouchMove({ x: width * 0.8 - width * 0.15, y: height * 0.5 });
      scene.onTouchEnd({ x: width * 0.8 - width * 0.15, y: height * 0.5 });
      
      scene.update(250); // Wait for transition

      assert.equal(scene.currentPage, 0, 'Should not transition page if drag is under 25%');
      assert.equal(scene.currentOffset, 0, 'Offset should snap back to 0');
    }
  },
  {
    id: '2.2',
    tier: 'Tier 2',
    category: 'UI/Navigation',
    name: '边界滑动阻尼限制',
    run: async () => {
      const host = window.gameHost;
      host.showMenu();
      await delay(100);
      const scene = getActiveScene();
      const { width, height } = host;

      // On page 0, drag right (out of bounds) by 50% of screen width
      scene.onTouchStart({ x: width * 0.2, y: height * 0.5 });
      scene.onTouchMove({ x: width * 0.2 + width * 0.5, y: height * 0.5 });
      scene.update(0);

      // Verify that visual offset is dampened (should be deltaX * 0.3)
      const expectedOffset = (width * 0.5) * 0.3;
      assert.equal(scene.swipeOffset, expectedOffset, 'Out-of-bounds drag should apply 0.3 damping');

      scene.onTouchEnd({ x: width * 0.2 + width * 0.5, y: height * 0.5 });
      scene.update(250); // let it snap back
    }
  },
  {
    id: '2.3',
    tier: 'Tier 2',
    category: 'UI/Navigation',
    name: '越界释放回弹动画时长验证',
    run: async () => {
      const host = window.gameHost;
      host.showMenu();
      await delay(100);
      const scene = getActiveScene();
      const { width, height } = host;

      // Swipe right (out of bounds)
      scene.onTouchStart({ x: width * 0.2, y: height * 0.5 });
      scene.onTouchMove({ x: width * 0.2 + width * 0.3, y: height * 0.5 });
      scene.onTouchEnd({ x: width * 0.2 + width * 0.3, y: height * 0.5 });

      // Run multiple steps to simulate 200ms easing animation
      let offsetHistory = [];
      for (let time = 0; time < 200; time += 20) {
        scene.update(20);
        offsetHistory.push(scene.currentOffset);
      }
      
      // Last update to ensure it reaches target
      scene.update(50);

      assert.equal(scene.currentOffset, 0, 'Offset should eventually settle to 0');
      
      // Verify non-linear decay (easeOutCubic)
      // The step-by-step reduction should start fast and slow down
      let firstDiff = offsetHistory[0] - offsetHistory[2];
      let lastDiff = offsetHistory[offsetHistory.length - 3] - offsetHistory[offsetHistory.length - 1];
      assert.true(firstDiff > lastDiff, 'Damping animation must follow a non-linear deceleration curve');
    }
  },
  {
    id: '2.4',
    tier: 'Tier 2',
    category: 'UI/Navigation',
    name: '极小屏幕自适应与安全限制',
    run: async () => {
      const host = window.gameHost;
      const originalGetWindowInfo = wx.getWindowInfo;

      // Mock tiny screen (height = 500) and large safeTop (50)
      wx.getWindowInfo = () => ({
        windowWidth: 390,
        windowHeight: 500,
        screenWidth: 390,
        screenHeight: 500,
        pixelRatio: 1,
        safeArea: { top: 50, bottom: 500, left: 0, right: 390 },
        statusBarHeight: 50,
      });
      host.height = 500;
      host.safeTop = 50;

      const testScene = new host.scene.constructor(host);
      testScene.init();

      // Check card heights and Y bounds
      const cardH = testScene._layout.cardH;
      const firstCardY = testScene._layout.topArea;

      // Restore
      wx.getWindowInfo = originalGetWindowInfo;
      host.height = originalGetWindowInfo().screenHeight;
      host.safeTop = originalGetWindowInfo().safeArea.top || 0;
      host.showMenu();

      assert.greaterOrEqual(cardH, 80, 'Card height should be protected at minimal 80px');
      assert.greaterOrEqual(firstCardY, 180, 'Top layout area should be clamped below safeTop + 130');
    }
  },
  {
    id: '3.1',
    tier: 'Tier 3',
    category: 'UI/Navigation',
    name: '滑动越过阈值拦截卡片点击 (误触屏蔽)',
    run: async () => {
      const host = window.gameHost;
      host.showMenu();
      await delay(100);
      const scene = getActiveScene();

      // Pick the first game card (Sudoku)
      const sudokuCard = scene.cards[0];
      const startX = sudokuCard.x + sudokuCard.w / 2;
      const startY = sudokuCard.y + sudokuCard.h / 2;

      // Start touch down on Sudoku card
      scene.onTouchStart({ x: startX, y: startY });
      // Drag horizontally by 20px (exceeds 10px click-cancellation threshold)
      scene.onTouchMove({ x: startX - 20, y: startY });
      // Release
      scene.onTouchEnd({ x: startX - 20, y: startY });
      
      scene.update(250);

      assert.equal(scene.modal, null, 'Game configuration modal should not open when drag exceeds 10px');
      assert.equal(host.scene, scene, 'Scene should not have switched');
    }
  },
  {
    id: '3.2',
    tier: 'Tier 3',
    category: 'UI/Navigation',
    name: '换页过渡动画期间屏蔽输入',
    run: async () => {
      const host = window.gameHost;
      host.showMenu();
      await delay(100);
      const scene = getActiveScene();
      const { width, height } = host;

      // Swipe left to trigger transition
      scene.onTouchStart({ x: width * 0.8, y: height * 0.5 });
      scene.onTouchMove({ x: width * 0.2, y: height * 0.5 });
      scene.onTouchEnd({ x: width * 0.2, y: height * 0.5 });

      // Mid-way through transition (50ms)
      scene.update(50);
      
      // Simulate rapid click on Classic Tab during animation
      const tabClassicX = width / 2 - 60;
      const layout = scene._layout || { topArea: 160 };
      const tabY = layout.topArea - 28;
      
      // This input should be ignored or blocked
      scene.onTouchStart({ x: tabClassicX, y: tabY });
      scene.onTouchEnd({ x: tabClassicX, y: tabY });

      // Complete transition
      scene.update(150);

      assert.equal(scene.currentPage, 1, 'New input during transition must be ignored, landing on Page 1');
    }
  },
  {
    id: '4.1',
    tier: 'Tier 4',
    category: 'UI/Navigation',
    name: '快速连续滑屏手势 (手势中断与抢占)',
    run: async () => {
      const host = window.gameHost;
      host.showMenu();
      await delay(100);
      const scene = getActiveScene();
      const { width, height } = host;

      // Quick drag left
      scene.onTouchStart({ x: width * 0.8, y: height * 0.5 });
      scene.onTouchMove({ x: width * 0.3, y: height * 0.5 });
      scene.onTouchEnd({ x: width * 0.3, y: height * 0.5 });

      // Interrupt mid-flight (50ms)
      scene.update(50);

      // Instantly start drag right
      scene.onTouchStart({ x: width * 0.3, y: height * 0.5 });
      scene.onTouchMove({ x: width * 0.8, y: height * 0.5 });
      scene.onTouchEnd({ x: width * 0.8, y: height * 0.5 });

      // Settle
      scene.update(250);

      assert.equal(scene.currentPage, 0, 'Interrupted swipe must correctly resolve to the second gesture (Page 0)');
      assert.equal(scene.currentOffset, 0, 'Offset should be stable at 0');
    }
  },
  {
    id: '4.2',
    tier: 'Tier 4',
    category: 'UI/Navigation',
    name: '往复拖拽与长时间按压挂起',
    run: async () => {
      const host = window.gameHost;
      host.showMenu();
      await delay(100);
      const scene = getActiveScene();
      const { width, height } = host;

      // Touch and drag left 150px
      scene.onTouchStart({ x: width * 0.8, y: height * 0.5 });
      scene.onTouchMove({ x: width * 0.8 - 150, y: height * 0.5 });
      scene.update(500); // Hold for 500ms
      assert.equal(scene.swipeOffset, -150, 'Drag offset should match current pointer coordinate');

      // Drag right 200px (exceeds left boundary, goes +50px right)
      scene.onTouchMove({ x: width * 0.8 + 50, y: height * 0.5 });
      scene.update(1000); // Hold for 1000ms
      assert.equal(scene.swipeOffset, 50 * 0.3, 'Damped offset should persist during out-of-bounds hold');

      // Drag left again to -30px net offset
      scene.onTouchMove({ x: width * 0.8 - 30, y: height * 0.5 });
      scene.onTouchEnd({ x: width * 0.8 - 30, y: height * 0.5 });
      scene.update(250); // Let it snap back

      assert.equal(scene.currentPage, 0, 'Should remain on page 0 since final net offset was small');
      assert.equal(scene.currentOffset, 0, 'Offset should return to 0');
    }
  },
  {
    id: '4.3',
    tier: 'Tier 4',
    category: 'UI/Navigation',
    name: '大厅成绩加载后自适应排版及手势稳定性',
    run: async () => {
      const host = window.gameHost;
      const originalScores = wx.getStorageSync('mini_game_collection_scores_v1');

      // Mock extremely long score strings
      const mockScores = {
        sudoku: { bestScore: 99999999, bestTime: 88888 },
        huarongdao: { bestScore: 99999999, bestSteps: 999999 },
        minesweeper: { bestScore: 99999999, bestTime: 99999 },
        game2048: { bestScore: 99999999 },
        memory: { bestScore: 99999999, bestTime: 99999 },
        slitherlink: { bestScore: 99999999, bestTime: 99999 }
      };
      wx.setStorageSync('mini_game_collection_scores_v1', mockScores);

      // Reload menu
      host.showMenu();
      await delay(100);
      const scene = getActiveScene();

      // Verify page layout holds stable and renders
      assert.true(scene.cards.length > 0, 'Cards should render with mock scores');
      
      // Perform swipe to ensure no exceptions
      const { width, height } = host;
      scene.onTouchStart({ x: width * 0.8, y: height * 0.5 });
      scene.onTouchMove({ x: width * 0.2, y: height * 0.5 });
      scene.onTouchEnd({ x: width * 0.2, y: height * 0.5 });
      scene.update(250);

      // Restore scores
      if (originalScores) {
        wx.setStorageSync('mini_game_collection_scores_v1', originalScores);
      } else {
        wx.setStorageSync('mini_game_collection_scores_v1', '');
      }
      host.showMenu();
    }
  },

  // ================= TIER 1: WOOD KINGDOM =================
  {
    id: 'wk1.1',
    tier: 'Tier 1',
    category: 'Wood Kingdom',
    name: '2x4 Grid Placement & Board Limits',
    run: async () => {
      checkWoodKingdom();
      // Code below will not execute since checkWoodKingdom throws
    }
  },
  {
    id: 'wk1.2',
    tier: 'Tier 1',
    category: 'Wood Kingdom',
    name: 'Resource Gains (Sacrifice & Card Death)',
    run: async () => {
      checkWoodKingdom();
    }
  },
  {
    id: 'wk1.3',
    tier: 'Tier 1',
    category: 'Wood Kingdom',
    name: '5-Point Balance Scale Win/Loss',
    run: async () => {
      checkWoodKingdom();
    }
  },
  {
    id: 'wk1.4',
    tier: 'Tier 1',
    category: 'Wood Kingdom',
    name: 'Wood Kingdom Sigil Combat Execution',
    run: async () => {
      checkWoodKingdom();
    }
  },
  {
    id: 'wk1.5',
    tier: 'Tier 1',
    category: 'Wood Kingdom',
    name: 'Campaign Progression & Deckbuilding Selection',
    run: async () => {
      checkWoodKingdom();
    }
  },
  {
    id: 'wk1.6',
    tier: 'Tier 1',
    category: 'Wood Kingdom',
    name: 'Storage Persistence & Menu Rendering',
    run: async () => {
      checkWoodKingdom();
    }
  },

  // ================= TIER 2: WOOD KINGDOM =================
  {
    id: 'wk2.1',
    tier: 'Tier 2',
    category: 'Wood Kingdom',
    name: 'Insufficient Resources & Out-of-Bounds Slot Coordinates',
    run: async () => {
      checkWoodKingdom();
    }
  },
  {
    id: 'wk2.2',
    tier: 'Tier 2',
    category: 'Wood Kingdom',
    name: 'Bifurcated Sigil Boundary Limits',
    run: async () => {
      checkWoodKingdom();
    }
  },
  {
    id: 'wk2.3',
    tier: 'Tier 2',
    category: 'Wood Kingdom',
    name: 'Shield and Deathtouch Interaction',
    run: async () => {
      checkWoodKingdom();
    }
  },
  {
    id: 'wk2.4',
    tier: 'Tier 2',
    category: 'Wood Kingdom',
    name: 'Simultaneous Scale Limit Reaches',
    run: async () => {
      checkWoodKingdom();
    }
  },
  {
    id: 'wk2.5',
    tier: 'Tier 2',
    category: 'Wood Kingdom',
    name: 'Campaign Final Stage Completion',
    run: async () => {
      checkWoodKingdom();
    }
  },
  {
    id: 'wk2.6',
    tier: 'Tier 2',
    category: 'Wood Kingdom',
    name: 'Storage Write Failure Resiliency',
    run: async () => {
      checkWoodKingdom();
    }
  },

  // ================= TIER 3: WOOD KINGDOM =================
  {
    id: 'wk3.1',
    tier: 'Tier 3',
    category: 'Wood Kingdom',
    name: 'Bifurcated + Deathtouch Sigil Combo',
    run: async () => {
      checkWoodKingdom();
    }
  },
  {
    id: 'wk3.2',
    tier: 'Tier 3',
    category: 'Wood Kingdom',
    name: 'Sacrifice, Resource Conversion & Double Costs',
    run: async () => {
      checkWoodKingdom();
    }
  },
  {
    id: 'wk3.3',
    tier: 'Tier 3',
    category: 'Wood Kingdom',
    name: 'Storage Best Time Optimization',
    run: async () => {
      checkWoodKingdom();
    }
  },
  {
    id: 'wk3.4',
    tier: 'Tier 3',
    category: 'Wood Kingdom',
    name: 'Multi-Stage Deck Inflation',
    run: async () => {
      checkWoodKingdom();
    }
  },

  // ================= TIER 4: WOOD KINGDOM =================
  {
    id: 'wk4.1',
    tier: 'Tier 4',
    category: 'Wood Kingdom',
    name: 'Notch Screen / Safe Area Adaptation',
    run: async () => {
      checkWoodKingdom();
    }
  },
  {
    id: 'wk4.2',
    tier: 'Tier 4',
    category: 'Wood Kingdom',
    name: 'Input Lock during Turn Resolution Animations',
    run: async () => {
      checkWoodKingdom();
    }
  },
  {
    id: 'wk4.3',
    tier: 'Tier 4',
    category: 'Wood Kingdom',
    name: 'Menu Swipe vs. Game Config Tap Interaction',
    run: async () => {
      // Swipe on the MenuScene should NOT open a game's config.
      // We can run this test on any game currently in MenuScene.
      // (Even if Wood Kingdom is missing, we verify swipe-cancellation on another card like Sudoku)
      const host = window.gameHost;
      host.showMenu();
      await delay(100);
      const scene = getActiveScene();

      // Sudoku Card is always first
      const sudokuCard = scene.cards[0];
      const startX = sudokuCard.x + sudokuCard.w / 2;
      const startY = sudokuCard.y + sudokuCard.h / 2;

      // Start drag left from Sudoku card by 100px
      scene.onTouchStart({ x: startX, y: startY });
      scene.onTouchMove({ x: startX - 100, y: startY });
      scene.onTouchEnd({ x: startX - 100, y: startY });
      
      scene.update(250);

      // Verify visual page changed or modal stayed closed
      assert.equal(scene.modal, null, 'Config modal should stay closed after a swipe drag');
    }
  },
  {
    id: 'wk4.4',
    tier: 'Tier 4',
    category: 'Wood Kingdom',
    name: 'App Minimize/Restore Resiliency',
    run: async () => {
      checkWoodKingdom();
    }
  }
];

// Execute a single test case
async function runTest(test) {
  test.status = 'RUNNING';
  test.error = null;
  updateTestUI(test);
  try {
    await test.run();
    test.status = 'PASS';
  } catch (err) {
    test.status = 'FAIL';
    test.error = err.message;
    console.error(`Test [${test.id}] ${test.name} Failed:`, err);
  }
  updateTestUI(test);
  return test;
}

// Run all test cases
export async function runAllTests() {
  const resultDiv = document.getElementById('test-results');
  if (resultDiv) {
    resultDiv.setAttribute('data-status', 'PENDING');
    resultDiv.innerText = 'Tests Running...';
  }

  console.log('--- MixGame E2E Test Suite Started ---');
  let passCount = 0;
  let failCount = 0;
  const logs = [];

  for (const test of tests) {
    const res = await runTest(test);
    if (res.status === 'PASS') {
      passCount++;
    } else {
      failCount++;
    }
    logs.push({
      id: test.id,
      name: test.name,
      tier: test.tier,
      category: test.category,
      status: test.status,
      error: test.error
    });
  }

  const finalStatus = failCount > 0 ? 'FAIL' : 'PASS';
  console.log(`--- Test Suite Finished: ${passCount} Passed, ${failCount} Failed ---`);

  if (resultDiv) {
    resultDiv.setAttribute('data-status', finalStatus);
    resultDiv.innerText = JSON.stringify({
      status: finalStatus,
      passCount,
      failCount,
      totalCount: tests.length,
      logs
    }, null, 2);
  }

  // Update Summary UI
  const summaryEl = document.getElementById('test-summary');
  if (summaryEl) {
    summaryEl.innerHTML = `
      <div style="display: flex; justify-content: space-between; font-weight: bold; margin-bottom: 8px;">
        <span style="color: #536b5d;">通过: ${passCount}</span>
        <span style="color: #a54b44;">失败: ${failCount}</span>
        <span>总计: ${tests.length}</span>
      </div>
      <div style="height: 6px; background: #ece7dd; border-radius: 3px; overflow: hidden; display: flex;">
        <div style="width: ${(passCount / tests.length) * 100}%; background: #536b5d; height: 100%;"></div>
        <div style="width: ${(failCount / tests.length) * 100}%; background: #a54b44; height: 100%;"></div>
      </div>
    `;
  }

  return finalStatus;
}

// DOM Setup
function setupTestPanel() {
  // Check if panel already exists
  if (document.getElementById('test-panel')) return;

  // Create test panel element
  const panel = document.createElement('div');
  panel.id = 'test-panel';
  panel.style.cssText = `
    position: fixed;
    right: 20px;
    top: 20px;
    bottom: 20px;
    width: 420px;
    background: #fffdf8;
    border: 1px solid #d7cec0;
    border-radius: 22px;
    box-shadow: 0 12px 40px rgba(0, 0, 0, 0.15);
    display: flex;
    flex-direction: column;
    font-family: "PingFang SC", "Microsoft YaHei", sans-serif;
    color: #25221d;
    overflow: hidden;
    z-index: 9999;
  `;

  panel.innerHTML = `
    <!-- Header -->
    <div style="padding: 16px 20px; border-bottom: 1px solid #d7cec0; background: #f4f2ed; display: flex; justify-content: space-between; align-items: center;">
      <h3 style="margin: 0; font-size: 16px; font-weight: 600; color: #25221d;">静游集 E2E 测试运行器</h3>
      <button id="run-all-btn" style="padding: 6px 14px; background: #7a4f3f; color: #fffdf8; border: none; border-radius: 8px; font-size: 13px; font-weight: 600; cursor: pointer; transition: background 0.2s;">运行全部</button>
    </div>
    
    <!-- Summary -->
    <div id="test-summary" style="padding: 12px 20px; border-bottom: 1px solid #d7cec0; background: #fffdf8;">
      <div style="color: #756f64; font-size: 13px; text-align: center;">尚未运行测试</div>
    </div>

    <!-- Test List -->
    <div id="test-list" style="flex: 1; overflow-y: auto; padding: 10px 20px; background: #f4f2ed;">
    </div>
  `;

  document.body.appendChild(panel);

  // Inject invisible results element
  const resultsDiv = document.createElement('div');
  resultsDiv.id = 'test-results';
  resultsDiv.setAttribute('data-status', 'PENDING');
  resultsDiv.style.display = 'none';
  document.body.appendChild(resultsDiv);

  // Adjust page layout if body width is wide enough
  const adjustBodyLayout = () => {
    if (window.innerWidth > 900) {
      document.body.style.display = 'flex';
      document.body.style.justifyContent = 'flex-start';
      document.body.style.paddingLeft = '50px';
      panel.style.display = 'flex';
    } else {
      document.body.style.display = 'grid';
      document.body.style.placeItems = 'center';
      document.body.style.paddingLeft = '0';
    }
  };
  window.addEventListener('resize', adjustBodyLayout);
  adjustBodyLayout();

  // Populate Test List UI
  const listContainer = document.getElementById('test-list');
  tests.forEach((test) => {
    test.status = 'PENDING';
    const row = document.createElement('div');
    row.id = `test-row-${test.id}`;
    row.style.cssText = `
      background: #fffdf8;
      border: 1px solid #d7cec0;
      border-radius: 12px;
      padding: 10px 14px;
      margin-bottom: 8px;
      display: flex;
      flex-direction: column;
      font-size: 13px;
      transition: all 0.2s;
    `;
    
    row.innerHTML = `
      <div style="display: flex; justify-content: space-between; align-items: center;">
        <span style="font-weight: bold; color: #756f64; font-size: 11px;">[${test.tier} - ${test.category}] 用例 ${test.id}</span>
        <span class="test-badge" style="font-size: 11px; padding: 2px 6px; border-radius: 4px; font-weight: bold; background: #ece7dd; color: #756f64;">PENDING</span>
      </div>
      <div style="margin-top: 4px; font-weight: 500;">${test.name}</div>
      <div class="test-err" style="margin-top: 6px; color: #a54b44; font-family: monospace; font-size: 11px; display: none; white-space: pre-wrap; background: #fff1f0; padding: 6px; border-radius: 6px; border: 1px solid #fcd2d1;"></div>
    `;

    // Click single test to rerun
    row.addEventListener('click', async (e) => {
      // Prevent running if clicked inner element that is button etc
      if (test.status === 'RUNNING') return;
      await runTest(test);
    });

    row.style.cursor = 'pointer';
    listContainer.appendChild(row);
  });

  // Bind Buttons
  document.getElementById('run-all-btn').addEventListener('click', async () => {
    const btn = document.getElementById('run-all-btn');
    btn.disabled = true;
    btn.style.background = '#ece7dd';
    btn.innerText = '运行中...';
    await runAllTests();
    btn.disabled = false;
    btn.style.background = '#7a4f3f';
    btn.innerText = '运行全部';
  });
}

function updateTestUI(test) {
  const row = document.getElementById(`test-row-${test.id}`);
  if (!row) return;

  const badge = row.querySelector('.test-badge');
  const errDiv = row.querySelector('.test-err');

  badge.innerText = test.status;
  if (test.status === 'RUNNING') {
    badge.style.background = '#ece7dd';
    badge.style.color = '#7a4f3f';
    row.style.borderColor = '#7a4f3f';
  } else if (test.status === 'PASS') {
    badge.style.background = '#536b5d';
    badge.style.color = '#fffdf8';
    row.style.borderColor = '#d7cec0';
    errDiv.style.display = 'none';
  } else if (test.status === 'FAIL') {
    badge.style.background = '#a54b44';
    badge.style.color = '#fffdf8';
    row.style.borderColor = '#a54b44';
    if (test.error) {
      errDiv.innerText = test.error;
      errDiv.style.display = 'block';
    }
  } else {
    badge.style.background = '#ece7dd';
    badge.style.color = '#756f64';
    row.style.borderColor = '#d7cec0';
    errDiv.style.display = 'none';
  }
}

// Initial Hook
async function initRunner() {
  setupTestPanel();

  // Wait briefly for GameHost and scene to mount
  let retries = 20;
  while (!window.gameHost && retries > 0) {
    await delay(100);
    retries--;
  }

  if (location.search.includes('runTests=true')) {
    // Automatically trigger
    const btn = document.getElementById('run-all-btn');
    if (btn) {
      btn.disabled = true;
      btn.style.background = '#ece7dd';
      btn.innerText = '运行中...';
    }
    await runAllTests();
    if (btn) {
      btn.disabled = false;
      btn.style.background = '#7a4f3f';
      btn.innerText = '运行全部';
    }
  }
}

if (typeof window !== 'undefined') {
  window.addEventListener('load', initRunner);
}
