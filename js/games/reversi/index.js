import BaseGameScene from '../../core/game-scene-base.js';
import { getHistory } from '../../core/storage.js';
import { ReversiState } from './state.js';
import { drawText, fillRoundRect, strokeRoundRect, hitTestGrid } from '../../ui/canvas.js';
import { getRandomQuote } from '../../ui/quotes.js';

export default class ReversiScene extends BaseGameScene {
  constructor(host, options = {}) {
    super(host, options);
    const difficulty = options.difficulty || 'normal';
    this.state = new ReversiState(difficulty);
    this.bottomQuote = getRandomQuote('reversi');
    this.completed = false;

    this.toastText = '';
    this.toastTimer = 0;

    this.aiThinkingTimer = 700;
    this.dropAnimation = null;
    this.animations = Array.from({ length: 8 }, () => Array.from({ length: 8 }, () => ({
      animating: false,
      progress: 0,
      delay: 0,
      animTime: 0,
      duration: 350,
      scaleX: 1.0,
      oldColor: 0,
      targetColor: 0
    })));

    this.legalMoves = [];
  }

  init() {
    const { width, height, safeTop } = this.host;
    const isTablet = width >= 500 && height >= 600 && height >= width;

    let boardSize, boardY;

    if (isTablet) {
      boardSize = 400;
      boardY = Math.floor((height - boardSize) / 2) + 20;
    } else if (height >= 700) {
      boardSize = Math.min(width - 32, 342);
      boardY = Math.floor((height - boardSize) / 2) + 30;
      if (boardY < safeTop + 140) {
        boardY = safeTop + 140;
      }
    } else {
      boardSize = Math.min(width - 32, height - 250);
      boardY = Math.floor((height - boardSize) / 2) + 15;
      if (boardY < safeTop + 120) {
        boardY = safeTop + 120;
      }
    }

    const cellSize = boardSize / 8;
    const boardX = (width - boardSize) / 2;

    this.boardSize = boardSize;
    this.boardY = boardY;
    this.cellSize = cellSize;
    this.boardX = boardX;

    this.createTopButtons();
    this.reset();
  }

  reset() {
    this.closeModal();
    this.state.reset();
    this.bottomQuote = getRandomQuote('reversi');
    this.completed = false;
    this.aiThinkingTimer = 700;
    this.toastText = '';
    this.toastTimer = 0;
    this.dropAnimation = null;
    this.animations = Array.from({ length: 8 }, () => Array.from({ length: 8 }, () => ({
      animating: false,
      progress: 0,
      delay: 0,
      animTime: 0,
      duration: 350,
      scaleX: 1.0,
      oldColor: 0,
      targetColor: 0
    })));

    this.legalMoves = this.state.getLegalMoves(this.state.turn);
  }

  showToast(text) {
    this.toastText = text;
    this.toastTimer = 1600;
  }

