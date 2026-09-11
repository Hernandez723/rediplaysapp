/**
 * Rediplays Music Client (C) 2026
 * Licensed under GPL-3.0
 */

package com.metrolist.music.di

import com.metrolist.music.utils.RediplaysSyncUtils
import dagger.hilt.EntryPoint
import dagger.hilt.InstallIn
import dagger.hilt.components.SingletonComponent

@EntryPoint
@InstallIn(SingletonComponent::class)
interface RediplaysSyncEntryPoint {
    fun rediplaysSyncUtils(): RediplaysSyncUtils
}
