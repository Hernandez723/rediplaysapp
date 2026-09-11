/**
 * Rediplays Music Client (C) 2026
 * Licensed under GPL-3.0 | See git history for contributors
 */

package com.metrolist.music.ui.screens

import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.WindowInsetsSides
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.only
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.layout.windowInsetsPadding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardActions
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.ElevatedCard
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Tab
import androidx.compose.material3.TabRow
import androidx.compose.material3.Text
import androidx.compose.material3.TopAppBar
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.focus.FocusDirection
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalFocusManager
import androidx.compose.ui.platform.LocalUriHandler
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.text.input.VisualTransformation
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.navigation.NavController
import com.metrolist.music.LocalPlayerAwareWindowInsets
import com.metrolist.music.R
import com.metrolist.music.api.RediplaysApi
import com.metrolist.music.constants.AccountEmailKey
import com.metrolist.music.constants.AccountNameKey
import com.metrolist.music.constants.RediplaysAvatarUrlKey
import com.metrolist.music.constants.RediplaysSyncEnabledKey
import com.metrolist.music.constants.RediplaysTokenKey
import com.metrolist.music.constants.RediplaysUserIdKey
import com.metrolist.music.ui.component.IconButton
import com.metrolist.music.ui.utils.backToMain
import com.metrolist.music.utils.RediplaysSyncUtils
import com.metrolist.music.utils.reportException
import com.metrolist.music.utils.safeDataStoreEdit
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import timber.log.Timber

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun LoginScreen(
    navController: NavController,
    isSwitchingChannel: Boolean = false,
) {
    val context = LocalContext.current
    val uriHandler = LocalUriHandler.current
    val focusManager = LocalFocusManager.current
    val coroutineScope = rememberCoroutineScope()
    val windowInsets = LocalPlayerAwareWindowInsets.current

    var selectedTab by remember { mutableIntStateOf(0) } // 0: Contraseña, 1: OTP
    var email by remember { mutableStateOf("") }
    var password by remember { mutableStateOf("") }
    var otpCode by remember { mutableStateOf("") }
    var passwordVisible by remember { mutableStateOf(false) }

    var isLoading by remember { mutableStateOf(false) }
    var errorMessage by remember { mutableStateOf<String?>(null) }

    fun handleLogin() {
        if (email.isBlank()) {
            errorMessage = "Ingresa tu correo electrónico"
            return
        }

        if (selectedTab == 0 && password.isBlank()) {
            errorMessage = "Ingresa tu contraseña"
            return
        }

        if (selectedTab == 1 && otpCode.isBlank()) {
            errorMessage = "Ingresa el código OTP"
            return
        }

        isLoading = true
        errorMessage = null
        focusManager.clearFocus()

        coroutineScope.launch {
            val result = if (selectedTab == 0) {
                RediplaysApi.loginWithPassword(email, password)
            } else {
                RediplaysApi.loginWithOtp(email, otpCode)
            }

            result.fold(
                onSuccess = { authResult ->
                    try {
                        Timber.d("Rediplays: Login exitoso para ${authResult.user.name}")
                        val saved = withContext(Dispatchers.IO) {
                            context.safeDataStoreEdit { settings ->
                                settings[RediplaysTokenKey] = authResult.token
                                settings[RediplaysUserIdKey] = authResult.user.id
                                settings[AccountNameKey] = authResult.user.name
                                settings[AccountEmailKey] = authResult.user.email.orEmpty()
                                settings[RediplaysAvatarUrlKey] = authResult.user.avatarUrl.orEmpty()
                                settings[RediplaysSyncEnabledKey] = true
                            }
                        }
                        check(saved) { "No se pudieron guardar las credenciales" }

                        // Disparar sincronización inicial de favoritos
                        try {
                            val syncUtils = dagger.hilt.android.EntryPointAccessors.fromApplication(
                                context.applicationContext,
                                com.metrolist.music.di.RediplaysSyncEntryPoint::class.java
                            ).rediplaysSyncUtils()
                            syncUtils.performFullSync()
                        } catch (e: Exception) {
                            Timber.w(e, "Rediplays: Error en sincronización inicial")
                        }

                        withContext(Dispatchers.Main) {
                            navController.navigateUp()
                        }
                    } catch (e: Exception) {
                        Timber.e(e, "Rediplays: Error guardando sesión")
                        reportException(e)
                        errorMessage = "Error guardando la sesión: ${e.localizedMessage}"
                        isLoading = false
                    }
                },
                onFailure = { throwable ->
                    isLoading = false
                    errorMessage = throwable.message ?: "Error al iniciar sesión"
                }
            )
        }
    }

    Scaffold(
        topBar = {
            TopAppBar(
                title = {
                    Text(
                        text = stringResource(R.string.login),
                        fontWeight = FontWeight.Bold
                    )
                },
                navigationIcon = {
                    IconButton(
                        onClick = navController::navigateUp,
                        onLongClick = navController::backToMain,
                    ) {
                        Icon(
                            painter = painterResource(R.drawable.arrow_back),
                            contentDescription = stringResource(R.string.cd_back),
                        )
                    }
                }
            )
        },
        modifier = Modifier
            .fillMaxSize()
            .background(MaterialTheme.colorScheme.background)
    ) { paddingValues ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(paddingValues)
                .windowInsetsPadding(windowInsets.only(WindowInsetsSides.Horizontal + WindowInsetsSides.Bottom))
                .verticalScroll(rememberScrollState())
                .padding(horizontal = 24.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
        ) {
            Spacer(Modifier.height(16.dp))

            // Logo & Title
            Box(
                contentAlignment = Alignment.Center,
                modifier = Modifier.size(90.dp)
            ) {
                Image(
                    painter = painterResource(R.drawable.ic_logo_oval),
                    contentDescription = null,
                    modifier = Modifier.size(90.dp)
                )
                Image(
                    painter = painterResource(R.drawable.about_icon),
                    contentDescription = stringResource(R.string.app_name),
                    modifier = Modifier.size(68.dp)
                )
            }

            Spacer(Modifier.height(12.dp))

            Text(
                text = "Iniciar sesión en rediplays",
                style = MaterialTheme.typography.headlineSmall,
                fontWeight = FontWeight.Black,
                color = MaterialTheme.colorScheme.onSurface
            )

            Text(
                text = "Sincroniza tus canciones favoritas y playlists",
                style = MaterialTheme.typography.bodyMedium,
                color = MaterialTheme.colorScheme.onSurfaceVariant
            )

            Spacer(Modifier.height(24.dp))

            // Tabs: Contraseña vs OTP
            TabRow(
                selectedTabIndex = selectedTab,
                modifier = Modifier
                    .fillMaxWidth()
                    .clip(RoundedCornerShape(16.dp))
            ) {
                Tab(
                    selected = selectedTab == 0,
                    onClick = {
                        selectedTab = 0
                        errorMessage = null
                    },
                    text = { Text("Contraseña", fontWeight = FontWeight.SemiBold) }
                )
                Tab(
                    selected = selectedTab == 1,
                    onClick = {
                        selectedTab = 1
                        errorMessage = null
                    },
                    text = { Text("Código OTP", fontWeight = FontWeight.SemiBold) }
                )
            }

            Spacer(Modifier.height(24.dp))

            // Card with Inputs
            ElevatedCard(
                shape = RoundedCornerShape(24.dp),
                modifier = Modifier.fillMaxWidth()
            ) {
                Column(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(20.dp),
                    horizontalAlignment = Alignment.CenterHorizontally
                ) {
                    // Email Input
                    OutlinedTextField(
                        value = email,
                        onValueChange = {
                            email = it
                            errorMessage = null
                        },
                        label = { Text("Correo electrónico") },
                        placeholder = { Text("ejemplo@rediplays.com") },
                        singleLine = true,
                        keyboardOptions = KeyboardOptions(
                            keyboardType = KeyboardType.Email,
                            imeAction = if (selectedTab == 0) ImeAction.Next else ImeAction.Done
                        ),
                        keyboardActions = KeyboardActions(
                            onNext = { focusManager.moveFocus(FocusDirection.Down) },
                            onDone = { if (selectedTab == 1) handleLogin() }
                        ),
                        modifier = Modifier.fillMaxWidth(),
                        shape = RoundedCornerShape(14.dp)
                    )

                    Spacer(Modifier.height(16.dp))

                    if (selectedTab == 0) {
                        // Password Input
                        OutlinedTextField(
                            value = password,
                            onValueChange = {
                                password = it
                                errorMessage = null
                            },
                            label = { Text("Contraseña") },
                            singleLine = true,
                            visualTransformation = if (passwordVisible) VisualTransformation.None else PasswordVisualTransformation(),
                            keyboardOptions = KeyboardOptions(
                                keyboardType = KeyboardType.Password,
                                imeAction = ImeAction.Done
                            ),
                            keyboardActions = KeyboardActions(
                                onDone = { handleLogin() }
                            ),
                            trailingIcon = {
                                IconButton(
                                    onClick = { passwordVisible = !passwordVisible },
                                    onLongClick = {}
                                ) {
                                    Icon(
                                        painter = painterResource(if (passwordVisible) R.drawable.lock_open else R.drawable.lock),
                                        contentDescription = if (passwordVisible) "Ocultar" else "Mostrar",
                                        modifier = Modifier.size(20.dp)
                                    )
                                }
                            },
                            modifier = Modifier.fillMaxWidth(),
                            shape = RoundedCornerShape(14.dp)
                        )
                    } else {
                        // OTP Code Input
                        OutlinedTextField(
                            value = otpCode,
                            onValueChange = {
                                otpCode = it
                                errorMessage = null
                            },
                            label = { Text("Código OTP") },
                            placeholder = { Text("Ingresa el código generado") },
                            singleLine = true,
                            keyboardOptions = KeyboardOptions(
                                keyboardType = KeyboardType.Number,
                                imeAction = ImeAction.Done
                            ),
                            keyboardActions = KeyboardActions(
                                onDone = { handleLogin() }
                            ),
                            modifier = Modifier.fillMaxWidth(),
                            shape = RoundedCornerShape(14.dp)
                        )
                    }

                    if (errorMessage != null) {
                        Spacer(Modifier.height(12.dp))
                        Text(
                            text = errorMessage.orEmpty(),
                            color = MaterialTheme.colorScheme.error,
                            style = MaterialTheme.typography.bodySmall,
                            fontWeight = FontWeight.Medium,
                            modifier = Modifier.fillMaxWidth()
                        )
                    }

                    Spacer(Modifier.height(24.dp))

                    // Login Button
                    Button(
                        onClick = { handleLogin() },
                        enabled = !isLoading,
                        modifier = Modifier
                            .fillMaxWidth()
                            .height(52.dp),
                        shape = CircleShape,
                        colors = ButtonDefaults.buttonColors(
                            containerColor = MaterialTheme.colorScheme.primary,
                            contentColor = MaterialTheme.colorScheme.onPrimary
                        )
                    ) {
                        if (isLoading) {
                            CircularProgressIndicator(
                                modifier = Modifier.size(24.dp),
                                color = MaterialTheme.colorScheme.onPrimary,
                                strokeWidth = 2.5.dp
                            )
                        } else {
                            Text(
                                text = "Iniciar Sesión",
                                fontWeight = FontWeight.Bold,
                                fontSize = 16.sp
                            )
                        }
                    }
                }
            }

            Spacer(Modifier.height(28.dp))

            // Register Link Button
            OutlinedButton(
                onClick = {
                    uriHandler.openUri("https://rediplays.com/register")
                },
                modifier = Modifier
                    .fillMaxWidth()
                    .height(50.dp),
                shape = CircleShape
            ) {
                Text(
                    text = "¿No tienes cuenta? Regístrate en rediplays.com",
                    fontWeight = FontWeight.SemiBold,
                    color = MaterialTheme.colorScheme.primary
                )
            }

            Spacer(Modifier.height(40.dp))
        }
    }
}
