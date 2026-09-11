/**
 * Rediplays Music Client (C) 2026
 * Licensed under GPL-3.0
 */

package com.metrolist.music.api

import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import okhttp3.Headers
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import org.json.JSONArray
import org.json.JSONObject
import timber.log.Timber
import java.util.concurrent.TimeUnit

data class RediplaysUserProfile(
    val id: String,
    val name: String,
    val email: String? = null,
    val avatarUrl: String? = null,
)

data class RediplaysAuthResult(
    val token: String,
    val user: RediplaysUserProfile,
)

data class RediplaysPlaylist(
    val id: String,
    val name: String,
    val songIds: List<String> = emptyList(),
)

object RediplaysApi {
    private const val BASE_URL = "https://rediplays.com/api/v1"
    private val JSON = "application/json; charset=utf-8".toMediaType()

    private val client = OkHttpClient.Builder()
        .connectTimeout(15, TimeUnit.SECONDS)
        .readTimeout(30, TimeUnit.SECONDS)
        .writeTimeout(30, TimeUnit.SECONDS)
        .build()

    suspend fun loginWithPassword(email: String, password: String): Result<RediplaysAuthResult> = withContext(Dispatchers.IO) {
        try {
            val payload = JSONObject().apply {
                put("email", email.trim())
                put("password", password)
                put("token_name", "Rediplays Android")
            }
            val request = Request.Builder()
                .url("$BASE_URL/auth/login")
                .header("Accept", "application/json")
                .post(payload.toString().toRequestBody(JSON))
                .build()

            client.newCall(request).execute().use { response ->
                val body = response.body?.string().orEmpty()
                // Log only the status code, NOT the body — it contains the auth token.
                Timber.d("RediplaysApi: loginWithPassword status=${response.code}")
                if (!response.isSuccessful) {
                    val errorMsg = parseErrorMessage(body, "Credenciales incorrectas o error en el servidor (${response.code})")
                    return@withContext Result.failure(Exception(errorMsg))
                }
                parseAuthResponse(body, email, response.headers)
            }
        } catch (e: Exception) {
            Timber.e(e, "RediplaysApi: Error logging in with password")
            Result.failure(Exception(e.localizedMessage ?: "Error de conexión al servidor"))
        }
    }

    suspend fun loginWithOtp(email: String, code: String): Result<RediplaysAuthResult> = withContext(Dispatchers.IO) {
        try {
            val payload = JSONObject().apply {
                put("email", email.trim())
                put("code", code.trim())
            }
            val request = Request.Builder()
                .url("$BASE_URL/tv/login-with-otp")
                .header("Accept", "application/json")
                .post(payload.toString().toRequestBody(JSON))
                .build()

            client.newCall(request).execute().use { response ->
                val body = response.body?.string().orEmpty()
                // Log only the status code, NOT the body — it contains the auth token.
                Timber.d("RediplaysApi: loginWithOtp status=${response.code}")
                if (!response.isSuccessful) {
                    val errorMsg = parseErrorMessage(body, "Código OTP inválido o expirado (${response.code})")
                    return@withContext Result.failure(Exception(errorMsg))
                }
                parseAuthResponse(body, email, response.headers)
            }
        } catch (e: Exception) {
            Timber.e(e, "RediplaysApi: Error logging in with OTP")
            Result.failure(Exception(e.localizedMessage ?: "Error de conexión al servidor"))
        }
    }

    private fun parseErrorMessage(body: String, defaultMsg: String): String {
        return try {
            val json = JSONObject(body)
            if (json.has("message")) {
                val msg = json.getString("message")
                val errors = json.optJSONObject("errors")
                if (errors != null) {
                    val keys = errors.keys()
                    if (keys.hasNext()) {
                        val firstKey = keys.next()
                        val arr = errors.optJSONArray(firstKey)
                        if (arr != null && arr.length() > 0) {
                            return arr.getString(0)
                        }
                    }
                }
                return msg
            }
            defaultMsg
        } catch (e: Exception) {
            defaultMsg
        }
    }

