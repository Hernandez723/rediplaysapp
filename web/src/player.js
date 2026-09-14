// Metrolist Web - Audio Player Engine

import { YTMusic } from './yt-api.js';

class AudioPlayer {
  constructor() {
    this.audio = new Audio();
    this.currentTrack = null;
    this.queue = [];
    this.queueIndex = -1;
    this.isPlaying = false;
    this.isShuffle = false;
    this.repeatMode = 'none'; // 'none', 'all', 'one'
    this.lyrics = { plain: '', synced: [] };
    this.onStateChangeCallbacks = [];
    this.onTimeUpdateCallbacks = [];

    this._initAudioEvents();
    this._initMediaSession();
  }

  _initAudioEvents() {
    this.audio.addEventListener('play', () => {
      this.isPlaying = true;
      this._notifyState();
      this._updateMediaSessionState();
    });

    this.audio.addEventListener('pause', () => {
      this.isPlaying = false;
      this._notifyState();
      this._updateMediaSessionState();
    });

    this.audio.addEventListener('timeupdate', () => {
      const current = this.audio.currentTime;
      const duration = this.audio.duration || 0;
      this.onTimeUpdateCallbacks.forEach(cb => cb(current, duration));
    });

    this.audio.addEventListener('ended', () => {
      if (this.repeatMode === 'one') {
        this.audio.currentTime = 0;
        this.audio.play();
      } else {
        this.next();
      }
    });

    this.audio.addEventListener('error', (e) => {
      console.error('Error al reproducir audio:', e);
      this._notifyState();
    });
  }

  _initMediaSession() {
    if ('mediaSession' in navigator) {
      navigator.mediaSession.setActionHandler('play', () => this.play());
      navigator.mediaSession.setActionHandler('pause', () => this.pause());
      navigator.mediaSession.setActionHandler('previoustrack', () => this.prev());
      navigator.mediaSession.setActionHandler('nexttrack', () => this.next());
      navigator.mediaSession.setActionHandler('seekto', (details) => {
        if (details.seekTime) this.seek(details.seekTime);
      });
    }
  }

  _updateMediaSessionState() {
    if ('mediaSession' in navigator) {
      navigator.mediaSession.playbackState = this.isPlaying ? 'playing' : 'paused';
    }
  }

  _updateMediaSessionMetadata() {
    if ('mediaSession' in navigator && this.currentTrack) {
      navigator.mediaSession.metadata = new MediaMetadata({
        title: this.currentTrack.title,
        artist: this.currentTrack.artists || this.currentTrack.artist || 'Artista',
        album: this.currentTrack.album || 'Metrolist',
        artwork: [
          { src: this.currentTrack.thumbnailUrl, sizes: '512x512', type: 'image/jpeg' }
        ]
      });
    }
  }

  async playTrack(track, queue = null) {
    if (queue) {
      this.queue = [...queue];
      this.queueIndex = this.queue.findIndex(t => t.id === track.id);
      if (this.queueIndex === -1) {
        this.queue.unshift(track);
        this.queueIndex = 0;
      }
    }

    this.currentTrack = track;
    this._updateMediaSessionMetadata();
    this._notifyState();

    // Cargar letras en segundo plano
    this.loadLyrics(track);

    // Obtener stream de audio
    const streamUrl = await YTMusic.getStream(track.id);
    if (!streamUrl) {
      alert('No se pudo obtener el audio de esta canción.');
      return;
    }

    this.audio.src = streamUrl;
    try {
      await this.audio.play();
    } catch (err) {
      console.warn('Autoplay bloqueado por el navegador o error:', err);
    }
  }

  async loadLyrics(track) {
    this.lyrics = { plain: '', synced: [] };
    const data = await YTMusic.getLyrics(track.title, track.artists || track.artist, track.duration);
    if (data.syncedLyrics) {
      this.lyrics.synced = this._parseLrc(data.syncedLyrics);
    }
    this.lyrics.plain = data.plainLyrics || '';
    this._notifyState();
  }

  _parseLrc(lrcText) {
    const lines = lrcText.split('\n');
    const result = [];
    const timeRegex = /\[(\d{2}):(\d{2})\.(\d{2,3})\]/;

    for (const line of lines) {
      const match = timeRegex.exec(line);
      if (match) {
        const min = parseInt(match[1], 10);
        const sec = parseInt(match[2], 10);
        const ms = parseFloat('0.' + match[3]);
        const time = min * 60 + sec + ms;
        const text = line.replace(timeRegex, '').trim();
        if (text) {
          result.push({ time, text });
        }
      }
    }
    return result;
  }

  play() {
    this.audio.play();
  }

  pause() {
    this.audio.pause();
  }

  togglePlay() {
    if (this.isPlaying) {
      this.pause();
    } else {
      this.play();
    }
  }

  seek(seconds) {
    this.audio.currentTime = seconds;
  }

  setVolume(fraction) {
    this.audio.volume = Math.max(0, Math.min(1, fraction));
  }

  next() {
    if (this.queue.length === 0) return;
    if (this.isShuffle) {
      this.queueIndex = Math.floor(Math.random() * this.queue.length);
    } else {
      this.queueIndex = (this.queueIndex + 1) % this.queue.length;
    }
    this.playTrack(this.queue[this.queueIndex]);
  }

  prev() {
    if (this.audio.currentTime > 3) {
      this.audio.currentTime = 0;
      return;
    }
    if (this.queue.length === 0) return;
    this.queueIndex = (this.queueIndex - 1 + this.queue.length) % this.queue.length;
    this.playTrack(this.queue[this.queueIndex]);
  }

  onStateChange(cb) {
    this.onStateChangeCallbacks.push(cb);
  }

  onTimeUpdate(cb) {
    this.onTimeUpdateCallbacks.push(cb);
  }

  _notifyState() {
    this.onStateChangeCallbacks.forEach(cb => cb({
      track: this.currentTrack,
      isPlaying: this.isPlaying,
      queue: this.queue,
      lyrics: this.lyrics,
      repeatMode: this.repeatMode,
      isShuffle: this.isShuffle
    }));
  }
}

export const player = new AudioPlayer();
