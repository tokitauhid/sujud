import * as dotenv from "dotenv";
import { resolve } from "path";
dotenv.config({ path: resolve(__dirname, ".env") });
import { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.sujud.app",
  appName: "Sujud",
  webDir: "dist",
  server: {
    cleartext: true,
  },
  plugins: {
    LocalNotifications: {
      smallIcon: "res:///ic_stat_name",
      iconColor: "#26a1d5",
    },
    SystemBars: {
      insetsHandling: "disable",
    },
    keyboard: {
      resize: "none",
      resizeOnFullScreen: false,
    },
    SplashScreen: {
      launchAutoHide: false,
    },
    CapacitorSQLite: {
      iosIsEncryption: false,
      iosKeychainPrefix: "sujud-data",
      iosBiometric: {
        biometricAuth: false,
      },
      androidIsEncryption: false,
      androidBiometric: {
        biometricAuth: false,
      },
    },
    FirebaseAuthentication: {
      skipNativeAuth: false,
      providers: ["google.com"],
    },
  },
};

export default config;
