// Metrolist Web - Sync & Cloudflare D1 Manager

class SyncManager {
  constructor() {
    this.userId = localStorage.getItem('metrolist_user_id') || null;
    this.pairingCode = localStorage.getItem('metrolist_pairing_code') || null;
    this.lastSyncAt = parseInt(localStorage.getItem('metrolist_last_sync') || '0', 10);
    this.favorites = JSON.parse(localStorage.getItem('metrolist_favorites') || '[]');
    this.playlists = JSON.parse(localStorage.getItem('metrolist_playlists') || '[]');
    this.history = JSON.parse(localStorage.getItem('metrolist_history') || '[]');
    this.listeners = [];

    this._autoInit();
  }

  async _autoInit() {
    if (!this.userId) {
      await this.registerOrPair();
    }
    // Sincronización inicial
    this.pull();
  }

  onChange(cb) {
    this.listeners.push(cb);
  }

  _notify() {
    this.listeners.forEach(cb => cb({
      favorites: this.favorites,
      playlists: this.playlists,
      history: this.history,
      userId: this.userId,
      pairingCode: this.pairingCode
    }));
    // Guardar en local
    localStorage.setItem('metrolist_favorites', JSON.stringify(this.favorites));
    localStorage.setItem('metrolist_playlists', JSON.stringify(this.playlists));
    localStorage.setItem('metrolist_history', JSON.stringify(this.history));
  }

  // Generar o vincular ID
  async registerOrPair() {
    try {
      const res = await fetch('/api/auth/pair', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'create_or_get', userId: this.userId })
      });
      if (res.ok) {
        const data = await res.json();
        this.userId = data.userId;
        this.pairingCode = data.pairingCode;
        localStorage.setItem('metrolist_user_id', this.userId);
        localStorage.setItem('metrolist_pairing_code', this.pairingCode);
        this._notify();
      }
    } catch (e) {
      console.warn('Backend de autenticación no disponible, usando modo local:', e);
      if (!this.userId) {
        this.userId = 'local-' + Math.random().toString(36).substring(2, 9);
        this.pairingCode = Math.floor(100000 + Math.random() * 900000).toString();
        localStorage.setItem('metrolist_user_id', this.userId);
        localStorage.setItem('metrolist_pairing_code', this.pairingCode);
        this._notify();
      }
    }
  }

  // Vincular usando un PIN existente de la App de Android
  async pairWithCode(code) {
    try {
      const res = await fetch('/api/auth/pair', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'pair_with_code', pairingCode: code })
      });
      if (res.ok) {
        const data = await res.json();
        this.userId = data.userId;
        this.pairingCode = data.pairingCode;
        localStorage.setItem('metrolist_user_id', this.userId);
        localStorage.setItem('metrolist_pairing_code', this.pairingCode);
        await this.pull(0); // Descarga completa
        this._notify();
        return true;
      }
    } catch (e) {
      console.error('Error al vincular con código:', e);
    }
    return false;
  }

  // Favoritos
  isFavorite(songId) {
    return this.favorites.some(f => f.id === songId);
  }

  toggleFavorite(track) {
    const idx = this.favorites.findIndex(f => f.id === track.id);
    if (idx >= 0) {
      this.favorites.splice(idx, 1);
    } else {
      this.favorites.unshift({
        id: track.id,
        title: track.title,
        artists: track.artists || track.artist || 'Artista',
        album: track.album || '',
        duration: track.duration || 0,
        thumbnailUrl: track.thumbnailUrl || '',
        likedAt: Date.now()
      });
    }
    this._notify();
    this.push();
  }

  // Playlists
  createPlaylist(name, description = '') {
    const newPlaylist = {
      id: 'pl-' + Date.now() + '-' + Math.random().toString(36).substring(2, 5),
      name,
      description,
      thumbnailUrl: '',
      songs: [],
      createdAt: Date.now(),
      updatedAt: Date.now()
    };
    this.playlists.unshift(newPlaylist);
    this._notify();
    this.push();
    return newPlaylist;
  }

  addSongToPlaylist(playlistId, track) {
    const pl = this.playlists.find(p => p.id === playlistId);
    if (pl) {
      if (!pl.songs) pl.songs = [];
      if (!pl.songs.some(s => s.id === track.id)) {
        pl.songs.push({
          id: track.id,
          title: track.title,
          artists: track.artists || track.artist || 'Artista',
          album: track.album || '',
          duration: track.duration || 0,
          thumbnailUrl: track.thumbnailUrl || '',
          addedAt: Date.now()
        });
        pl.updatedAt = Date.now();
        if (!pl.thumbnailUrl && track.thumbnailUrl) {
          pl.thumbnailUrl = track.thumbnailUrl;
        }
        this._notify();
        this.push();
      }
    }
  }

  // Historial
  addHistory(track) {
    this.history = this.history.filter(h => h.id !== track.id);
    this.history.unshift({
      id: track.id,
      title: track.title,
      artists: track.artists || track.artist || 'Artista',
      album: track.album || '',
      duration: track.duration || 0,
      thumbnailUrl: track.thumbnailUrl || '',
      playedAt: Date.now()
    });
    if (this.history.length > 50) this.history.pop();
    this._notify();
    this.push();
  }

  // Push a Cloudflare D1
  async push() {
    if (!this.userId) return;
    try {
      await fetch('/api/sync/push', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-User-Id': this.userId
        },
        body: JSON.stringify({
          userId: this.userId,
          favorites: this.favorites,
          playlists: this.playlists,
          history: this.history
        })
      });
      this.lastSyncAt = Date.now();
      localStorage.setItem('metrolist_last_sync', this.lastSyncAt.toString());
    } catch (e) {
      console.warn('Sync push fallido:', e);
    }
  }

  // Pull de Cloudflare D1
  async pull(since = this.lastSyncAt) {
    if (!this.userId) return;
    try {
      const res = await fetch(`/api/sync/pull?userId=${this.userId}&since=${since}`);
      if (res.ok) {
        const data = await res.json();
        if (data.favorites && data.favorites.length > 0) {
          // Fusionar favoritos sin duplicados
          const map = new Map();
          [...data.favorites, ...this.favorites].forEach(f => map.set(f.id, f));
          this.favorites = Array.from(map.values());
        }
        if (data.playlists && data.playlists.length > 0) {
          const map = new Map();
          [...data.playlists, ...this.playlists].forEach(p => map.set(p.id, p));
          this.playlists = Array.from(map.values());
        }
        if (data.history && data.history.length > 0) {
          const map = new Map();
          [...data.history, ...this.history].forEach(h => map.set(h.id, h));
          this.history = Array.from(map.values());
        }
        this.lastSyncAt = data.syncedAt || Date.now();
        localStorage.setItem('metrolist_last_sync', this.lastSyncAt.toString());
        this._notify();
      }
    } catch (e) {
      console.warn('Sync pull fallido:', e);
    }
  }
}

export const sync = new SyncManager();
