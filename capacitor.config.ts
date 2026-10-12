import type { CapacitorConfig } from "@capacitor/cli";

/**
 * WRLD phone apps (iOS + Android).
 *
 * The apps load the hosted WRLD site, so sign-in, saving and server features
 * work exactly as on the web. Set WRLD_APP_URL to the deployed address
 * (https://wrldtrips.com by default) before running `npm run mobile:sync`.
 *
 * appId is permanent once the app is published. com.wrldtrips.app matches
 * the wrldtrips.com domain you own.
 */
const appUrl = process.env.WRLD_APP_URL ?? "https://wrldtrips.com";

const config: CapacitorConfig = {
  appId: "com.wrldtrips.app",
  appName: "WRLD",
  webDir: "mobile-shell",
  server: {
    url: appUrl,
    errorPath: "error.html",
    // Supabase sign-in stays inside the app; everything else opens in the browser.
    allowNavigation: ["*.supabase.co"],
  },
  backgroundColor: "#FDF6F0",
  ios: {
    contentInset: "never",
    limitsNavigationsToAppBoundDomains: false,
  },
  android: {
    allowMixedContent: false,
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 600,
      launchAutoHide: true,
      backgroundColor: "#FDF6F0",
      showSpinner: false,
    },
    StatusBar: {
      style: "DARK",
      backgroundColor: "#253A33",
      overlaysWebView: false,
    },
  },
};

export default config;
