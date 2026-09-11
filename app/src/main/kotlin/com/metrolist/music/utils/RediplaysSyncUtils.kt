/**
 * Rediplays Music Client (C) 2026
 * Licensed under GPL-3.0
 */

package com.metrolist.music.utils

import android.content.Context
import com.metrolist.music.api.RediplaysApi
import com.metrolist.music.constants.RediplaysSyncEnabledKey
import com.metrolist.music.constants.RediplaysTokenKey
import com.metrolist.music.db.MusicDatabase
import com.metrolist.music.db.entities.PlaylistEntity
import com.metrolist.music.db.entities.PlaylistSongMap
import com.metrolist.music.db.entities.SongEntity
import dagger.hilt.android.qualifiers.ApplicationContext
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.flow.firstOrNull
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import timber.log.Timber
import java.time.LocalDateTime
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class RediplaysSyncUtils @Inject constructor(
    @ApplicationContext private val context: Context,
    private val database: MusicDatabase,
) {
    private val scope = CoroutineScope(Dispatchers.IO + SupervisorJob())

    suspend fun getToken(): String? {
        return context.dataStore.data.firstOrNull()?.get(RediplaysTokenKey)?.takeIf { it.isNotBlank() }
    }

    suspend fun isSyncEnabled(): Boolean {
        val prefs = context.dataStore.data.firstOrNull()
        val token = prefs?.get(RediplaysTokenKey)
        // Default to false (opt-in): sync is only active if the user has explicitly enabled it.
        val enabled = prefs?.get(RediplaysSyncEnabledKey) ?: false
        return !token.isNullOrBlank() && enabled
    }

    fun syncFavoriteAsync(songId: String, isLiked: Boolean, title: String? = null, artist: String? = null) {
        scope.launch {
            if (!isSyncEnabled()) return@launch
            val token = getToken() ?: return@launch
            if (isLiked) {
                RediplaysApi.addFavorite(token, songId, title, artist)
            } else {
                RediplaysApi.removeFavorite(token, songId)
            }
        }
    }

    fun syncPlaylistAsync(playlistId: String, name: String, songIds: List<String>) {
        scope.launch {
            if (!isSyncEnabled()) return@launch
            val token = getToken() ?: return@launch
            RediplaysApi.createOrUpdatePlaylist(token, playlistId, name, songIds)
        }
    }

    suspend fun performFullSync(): Result<Unit> = withContext(Dispatchers.IO) {
        val token = getToken() ?: return@withContext Result.failure(Exception("Not logged in to Rediplays"))
        try {
            Timber.d("Rediplays: Starting full sync...")

            // 1. Sync User Profile
            val profileRes = RediplaysApi.getUserProfile(token)
            if (profileRes.isSuccess) {
                val profile = profileRes.getOrThrow()
                Timber.d("Rediplays: Profile synced: ${profile.name}")
            }

            // 2. Sync Favorites (Likes)
            val favsRes = RediplaysApi.getFavorites(token)
            if (favsRes.isSuccess) {
                val remoteFavIds = favsRes.getOrThrow()
                for (songId in remoteFavIds) {
                    val existingSong = database.song(songId).firstOrNull()?.song
                    if (existingSong != null && !existingSong.liked) {
                        database.update(existingSong.copy(liked = true, likedDate = LocalDateTime.now()))
                    }
                }
            }

            // 3. Sync Playlists
            val playlistsRes = RediplaysApi.getUserPlaylists(token)
            if (playlistsRes.isSuccess) {
                val remotePlaylists = playlistsRes.getOrThrow()
                for (p in remotePlaylists) {
                    val existingPlaylist = database.playlist(p.id).firstOrNull()
                    if (existingPlaylist == null) {
                        val newPlaylist = PlaylistEntity(
                            id = p.id,
                            name = p.name,
                            createdAt = LocalDateTime.now(),
                            lastUpdateTime = LocalDateTime.now(),
                        )
                        database.insert(newPlaylist)
                    }
                }
            }

            Timber.d("Rediplays: Full sync completed successfully")
            Result.success(Unit)
        } catch (e: Exception) {
            Timber.e(e, "Rediplays: Full sync failed")
            Result.failure(e)
        }
    }
}
