package com.example

import android.Manifest
import android.annotation.SuppressLint
import android.content.pm.PackageManager
import android.os.Bundle
import android.webkit.GeolocationPermissions
import android.webkit.WebChromeClient
import android.webkit.WebSettings
import android.webkit.WebView
import android.webkit.WebViewClient
import androidx.activity.ComponentActivity
import androidx.activity.OnBackPressedCallback
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.Scaffold
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.viewinterop.AndroidView
import androidx.core.content.ContextCompat
import com.example.ui.theme.MyApplicationTheme

class MainActivity : ComponentActivity() {

  private var appWebView: WebView? = null

  private val requestLocationPermissions =
      registerForActivityResult(ActivityResultContracts.RequestMultiplePermissions()) { _ ->
        // Recargar o notificar webview para que use la ubicación GPS concedida
        appWebView?.reload()
      }

  override fun onCreate(savedInstanceState: Bundle?) {
    super.onCreate(savedInstanceState)
    enableEdgeToEdge()

    // Solicitar permisos de ubicación en tiempo de ejecución
    checkAndRequestPermissions()

    onBackPressedDispatcher.addCallback(
        this,
        object : OnBackPressedCallback(true) {
          override fun handleOnBackPressed() {
            if (appWebView?.canGoBack() == true) {
              appWebView?.goBack()
            } else {
              isEnabled = false
              onBackPressedDispatcher.onBackPressed()
            }
          }
        })

    setContent {
      MyApplicationTheme {
        Scaffold(modifier = Modifier.fillMaxSize()) { innerPadding ->
          BusTrackWebView(
              modifier = Modifier
                  .fillMaxSize()
                  .padding(innerPadding),
              onWebViewCreated = { webView -> appWebView = webView })
        }
      }
    }
  }

  private fun checkAndRequestPermissions() {
    val fineLocation = ContextCompat.checkSelfPermission(this, Manifest.permission.ACCESS_FINE_LOCATION)
    val coarseLocation = ContextCompat.checkSelfPermission(this, Manifest.permission.ACCESS_COARSE_LOCATION)

    if (fineLocation != PackageManager.PERMISSION_GRANTED || coarseLocation != PackageManager.PERMISSION_GRANTED) {
      requestLocationPermissions.launch(
          arrayOf(
              Manifest.permission.ACCESS_FINE_LOCATION,
              Manifest.permission.ACCESS_COARSE_LOCATION
          )
      )
    }
  }
}

@SuppressLint("SetJavaScriptEnabled")
@Composable
fun BusTrackWebView(modifier: Modifier = Modifier, onWebViewCreated: (WebView) -> Unit) {
  AndroidView(
      modifier = modifier,
      factory = { context ->
        WebView(context).apply {
          settings.apply {
            javaScriptEnabled = true
            domStorageEnabled = true
            databaseEnabled = true
            setGeolocationEnabled(true)
            cacheMode = WebSettings.LOAD_DEFAULT
            allowFileAccess = true
            allowContentAccess = true
            mediaPlaybackRequiresUserGesture = false
            loadWithOverviewMode = true
            useWideViewPort = true
          }

          webChromeClient = object : WebChromeClient() {
            override fun onGeolocationPermissionsShowPrompt(
                origin: String?,
                callback: GeolocationPermissions.Callback?
            ) {
              // Otorgar permiso de geolocalización a la aplicación web interna
              callback?.invoke(origin, true, false)
            }
          }

          webViewClient = object : WebViewClient() {
            override fun shouldOverrideUrlLoading(view: WebView?, url: String?): Boolean {
              return false
            }
          }

          loadUrl("file:///android_asset/web/index.html")
          onWebViewCreated(this)
        }
      }
  )
}

@Composable
fun Greeting(name: String, modifier: Modifier = Modifier) {
  androidx.compose.material3.Text(text = "Hello $name!", modifier = modifier)
}