    private fun parseAuthResponse(body: String, fallbackEmail: String, headers: Headers? = null): Result<RediplaysAuthResult> {
        return try {
            var token: String? = null
            var userObj: JSONObject? = null

            if (body.isNotBlank() && (body.trim().startsWith("{") || body.trim().startsWith("["))) {
                val json = JSONObject(body)
                token = findTokenRecursive(json)
                userObj = findUserRecursive(json)
            }

            // Fallback to headers if token not found in JSON
            if (token.isNullOrBlank() && headers != null) {
                token = headers.get("Authorization")?.removePrefix("Bearer ")?.trim()
                if (token.isNullOrBlank()) {
                    val cookies = headers.values("Set-Cookie")
                    for (cookie in cookies) {
                        if (cookie.contains("laravel_session=") || cookie.contains("token=")) {
                            token = cookie.substringBefore(";")
                            break
                        }
                    }
                }
            }

            if (token.isNullOrBlank()) {
                Timber.w("RediplaysApi: No token found in body: $body")
                return Result.failure(Exception("No se encontró el token en la respuesta del servidor. Respuesta: ${body.take(150)}"))
            }

            val userId = userObj?.optString("id", userObj.optString("userId", "")) ?: ""
            val name = userObj?.optString("name", userObj.optString("username", fallbackEmail.substringBefore("@"))) ?: fallbackEmail.substringBefore("@")
            val email = userObj?.optString("email", fallbackEmail) ?: fallbackEmail
            val avatarUrl = userObj?.optString("avatar", userObj.optString("avatarUrl", ""))?.takeIf { it.isNotBlank() }

            Result.success(
                RediplaysAuthResult(
                    token = token,
                    user = RediplaysUserProfile(
                        id = userId,
                        name = name,
                        email = email,
                        avatarUrl = avatarUrl,
                    )
                )
            )
        } catch (e: Exception) {
            Timber.e(e, "RediplaysApi: Error parsing auth response")
            Result.failure(Exception("Error al procesar la respuesta: ${e.localizedMessage}"))
        }
    }

    private fun findTokenRecursive(json: Any?): String? {
        when (json) {
            is JSONObject -> {
                val tokenKeys = listOf(
                    "plainTextToken",
                    "token",
                    "access_token",
                    "accessToken",
                    "auth_token",
                    "jwt",
                    "api_token",
                    "bearer_token",
                    "token_key",
                    "key"
                )
                for (key in tokenKeys) {
                    if (json.has(key)) {
                        val value = json.get(key)
                        if (value is String && value.isNotBlank()) {
                            return value
                        } else if (value is JSONObject) {
                            val nested = findTokenRecursive(value)
                            if (!nested.isNullOrBlank()) return nested
                        }
                    }
                }
                val keys = json.keys()
                while (keys.hasNext()) {
                    val key = keys.next()
                    val child = json.get(key)
                    if (child is JSONObject || child is JSONArray) {
                        val nested = findTokenRecursive(child)
                        if (!nested.isNullOrBlank()) return nested
                    }
                }
            }
            is JSONArray -> {
                for (i in 0 until json.length()) {
                    val nested = findTokenRecursive(json.get(i))
                    if (!nested.isNullOrBlank()) return nested
                }
            }
        }
        return null
    }

    private fun findUserRecursive(json: Any?): JSONObject? {
        if (json !is JSONObject) return null
        if (json.has("email") && (json.has("name") || json.has("username") || json.has("id"))) {
            return json
        }
        val userKeys = listOf("user", "user_profile", "profile", "account", "data", "bootstrapData")
        for (key in userKeys) {
            val child = json.optJSONObject(key)
            if (child != null) {
                val found = findUserRecursive(child)
                if (found != null) return found
            }
        }
        val keys = json.keys()
        while (keys.hasNext()) {
            val key = keys.next()
            val child = json.optJSONObject(key)
            if (child != null) {
                val found = findUserRecursive(child)
                if (found != null) return found
            }
        }
        return null
    }

