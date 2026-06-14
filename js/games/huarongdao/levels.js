export const LEVELS = [
  {
    id: 'classic-1',
    title: '横刀立马',
    width: 4,
    height: 5,
    exit: { x: 1, y: 4, w: 2, h: 1 },
    pieces: [
      { id: 'cao', name: '曹操', x: 1, y: 0, w: 2, h: 2, role: 'king' },
      { id: 'zhang', name: '张飞', x: 0, y: 0, w: 1, h: 2, role: 'vertical' },
      { id: 'zhao', name: '赵云', x: 3, y: 0, w: 1, h: 2, role: 'vertical' },
      { id: 'ma', name: '马超', x: 0, y: 2, w: 1, h: 2, role: 'vertical' },
      { id: 'huang', name: '黄忠', x: 3, y: 2, w: 1, h: 2, role: 'vertical' },
      { id: 'guan', name: '关羽', x: 1, y: 2, w: 2, h: 1, role: 'horizontal' },
      { id: 'soldier1', name: '卒', x: 1, y: 3, w: 1, h: 1, role: 'small' },
      { id: 'soldier2', name: '卒', x: 2, y: 3, w: 1, h: 1, role: 'small' },
      { id: 'soldier3', name: '卒', x: 0, y: 4, w: 1, h: 1, role: 'small' },
      { id: 'soldier4', name: '卒', x: 3, y: 4, w: 1, h: 1, role: 'small' },
    ],
  },
];
