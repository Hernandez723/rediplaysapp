// Metrolist Web - YouTube Music API Client

export const YTMusic = {
  // Buscar contenido categorizado (canciones, artistas, álbumes, playlists)
  async search(query) {
    if (!query || !query.trim()) {
      return { songs: [], artists: [], albums: [], playlists: [], topResult: null, results: [] };
    }

    try {
      const res = await fetch(`/api/yt/search?q=${encodeURIComponent(query.trim())}`);
      if (res.ok) {
        const data = await res.json();
        if (data && typeof data === 'object') {
          return {
            songs: data.songs || data.results || [],
            artists: data.artists || [],
            albums: data.albums || [],
            playlists: data.playlists || [],
            topResult: data.topResult || null,
            results: data.results || data.songs || []
          };
        }
      }
    } catch (e) {
      console.warn('Error al consultar /api/yt/search:', e);
    }

    return { songs: [], artists: [], albums: [], playlists: [], topResult: null, results: [] };
  },

  // Obtener detalles, canciones y perfil de un artista
  async getArtist(artistName) {
    if (!artistName || !artistName.trim()) return null;

    try {
      const res = await fetch(`/api/yt/artist?name=${encodeURIComponent(artistName.trim())}`);
      if (res.ok) {
        return await res.json();
      }
    } catch (e) {
      console.warn('Error al consultar /api/yt/artist:', e);
    }

    return null;
  },

  // Obtener URL del flujo de audio
  async getStream(songId) {
    if (!songId) return null;

    try {
      const res = await fetch(`/api/yt/stream?id=${songId}`);
      if (res.ok) {
        const data = await res.json();
        if (data.url) return data.url;
      }
    } catch (e) {
      console.warn('Error al consultar /api/yt/stream:', e);
    }

    return null;
  },

  // Obtener sugerencias de autocompletado en vivo
  async getSuggestions(query) {
    if (!query || query.trim().length < 2) return [];
    try {
      const res = await fetch(`/api/yt/suggestions?q=${encodeURIComponent(query.trim())}`);
      if (res.ok) {
        const data = await res.json();
        return data.suggestions || [];
      }
    } catch (e) {}
    return [];
  },

  // Obtener categorías de Explorar (estados de ánimo, géneros, charts)
  async getExploreData() {
    try {
      const res = await fetch('/api/yt/explore');
      if (res.ok) {
        return await res.json();
      }
    } catch (e) {}
    return null;
  },

  // Obtener canciones de Radio / Autoplay
  async getRadio(songId) {
    if (!songId) return [];
    try {
      const res = await fetch(`/api/yt/radio?id=${songId}`);
      if (res.ok) {
        const data = await res.json();
        return data.tracks || [];
      }
    } catch (e) {}
    return [];
  },

  // Obtener letras
  async getLyrics(title, artist, duration = 0) {
    try {
      const res = await fetch(`/api/yt/lyrics?title=${encodeURIComponent(title)}&artist=${encodeURIComponent(artist)}&duration=${duration}`);
      if (res.ok) {
        return await res.json();
      }
    } catch (e) {
      console.warn('Error al consultar /api/yt/lyrics:', e);
    }

    return { plainLyrics: '', syncedLyrics: '' };
  }
};
