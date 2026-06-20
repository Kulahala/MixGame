export const MAP_CONFIG = {
  totalWidth: 360,
  totalHeight: 3200,
  platforms: [
    // 宁静之森 (Y: 2200 ~ 3200)
    { x: 0, y: 3150, w: 360, h: 50, type: 'wood' }, // 底部地面
    { x: 80, y: 3000, w: 100, h: 15, type: 'wood' },
    { x: 200, y: 2850, w: 100, h: 15, type: 'wood' },
    { x: 50, y: 2700, w: 120, h: 15, type: 'wood' },
    { x: 210, y: 2550, w: 100, h: 15, type: 'wood' },
    { x: 130, y: 2400, w: 100, h: 15, type: 'wood' },
    { x: 40, y: 2250, w: 140, h: 20, type: 'wood' }, // 森林顶层，有 Checkpoint 1

    // 险峻遗迹 (Y: 1100 ~ 2200)
    { x: 250, y: 2100, w: 70, h: 15, type: 'stone' },
    { x: 140, y: 1850, w: 80, h: 150, type: 'stone' }, // 中间大高墙，需撞击反弹
    { x: 20, y: 1980, w: 70, h: 15, type: 'stone' },
    { x: 270, y: 1850, w: 70, h: 15, type: 'stone' },
    { x: 20, y: 1720, w: 70, h: 15, type: 'stone' },
    { x: 140, y: 1580, w: 80, h: 20, type: 'stone' },
    { x: 40, y: 1450, w: 60, h: 15, type: 'stone' },
    { x: 260, y: 1320, w: 60, h: 15, type: 'stone' },
    { x: 120, y: 1180, w: 120, h: 20, type: 'stone' }, // 遗迹顶层，有 Checkpoint 2

    // 云霄之巅 (Y: 0 ~ 1100)
    { x: 50, y: 1050, w: 50, h: 12, type: 'cloud' },
    { x: 260, y: 950, w: 50, h: 12, type: 'cloud' },
    { x: 150, y: 830, w: 60, h: 12, type: 'cloud' },
    { x: 30, y: 720, w: 50, h: 12, type: 'cloud' },
    { x: 280, y: 600, w: 50, h: 12, type: 'cloud' },
    { x: 120, y: 480, w: 60, h: 12, type: 'cloud' },
    { x: 60, y: 360, w: 40, h: 12, type: 'cloud' },
    { x: 260, y: 250, w: 40, h: 12, type: 'cloud' },
    { x: 100, y: 120, w: 160, h: 20, type: 'cloud' } // 终点平台
  ],
  checkpoints: [
    { id: 0, x: 180, y: 3150, name: '森林启程篝火' },
    { id: 1, x: 100, y: 2250, name: '遗迹前哨篝火' },
    { id: 2, x: 180, y: 1180, name: '云天之下篝火' }
  ]
};
