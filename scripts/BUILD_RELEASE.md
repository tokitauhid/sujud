# Android Local Build & ADB Deployment Guide

Sujud includes an automated local build script (`scripts/build-release-apk.sh`) that compiles the web application, synchronizes Capacitor Android native assets, builds a signed release APK (or unsigned debug APK) with Gradle, and optionally pushes it directly to a connected Android device via ADB.

---

## 🚀 Quick Start

### 1. Interactive Build (Prompted)
```bash
npm run build:apk
# or directly:
./scripts/build-release-apk.sh
```

### 2. Fast One-Liner (Bypassing Prompts)
```bash
./scripts/build-release-apk.sh -p "YOUR_KEYSTORE_PASSWORD" --adb
```

### 3. Rapid Iteration (Skip Web Asset Rebuild)
If you only modified native Android files or already ran `npm run build`:
```bash
./scripts/build-release-apk.sh -p "YOUR_KEYSTORE_PASSWORD" --adb --skip-web
```

### 4. Build Unsigned Debug APK
```bash
./scripts/build-release-apk.sh --debug
```

---

## 📋 System Prerequisites

To build APKs locally, ensure the following tools are installed and accessible in your shell:

| Prerequisite | Minimum Version | Verification Command | Notes |
|---|---|---|---|
| **Node.js** | 18+ (20 or 22 recommended) | `node -v` | Needed to build Vite frontend |
| **npm** | 9+ | `npm -v` | Installed with Node |
| **Java JDK** | JDK 17 or JDK 21 | `java -version` | OpenJDK or Temurin recommended |
| **Android SDK** | API 34+ / Build-Tools | `echo $ANDROID_HOME` | Required by Gradle |
| **Android Platform Tools (`adb`)** | Latest | `adb version` | For installing directly onto your phone |

### Setting Android SDK & Java Environment Variables

Add the following to your `~/.bashrc`, `~/.zshrc`, or shell profile:

```bash
# Android SDK path (adjust for your system)
export ANDROID_HOME="$HOME/Android/Sdk" # Linux default
# export ANDROID_HOME="/opt/android-sdk" # Arch Linux default
# export ANDROID_HOME="$HOME/Library/Android/sdk" # macOS default

# Platform tools (adb)
export PATH="$PATH:$ANDROID_HOME/platform-tools"

# Java Home (if not managed by mise/asdf/sdkman)
# export JAVA_HOME="/path/to/jdk-21"
```

---

## 🔐 Keystore & Signing Setup

When running a release build, the script signs the APK with your Android keystore.

### Keystore Discovery Order
The script automatically searches for a keystore in the following locations:
1. Custom path provided via `-k <path>` or `KEYSTORE_FILE` environment variable
2. `internal/secrets/release.keystore` (private developer workspace)
3. `android/app/release.keystore`
4. `release.keystore` in project root

### Auto-Detected Key Alias
The script queries the keystore using `keytool` to detect the key alias automatically. You can also specify an alias manually with `-a <alias>`.

### Generating a New Keystore (If You Don't Have One)
If you do not have an existing keystore, you can generate one with:
```bash
keytool -genkeypair -v \
  -keystore release.keystore \
  -alias sujud-release-key \
  -keyalg RSA \
  -keysize 2048 \
  -validity 10000
```
> [!WARNING]
> Keep your keystore safe and never commit `*.keystore` or `*.jks` files to Git. They are automatically ignored in `.gitignore`.

### Debug APK Fallback
If no keystore is found and none is provided, the script will ask if you want to build an unsigned **Debug APK** (`./gradlew assembleDebug`), which requires no signing credentials.

---

## 📲 Direct Device Deployment via ADB

If an Android device is connected via USB or Wi-Fi, the script detects it and prompts to install the APK automatically:

```text
📱 Found 1 connected ADB device(s):
   - 192.168.0.37:5555

📲 Would you like to push & install this APK to ADB device? [y/N]: y
🚀 Installing APK to 192.168.0.37:5555...
Success
✅ Successfully installed on 192.168.0.37:5555!
```

### Connecting Your Device via Wi-Fi ADB:
1. Enable **Developer Options** and **Wireless Debugging** on your phone.
2. Note the IP address and port shown on the device.
3. In your terminal:
   ```bash
   adb connect <PHONE_IP>:<PORT>
   ```
4. Verify with `adb devices`.

---

## 📁 Output Artifacts

The built APK is saved in:
- `release/sujud-v<VERSION>-release.apk`
- `release/sujud-release-latest.apk`
*(If the `internal/release` directory exists, copies are also saved there).*

---

## ⚙️ Full CLI Options Reference

```text
Usage:
  ./scripts/build-release-apk.sh [OPTIONS]
  npm run build:apk -- [OPTIONS]

Options:
  -p, --password <pass>  Keystore password (bypasses interactive prompt)
  -k, --keystore <path>  Path to release.keystore file
  -a, --alias <alias>    Key alias (default: auto-detected from keystore)
  -o, --output <dir>     Output directory for generated APK (default: release/)
  --adb                  Auto-install to connected ADB device without prompting
  --no-adb               Skip ADB installation prompt
  --skip-web             Skip "npm run build" and "npx cap sync android"
  --debug                Build unsigned debug APK instead of signed release
  -h, --help             Show this help message
```
