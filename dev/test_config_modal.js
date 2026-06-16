import assert from 'assert';
import ConfigModal from '../js/ui/config-modal.js';
import elegantTheme from '../js/themes/elegant.js';

// Mock host object
const mockHost = {
  width: 375,
  height: 667
};

// Mock game object
const mockGame = {
  name: '测试游戏',
  rules: '规则第一行\n规则第二行很长很长很长很长很长很长很长很长很长很长\n规则第三行\n规则第四行更多内容内容\n规则第五行末尾\n规则第六行额外内容\n规则第七行额外内容\n规则第八行额外内容\n规则第九行额外内容\n规则第十行额外内容\n规则第十一行额外内容\n规则第十二行额外内容'
};

const mockOptions = [
  { label: '简单', value: 'easy' },
  { label: '普通', value: 'normal' },
  { label: '困难', value: 'hard' }
];

// Mock canvas context
const mockCtx = {
  save() {},
  restore() {},
  translate() {},
  scale() {},
  beginPath() {},
  moveTo() {},
  arcTo() {},
  closePath() {},
  fill() {},
  stroke() {},
  fillText() {},
  fillRect() {},
  rect() {},
  clip() {},
  measureText(text) {
    return { width: text.length * 10 };
  },
  set font(val) {},
  get font() { return ''; },
  set fillStyle(val) {},
  get fillStyle() { return ''; },
  set strokeStyle(val) {},
  get strokeStyle() { return ''; },
  set lineWidth(val) {},
  get lineWidth() { return 1; },
  set textAlign(val) {},
  get textAlign() { return 'left'; },
  set textBaseline(val) {},
  get textBaseline() { return 'alphabetic'; },
  set globalAlpha(val) {},
  get globalAlpha() { return 1; }
};

function runTest(name, fn) {
  try {
    fn();
    console.log(`\x1b[32m✔ PASS: ${name}\x1b[0m`);
  } catch (err) {
    console.error(`\x1b[31m✘ FAIL: ${name}\x1b[0m`);
    console.error(err);
    process.exit(1);
  }
}

console.log('Running ConfigModal Coordinates, Drag Bounds & Transitions Tests...\n');

// Test 1: Button Widths and Symmetric Positions
runTest('Verify button widths and symmetric positions', () => {
  const modal = new ConfigModal({
    host: mockHost,
    game: mockGame,
    options: mockOptions
  });

  // Verify modal is centered horizontally
  assert.strictEqual(modal.x, (mockHost.width - modal.w) / 2);
  assert.strictEqual(modal.w, 280);

  // Button sizes and gaps check when showRulesMode is false
  const cancel = modal.cancelBtn;
  const rules = modal.rulesBtn;
  const confirm = modal.confirmBtn;

  assert.strictEqual(cancel.w, 72);
  assert.strictEqual(rules.w, 72);
  assert.strictEqual(confirm.w, 72);

  // Spacings relative to modal x
  const marginL = cancel.x - modal.x;
  const gap1 = rules.x - (cancel.x + cancel.w);
  const gap2 = confirm.x - (rules.x + rules.w);
  const marginR = (modal.x + modal.w) - (confirm.x + confirm.w);

  assert.strictEqual(marginL, 16);
  assert.strictEqual(gap1, 16);
  assert.strictEqual(gap2, 16);
  assert.strictEqual(marginR, 16);

  // Verify backBtn width and center positioning
  const back = modal.backBtn;
  assert.strictEqual(back.w, 100);
  const backMarginL = back.x - modal.x;
  const backMarginR = (modal.x + modal.w) - (back.x + back.w);
  assert.strictEqual(backMarginL, backMarginR);
  assert.strictEqual(backMarginL, (modal.w - back.w) / 2);
});

// Test 2: Dynamic OptionRects Y Coordinates
runTest('Verify dynamic optionRects Y coordinates match positioning', () => {
  const modal = new ConfigModal({
    host: mockHost,
    game: mockGame,
    options: mockOptions
  });

  // Check initial positioning
  const initialY = modal.y;
  const optH = 36;
  const gap = 12;
  const optYStart = initialY + 70;

  modal.optionRects.forEach((rect, idx) => {
    assert.strictEqual(rect.y, optYStart + idx * (optH + gap));
    assert.strictEqual(rect.x, modal.x + 24);
    assert.strictEqual(rect.w, modal.w - 48);
    assert.strictEqual(rect.h, optH);
  });

  // Simulate height transitions (e.g. going into rules mode and back)
  modal.showRulesMode = true;
  modal.targetH = 320;

  // Simulate multiple render/updates ticks
  for (let i = 0; i < 20; i++) {
    modal.render(mockCtx, elegantTheme);
    // Option Y coordinates should match current modal.y
    const currentY = modal.y;
    const currentOptYStart = currentY + 70;
    modal.optionRects.forEach((rect, idx) => {
      assert.strictEqual(rect.y, currentOptYStart + idx * (optH + gap));
    });
  }

  // Verify transition final state settles at targetH
  modal.h = modal.targetH;
  modal.render(mockCtx, elegantTheme);
  const finalY = modal.y;
  modal.optionRects.forEach((rect, idx) => {
    assert.strictEqual(rect.y, finalY + 70 + idx * (optH + gap));
  });
});

