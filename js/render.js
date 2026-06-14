GameGlobal.canvas = wx.createCanvas();
const canvas = GameGlobal.canvas;

const windowInfo = wx.getWindowInfo ? wx.getWindowInfo() : wx.getSystemInfoSync();

// 使用 windowWidth/windowHeight 作为逻辑尺寸，避免状态栏/刘海区域遮挡
const windowWidth = windowInfo.windowWidth || windowInfo.screenWidth;
const windowHeight = windowInfo.windowHeight || windowInfo.screenHeight;
const pixelRatio = windowInfo.pixelRatio || 1;

// Canvas 物理像素 = 逻辑像素 × pixelRatio（高 DPI 清晰渲染）
canvas.width = windowWidth * pixelRatio;
canvas.height = windowHeight * pixelRatio;

// 部分环境（如浏览器调试）支持 style 属性设置 CSS 尺寸
if (canvas.style) {
  canvas.style.width = windowWidth + 'px';
  canvas.style.height = windowHeight + 'px';
}

// 下游代码使用逻辑像素做布局
export const SCREEN_WIDTH = windowWidth;
export const SCREEN_HEIGHT = windowHeight;
export const PIXEL_RATIO = pixelRatio;
