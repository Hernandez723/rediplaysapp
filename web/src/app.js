// Metrolist Web - Main App Entry Point

import { player } from './player.js';
import { sync } from './sync.js';
import { YTMusic } from './yt-api.js';
import { UI } from './ui.js';

class App {
  constructor() {
    this.currentView = 'home';
    this.searchDebounceTimer = null;
    this._initDomElements();
    this._bindEvents();
    this._initSubscriptions();
    this._registerServiceWorker();
  }

  _initDomElements() {
    this.mainView = document.getElementById('view-content');
    this.searchInput = document.getElementById('search-input');
    this.navItems = document.querySelectorAll('.nav-item');
    
    // Player DOM
    this.bottomPlayer = document.getElementById('bottom-player');
    this.playerThumb = document.getElementById('player-thumb');
    this.playerTitle = document.getElementById('player-title');
    this.playerArtist = document.getElementById('player-artist');
    this.btnPlayPause = document.getElementById('btn-play-pause');
    this.btnPrev = document.getElementById('btn-prev');
    this.btnNext = document.getElementById('btn-next');
    this.seekBar = document.getElementById('seek-bar');
    this.currentTimeLabel = document.getElementById('current-time');
    this.totalTimeLabel = document.getElementById('total-time');
    this.volumeSlider = document.getElementById('volume-slider');
    this.btnLyrics = document.getElementById('btn-lyrics');
    this.lyricsOverlay = document.getElementById('lyrics-overlay');
    this.lyricsContainer = document.getElementById('lyrics-container');
    this.btnCloseLyrics = document.getElementById('btn-close-lyrics');

    // Sync Modal DOM
    this.syncBadge = document.getElementById('sync-badge');
    this.syncModal = document.getElementById('sync-modal');
    this.pairingCodeDisplay = document.getElementById('my-pairing-code');
    this.inputRemoteCode = document.getElementById('input-remote-code');
    this.btnPairRemote = document.getElementById('btn-pair-remote');
    this.btnCloseSyncModal = document.getElementById('btn-close-sync-modal');
  }