  isAnimating() {
    if (this.dropAnimation) return true;
    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 8; c++) {
        if (this.animations[r][c] && this.animations[r][c].animating) {
          return true;
        }
      }
    }
    return false;
  }

  update(dt = 16) {
    if (super.update(dt)) return;

    if (this.toastTimer > 0) {
      this.toastTimer -= dt;
      if (this.toastTimer <= 0) {
        this.toastText = '';
      }
    }

    if (this.dropAnimation) {
      this.dropAnimation.progress += dt / this.dropAnimation.duration;
      if (this.dropAnimation.progress >= 1.0) {
        this.dropAnimation = null;
      }
    }

    let anyAnimating = false;
    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 8; c++) {
        const anim = this.animations[r][c];
        if (anim && anim.animating) {
          anyAnimating = true;
          if (anim.delay > 0) {
            anim.delay -= dt;
          } else {
            anim.animTime += dt;
            const progress = anim.animTime / anim.duration;
            if (progress >= 1.0) {
              anim.progress = 1.0;
              anim.scaleX = 1.0;
              anim.animating = false;
            } else {
              anim.progress = progress;
              if (progress < 0.5) {
                anim.scaleX = 1.0 - progress * 2;
              } else {
                anim.scaleX = (progress - 0.5) * 2;
              }
            }
          }
        }
      }
    }

    if (!anyAnimating && !this.completed) {
      this.legalMoves = this.state.getLegalMoves(this.state.turn);

      const gameResult = this.state.isGameOver();
      if (gameResult.finished) {
        this.completed = true;
        this.state.saveResult();

        const won = gameResult.winner === 1;
        const finalScore = won ? (gameResult.blackCount - gameResult.whiteCount) * 100 + gameResult.blackCount * 10 : gameResult.blackCount * 10;

        const stats = [
          `得分：${finalScore} 分`,
          `结果：${won ? '胜利' : (gameResult.winner === 2 ? '失败' : '平局')}`,
          `黑棋 (玩家)：${gameResult.blackCount} 子`,
          `白棋 (电脑)：${gameResult.whiteCount} 子`,
          `对局用时：${this.state.getElapsed()}s`,
          `AI 难度：${this.state.difficulty === 'easy' ? '简单' : (this.state.difficulty === 'normal' ? '普通' : '大师')}`
        ];

        const history = getHistory('reversi', this.state.difficulty).map(h => ({
          label: `${h.score}分 · ${h.time}s`,
          highlight: h.score === finalScore && h.time === this.state.getElapsed()
        }));

        const title = won ? '棋开得胜！' : (gameResult.winner === 2 ? '棋差一招' : '握手言和');
        this.showResult(title, stats, won, history);
        return;
      }

      if (this.state.turn === 2) {
        this.aiThinkingTimer -= dt;
        if (this.aiThinkingTimer <= 0) {
          const bestMove = this.state.getBestMove();
          if (bestMove) {
            const res = this.state.makeMove(bestMove.r, bestMove.c);
            if (res.success) {
              this.dropAnimation = { r: bestMove.r, c: bestMove.c, progress: 0, duration: 250 };

              if (res.flips && res.flips.length > 0) {
                res.flips.forEach(f => {
                  const dist = Math.abs(f.r - bestMove.r) + Math.abs(f.c - bestMove.c);
                  const delay = dist * 70;
                  this.animations[f.r][f.c] = {
                    animating: true,
                    progress: 0,
                    delay: delay,
                    animTime: 0,
                    duration: 350,
                    scaleX: 1.0,
                    oldColor: 1,
                    targetColor: 2
                  };
                });
              }

              if (this.state.passFlag) {
                this.showToast('玩家无棋可走，跳过回合');
                this.aiThinkingTimer = 1000;
              } else {
                this.aiThinkingTimer = 700;
              }
            }
          }
        }
      }
    }
  }

  onTouchStart(point) {
    if (this.isExiting) return;
    if (this.input.onTouchStart(point.x, point.y)) return;

    if (this.modal || this.completed || this.isAnimating() || this.state.turn !== 1) {
      return;
    }

    const cell = hitTestGrid(point, this.boardX, this.boardY, this.cellSize, 0, 8, 8);
    if (!cell) return;

    const { row, col } = cell;

    const isLegal = this.legalMoves.some(m => m.r === row && m.c === col);
    if (!isLegal) return;

    const res = this.state.makeMove(row, col);
    if (res.success) {
      this.dropAnimation = { r: row, c: col, progress: 0, duration: 250 };

      if (res.flips && res.flips.length > 0) {
        res.flips.forEach(f => {
          const dist = Math.abs(f.r - row) + Math.abs(f.c - col);
          const delay = dist * 70;
          this.animations[f.r][f.c] = {
            animating: true,
            progress: 0,
            delay: delay,
            animTime: 0,
            duration: 350,
            scaleX: 1.0,
            oldColor: 2,
            targetColor: 1
          };
        });
      }

      if (this.state.passFlag) {
        this.showToast('电脑无棋可下，跳过回合');
      } else {
        this.aiThinkingTimer = 700;
      }
    }
  }

  drawPiece(ctx, cx, cy, color, radius) {
    if (color === 1) {
      ctx.save();
      ctx.shadowColor = 'rgba(0, 0, 0, 0.4)';
      ctx.shadowBlur = 4;
      ctx.shadowOffsetY = 2;

      ctx.fillStyle = '#1a1a1a';
      ctx.beginPath();
      ctx.arc(cx, cy, radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();

      const grad = ctx.createRadialGradient(cx - radius * 0.3, cy - radius * 0.3, 1, cx, cy, radius);
      grad.addColorStop(0, '#3a3a3a');
      grad.addColorStop(1, '#1b1b1b');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(cx, cy, radius * 0.95, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = 'rgba(255, 255, 255, 0.15)';
      ctx.beginPath();
      ctx.arc(cx - radius * 0.3, cy - radius * 0.3, radius * 0.18, 0, Math.PI * 2);
      ctx.fill();
    } else {
      ctx.save();
      ctx.shadowColor = 'rgba(0, 0, 0, 0.25)';
      ctx.shadowBlur = 4;
      ctx.shadowOffsetY = 2;

      ctx.fillStyle = '#dededb';
      ctx.beginPath();
      ctx.arc(cx, cy, radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();

      const grad = ctx.createRadialGradient(cx - radius * 0.3, cy - radius * 0.3, 1, cx, cy, radius);
      grad.addColorStop(0, '#ffffff');
      grad.addColorStop(1, '#fcfaf2');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(cx, cy, radius * 0.95, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
      ctx.beginPath();
      ctx.arc(cx - radius * 0.3, cy - radius * 0.3, radius * 0.15, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  renderGame(ctx) {
    const theme = this.theme;
    const { width, height, safeTop } = this.host;
    const cellSize = this.cellSize;
    const boardX = this.boardX;
    const boardY = this.boardY;
    const boardSize = this.boardSize;

    const isTablet = width >= 500 && height >= 600 && height >= width;
    const titleY = safeTop + (isTablet ? 100 : (height >= 700 ? 90 : 65));

    drawText(ctx, '黑白棋', width / 2, titleY, {
      size: height >= 700 ? 28 : 22,
      color: theme.color.ink,
      align: 'center',
      baseline: 'middle',
      font: theme.font.title,
      weight: '600',
    });

    const panelY = boardY - 75;
    const panelH = 60;
    fillRoundRect(ctx, boardX, panelY, boardSize, panelH, theme.radius.md, 'rgba(255, 255, 255, 0.45)');
    strokeRoundRect(ctx, boardX, panelY, boardSize, panelH, theme.radius.md, 'rgba(255, 255, 255, 0.6)', 1.5);

    let blackCount = 0;
    let whiteCount = 0;
    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 8; c++) {
        if (this.state.board[r][c] === 1) blackCount++;
        else if (this.state.board[r][c] === 2) whiteCount++;
      }
    }

    const centerY = panelY + panelH / 2;

    const blackIconX = boardX + 35;
    ctx.fillStyle = '#2b2b2b';
    ctx.beginPath();
    ctx.arc(blackIconX, centerY, 10, 0, Math.PI * 2);
    ctx.fill();

    drawText(ctx, `玩家：${blackCount}`, blackIconX + 18, centerY, {
      size: 16,
      color: theme.color.ink,
      weight: 'bold',
      align: 'left',
      baseline: 'middle',
      font: theme.font.body
    });

    const whiteIconX = boardX + boardSize - 95;
    ctx.save();
    ctx.fillStyle = '#dededb';
    ctx.beginPath();
    ctx.arc(whiteIconX, centerY, 10, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#fcfaf2';
    ctx.beginPath();
    ctx.arc(whiteIconX, centerY, 8, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    drawText(ctx, `电脑：${whiteCount}`, whiteIconX + 18, centerY, {
      size: 16,
      color: theme.color.ink,
      weight: 'bold',
      align: 'left',
      baseline: 'middle',
      font: theme.font.body
    });

    const isPlayerTurn = this.state.turn === 1;
    const breatheSize = Math.sin(Date.now() / 200) * 1.5 + 5.5;

    ctx.save();
    if (isPlayerTurn) {
      ctx.fillStyle = 'rgba(86, 125, 101, 0.2)';
      ctx.beginPath();
      ctx.arc(blackIconX - 18, centerY, breatheSize + 4, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = '#567d65';
      ctx.beginPath();
      ctx.arc(blackIconX - 18, centerY, breatheSize, 0, Math.PI * 2);
      ctx.fill();
    } else {
      ctx.fillStyle = 'rgba(86, 125, 101, 0.2)';
      ctx.beginPath();
      ctx.arc(whiteIconX - 18, centerY, breatheSize + 4, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = '#567d65';
      ctx.beginPath();
      ctx.arc(whiteIconX - 18, centerY, breatheSize, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();

    fillRoundRect(ctx, boardX, boardY, boardSize, boardSize, theme.radius.lg, '#567d65');
    strokeRoundRect(ctx, boardX, boardY, boardSize, boardSize, theme.radius.lg, 'rgba(255, 255, 255, 0.15)', 2);

    ctx.save();
    ctx.strokeStyle = '#3d5947';
    ctx.lineWidth = 1.5;
    for (let i = 1; i < 8; i++) {
      const pos = i * cellSize;
      ctx.beginPath();
      ctx.moveTo(boardX, boardY + pos);
      ctx.lineTo(boardX + boardSize, boardY + pos);
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(boardX + pos, boardY);
      ctx.lineTo(boardX + pos, boardY + boardSize);
      ctx.stroke();
    }
    ctx.restore();

    ctx.save();
    ctx.fillStyle = '#3d5947';
    const stars = [2, 6];
    stars.forEach(r => {
      stars.forEach(c => {
        ctx.beginPath();
        ctx.arc(boardX + c * cellSize, boardY + r * cellSize, 3.5, 0, Math.PI * 2);
        ctx.fill();
      });
    });
    ctx.restore();

    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 8; c++) {
        const val = this.state.board[r][c];
        const cx = boardX + c * cellSize + cellSize / 2;
        const cy = boardY + r * cellSize + cellSize / 2;

        const anim = this.animations[r][c];
        if (anim && anim.animating && anim.delay <= 0) {
          const scaleX = anim.scaleX;
          const color = anim.progress < 0.5 ? anim.oldColor : anim.targetColor;

          ctx.save();
          ctx.translate(cx, cy);
          ctx.scale(scaleX, 1.0);
          ctx.translate(-cx, -cy);
          this.drawPiece(ctx, cx, cy, color, cellSize * 0.38);
          ctx.restore();
        } else if (val !== 0) {
          if (this.dropAnimation && this.dropAnimation.r === r && this.dropAnimation.c === c) {
            const scale = 1.0 + Math.max(0, 0.25 * (1.0 - this.dropAnimation.progress));
            ctx.save();
            ctx.translate(cx, cy);
            ctx.scale(scale, scale);
            ctx.translate(-cx, -cy);
            this.drawPiece(ctx, cx, cy, val, cellSize * 0.38);
            ctx.restore();
          } else {
            this.drawPiece(ctx, cx, cy, val, cellSize * 0.38);
          }
        } else {
          if (this.state.turn === 1 && !this.completed) {
            const isLegal = this.legalMoves.some(m => m.r === r && m.c === c);
            if (isLegal) {
              ctx.save();
              const breatheAlpha = 0.18 + Math.sin(Date.now() / 250) * 0.06;
              ctx.fillStyle = `rgba(0, 0, 0, ${breatheAlpha})`;
              ctx.beginPath();
              ctx.arc(cx, cy, 6, 0, Math.PI * 2);
              ctx.fill();
              ctx.restore();
            }
          }
        }
      }
    }

    if (this.toastText && this.toastTimer > 0) {
      const alpha = Math.min(1.0, this.toastTimer / 300);
      ctx.save();
      ctx.globalAlpha = alpha;
      const toastW = Math.min(width - 60, 220);
      const toastH = 44;
      const toastX = (width - toastW) / 2;
      const toastY = (height - toastH) / 2;

      fillRoundRect(ctx, toastX, toastY, toastW, toastH, 8, 'rgba(0, 0, 0, 0.75)');
      drawText(ctx, this.toastText, width / 2, height / 2, {
        size: 14,
        color: '#ffffff',
        align: 'center',
        baseline: 'middle',
        font: theme.font.body,
      });
      ctx.restore();
    }
  }
}