    suspend fun getUserProfile(token: String): Result<RediplaysUserProfile> = withContext(Dispatchers.IO) {
        try {
            val request = Request.Builder()
                .url("$BASE_URL/user/profile")
                .header("Authorization", "Bearer $token")
                .header("Accept", "application/json")
                .get()
                .build()

            client.newCall(request).execute().use { response ->
                if (!response.isSuccessful) {
                    return@withContext Result.failure(Exception("HTTP error: ${response.code}"))
                }
                val body = response.body?.string() ?: return@withContext Result.failure(Exception("Empty body"))
                val json = JSONObject(body)
                val userObj = if (json.has("user")) json.getJSONObject("user") else json
                Result.success(
                    RediplaysUserProfile(
                        id = userObj.optString("id", userObj.optString("userId", "")),
                        name = userObj.optString("name", userObj.optString("username", "")),
                        email = userObj.optString("email").takeIf { it.isNotBlank() },
                        avatarUrl = userObj.optString("avatarUrl", userObj.optString("avatar", "")).takeIf { it.isNotBlank() },
                    )
                )
            }
        } catch (e: Exception) {
            Timber.e(e, "RediplaysApi: Failed to fetch user profile")
            Result.failure(e)
        }
    }

    suspend fun getFavorites(token: String): Result<List<String>> = withContext(Dispatchers.IO) {
        try {
            val request = Request.Builder()
                .url("$BASE_URL/favorites")
                .header("Authorization", "Bearer $token")
                .header("Accept", "application/json")
                .get()
                .build()

            client.newCall(request).execute().use { response ->
                if (!response.isSuccessful) {
                    return@withContext Result.failure(Exception("HTTP error: ${response.code}"))
                }
                val body = response.body?.string() ?: return@withContext Result.failure(Exception("Empty body"))
                val list = mutableListOf<String>()
                if (body.trimStart().startsWith("[")) {
                    val array = JSONArray(body)
                    for (i in 0 until array.length()) {
                        val item = array.get(i)
                        if (item is JSONObject) {
                            list.add(item.optString("songId", item.optString("id", "")))
                        } else if (item is String) {
                            list.add(item)
                        }
                    }
                } else {
                    val json = JSONObject(body)
                    val array = json.optJSONArray("favorites") ?: json.optJSONArray("songs") ?: JSONArray()
                    for (i in 0 until array.length()) {
                        val item = array.get(i)
                        if (item is JSONObject) {
                            list.add(item.optString("songId", item.optString("id", "")))
                        } else if (item is String) {
                            list.add(item)
                        }
                    }
                }
                Result.success(list.filter { it.isNotBlank() })
            }
        } catch (e: Exception) {
            Timber.e(e, "RediplaysApi: Failed to fetch favorites")
            Result.failure(e)
        }
    }

    suspend fun addFavorite(
        token: String,
        songId: String,
        title: String? = null,
        artist: String? = null,
    ): Result<Unit> = withContext(Dispatchers.IO) {
        try {
            val payload = JSONObject().apply {
                put("songId", songId)
                put("title", title.orEmpty())
                put("artist", artist.orEmpty())
            }
            val request = Request.Builder()
                .url("$BASE_URL/favorites")
                .header("Authorization", "Bearer $token")
                .header("Accept", "application/json")
                .post(payload.toString().toRequestBody(JSON))
                .build()

            client.newCall(request).execute().use { response ->
                if (response.isSuccessful) {
                    Result.success(Unit)
                } else {
                    Result.failure(Exception("HTTP ${response.code}"))
                }
            }
        } catch (e: Exception) {
            Timber.e(e, "RediplaysApi: Failed to add favorite $songId")
            Result.failure(e)
        }
    }

    suspend fun removeFavorite(token: String, songId: String): Result<Unit> = withContext(Dispatchers.IO) {
        try {
            val request = Request.Builder()
                .url("$BASE_URL/favorites/$songId")
                .header("Authorization", "Bearer $token")
                .header("Accept", "application/json")
                .delete()
                .build()

            client.newCall(request).execute().use { response ->
                if (response.isSuccessful) {
                    Result.success(Unit)
                } else {
                    Result.failure(Exception("HTTP ${response.code}"))
                }
            }
        } catch (e: Exception) {
            Timber.e(e, "RediplaysApi: Failed to remove favorite $songId")
            Result.failure(e)
        }
    }

