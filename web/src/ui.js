// Metrolist Web - UI Component Renderer

import { player } from './player.js';
import { sync } from './sync.js';
import { YTMusic } from './yt-api.js';

export const UI = {
  // Formatear segundos a mm:ss
  formatTime(secs) {
    if (isNaN(secs) || secs < 0) return '0:00';
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  },

  // Renderizar tarjeta de canción
  createSongElement(track, playlistContext = null) {
    const isFav = sync.isFavorite(track.id);
    const div = document.createElement('div');
    div.className = `song-card ${player.currentTrack?.id === track.id ? 'active' : ''}`;
    div.dataset.id = track.id;

    const artistName = track.artists || track.artist || 'Artista';

    div.innerHTML = `
      <img src="${track.thumbnailUrl || 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=100'}" class="song-thumb" alt="${track.title}" loading="lazy"/>
      <div class="song-info">
        <div class="song-title">${track.title}</div>
        <div class="song-artist artist-clickable" title="Ver perfil de ${artistName}">${artistName}</div>
      </div>
      <div class="song-actions">
        <button class="btn-icon btn-fav ${isFav ? 'liked' : ''}" title="Me gusta">
          <svg viewBox="0 0 24 24"><path d="${isFav ? 'M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z' : 'M16.5 3c-1.74 0-3.41.81-4.5 2.09C10.91 3.81 9.24 3 7.5 3 4.42 3 2 5.42 2 8.5c0 3.78 3.4 6.86 8.55 11.54L12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z'}"/></svg>
        </button>
        <button class="btn-icon btn-add-pl" title="Añadir a playlist">
          <svg viewBox="0 0 24 24"><path d="M14 10H2v2h12v-2zm0-4H2v2h12V6zm4 8v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zM2 16h8v-2H2v2z"/></svg>
        </button>
      </div>
    `;

    // Click para reproducir
    div.addEventListener('click', (e) => {
      if (e.target.closest('.btn-fav') || e.target.closest('.btn-add-pl') || e.target.closest('.artist-clickable')) return;
      player.playTrack(track, playlistContext || [track]);
      sync.addHistory(track);
    });

    // Click en el artista
    const artistElem = div.querySelector('.artist-clickable');
    artistElem.addEventListener('click', (e) => {
      e.stopPropagation();
      if (window.app && typeof window.app.openArtistPage === 'function') {
        window.app.openArtistPage(artistName);
      }
    });

    // Botón de favorito
    const favBtn = div.querySelector('.btn-fav');
    favBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      sync.toggleFavorite(track);
    });

    // Botón de añadir a playlist
    const plBtn = div.querySelector('.btn-add-pl');
    plBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      UI.openAddToPlaylistModal(track);
    });

    return div;
  },

  // Renderizar tarjeta circular de artista
  createArtistCardElement(artist) {
    const div = document.createElement('div');
    div.className = 'artist-card';
    div.innerHTML = `
      <img src="${artist.thumbnailUrl || 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=200'}" class="artist-card-thumb" alt="${artist.name}" loading="lazy"/>
      <div class="artist-card-name">${artist.name}</div>
      <div class="artist-card-sub">${artist.subscribers || 'Artista'}</div>
    `;

    div.addEventListener('click', () => {
      if (window.app && typeof window.app.openArtistPage === 'function') {
        window.app.openArtistPage(artist.name);
      }
    });

    return div;
  },

  // Renderizar tarjeta de Álbum o Playlist
  createMediaCardElement(item, type = 'album') {
    const div = document.createElement('div');
    div.className = 'media-card';
    div.innerHTML = `
      <img src="${item.thumbnailUrl || 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=300'}" class="media-card-thumb" alt="${item.title}" loading="lazy"/>
      <div class="media-card-title">${item.title}</div>
      <div class="media-card-sub">${item.artist || item.author || (type === 'album' ? 'Álbum' : 'Playlist')} ${item.year ? '• ' + item.year : (item.trackCount ? '• ' + item.trackCount : '')}</div>
    `;

    div.addEventListener('click', () => {
      if (window.app && typeof window.app.executeSearch === 'function') {
        // Cargar canciones de este álbum/playlist
        window.app.executeSearch(`${item.title} ${item.artist || ''}`);
      }
    });

    return div;
  },

  // Modal para añadir canción a playlist
  openAddToPlaylistModal(track) {
    const modal = document.getElementById('playlist-modal');
    const plList = document.getElementById('modal-playlist-list');
    plList.innerHTML = '';

    if (sync.playlists.length === 0) {
      plList.innerHTML = '<p style="color: var(--md-sys-color-on-surface-variant); font-size: 0.9rem;">No tienes playlists. ¡Crea una primero!</p>';
    } else {
      sync.playlists.forEach(pl => {
        const item = document.createElement('div');
        item.className = 'song-card';
        item.innerHTML = `
          <div class="song-info">
            <div class="song-title">${pl.name}</div>
            <div class="song-artist">${pl.songs?.length || 0} canciones</div>
          </div>
        `;
        item.addEventListener('click', () => {
          sync.addSongToPlaylist(pl.id, track);
          modal.classList.remove('active');
          UI.showToast(`Añadida a ${pl.name}`);
        });
        plList.appendChild(item);
      });
    }

    modal.classList.add('active');
  },

  // Mostrar mensaje flotante Toast
  showToast(message) {
    let toast = document.getElementById('toast-msg');
    if (!toast) {
      toast = document.createElement('div');
      toast.id = 'toast-msg';
      toast.style.cssText = `
        position: fixed;
        bottom: 96px;
        left: 50%;
        transform: translateX(-50%);
        background: var(--md-sys-color-surface-container-highest);
        color: var(--md-sys-color-on-surface);
        padding: 10px 20px;
        border-radius: var(--radius-full);
        font-size: 0.9rem;
        z-index: 200;
        box-shadow: 0 4px 12px rgba(0,0,0,0.4);
        transition: opacity 0.3s ease;
      `;
      document.body.appendChild(toast);
    }
    toast.textContent = message;
    toast.style.opacity = '1';
    setTimeout(() => { toast.style.opacity = '0'; }, 2500);
  }
};
