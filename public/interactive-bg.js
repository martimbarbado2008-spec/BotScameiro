(function() {
  // Criar o div de brilho de fundo do rato
  const glowDiv = document.createElement("div");
  glowDiv.className = "mouse-glow-bg";
  document.body.appendChild(glowDiv);

  // Criar o canvas para a rede de partículas
  const canvas = document.createElement("canvas");
  canvas.style.position = "fixed";
  canvas.style.top = "0";
  canvas.style.left = "0";
  canvas.style.width = "100%";
  canvas.style.height = "100%";
  canvas.style.pointerEvents = "none";
  canvas.style.zIndex = "-1";
  document.body.appendChild(canvas);

  const ctx = canvas.getContext("2d");
  
  // Injetar estilos CSS necessários
  const style = document.createElement("style");
  style.textContent = `
    .mouse-glow-bg {
      position: fixed;
      top: 0;
      left: 0;
      width: 100vw;
      height: 100vh;
      pointer-events: none;
      z-index: -2;
      background: radial-gradient(500px circle at var(--mouse-x, -1000px) var(--mouse-y, -1000px), rgba(87, 242, 135, 0.05), transparent 80%);
    }
  `;
  document.head.appendChild(style);

  const mouse = { x: null, y: null, radius: 150 };

  // Escutar movimentos do rato para atualizar coordenadas
  window.addEventListener("mousemove", (e) => {
    glowDiv.style.setProperty("--mouse-x", `${e.clientX}px`);
    glowDiv.style.setProperty("--mouse-y", `${e.clientY}px`);
    mouse.x = e.clientX;
    mouse.y = e.clientY;
  });

  window.addEventListener("mouseleave", () => {
    mouse.x = null;
    mouse.y = null;
  });

  // Ajustar tamanho do canvas
  function resize() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
  }
  window.addEventListener("resize", resize);
  resize();

  // Partículas
  const particles = [];
  const particleCount = Math.min(50, Math.floor((window.innerWidth * window.innerHeight) / 28000));

  class Particle {
    constructor() {
      this.x = Math.random() * canvas.width;
      this.y = Math.random() * canvas.height;
      this.vx = (Math.random() - 0.5) * 0.4;
      this.vy = (Math.random() - 0.5) * 0.4;
      this.radius = Math.random() * 2 + 1;
    }

    update() {
      this.x += this.vx;
      this.y += this.vy;

      // Ricochete nas bordas
      if (this.x < 0 || this.x > canvas.width) this.vx *= -1;
      if (this.y < 0 || this.y > canvas.height) this.vy *= -1;

      // Efeito de repulsão / atração suave do rato
      if (mouse.x !== null && mouse.y !== null) {
        const dx = mouse.x - this.x;
        const dy = mouse.y - this.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < mouse.radius) {
          const force = (mouse.radius - dist) / mouse.radius;
          // Puxa suavemente as partículas na direção do rato
          this.x += (dx / dist) * force * 0.2;
          this.y += (dy / dist) * force * 0.2;
        }
      }
    }

    draw() {
      ctx.beginPath();
      ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
      ctx.fillStyle = "rgba(87, 242, 135, 0.35)";
      ctx.fill();
    }
  }

  // Inicializar partículas
  for (let i = 0; i < particleCount; i++) {
    particles.push(new Particle());
  }

  // Loop de animação
  function animate() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    particles.forEach(p => {
      p.update();
      p.draw();
    });

    // Desenhar linhas de ligação (constelações)
    for (let i = 0; i < particles.length; i++) {
      for (let j = i + 1; j < particles.length; j++) {
        const dx = particles[i].x - particles[j].x;
        const dy = particles[i].y - particles[j].y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (dist < 110) {
          const alpha = (110 - dist) / 110 * 0.12;
          ctx.beginPath();
          ctx.moveTo(particles[i].x, particles[i].y);
          ctx.lineTo(particles[j].x, particles[j].y);
          ctx.strokeStyle = `rgba(87, 242, 135, ${alpha})`;
          ctx.lineWidth = 0.6;
          ctx.stroke();
        }
      }

      // Conectar linhas das partículas ao cursor do rato
      if (mouse.x !== null && mouse.y !== null) {
        const dx = particles[i].x - mouse.x;
        const dy = particles[i].y - mouse.y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (dist < mouse.radius) {
          const alpha = (mouse.radius - dist) / mouse.radius * 0.2;
          ctx.beginPath();
          ctx.moveTo(particles[i].x, particles[i].y);
          ctx.lineTo(mouse.x, mouse.y);
          ctx.strokeStyle = `rgba(87, 242, 135, ${alpha})`;
          ctx.lineWidth = 0.8;
          ctx.stroke();
        }
      }
    }

    requestAnimationFrame(animate);
  }

  animate();
})();
