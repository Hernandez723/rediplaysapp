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
    this.currentSearchQuery = query;
    this.currentSearchFilter = 'all';
    this.navigateTo('search');
    this.mainView.innerHTML = `
      <h2 class="section-title">Resultados para "${query}"</h2>
      <div style="color: var(--md-sys-color-on-surface-variant); padding: 20px 0;">Buscando en YouTube Music...</div>
    `;

    const data = await YTMusic.search(query);
    this.searchData = data;
    this._renderSearchResults();
  }

  _renderSearchResults() {
    const query = this.currentSearchQuery || '';
    const data = this.searchData || { songs: [], artists: [], albums: [], playlists: [], topResult: null, results: [] };
    const songs = data.songs || data.results || [];
    const artists = data.artists || [];
    const albums = data.albums || [];
    const playlists = data.playlists || [];
    const topResult = data.topResult;

    const totalResults = songs.length + artists.length + albums.length + playlists.length;
    if (totalResults === 0 && !topResult) {
      this.mainView.innerHTML = `
        <h2 class="section-title">Resultados para "${query}"</h2>
        <div style="color: var(--md-sys-color-on-surface-variant); padding: 24px 0;">No se encontraron resultados para "${query}".</div>
      `;
      return;
    }

    this.mainView.innerHTML = `
      <div style="margin-bottom: 20px;">
        <h2 class="section-title" style="margin-bottom: 16px;">Resultados para "${query}"</h2>
        
        <!-- Filter Chips (Igual a la App Android) -->
        <div class="filter-chips">
          <button class="chip ${this.currentSearchFilter === 'all' ? 'active' : ''}" data-filter="all">Todos</button>
          <button class="chip ${this.currentSearchFilter === 'songs' ? 'active' : ''}" data-filter="songs">Canciones ${songs.length ? `(${songs.length})` : ''}</button>
          <button class="chip ${this.currentSearchFilter === 'artists' ? 'active' : ''}" data-filter="artists">Artistas ${artists.length ? `(${artists.length})` : ''}</button>
          <button class="chip ${this.currentSearchFilter === 'albums' ? 'active' : ''}" data-filter="albums">Álbumes ${albums.length ? `(${albums.length})` : ''}</button>
          <button class="chip ${this.currentSearchFilter === 'playlists' ? 'active' : ''}" data-filter="playlists">Playlists ${playlists.length ? `(${playlists.length})` : ''}</button>
        </div>
      </div>

      <div id="search-content-body"></div>
    `;

    // Bind Filter Chips click
    this.mainView.querySelectorAll('.chip').forEach(chip => {
      chip.addEventListener('click', () => {
        this.currentSearchFilter = chip.dataset.filter;
        this._renderSearchResults();
      });
    });

    const body = document.getElementById('search-content-body');

    // MODO: TODOS (Vista General Agrupada)
    if (this.currentSearchFilter === 'all') {
      // 1. Mejor Resultado (si existe)
      if (topResult) {
        const topDiv = document.createElement('div');
        topDiv.style.cssText = 'margin-bottom: 28px;';
        topDiv.innerHTML = `
          <h3 style="font-size: 1.1rem; font-weight: 700; margin-bottom: 12px; color: var(--md-sys-color-primary);">Mejor Resultado</h3>
          <div class="song-card" style="padding: 16px; background: linear-gradient(135deg, var(--md-sys-color-surface-container-high) 0%, var(--md-sys-color-surface-container) 100%);">
            <img src="${topResult.thumbnailUrl || 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=120'}" style="width: 64px; height: 64px; border-radius: var(--radius-md); object-fit: cover;" alt="${topResult.title}" />
            <div class="song-info">
              <span style="font-size: 0.75rem; text-transform: uppercase; letter-spacing: 0.5px; color: var(--md-sys-color-primary); font-weight: 700;">${topResult.type || 'Destacado'}</span>
              <div class="song-title" style="font-size: 1.1rem; font-weight: 700; margin-top: 2px;">${topResult.title}</div>
              <div class="song-artist artist-clickable" style="font-size: 0.85rem; margin-top: 4px;">${topResult.artist}</div>
            </div>
            ${topResult.id ? `
            <button class="btn-primary" style="padding: 8px 18px; font-size: 0.85rem; display: flex; align-items: center; gap: 6px;">
              <svg viewBox="0 0 24 24" style="width: 18px; height: 18px; fill: currentColor;"><path d="M8 5v14l11-7z"/></svg>
              <span>Reproducir</span>
            </button>` : ''}
          </div>
        `;

        if (topResult.id) {
          topDiv.querySelector('.btn-primary')?.addEventListener('click', (e) => {
            e.stopPropagation();
            player.playTrack({
              id: topResult.id,
              title: topResult.title,
              artist: topResult.artist,
              artists: topResult.artist,
              thumbnailUrl: topResult.thumbnailUrl
            }, songs);
          });
        }

        topDiv.querySelector('.artist-clickable')?.addEventListener('click', (e) => {
          e.stopPropagation();
          this.openArtistPage(topResult.artist);
        });

        body.appendChild(topDiv);
      }

      // 2. Artistas (Carrusel Horizontal)
      if (artists.length > 0) {
        const artSec = document.createElement('div');
        artSec.innerHTML = `
          <div class="section-title">
            <span>Artistas</span>
            <button class="btn-action-pill" style="background: transparent; color: var(--md-sys-color-primary); font-size: 0.85rem; padding: 4px 8px;">Ver todos</button>
          </div>
          <div class="horizontal-scroll-row"></div>
        `;
        const row = artSec.querySelector('.horizontal-scroll-row');
        artists.slice(0, 10).forEach(artist => {
          row.appendChild(UI.createArtistCardElement(artist));
        });
        artSec.querySelector('button')?.addEventListener('click', () => {
          this.currentSearchFilter = 'artists';
          this._renderSearchResults();
        });
        body.appendChild(artSec);
      }

      // 3. Canciones (Lista)
      if (songs.length > 0) {
        const songSec = document.createElement('div');
        songSec.style.cssText = 'margin-bottom: 28px;';
        songSec.innerHTML = `
          <div class="section-title">
            <span>Canciones</span>
            <button class="btn-action-pill" style="background: transparent; color: var(--md-sys-color-primary); font-size: 0.85rem; padding: 4px 8px;">Ver todas</button>
          </div>
          <div class="song-list"></div>
        `;
        const list = songSec.querySelector('.song-list');
        songs.slice(0, 6).forEach(track => {
          list.appendChild(UI.createSongElement(track, songs));
        });
        songSec.querySelector('button')?.addEventListener('click', () => {
          this.currentSearchFilter = 'songs';
          this._renderSearchResults();
        });
        body.appendChild(songSec);
      }

      // 4. Álbumes (Carrusel Horizontal)
      if (albums.length > 0) {
        const albSec = document.createElement('div');
        albSec.innerHTML = `
          <div class="section-title">
            <span>Álbumes</span>
            <button class="btn-action-pill" style="background: transparent; color: var(--md-sys-color-primary); font-size: 0.85rem; padding: 4px 8px;">Ver todos</button>
          </div>
          <div class="horizontal-scroll-row"></div>
        `;
        const row = albSec.querySelector('.horizontal-scroll-row');
        albums.slice(0, 10).forEach(album => {
          row.appendChild(UI.createMediaCardElement(album, 'album'));
        });
        albSec.querySelector('button')?.addEventListener('click', () => {
          this.currentSearchFilter = 'albums';
          this._renderSearchResults();
        });
        body.appendChild(albSec);
      }

      // 5. Playlists (Carrusel Horizontal)
      if (playlists.length > 0) {
        const plSec = document.createElement('div');
        plSec.innerHTML = `
          <div class="section-title">
            <span>Listas de Reproducción</span>
            <button class="btn-action-pill" style="background: transparent; color: var(--md-sys-color-primary); font-size: 0.85rem; padding: 4px 8px;">Ver todas</button>
          </div>
          <div class="horizontal-scroll-row"></div>
        `;
        const row = plSec.querySelector('.horizontal-scroll-row');
        playlists.slice(0, 10).forEach(pl => {
          row.appendChild(UI.createMediaCardElement(pl, 'playlist'));
        });
        plSec.querySelector('button')?.addEventListener('click', () => {
          this.currentSearchFilter = 'playlists';
          this._renderSearchResults();
        });
        body.appendChild(plSec);
      }
    }

    // MODO: CANCIONES (Lista completa)
    else if (this.currentSearchFilter === 'songs') {
      if (songs.length === 0) {
        body.innerHTML = '<p style="color: var(--md-sys-color-on-surface-variant);">No se encontraron canciones.</p>';
      } else {
        const list = document.createElement('div');
        list.className = 'song-list';
        songs.forEach(track => {
          list.appendChild(UI.createSongElement(track, songs));
        });
        body.appendChild(list);
      }
    }

    // MODO: ARTISTAS (Grid completo)
    else if (this.currentSearchFilter === 'artists') {
      if (artists.length === 0) {
        body.innerHTML = '<p style="color: var(--md-sys-color-on-surface-variant);">No se encontraron artistas.</p>';
      } else {
        const grid = document.createElement('div');
        grid.className = 'grid-cards';
        artists.forEach(artist => {
          grid.appendChild(UI.createArtistCardElement(artist));
        });
        body.appendChild(grid);
      }
    }

    // MODO: ÁLBUMES (Grid completo)
    else if (this.currentSearchFilter === 'albums') {
      if (albums.length === 0) {
        body.innerHTML = '<p style="color: var(--md-sys-color-on-surface-variant);">No se encontraron álbumes.</p>';
      } else {
        const grid = document.createElement('div');
        grid.className = 'grid-cards';
        albums.forEach(album => {
          grid.appendChild(UI.createMediaCardElement(album, 'album'));
        });
        body.appendChild(grid);
      }
    }

    // MODO: PLAYLISTS (Grid completo)
    else if (this.currentSearchFilter === 'playlists') {
      if (playlists.length === 0) {
        body.innerHTML = '<p style="color: var(--md-sys-color-on-surface-variant);">No se encontraron listas de reproducción.</p>';
      } else {
        const grid = document.createElement('div');
        grid.className = 'grid-cards';
        playlists.forEach(pl => {
          grid.appendChild(UI.createMediaCardElement(pl, 'playlist'));
        });
        body.appendChild(grid);
      }
    }
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
    YTMusic.search('Trending Hits').then(data => {
      const results = data.songs || data.results || [];
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
