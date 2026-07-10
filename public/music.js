(function() {
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
      border-radius: 50px;
      padding: 8px 16px;
      display: flex;
      align-items: center;
      gap: 12px;
      z-index: 9999;
      backdrop-filter: blur(10px);
      transition: all 0.3s ease;
      max-width: 260px;
    }

    .music-widget:hover {
      border-color: #57f287;
      box-shadow: 0 0 20px rgba(87, 242, 135, 0.2);
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
    <button class="music-btn" id="musicPlayBtn">▶</button>
    <div class="music-info">
      <span class="music-title">Casino Lounge Lofi 📻</span>
      <span class="music-status" id="musicStatus">Desativado</span>
    </div>
    <input type="range" class="volume-slider" id="musicVolume" min="0" max="1" step="0.05" value="${audio.volume}">
  `;
  document.body.appendChild(widget);

  const playBtn = widget.querySelector("#musicPlayBtn");
  const statusEl = widget.querySelector("#musicStatus");
  const volumeSlider = widget.querySelector("#musicVolume");

  let isPlaying = localStorage.getItem("casino_music_playing") === "true";

  function updateUI() {
    if (isPlaying) {
      playBtn.textContent = "⏸";
      statusEl.textContent = "A tocar 🎶";
      statusEl.style.color = "#57f287";
    } else {
      playBtn.textContent = "▶";
      statusEl.textContent = "Pausado";
      statusEl.style.color = "#9ca3af";
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

  updateUI();
})();
