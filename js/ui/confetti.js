export default class Confetti {
  constructor(host) {
    this.host = host;
    this.particles = [];
  }

  fire(x, y) {
    for (let i = 0; i < 60; i++) {
      this.particles.push({
        x: x,
        y: y,
        vx: (Math.random() - 0.5) * 12,
        vy: (Math.random() - 1) * 12 - 2,
        size: Math.random() * 6 + 3,
        color: ['#d9ad61', '#6f8b7b', '#485e7a', '#c76e5d', '#e0d8cb'][Math.floor(Math.random() * 5)],
        life: 1.0,
      });
    }
  }

  update() {
    this.particles.forEach((p) => {
      p.x += p.vx;
      p.y += p.vy;
      p.vy += 0.4;
      p.life -= 0.012;
    });
    this.particles = this.particles.filter((p) => p.life > 0);
  }

  render(ctx) {
    this.particles.forEach((p) => {
      ctx.globalAlpha = Math.max(0, p.life);
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fill();
    });
    ctx.globalAlpha = 1;
  }
}