    suspend fun recordHistory(
        token: String,
        songId: String,
        title: String? = null,
        artist: String? = null,
    ): Result<Unit> = withContext(Dispatchers.IO) {
        try {
            val payload = JSONObject().apply {
                put("songId", songId)
                put("title", title.orEmpty())
                put("artist", artist.orEmpty())
            }
            val request = Request.Builder()
                .url("$BASE_URL/history")
                .header("Authorization", "Bearer $token")
                .header("Accept", "application/json")
                .post(payload.toString().toRequestBody(JSON))
                .build()

            client.newCall(request).execute().use { response ->
                if (response.isSuccessful) {
                    Result.success(Unit)
                } else {
                    Result.failure(Exception("HTTP ${response.code}"))
                }
            }
        } catch (e: Exception) {
            Timber.w(e, "RediplaysApi: Failed to record history for $songId")
            Result.failure(e)
        }
    }

    suspend fun getUserPlaylists(token: String): Result<List<RediplaysPlaylist>> = withContext(Dispatchers.IO) {
        try {
            val request = Request.Builder()
                .url("$BASE_URL/playlists")
                .header("Authorization", "Bearer $token")
                .header("Accept", "application/json")
                .get()
                .build()

            client.newCall(request).execute().use { response ->
                if (!response.isSuccessful) {
                    return@withContext Result.failure(Exception("HTTP error: ${response.code}"))
                }
                val body = response.body?.string() ?: return@withContext Result.failure(Exception("Empty body"))
                val list = mutableListOf<RediplaysPlaylist>()
                val array = if (body.trimStart().startsWith("[")) {
                    JSONArray(body)
                } else {
                    val json = JSONObject(body)
                    json.optJSONArray("playlists") ?: JSONArray()
                }
                for (i in 0 until array.length()) {
                    val obj = array.optJSONObject(i) ?: continue
                    val pId = obj.optString("id", "")
                    val pName = obj.optString("name", obj.optString("title", "Playlist"))
                    val songIdsList = mutableListOf<String>()
                    val songsArray = obj.optJSONArray("songs") ?: obj.optJSONArray("songIds")
                    if (songsArray != null) {
                        for (j in 0 until songsArray.length()) {
                            val songItem = songsArray.get(j)
                            if (songItem is JSONObject) {
                                songIdsList.add(songItem.optString("id", songItem.optString("songId", "")))
                            } else if (songItem is String) {
                                songIdsList.add(songItem)
                            }
                        }
                    }
                    if (pId.isNotBlank()) {
                        list.add(RediplaysPlaylist(id = pId, name = pName, songIds = songIdsList.filter { it.isNotBlank() }))
                    }
                }
                Result.success(list)
            }
        } catch (e: Exception) {
            Timber.e(e, "RediplaysApi: Failed to fetch playlists")
            Result.failure(e)
        }
    }

    suspend fun createOrUpdatePlaylist(
        token: String,
        playlistId: String,
        name: String,
        songIds: List<String>,
    ): Result<Unit> = withContext(Dispatchers.IO) {
        try {
            val payload = JSONObject().apply {
                put("id", playlistId)
                put("name", name)
                put("songs", JSONArray(songIds))
            }
            val request = Request.Builder()
                .url("$BASE_URL/playlists")
                .header("Authorization", "Bearer $token")
                .header("Accept", "application/json")
                .post(payload.toString().toRequestBody(JSON))
                .build()

            client.newCall(request).execute().use { response ->
                if (response.isSuccessful) {
                    Result.success(Unit)
                } else {
                    Result.failure(Exception("HTTP ${response.code}"))
                }
            }
        } catch (e: Exception) {
            Timber.e(e, "RediplaysApi: Failed to sync playlist $playlistId")
            Result.failure(e)
        }
    }
}
