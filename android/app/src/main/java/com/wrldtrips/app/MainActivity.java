package com.wrldtrips.app;

import android.content.Intent;
import android.net.Uri;
import android.webkit.WebView;

import com.getcapacitor.BridgeActivity;

/**
 * Opens WRLD's /share page when someone shares a TikTok, reel or link to
 * WRLD from another app (Android share sheet → WRLD).
 */
public class MainActivity extends BridgeActivity {

    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        openSharedText(intent);
    }

    private void openSharedText(Intent intent) {
        if (intent == null || !Intent.ACTION_SEND.equals(intent.getAction())) return;
        if (intent.getType() == null || !intent.getType().startsWith("text/")) return;
        if (bridge == null) return;

        String text = intent.getStringExtra(Intent.EXTRA_TEXT);
        String subject = intent.getStringExtra(Intent.EXTRA_SUBJECT);
        if (text == null && subject == null) return;

        String base = bridge.getServerUrl() != null ? bridge.getServerUrl() : bridge.getAppUrl();
        if (base == null) return;
        Uri.Builder url = Uri.parse(base).buildUpon().path("/share");
        if (text != null) url.appendQueryParameter("text", text);
        if (subject != null) url.appendQueryParameter("title", subject);

        final String target = url.build().toString();
        final WebView webView = bridge.getWebView();
        webView.post(() -> webView.loadUrl(target));
        // Handled; don't re-open the share page on rotation or relaunch.
        intent.setAction(Intent.ACTION_MAIN);
    }
}
