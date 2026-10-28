import type { ExpoConfig, ConfigContext } from "expo/config";

/**
 * FloBama guest app config.
 *
 * Values YOU must supply before signed EAS Build / Submit (do not invent these in git):
 * - EXPO_PUBLIC_API_BASE_URL (optional; defaults to production FloBama OS)
 * - ios.bundleIdentifier — register a bundle ID you own in Apple Developer
 * - Apple Team ID, ASC App ID — only at submit time (see eas.json + README)
 *
 * Expo project linked from dashboard (do not create a second empty app):
 * eas init --id 45cc604d-a79f-4b2b-adcb-e48b42faf3e3
 */

const bundleIdentifier =
  process.env.IOS_BUNDLE_IDENTIFIER?.trim() || "com.flobama.guest";

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: "FloBama",
  // Matches the Expo project created in the dashboard (flobama-downtown).
  slug: "flobama-downtown",
  version: "1.0.0",
  orientation: "portrait",
  icon: "./assets/images/icon.png",
  scheme: "flobama",
  userInterfaceStyle: "dark",
  ios: {
    supportsTablet: false,
    bundleIdentifier,
    buildNumber: "1",
    infoPlist: {
      // Ordering and maps open in the system browser / Maps.
      LSApplicationQueriesSchemes: ["tel", "mailto", "http", "https"],
    },
  },
  android: {
    adaptiveIcon: {
      backgroundColor: "#1a1210",
      foregroundImage: "./assets/images/android-icon-foreground.png",
      backgroundImage: "./assets/images/android-icon-background.png",
    },
    package: process.env.ANDROID_PACKAGE?.trim() || "com.flobama.guest",
  },
  web: {
    bundler: "metro",
    output: "static",
    favicon: "./assets/images/favicon.png",
  },
  plugins: [
    "expo-router",
    "expo-font",
    "expo-sharing",
    [
      "expo-splash-screen",
      {
        image: "./assets/images/splash-icon.png",
        resizeMode: "contain",
        backgroundColor: "#1a1210",
      },
    ],
  ],
  experiments: {
    typedRoutes: true,
  },
  extra: {
    router: {},
    eas: {
      projectId:
        process.env.EAS_PROJECT_ID?.trim() || "45cc604d-a79f-4b2b-adcb-e48b42faf3e3",
    },
  },
  owner: process.env.EXPO_OWNER?.trim() || "zakaryroachs-team",
});
