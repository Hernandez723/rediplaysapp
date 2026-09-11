/**
 * Rediplays Music Client (C) 2026
 * Licensed under GPL-3.0
 */

package com.metrolist.music.utils

import android.app.Activity
import android.content.Context
import com.google.android.gms.ads.AdError
import com.google.android.gms.ads.AdRequest
import com.google.android.gms.ads.FullScreenContentCallback
import com.google.android.gms.ads.LoadAdError
import com.google.android.gms.ads.MobileAds
import com.google.android.gms.ads.rewarded.RewardItem
import com.google.android.gms.ads.rewarded.RewardedAd
import com.google.android.gms.ads.rewarded.RewardedAdLoadCallback
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.asStateFlow
import timber.log.Timber

object RewardedAdManager {
    const val REWARDED_AD_UNIT_ID = "ca-app-pub-3495861259467529/4254735466"

    private var rewardedAd: RewardedAd? = null
    private var isLoading = false

    private val _isAdReady = MutableStateFlow(false)
    val isAdReady = _isAdReady.asStateFlow()


    fun loadRewardedAd(context: Context, onLoaded: (() -> Unit)? = null, onFailed: ((String) -> Unit)? = null) {
        if (isLoading) return
        if (rewardedAd != null) {
            _isAdReady.value = true
            onLoaded?.invoke()
            return
        }

        isLoading = true

        // Initialize MobileAds lazily on first ad request (not at app startup),
        // so the SDK only collects device/advertising data when the user actively opts in.
        MobileAds.initialize(context.applicationContext) {
            Timber.d("AdMob: Initialized on first ad request")
            val adRequest = AdRequest.Builder().build()
            RewardedAd.load(
                context,
                REWARDED_AD_UNIT_ID,
                adRequest,
                object : RewardedAdLoadCallback() {
                    override fun onAdLoaded(ad: RewardedAd) {
                        Timber.d("AdMob: Rewarded ad loaded successfully")
                        rewardedAd = ad
                        isLoading = false
                        _isAdReady.value = true
                        onLoaded?.invoke()
                    }

                    override fun onAdFailedToLoad(loadAdError: LoadAdError) {
                        Timber.w("AdMob: Failed to load rewarded ad: ${loadAdError.message} (code: ${loadAdError.code})")
                        rewardedAd = null
                        isLoading = false
                        _isAdReady.value = false
                        onFailed?.invoke(loadAdError.message)
                    }
                }
            )
        }
    }


    fun showRewardedAd(
        activity: Activity,
        onRewardEarned: (RewardItem) -> Unit,
        onAdClosed: () -> Unit = {},
        onAdFailed: (String) -> Unit = {},
    ) {
        val currentAd = rewardedAd
        if (currentAd == null) {
            Timber.w("AdMob: Rewarded ad was not ready. Loading now...")
            loadRewardedAd(
                context = activity,
                onLoaded = {
                    showRewardedAd(activity, onRewardEarned, onAdClosed, onAdFailed)
                },
                onFailed = { error ->
                    onAdFailed(error)
                }
            )
            return
        }

        var rewardGranted = false

        currentAd.fullScreenContentCallback = object : FullScreenContentCallback() {
            override fun onAdDismissedFullScreenContent() {
                Timber.d("AdMob: Rewarded ad dismissed")
                rewardedAd = null
                _isAdReady.value = false
                // Preload the next ad
                loadRewardedAd(activity.applicationContext)
                onAdClosed()
            }

            override fun onAdFailedToShowFullScreenContent(adError: AdError) {
                Timber.e("AdMob: Failed to show rewarded ad: ${adError.message}")
                rewardedAd = null
                _isAdReady.value = false
                loadRewardedAd(activity.applicationContext)
                onAdFailed(adError.message)
            }

            override fun onAdShowedFullScreenContent() {
                Timber.d("AdMob: Rewarded ad showing full screen")
            }
        }

        currentAd.show(activity) { rewardItem ->
            rewardGranted = true
            Timber.d("AdMob: User earned reward: ${rewardItem.amount} ${rewardItem.type}")
            onRewardEarned(rewardItem)
        }
    }
}
