/**
 * Metrolist Project (C) 2026
 * Licensed under GPL-3.0 | See git history for contributors
 */

package com.metrolist.music.sync

import android.content.Context
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import org.json.JSONArray
import org.json.JSONObject
import java.io.BufferedReader
import java.io.InputStreamReader
import java.io.OutputStreamWriter
import java.net.HttpURLConnection
import java.net.URL

/**
 * Cliente de Sincronización en la Nube con Cloudflare Workers y D1
 * Diseñado para sincronizar favoritos y playlists sin alterar la base de datos local ni el funcionamiento offline.
 */
object CloudSyncManager {
    private const val PREFS_NAME = "metrolist_cloud_sync_prefs"
    private const val KEY_SERVER_URL = "server_url"
    private const val KEY_USER_ID = "user_id"
    private const val KEY_PAIRING_CODE = "pairing_code"
    private const val KEY_LAST_SYNC = "last_sync_timestamp"

    // URL por defecto (configurable por el usuario)
    private const val DEFAULT_SERVER_URL = "https://metrolist-web.pages.dev"

    fun getServerUrl(context: Context): String {
        return context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
            .getString(KEY_SERVER_URL, DEFAULT_SERVER_URL) ?: DEFAULT_SERVER_URL
    }

    fun setServerUrl(context: Context, url: String) {
        context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
            .edit()
            .putString(KEY_SERVER_URL, url.trimEnd('/'))
            .apply()
    }

    fun getUserId(context: Context): String? {
        return context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
            .getString(KEY_USER_ID, null)
    }

    fun getPairingCode(context: Context): String? {
        return context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
            .getString(KEY_PAIRING_CODE, null)
    }

    private fun saveCredentials(context: Context, userId: String, pairingCode: String) {
        context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
            .edit()
            .putString(KEY_USER_ID, userId)
            .putString(KEY_PAIRING_CODE, pairingCode)
            .apply()
    }

    /**
     * Vincula el dispositivo Android con un PIN de 6 dígitos mostrado en la web.
     */
    suspend fun pairWithCode(context: Context, pairingCode: String): Boolean = withContext(Dispatchers.IO) {
        try {
            val baseUrl = getServerUrl(context)
            val url = URL("$baseUrl/api/auth/pair")
            val conn = (url.openConnection() as HttpURLConnection).apply {
                requestMethod = "POST"
                setRequestProperty("Content-Type", "application/json")
                doOutput = true
                connectTimeout = 8000
                readTimeout = 8000
            }

            val jsonBody = JSONObject().apply {
                put("action", "pair_with_code")
                put("pairingCode", pairingCode.trim())
            }

            OutputStreamWriter(conn.outputStream).use { writer ->
                writer.write(jsonBody.toString())
                writer.flush()
            }

            if (conn.responseCode in 200..299) {
                val responseText = BufferedReader(InputStreamReader(conn.inputStream)).use { it.readText() }
                val json = JSONObject(responseText)
                if (json.optBoolean("success", false)) {
                    val uid = json.getString("userId")
                    val code = json.getString("pairingCode")
                    saveCredentials(context, uid, code)
                    return@withContext true
                }
            }
        } catch (e: Exception) {
            e.printStackTrace()
        }
        return@withContext false
    }

    /**
     * Envía las canciones favoritas locales al Worker de Cloudflare D1
     */
    suspend fun pushFavorites(
        context: Context,
        favoritesList: List<Map<String, Any?>>
    ): Boolean = withContext(Dispatchers.IO) {
        val userId = getUserId(context) ?: return@withContext false
        try {
            val baseUrl = getServerUrl(context)
            val url = URL("$baseUrl/api/sync/push")
            val conn = (url.openConnection() as HttpURLConnection).apply {
                requestMethod = "POST"
                setRequestProperty("Content-Type", "application/json")
                setRequestProperty("X-User-Id", userId)
                doOutput = true
                connectTimeout = 10000
                readTimeout = 10000
            }

            val favArray = JSONArray()
            for (fav in favoritesList) {
                val obj = JSONObject().apply {
                    put("id", fav["id"])
                    put("title", fav["title"])
                    put("artists", fav["artists"])
                    put("album", fav["album"])
                    put("duration", fav["duration"])
                    put("thumbnailUrl", fav["thumbnailUrl"])
                    put("likedAt", fav["likedAt"])
                }
                favArray.put(obj)
            }

            val body = JSONObject().apply {
                put("userId", userId)
                put("favorites", favArray)
            }

            OutputStreamWriter(conn.outputStream).use { writer ->
                writer.write(body.toString())
                writer.flush()
            }

            return@withContext conn.responseCode in 200..299
        } catch (e: Exception) {
            e.printStackTrace()
            return@withContext false
        }
    }
}
