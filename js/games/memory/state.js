import { saveScore } from '../../core/storage.js';

const SYMBOLS = [
  '山', '水', '风', '月', '花', '鸟', '云', '雨',
  '松', '竹', '梅', '兰', '鹤', '鹿', '鱼', '蝶',
  '星', '雪', '泉', '石', '桥', '舟', '琴', '棋',
];

export default class MemoryState {
  constructor(rows, cols) {
    if ((rows * cols) % 2 !== 0) {
      throw new Error(`Memory board must have even number of cells, got ${rows}x${cols}=${rows * cols}`);
    }
    this.rows = rows;
    this.cols = cols;
    this.pairs = (rows * cols) / 2;
    this.cards = [];
    this.completed = false;
    this.saved = false;
    this.startTime = Date.now();
    this.steps = 0;
    this.matchedPairs = 0;

    this.init();
  }

  init() {
    const selected = SYMBOLS.slice(0, this.pairs);
    const deck = [...selected, ...selected];

    // Fisher-Yates shuffle
    for (let i = deck.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [deck[i], deck[j]] = [deck[j], deck[i]];
    }

    this.cards = [];
    let idx = 0;
    for (let r = 0; r < this.rows; r++) {
      this.cards[r] = [];
      for (let c = 0; c < this.cols; c++) {
        this.cards[r][c] = {
          symbol: deck[idx++],
          faceUp: false,
          matched: false,
        };
      }
    }

    this.completed = false;
    this.saved = false;
    this.startTime = Date.now();
    this.steps = 0;
    this.matchedPairs = 0;
  }

  flip(row, col) {
    if (this.completed) return { action: 'blocked' };
    const card = this.cards[row][col];
    if (card.faceUp || card.matched) return { action: 'blocked' };

    card.faceUp = true;
    this.steps++;

    const faceUpCards = [];
    for (let r = 0; r < this.rows; r++) {
      for (let c = 0; c < this.cols; c++) {
        if (this.cards[r][c].faceUp && !this.cards[r][c].matched) {
          faceUpCards.push({ r, c, card: this.cards[r][c] });
        }
      }
    }

    if (faceUpCards.length === 2) {
      const [a, b] = faceUpCards;
      if (a.card.symbol === b.card.symbol) {
        a.card.matched = true;
        b.card.matched = true;
        this.matchedPairs++;

        if (this.matchedPairs >= this.pairs) {
          this.completed = true;
        }

        return { action: 'match', card1: { r: a.r, c: a.c }, card2: { r: b.r, c: b.c } };
      } else {
        return { action: 'mismatch', card1: { r: a.r, c: a.c }, card2: { r: b.r, c: b.c } };
      }
    }

    return { action: 'flip', card1: { r: row, c: col } };
  }

  hideCards(positions) {
    for (const { r, c } of positions) {
      this.cards[r][c].faceUp = false;
    }
  }

  getElapsed() {
    return Math.floor((Date.now() - this.startTime) / 1000);
  }

  saveResult() {
    if (this.saved) return;
    const time = this.getElapsed();
    const score = Math.max(100, 1000 - time * 3 - this.steps * 5);
    saveScore('memory', {
      score,
      time,
      steps: this.steps,
      difficulty: `${this.rows}x${this.cols}`,
    });
    this.saved = true;
  }
}
