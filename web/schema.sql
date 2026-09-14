-- Esquema de Base de Datos para Cloudflare D1 (SQLite Serverless)
-- Compatible con la estructura de datos de Metrolist / Rediplays

-- Usuarios y dispositivos vinculados
CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    pairing_code TEXT UNIQUE,
    created_at INTEGER NOT NULL,
    last_sync_at INTEGER NOT NULL
);

-- Canciones Favoritas / Guardadas
CREATE TABLE IF NOT EXISTS favorites (
    user_id TEXT NOT NULL,
    song_id TEXT NOT NULL,
    title TEXT NOT NULL,
    artists TEXT NOT NULL,
    album TEXT,
    duration INTEGER DEFAULT 0,
    thumbnail_url TEXT,
    liked_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    PRIMARY KEY (user_id, song_id),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Listas de Reproducción (Playlists)
CREATE TABLE IF NOT EXISTS playlists (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    thumbnail_url TEXT,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Canciones en Listas de Reproducción
CREATE TABLE IF NOT EXISTS playlist_songs (
    playlist_id TEXT NOT NULL,
    song_id TEXT NOT NULL,
    position INTEGER NOT NULL,
    title TEXT NOT NULL,
    artists TEXT NOT NULL,
    album TEXT,
    duration INTEGER DEFAULT 0,
    thumbnail_url TEXT,
    added_at INTEGER NOT NULL,
    PRIMARY KEY (playlist_id, song_id),
    FOREIGN KEY (playlist_id) REFERENCES playlists(id) ON DELETE CASCADE
);

-- Historial de Reproducción
CREATE TABLE IF NOT EXISTS history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT NOT NULL,
    song_id TEXT NOT NULL,
    title TEXT NOT NULL,
    artists TEXT NOT NULL,
    album TEXT,
    duration INTEGER DEFAULT 0,
    thumbnail_url TEXT,
    played_at INTEGER NOT NULL,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Índices para optimizar consultas de sincronización
CREATE INDEX IF NOT EXISTS idx_favorites_user_updated ON favorites(user_id, updated_at);
CREATE INDEX IF NOT EXISTS idx_playlists_user_updated ON playlists(user_id, updated_at);
CREATE INDEX IF NOT EXISTS idx_history_user_played ON history(user_id, played_at DESC);
CREATE INDEX IF NOT EXISTS idx_users_pairing_code ON users(pairing_code);