  _bindEvents() {
    // Navegación
    this.navItems.forEach(item => {
      item.addEventListener('click', (e) => {
        e.preventDefault();
        const view = item.dataset.view;
        this.navigateTo(view);
      });
    });

    // Búsqueda
    this.searchInput.addEventListener('input', (e) => {
      const q = e.target.value.trim();
      clearTimeout(this.searchDebounceTimer);
      if (q.length >= 2) {
        this.searchDebounceTimer = setTimeout(() => {
          this.executeSearch(q);
        }, 350);
      }
    });

    this.searchInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        clearTimeout(this.searchDebounceTimer);
        this.executeSearch(this.searchInput.value.trim());
      }
    });

    // Click en el artista del reproductor inferior
    this.playerArtist.style.cursor = 'pointer';
    this.playerArtist.addEventListener('click', (e) => {
      e.stopPropagation();
      if (player.currentTrack) {
        const artist = player.currentTrack.artists || player.currentTrack.artist;
        if (artist) this.openArtistPage(artist);
      }
    });

    // Controles de Reproducción
    this.btnPlayPause.addEventListener('click', () => player.togglePlay());
    this.btnNext.addEventListener('click', () => player.next());
    this.btnPrev.addEventListener('click', () => player.prev());

    this.seekBar.addEventListener('input', (e) => {
      const time = parseFloat(e.target.value);
      this.currentTimeLabel.textContent = UI.formatTime(time);
    });

    this.seekBar.addEventListener('change', (e) => {
      player.seek(parseFloat(e.target.value));
    });

    this.volumeSlider.addEventListener('input', (e) => {
      player.setVolume(parseFloat(e.target.value));
    });

    // Letras
    this.btnLyrics.addEventListener('click', () => {
      this.lyricsOverlay.classList.toggle('active');
    });

    this.btnCloseLyrics.addEventListener('click', () => {
      this.lyricsOverlay.classList.remove('active');
    });

    // Modal de sincronización
    this.syncBadge.addEventListener('click', () => {
      this.pairingCodeDisplay.textContent = sync.pairingCode || '------';
      this.syncModal.classList.add('active');
    });

    this.btnCloseSyncModal.addEventListener('click', () => {
      this.syncModal.classList.remove('active');
    });

    this.btnPairRemote.addEventListener('click', async () => {
      const code = this.inputRemoteCode.value.trim();
      if (code.length >= 4) {
        this.btnPairRemote.disabled = true;
        this.btnPairRemote.textContent = 'Vinculando...';
        const success = await sync.pairWithCode(code);
        this.btnPairRemote.disabled = false;
        this.btnPairRemote.textContent = 'Vincular Dispositivo';
        if (success) {
          UI.showToast('¡Dispositivo vinculado con éxito!');
          this.syncModal.classList.remove('active');
          this.renderView();
        } else {
          alert('Código inválido o no encontrado');
        }
      }
    });

    // Cerrar modales en clic exterior
    document.querySelectorAll('.modal-backdrop').forEach(modal => {
      modal.addEventListener('click', (e) => {
        if (e.target === modal) modal.classList.remove('active');
      });
    });
  }

  _initSubscriptions() {
    // Escuchar estado del reproductor
    player.onStateChange((state) => {
      if (state.track) {
        this.bottomPlayer.style.display = 'flex';
        this.playerThumb.src = state.track.thumbnailUrl || 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=100';
        this.playerTitle.textContent = state.track.title;
        const artist = state.track.artists || state.track.artist || 'Artista';
        this.playerArtist.textContent = artist;
        this.playerArtist.title = `Ver perfil de ${artist}`;
        
        // Icono play/pause
        this.btnPlayPause.innerHTML = state.isPlaying
          ? `<svg viewBox="0 0 24 24"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/></svg>`
          : `<svg viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>`;

        // Renderizar letras
        this._renderLyrics(state.lyrics);
      }
    });

    // Escuchar actualización de tiempo
    player.onTimeUpdate((current, duration) => {
      this.seekBar.max = duration;
      this.seekBar.value = current;
      this.currentTimeLabel.textContent = UI.formatTime(current);
      this.totalTimeLabel.textContent = UI.formatTime(duration);

      // Sincronizar resaltado de letra
      this._updateLyricsHighlight(current);
    });

    // Escuchar cambios de sincronización
    sync.onChange(() => {
      this.renderView();
    });
  }

  navigateTo(view) {
    this.currentView = view;
    this.navItems.forEach(item => {
      item.classList.toggle('active', item.dataset.view === view);
    });
    this.renderView();
  }

  async executeSearch(query) {
    if (!query) return;
    this.navigateTo('search');
    this.mainView.innerHTML = `
      <h2 class="section-title">Resultados para "${query}"</h2>
      <div style="color: var(--md-sys-color-on-surface-variant);">Buscando en YouTube Music...</div>
    `;

    const results = await YTMusic.search(query);
    if (results.length === 0) {
      this.mainView.innerHTML = `
        <h2 class="section-title">Resultados para "${query}"</h2>
        <div style="color: var(--md-sys-color-on-surface-variant);">No se encontraron resultados.</div>
      `;
      return;
    }

    this.mainView.innerHTML = `<h2 class="section-title">Resultados para "${query}"</h2>`;
    const list = document.createElement('div');
    list.className = 'song-list';
    results.forEach(track => {
      list.appendChild(UI.createSongElement(track, results));
    });
    this.mainView.appendChild(list);
  }

  // Abrir y renderizar página completa del artista
  async openArtistPage(artistName) {
    if (!artistName) return;
    this.currentView = 'artist';
    this.navItems.forEach(item => item.classList.remove('active'));

    this.mainView.innerHTML = `
      <div style="padding: 40px; text-align: center; color: var(--md-sys-color-on-surface-variant);">
        Cargando perfil de ${artistName}...
      </div>
    `;

    const data = await YTMusic.getArtist(artistName);
    if (!data || !data.artist) {
      this.mainView.innerHTML = `
        <div style="padding: 20px;">
          <h1 style="font-size: 1.8rem; font-weight: 700;">${artistName}</h1>
          <p style="color: var(--md-sys-color-on-surface-variant); margin-top: 8px;">No se pudo cargar la información del artista.</p>
        </div>
      `;
      return;
    }

    const artist = data.artist;
    const topSongs = data.topSongs || [];

    this.mainView.innerHTML = `
      <div class="artist-hero">
        <img src="${artist.thumbnailUrl || 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=300'}" class="artist-hero-thumb" alt="${artist.name}" />
        <div class="artist-hero-info">
          <span style="font-size: 0.85rem; color: var(--md-sys-color-primary); font-weight: 600; text-transform: uppercase;">Artista</span>
          <h1 class="artist-hero-title">${artist.name}</h1>
          <p style="color: var(--md-sys-color-on-surface-variant); font-size: 0.95rem;">${artist.description || 'Canciones más escuchadas en Metrolist'}</p>
          <div class="artist-hero-actions">
            <button id="btn-artist-play-all" class="btn-action-pill btn-primary">
              <svg viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>
              <span>Reproducir Todo</span>
            </button>
            <button id="btn-artist-shuffle" class="btn-action-pill" style="background: var(--md-sys-color-surface-container-highest); color: var(--md-sys-color-on-surface);">
              <svg viewBox="0 0 24 24"><path d="M10.59 9.17L5.41 4 4 5.41l5.17 5.17 1.42-1.41zM14.5 4l2.04 2.04L4 18.59 5.41 20 17.96 7.46 20 9.5V4h-5.5zm.33 9.41l-1.41 1.41 3.13 3.13L14.5 20H20v-5.5l-2.04 2.04-3.13-3.13z"/></svg>
              <span>Aleatorio</span>
            </button>
          </div>
        </div>
      </div>

      <h2 class="section-title">Canciones Populares (${topSongs.length})</h2>
      <div id="artist-songs-list" class="song-list"></div>
    `;

    // Botón Reproducir Todo
    document.getElementById('btn-artist-play-all').addEventListener('click', () => {
      if (topSongs.length > 0) {
        player.playTrack(topSongs[0], topSongs);
      }
    });

    // Botón Aleatorio
    document.getElementById('btn-artist-shuffle').addEventListener('click', () => {
      if (topSongs.length > 0) {
        const randIdx = Math.floor(Math.random() * topSongs.length);
        player.isShuffle = true;
        player.playTrack(topSongs[randIdx], topSongs);
      }
    });

    // Lista de canciones
    const list = document.getElementById('artist-songs-list');
    if (topSongs.length === 0) {
      list.innerHTML = '<p style="color: var(--md-sys-color-on-surface-variant);">No hay canciones disponibles para este artista.</p>';
    } else {
      topSongs.forEach(track => {
        list.appendChild(UI.createSongElement(track, topSongs));
      });
    }
  }

  renderView() {
    if (this.currentView === 'home') {
      this._renderHome();
    } else if (this.currentView === 'favorites') {
      this._renderFavorites();
    } else if (this.currentView === 'playlists') {
      this._renderPlaylists();
    } else if (this.currentView === 'history') {
      this._renderHistory();
    }
  }

  _renderHome() {
    this.mainView.innerHTML = `
      <div style="margin-bottom: 28px;">
        <h1 style="font-size: 2rem; font-weight: 800; margin-bottom: 8px;">Metrolist Web</h1>
        <p style="color: var(--md-sys-color-on-surface-variant);">Música ilimitada sincronizada con tu dispositivo Android</p>
      </div>

      <h2 class="section-title">Tus Favoritos Recientes</h2>
      <div id="home-favs" class="song-list" style="margin-bottom: 32px;"></div>

      <h2 class="section-title">Explorar Tendencias</h2>
      <div id="home-trending" class="song-list"></div>
    `;

    const favsContainer = document.getElementById('home-favs');
    if (sync.favorites.length === 0) {
      favsContainer.innerHTML = '<p style="color: var(--md-sys-color-on-surface-variant); font-size: 0.9rem;">No tienes canciones favoritas aún. ¡Busca y dale Me Gusta!</p>';
    } else {
      sync.favorites.slice(0, 5).forEach(track => {
        favsContainer.appendChild(UI.createSongElement(track, sync.favorites));
      });
    }

    // Cargar tendencias recomendadas
    YTMusic.search('Trending Hits').then(results => {
      const trendContainer = document.getElementById('home-trending');
      if (trendContainer && results.length > 0) {
        trendContainer.innerHTML = '';
        results.slice(0, 10).forEach(track => {
          trendContainer.appendChild(UI.createSongElement(track, results));
        });
      }
    });
  }

  _renderFavorites() {
    this.mainView.innerHTML = `
      <h2 class="section-title">Canciones Favoritas (${sync.favorites.length})</h2>
      <div id="favs-list" class="song-list"></div>
    `;
    const container = document.getElementById('favs-list');
    if (sync.favorites.length === 0) {
      container.innerHTML = '<p style="color: var(--md-sys-color-on-surface-variant);">No has guardado canciones favoritas todavía.</p>';
    } else {
      sync.favorites.forEach(track => {
        container.appendChild(UI.createSongElement(track, sync.favorites));
      });
    }
  }

  _renderPlaylists() {
    this.mainView.innerHTML = `
      <div class="section-title">
        <span>Tus Playlists (${sync.playlists.length})</span>
        <button id="btn-create-pl" class="btn-primary" style="padding: 8px 16px; font-size: 0.85rem;">+ Nueva Playlist</button>
      </div>
      <div id="pl-container" class="song-list"></div>
    `;

    document.getElementById('btn-create-pl').addEventListener('click', () => {
      const name = prompt('Nombre de la nueva playlist:');
      if (name && name.trim()) {
        sync.createPlaylist(name.trim());
        this._renderPlaylists();
      }
    });

    const container = document.getElementById('pl-container');
    if (sync.playlists.length === 0) {
      container.innerHTML = '<p style="color: var(--md-sys-color-on-surface-variant);">No tienes listas de reproducción creadas.</p>';
    } else {
      sync.playlists.forEach(pl => {
        const div = document.createElement('div');
        div.className = 'song-card';
        div.innerHTML = `
          <div class="song-info">
            <div class="song-title">${pl.name}</div>
            <div class="song-artist">${pl.songs?.length || 0} canciones</div>
          </div>
        `;
        div.addEventListener('click', () => {
          this._renderPlaylistDetails(pl);
        });
        container.appendChild(div);
      });
    }
  }

  _renderPlaylistDetails(pl) {
    this.mainView.innerHTML = `
      <div style="margin-bottom: 24px;">
        <button id="btn-back-pl" class="btn-icon" style="margin-bottom: 12px;">
          <svg viewBox="0 0 24 24"><path d="M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z"/></svg>
        </button>
        <h1 style="font-size: 1.8rem; font-weight: 700;">${pl.name}</h1>
        <p style="color: var(--md-sys-color-on-surface-variant); font-size: 0.9rem;">${pl.songs?.length || 0} canciones</p>
      </div>
      <div id="pl-songs" class="song-list"></div>
    `;

    document.getElementById('btn-back-pl').addEventListener('click', () => this._renderPlaylists());

    const container = document.getElementById('pl-songs');
    if (!pl.songs || pl.songs.length === 0) {
      container.innerHTML = '<p style="color: var(--md-sys-color-on-surface-variant);">Esta playlist está vacía.</p>';
    } else {
      pl.songs.forEach(track => {
        container.appendChild(UI.createSongElement(track, pl.songs));
      });
    }
  }

  _renderHistory() {
    this.mainView.innerHTML = `
      <h2 class="section-title">Historial de Reproducción</h2>
      <div id="history-list" class="song-list"></div>
    `;
    const container = document.getElementById('history-list');
    if (sync.history.length === 0) {
      container.innerHTML = '<p style="color: var(--md-sys-color-on-surface-variant);">No hay canciones en el historial.</p>';
    } else {
      sync.history.forEach(track => {
        container.appendChild(UI.createSongElement(track, sync.history));
      });
    }
  }

  _renderLyrics(lyrics) {
    this.lyricsContainer.innerHTML = '';
    if (lyrics.synced && lyrics.synced.length > 0) {
      lyrics.synced.forEach((line, idx) => {
        const p = document.createElement('div');
        p.className = 'lyric-line';
        p.dataset.time = line.time;
        p.dataset.index = idx;
        p.textContent = line.text;
        p.addEventListener('click', () => {
          player.seek(line.time);
        });
        this.lyricsContainer.appendChild(p);
      });
    } else if (lyrics.plain) {
      const p = document.createElement('div');
      p.className = 'lyric-line active';
      p.style.whiteSpace = 'pre-line';
      p.textContent = lyrics.plain;
      this.lyricsContainer.appendChild(p);
    } else {
      this.lyricsContainer.innerHTML = '<div class="lyric-line" style="color: var(--md-sys-color-on-surface-variant);">No hay letra disponible para esta canción.</div>';
    }
  }

  _updateLyricsHighlight(currentTime) {
    const lines = this.lyricsContainer.querySelectorAll('.lyric-line[data-time]');
    if (lines.length === 0) return;

    let activeLine = null;
    lines.forEach(line => {
      const t = parseFloat(line.dataset.time);
      if (currentTime >= t) {
        activeLine = line;
      }
    });

    lines.forEach(l => l.classList.remove('active'));
    if (activeLine) {
      activeLine.classList.add('active');
      activeLine.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }

  _registerServiceWorker() {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch(err => {
        console.log('ServiceWorker error:', err);
      });
    }
  }
}

// Iniciar aplicación al cargar el DOM
window.addEventListener('DOMContentLoaded', () => {
  window.app = new App();
  window.app.renderView();
});