// Test 3: Scrolling Bounds Strictly Clamped
runTest('Verify scrolling bounds strictly clamped', () => {
  const modal = new ConfigModal({
    host: mockHost,
    game: mockGame,
    options: mockOptions
  });

  // Set to rules mode and fast-forward transition
  modal.showRulesMode = true;
  modal.targetH = 320;
  modal.h = 320;
  modal.rulesAlpha = 1.0;
  modal.alpha = 1.0;
  modal.animTime = 220; // set to animDuration to prevent recalculation in render

  // Let render wrap text and calculate maxScrollY
  modal.render(mockCtx, elegantTheme);
  assert.ok(modal.maxScrollY > 0, `maxScrollY should be greater than 0, got ${modal.maxScrollY}`);

  // Test drag on rules body: dragging down (scrolling down content)
  // drag start
  const touchStartY = 300;
  modal.onTouchStart(modal.x + 50, touchStartY);
  assert.strictEqual(modal.isDraggingRules, true);
  assert.strictEqual(modal.scrollY, 0);

  // drag moves
  modal.onTouchMove(modal.x + 50, touchStartY - 50); // Move fingers up 50px (scroll content down)
  assert.strictEqual(modal.scrollY, 50);

  // drag moves beyond maxScrollY
  modal.onTouchMove(modal.x + 50, touchStartY - (modal.maxScrollY + 100));
  assert.strictEqual(modal.scrollY, modal.maxScrollY); // clamped to maxScrollY

  // drag moves above 0
  modal.onTouchMove(modal.x + 50, touchStartY + 100);
  assert.strictEqual(modal.scrollY, 0); // clamped to 0

  modal.onTouchEnd(modal.x + 50, touchStartY);

  // Test drag on scrollbar
  modal.onTouchStart(modal.x + modal.w - 10, touchStartY);
  assert.strictEqual(modal.isDraggingScrollbar, true);
  assert.strictEqual(modal.isDraggingRules, false);
});

// Test 4: Verifying Button States, Safety Scroll Clamp, and Touch Delegation Restrictions
runTest('Verify Button States, Safety Scroll Clamp, and Touch Delegation Restrictions', () => {
  const modal = new ConfigModal({
    host: mockHost,
    game: mockGame,
    options: mockOptions
  });

  // Verify pressedIndex is reset to -1 when rulesBtn or backBtn is clicked
  modal.pressedIndex = 2;
  modal.rulesBtn.onClick();
  assert.strictEqual(modal.pressedIndex, -1, 'rulesBtn click must reset pressedIndex to -1');

  modal.pressedIndex = 1;
  modal.backBtn.onClick();
  assert.strictEqual(modal.pressedIndex, -1, 'backBtn click must reset pressedIndex to -1');

  // Verify safety scroll clamp in render
  modal.showRulesMode = true;
  modal.targetH = 320;
  modal.h = 320;
  modal.rulesAlpha = 1.0;
  modal.alpha = 1.0;
  modal.animTime = 220;
  modal.render(mockCtx, elegantTheme);
  
  modal.scrollY = modal.maxScrollY + 50;
  modal.render(mockCtx, elegantTheme);
  assert.strictEqual(modal.scrollY, modal.maxScrollY, 'render should clamp scrollY if it exceeds maxScrollY');

  // Verify touch delegation restrictions based on showRulesMode and rulesAlpha
  
  // Case A: showRulesMode is true but rulesAlpha <= 0.9 (e.g. 0.5)
  // backBtn touchStart/touchMove/touchEnd should not be called
  modal.showRulesMode = true;
  modal.rulesAlpha = 0.5;
  modal.alpha = 1.0;
  modal.animTime = 220;
  let backBtnStartCalled = false;
  modal.backBtn.onTouchStart = () => { backBtnStartCalled = true; return true; };
  modal.onTouchStart(modal.backBtn.x + 5, modal.backBtn.y + 5);
  assert.strictEqual(backBtnStartCalled, false, 'backBtn.onTouchStart should not be checked when rulesAlpha <= 0.9');

  // Case B: showRulesMode is true and rulesAlpha > 0.9
  modal.rulesAlpha = 1.0;
  modal.onTouchStart(modal.backBtn.x + 5, modal.backBtn.y + 5);
  assert.strictEqual(backBtnStartCalled, true, 'backBtn.onTouchStart should be checked when rulesAlpha > 0.9');

  // Case C: showRulesMode is false but rulesAlpha >= 0.1 (e.g. 0.5)
  // cancelBtn/rulesBtn/confirmBtn touchStart should not be checked
  modal.showRulesMode = false;
  modal.rulesAlpha = 0.5;
  let cancelBtnStartCalled = false;
  modal.cancelBtn.onTouchStart = () => { cancelBtnStartCalled = true; return true; };
  modal.onTouchStart(modal.cancelBtn.x + 5, modal.cancelBtn.y + 5);
  assert.strictEqual(cancelBtnStartCalled, false, 'cancelBtn.onTouchStart should not be checked when rulesAlpha >= 0.1');

  // Case D: showRulesMode is false and rulesAlpha < 0.1
  modal.rulesAlpha = 0.0;
  modal.onTouchStart(modal.cancelBtn.x + 5, modal.cancelBtn.y + 5);
  assert.strictEqual(cancelBtnStartCalled, true, 'cancelBtn.onTouchStart should be checked when rulesAlpha < 0.1');
});
