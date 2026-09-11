<div align="center">

# 🎵 RediPlays

### Plataforma moderna de streaming de música para Android  
### *Modern Music Streaming Client for Android*

<br/>

[![License](https://img.shields.io/badge/License-GPL--3.0-blue.svg?style=for-the-badge&labelColor=0d1117)](LICENSE)
[![Kotlin](https://img.shields.io/badge/Kotlin-93.8%25-7F52FF.svg?style=for-the-badge&logo=kotlin&logoColor=white&labelColor=0d1117)](https://kotlinlang.org)
[![GitHub stars](https://img.shields.io/github/stars/Hernandez723/rediplaysapp?style=for-the-badge&labelColor=0d1117)](https://github.com/Hernandez723/rediplaysapp/stargazers)
[![GitHub forks](https://img.shields.io/github/forks/Hernandez723/rediplaysapp?style=for-the-badge&labelColor=0d1117)](https://github.com/Hernandez723/rediplaysapp/network/members)

<br/>

[🇪🇸 **Español**](#-español) · [🇬🇧 **English**](#-english) · [📥 **Descargar / Download**](#-descargas--downloads) · [🛠️ **Compilación / Build**](#-compilación-y-desarrollo--build--development)

</div>

---

# 🇪🇸 Español

**RediPlays** es un cliente de streaming de música y reproducción de audio en tiempo real para Android, diseñado bajo los lineamientos modernos de **Material 3**. Permite disfrutar de tu música favorita con funciones avanzadas como letras sincronizadas, reproducción en segundo plano y modo sin conexión.

### ✨ Características Principales

<table>
  <tr>
    <td width="50%" valign="top">

#### 🎧 Reproducción y Audio
- **Streaming continuo:** Reproduce cualquier canción o video de YouTube Music.
- **Segundo plano:** Música sin interrupciones con la pantalla apagada o en otras apps.
- **Descargas sin conexión:** Guarda y almacena en caché canciones y listas.
- **Audio avanzado:** Normalización de volumen, ecualizador integrado y control de tono y velocidad.
- **Temporizador:** Apagado automático programable y salto de silencios.

</td>
    <td width="50%" valign="top">

#### 📜 Letras y Descubrimiento
- **Letras sincronizadas en vivo:** Sigue la letra palabra por palabra en tiempo real.
- **Traducción de letras:** Traducción asistida para canciones en otros idiomas.
- **Búsqueda completa:** Canciones, artistas, álbumes, videos y listas de reproducción.
- **Reconocimiento musical:** Identifica canciones al instante.

</td>
  </tr>
  <tr>
    <td width="50%" valign="top">

#### 📚 Biblioteca y Listas
- **Gestión total:** Crea listas locales, importa playlists y organiza tu cola.
- **Sincronización de cuenta:** Inicia sesión con tu cuenta de YouTube Music.
- **Escucha en grupo:** Reproducción compartida con amigos en tiempo real.

</td>
    <td width="50%" valign="top">

#### 🎨 Interfaz y Personalización
- **Diseño Material 3:** Interfaz moderna y fluida.
- **Temas:** Claro, Oscuro, Negro Puro (AMOLED) y color dinámico (Material You).
- **Paletas:** Más de 19 temas de colores preestablecidos.
- **Widgets:** Control rápido desde la pantalla de inicio.

</td>
  </tr>
</table>

---

# 🇬🇧 English

**RediPlays** is a modern music streaming client and real-time audio player for Android, crafted following **Material 3** design principles. Enjoy your favorite music with rich features including live synced lyrics, background playback, and offline listening.

### ✨ Key Features

<table>
  <tr>
    <td width="50%" valign="top">

#### 🎧 Playback & Audio
- **Seamless Streaming:** Play any track or video from YouTube Music.
- **Background Playback:** Listen with screen off or while using other apps.
- **Offline Mode:** Download and cache tracks and playlists.
- **Advanced Audio:** Audio normalization, built-in equalizer, tempo and pitch controls.
- **Smart Tools:** Sleep timer and skip silence support.

</td>
    <td width="50%" valign="top">

#### 📜 Lyrics & Discovery
- **Live Synced Lyrics:** Real-time word-by-word highlighted lyrics.
- **Lyrics Translation:** AI-powered translation for multi-language tracks.
- **Comprehensive Search:** Find tracks, artists, albums, videos, and playlists.
- **Music Recognition:** Instant song identification.

</td>
  </tr>
  <tr>
    <td width="50%" valign="top">

#### 📚 Library & Playlists
- **Full Management:** Local playlists, playlist imports, and queue management.
- **Account Integration:** Login to sync with YouTube Music.
- **Listen Together:** Real-time social playback with friends.

</td>
    <td width="50%" valign="top">

#### 🎨 Interface & Customization
- **Material 3:** Modern, clean, and responsive UI.
- **Themes:** Light, Dark, Pure Black (AMOLED), and Dynamic Colors (Material You).
- **Palettes:** 19+ custom accent color themes.
- **Widgets:** Fast playback control right from your home screen.

</td>
  </tr>
</table>

---

# 📥 Descargas / Downloads

<div align="center">

Las versiones compiladas y paquetes APK se publican en la sección de **Releases** de este repositorio.

*Compiled APK builds are available in the **Releases** section of this repository.*

<br/>

[![GitHub Releases](https://img.shields.io/badge/Releases-Descargar%20APK%20%2F%20Download-success?style=for-the-badge&logo=github&labelColor=0d1117)](https://github.com/Hernandez723/rediplaysapp/releases)

</div>

---

# 🛠️ Compilación y Desarrollo / Build & Development

Para compilar el proyecto localmente / *To build the project locally*:

```bash
# Clonar el repositorio / Clone repository
git clone https://github.com/Hernandez723/rediplaysapp.git

# Entrar a la carpeta / Enter project directory
cd rediplaysapp

# Compilar APK en modo Debug / Build Debug APK
./gradlew :app:assembleFossDebug
```

El archivo APK generado se ubicará en:  
*The generated APK file will be located at:*  
`app/build/outputs/apk/universalFoss/debug/app-universal-foss-debug.apk`

---

# 🤝 Reconocimientos / Special Thanks & Credits

RediPlays se basa en excelentes proyectos de código abierto del ecosistema Android:  
*RediPlays is built upon exceptional open-source work in the Android ecosystem:*

- **[Metrolist](https://github.com/MetrolistGroup/Metrolist)** - Proyecto base / Core foundation
- **[InnerTune](https://github.com/z-huang/InnerTune)** & **[OuterTune](https://github.com/DD3Boh/OuterTune)** - Inspiración en interfaz y arquitectura / Architecture and UI inspiration
- **[Better Lyrics](https://better-lyrics.boidu.dev/)** - Sincronización de letras / Synced lyrics engine
- **[MusicRecognizer](https://github.com/aleksey-saenko/MusicRecognizer)** - Reconocimiento de música / Music recognition
- **[zemer-cipher](https://github.com/ZemerTeam/zemer-cipher)** - Integración de streaming / Streaming integration

---

# ⚖️ Licencia y Descargo / License & Disclaimer

Este proyecto está bajo la licencia **GNU General Public License v3.0 (GPL-3.0)**.  
*This project is licensed under the **GNU General Public License v3.0 (GPL-3.0)**.*

> **Nota:** Este proyecto no está afiliado, respaldado ni asociado de ninguna manera con YouTube ni Google LLC. Todas las marcas registradas pertenecen a sus respectivos propietarios.  
> *Disclaimer: This project is not affiliated with, endorsed by, or associated with YouTube or Google LLC. All trademarks belong to their respective owners.*
