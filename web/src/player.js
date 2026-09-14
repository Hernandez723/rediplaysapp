// Metrolist Web - Audio Player Engine (Hybrid YouTube IFrame + HTML5 Audio)

import { YTMusic } from './yt-api.js';

class AudioPlayer {
  constructor() {
    this.currentTrack = null;
    this.queue = [];
    this.queueIndex = -1;
    this.isPlaying = false;
    this.isShuffle = false;
    this.repeatMode = 'none'; // 'none', 'all', 'one'
    this.lyrics = { plain: '', synced: [] };
    this.onStateChangeCallbacks = [];
    this.onTimeUpdateCallbacks = [];

    this.ytPlayer = null;
    this.isYtReady = false;
    this.timeUpdateTimer = null;

    this._initYouTubeIframe();
    this._initMediaSession();
  }

  _initYouTubeIframe() {
    // Cargar la API de YouTube si no está presente
    if (!window.YT) {
      const tag = document.createElement('script');
      tag.src = 'https://www.youtube.com/iframe_api';
      const firstScriptTag = document.getElementsByTagName('script')[0];
      firstScriptTag.parentNode.insertBefore(tag, firstScriptTag);
    }

    window.onYouTubeIframeAPIReady = () => {
      this.ytPlayer = new window.YT.Player('yt-player-frame', {
        height: '1',
        width: '1',
        playerVars: {
          autoplay: 1,
          controls: 0,
          disablekb: 1,
          fs: 0,
          rel: 0,
          modestbranding: 1,
          playsinline: 1,
          origin: window.location.origin
        },
        events: {
          onReady: () => {
            this.isYtReady = true;
          },
          onStateChange: (event) => {
            // YT.PlayerState.PLAYING = 1, PAUSED = 2, ENDED = 0, BUFFERING = 3
            if (event.data === window.YT.PlayerState.PLAYING) {
              this.isPlaying = true;
              this._startTimeUpdater();
              this._notifyState();
              this._updateMediaSessionState();
            } else if (event.data === window.YT.PlayerState.PAUSED) {
              this.isPlaying = false;
              this._stopTimeUpdater();
              this._notifyState();
              this._updateMediaSessionState();
            } else if (event.data === window.YT.PlayerState.ENDED) {
              this._stopTimeUpdater();
              if (this.repeatMode === 'one') {
                this.seek(0);
                this.play();
              } else {
                this.next();
              }
            }
          },
          onError: (err) => {
            console.warn('YouTube Player error code:', err.data);
            this.isPlaying = false;
            this._notifyState();
          }
        }
      });
    };

    // Si la API ya estaba lista
    if (window.YT && window.YT.Player) {
      window.onYouTubeIframeAPIReady();
    }
  }

  _startTimeUpdater() {
    this._stopTimeUpdater();
    this.timeUpdateTimer = setInterval(() => {
      if (this.ytPlayer && typeof this.ytPlayer.getCurrentTime === 'function') {
        const current = this.ytPlayer.getCurrentTime() || 0;
        const duration = this.ytPlayer.getDuration() || 0;
        this.onTimeUpdateCallbacks.forEach(cb => cb(current, duration));
      }
    }, 250);
  }

  _stopTimeUpdater() {
    if (this.timeUpdateTimer) {
      clearInterval(this.timeUpdateTimer);
      this.timeUpdateTimer = null;
    }
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

    // Reproducir vía YouTube Player Engine
    const play = () => {
      if (this.ytPlayer && typeof this.ytPlayer.loadVideoById === 'function') {
        this.ytPlayer.loadVideoById(track.id);
        this.ytPlayer.playVideo();
      } else {
        setTimeout(play, 200);
      }
    };
    play();
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
    if (this.ytPlayer && typeof this.ytPlayer.playVideo === 'function') {
      this.ytPlayer.playVideo();
    }
  }

  pause() {
    if (this.ytPlayer && typeof this.ytPlayer.pauseVideo === 'function') {
      this.ytPlayer.pauseVideo();
    }
  }

  togglePlay() {
    if (this.isPlaying) {
      this.pause();
    } else {
      this.play();
    }
  }

  seek(seconds) {
    if (this.ytPlayer && typeof this.ytPlayer.seekTo === 'function') {
      this.ytPlayer.seekTo(seconds, true);
    }
  }

  setVolume(fraction) {
    if (this.ytPlayer && typeof this.ytPlayer.setVolume === 'function') {
      this.ytPlayer.setVolume(Math.round(Math.max(0, Math.min(1, fraction)) * 100));
    }
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
    if (this.ytPlayer && typeof this.ytPlayer.getCurrentTime === 'function' && this.ytPlayer.getCurrentTime() > 3) {
      this.seek(0);
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
