package com.metrolist.music.ui.theme

import androidx.compose.ui.text.font.Font
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.googlefonts.Font
import androidx.compose.ui.text.googlefonts.GoogleFont
import com.metrolist.music.R

val bbhBartle = FontFamily(
    Font(R.font.bbh_bartle_regular, FontWeight.Normal)
)

val provider = GoogleFont.Provider(
    providerAuthority = "com.google.android.gms.fonts",
    providerPackage = "com.google.android.gms",
    certificates = R.array.com_google_android_gms_fonts_certs
)

val MontserratFont = GoogleFont("Montserrat")

val Montserrat = FontFamily(
    Font(googleFont = MontserratFont, fontProvider = provider),
    Font(googleFont = MontserratFont, fontProvider = provider, weight = FontWeight.Bold),
    Font(googleFont = MontserratFont, fontProvider = provider, weight = FontWeight.Black),
)
