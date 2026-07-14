(function() {
  // --- Web Audio API SFX Synthesizer ---
  let audioCtx = null;
  function initAudioCtx() {
    if (!audioCtx) {
      audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (audioCtx.state === 'suspended') {
      audioCtx.resume();
    }
  }

  window.playSFX = function(type) {
    try {
      initAudioCtx();
      if (!audioCtx) return;

      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.connect(gain);
      gain.connect(audioCtx.destination);

      const now = audioCtx.currentTime;

      if (type === 'click') {
        osc.type = 'sine';
        osc.frequency.setValueAtTime(800, now);
        osc.frequency.exponentialRampToValueAtTime(100, now + 0.05);
        gain.gain.setValueAtTime(0.08, now);
        gain.gain.linearRampToValueAtTime(0, now + 0.05);
        osc.start(now);
        osc.stop(now + 0.05);
      } else if (type === 'win') {
        const notes = [523.25, 659.25, 783.99, 1046.50];
        notes.forEach((freq, idx) => {
          const t = now + idx * 0.08;
          const oscNode = audioCtx.createOscillator();
          const gainNode = audioCtx.createGain();
          oscNode.connect(gainNode);
          gainNode.connect(audioCtx.destination);
          oscNode.type = 'triangle';
          oscNode.frequency.setValueAtTime(freq, t);
          gainNode.gain.setValueAtTime(0.12, t);
          gainNode.gain.exponentialRampToValueAtTime(0.001, t + 0.25);
          oscNode.start(t);
          oscNode.stop(t + 0.3);
        });
      } else if (type === 'lose') {
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(250, now);
        osc.frequency.linearRampToValueAtTime(70, now + 0.4);
        gain.gain.setValueAtTime(0.12, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.4);
        osc.start(now);
        osc.stop(now + 0.45);
      } else if (type === 'spin') {
        osc.type = 'sine';
        osc.frequency.setValueAtTime(450, now);
        gain.gain.setValueAtTime(0.06, now);
        gain.gain.linearRampToValueAtTime(0, now + 0.03);
        osc.start(now);
        osc.stop(now + 0.04);
      } else if (type === 'trade') {
        osc.type = 'sine';
        osc.frequency.setValueAtTime(880, now);
        gain.gain.setValueAtTime(0.08, now);
        gain.gain.linearRampToValueAtTime(0, now + 0.12);
        osc.start(now);
        osc.stop(now + 0.13);
      } else if (type === 'levelup') {
        const notes = [261.63, 329.63, 392.00, 523.25, 659.25, 783.99, 1046.50];
        notes.forEach((freq, idx) => {
          const t = now + idx * 0.07;
          const oscNode = audioCtx.createOscillator();
          const gainNode = audioCtx.createGain();
          oscNode.connect(gainNode);
          gainNode.connect(audioCtx.destination);
          oscNode.type = 'sine';
          oscNode.frequency.setValueAtTime(freq, t);
          gainNode.gain.setValueAtTime(0.1, t);
          gainNode.gain.exponentialRampToValueAtTime(0.001, t + 0.3);
          oscNode.start(t);
          oscNode.stop(t + 0.35);
        });
      } else if (type === 'join' || type === 'chat_join') {
        const notes = [587.33, 880.00];
        notes.forEach((freq, idx) => {
          const t = now + idx * 0.12;
          const oscNode = audioCtx.createOscillator();
          const gainNode = audioCtx.createGain();
          oscNode.connect(gainNode);
          gainNode.connect(audioCtx.destination);
          oscNode.type = 'triangle';
          oscNode.frequency.setValueAtTime(freq, t);
          gainNode.gain.setValueAtTime(0.08, t);
          gainNode.gain.exponentialRampToValueAtTime(0.001, t + 0.2);
          oscNode.start(t);
          oscNode.stop(t + 0.25);
        });
      } else if (type === 'russa_click') {
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(120, now);
        osc.frequency.setValueAtTime(30, now + 0.05);
        gain.gain.setValueAtTime(0.3, now);
        gain.gain.linearRampToValueAtTime(0, now + 0.05);
        osc.start(now);
        osc.stop(now + 0.06);
      } else if (type === 'russa_bang') {
        const bufferSize = audioCtx.sampleRate * 1.5;
        const buffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) {
          data[i] = Math.random() * 2 - 1;
        }
        const noise = audioCtx.createBufferSource();
        noise.buffer = buffer;

        const filter = audioCtx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(1000, now);
        filter.frequency.exponentialRampToValueAtTime(10, now + 0.8);

        const noiseGain = audioCtx.createGain();
        noiseGain.gain.setValueAtTime(0.5, now);
        noiseGain.gain.exponentialRampToValueAtTime(0.001, now + 1.2);

        noise.connect(filter);
        filter.connect(noiseGain);
        noiseGain.connect(audioCtx.destination);

        noise.start(now);
        noise.stop(now + 1.3);
      }
    } catch (e) {
      console.warn("SFX error:", e);
    }
  };

  // Criar elemento de áudio
  const audio = new Audio("https://www.soundhelix.com/examples/mp3/SoundHelix-Song-8.mp3");
  audio.loop = true;
  audio.volume = parseFloat(localStorage.getItem("casino_music_volume") || "0.2");

  // Injetar estilos do widget
  const style = document.createElement("style");
  style.textContent = `
    .music-widget {
      position: fixed;
      bottom: 20px;
      left: 20px;
      background: rgba(13, 22, 18, 0.95);
      border: 1px solid rgba(87, 242, 135, 0.3);
      box-shadow: 0 0 15px rgba(87, 242, 135, 0.1), 0 8px 32px rgba(0,0,0,0.5);
      border-radius: 50%;
      width: 48px;
      height: 48px;
      padding: 0;
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 9999;
      backdrop-filter: blur(10px);
      transition: width 0.4s cubic-bezier(0.165, 0.84, 0.44, 1), border-radius 0.4s ease, padding 0.4s ease;
      overflow: hidden;
    }

    .music-widget:hover {
      width: 270px;
      border-radius: 50px;
      padding: 8px 16px;
      border-color: #57f287;
      box-shadow: 0 0 20px rgba(87, 242, 135, 0.2);
    }

    /* Ícone exibido quando colapsado */
    .music-collapsed-icon {
      font-size: 20px;
      display: flex;
      align-items: center;
      justify-content: center;
      min-width: 48px;
      height: 48px;
      transition: opacity 0.3s ease, transform 0.3s ease, width 0.3s ease;
      user-select: none;
      cursor: pointer;
    }

    @keyframes spin {
      from { transform: rotate(0deg); }
      to { transform: rotate(360deg); }
    }

    .music-collapsed-icon.spinning {
      animation: spin 6s linear infinite;
    }

    .music-widget:hover .music-collapsed-icon {
      opacity: 0;
      transform: scale(0.5);
      min-width: 0;
      width: 0;
      pointer-events: none;
    }

    /* Content/Controlos visíveis apenas no hover */
    .music-controls-container {
      display: flex;
      align-items: center;
      gap: 12px;
      opacity: 0;
      pointer-events: none;
      transition: opacity 0.3s ease;
      width: 100%;
      min-width: 230px;
    }

    .music-widget:hover .music-controls-container {
      opacity: 1;
      pointer-events: auto;
    }

    .music-btn {
      width: 32px;
      height: 32px;
      border-radius: 50%;
      background: #57f287;
      border: none;
      color: #050e08;
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      font-size: 14px;
      font-weight: bold;
      box-shadow: 0 2px 10px rgba(87, 242, 135, 0.3);
      transition: all 0.2s ease;
    }

    .music-btn:hover {
      transform: scale(1.05);
    }

    .music-info {
      display: flex;
      flex-direction: column;
    }

    .music-title {
      font-size: 11px;
      font-weight: 800;
      color: #fff;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      max-width: 120px;
    }

    .music-status {
      font-size: 8px;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      color: #57f287;
      font-weight: 700;
    }

    .volume-slider {
      width: 50px;
      height: 4px;
      -webkit-appearance: none;
      background: rgba(255,255,255,0.1);
      border-radius: 2px;
      outline: none;
      cursor: pointer;
    }

    .volume-slider::-webkit-slider-thumb {
      -webkit-appearance: none;
      width: 10px;
      height: 10px;
      border-radius: 50%;
      background: #57f287;
      cursor: pointer;
    }
  `;
  document.head.appendChild(style);

  // Injetar HTML do widget
  const widget = document.createElement("div");
  widget.className = "music-widget";
  widget.innerHTML = `
    <div class="music-collapsed-icon" id="musicCollapsedIcon">📻</div>
    <div class="music-controls-container">
      <button class="music-btn" id="musicPlayBtn">▶</button>
      <div class="music-info">
        <span class="music-title">Casino Lounge Lofi 📻</span>
        <span class="music-status" id="musicStatus">Desativado</span>
      </div>
      <input type="range" class="volume-slider" id="musicVolume" min="0" max="1" step="0.05" value="${audio.volume}">
    </div>
  `;
  document.body.appendChild(widget);

  const collapsedIcon = widget.querySelector("#musicCollapsedIcon");
  const playBtn = widget.querySelector("#musicPlayBtn");
  const statusEl = widget.querySelector("#musicStatus");
  const volumeSlider = widget.querySelector("#musicVolume");

  let isPlaying = localStorage.getItem("casino_music_playing") === "true";

  function updateUI() {
    if (isPlaying) {
      playBtn.textContent = "⏸";
      statusEl.textContent = "A tocar 🎶";
      statusEl.style.color = "#57f287";
      collapsedIcon.classList.add("spinning");
    } else {
      playBtn.textContent = "▶";
      statusEl.textContent = "Pausado";
      statusEl.style.color = "#9ca3af";
      collapsedIcon.classList.remove("spinning");
    }
  }

  async function togglePlay() {
    if (isPlaying) {
      audio.pause();
      isPlaying = false;
      localStorage.setItem("casino_music_playing", "false");
    } else {
      try {
        await audio.play();
        isPlaying = true;
        localStorage.setItem("casino_music_playing", "true");
      } catch (err) {
        console.log("Autoplay impedido pelo navegador, aguardando clique...");
      }
    }
    updateUI();
  }

  playBtn.addEventListener("click", togglePlay);
  // Clicar no ícone de rádio colapsado também liga/desliga o som diretamente
  collapsedIcon.addEventListener("click", togglePlay);
  
  volumeSlider.addEventListener("input", (e) => {
    const vol = parseFloat(e.target.value);
    audio.volume = vol;
    localStorage.setItem("casino_music_volume", vol.toString());
  });

  // Tentar arrancar se estava a tocar na página anterior
  if (isPlaying) {
    // Autoplay pode necessitar de interação prévia do utilizador, por isso tentamos
    document.addEventListener("click", function startOnFirstClick() {
      audio.play().then(() => {
        isPlaying = true;
        updateUI();
      }).catch(() => {});
      document.removeEventListener("click", startOnFirstClick);
    }, { once: true });
  }

  // Escutador global para cliques em botões para feedback físico de áudio
  document.addEventListener('click', (e) => {
    const target = e.target.closest('button, .nav-btn, .amount-shortcut, .btn-duration, .lobby-item, .filter-btn, .action-btn');
    if (target && !target.disabled) {
      if (typeof window.playSFX === 'function') {
        window.playSFX('click');
      }
    }
  });

  updateUI();
})();
