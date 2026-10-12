import type { CapacitorConfig } from "@capacitor/cli";

/**
 * WRLD phone apps (iOS + Android).
 *
 * The apps load the hosted WRLD site, so sign-in, saving and server features
 * work exactly as on the web. Set WRLD_APP_URL to the deployed address
 * (e.g. https://app.wrld.travel) before running `npm run mobile:sync`.
 *
 * appId is permanent once the app is published. Change it to a reverse-domain
 * name you own (e.g. travel.wrld.app) before the first store upload.
 */
const appUrl = process.env.WRLD_APP_URL ?? "https://wrld.example.com";

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
