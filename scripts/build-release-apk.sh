#!/usr/bin/env bash
# ==============================================================================
# Sujud — Android APK Builder & ADB Deployer
# ==============================================================================
# Builds a signed release APK (or debug APK) from local source and optionally
# deploys it directly to a connected Android device via ADB.
#
# Usage:
#   ./scripts/build-release-apk.sh [OPTIONS]
#   npm run build:apk -- [OPTIONS]
#
# Options:
#   -p, --password <pass>    Keystore password (bypasses interactive prompt)
#   -k, --keystore <path>    Path to release.keystore file
#   -a, --alias <alias>      Key alias inside keystore (default: auto-detect)
#   -o, --output <dir>       Custom output directory for the built APK
#   --adb                    Automatically install to connected ADB device
#   --no-adb                 Skip ADB installation prompt
#   --skip-web               Skip web build (npm run build) & cap sync
#   --debug                  Build an unsigned debug APK instead of release
#   -h, --help               Display this help message
# ==============================================================================

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

# Ensure sensitive variables are cleared on exit
trap 'unset KEYSTORE_PASS' EXIT INT TERM

# CLI / Environment variable defaults
KEYSTORE_PASS="${KEYSTORE_PASSWORD:-}"
KEYSTORE_FILE="${KEYSTORE_FILE:-}"
KEY_ALIAS="${KEY_ALIAS:-}"
OUTPUT_DIR="${OUTPUT_DIR:-}"
AUTO_ADB=""
SKIP_WEB=false
BUILD_DEBUG=false

# Parse arguments
while [[ $# -gt 0 ]]; do
  case "$1" in
    -p|--password)
      KEYSTORE_PASS="$2"
      shift 2
      ;;
    -k|--keystore)
      KEYSTORE_FILE="$2"
      shift 2
      ;;
    -a|--alias)
      KEY_ALIAS="$2"
      shift 2
      ;;
    -o|--output)
      OUTPUT_DIR="$2"
      shift 2
      ;;
    --adb)
      AUTO_ADB="yes"
      shift
      ;;
    --no-adb)
      AUTO_ADB="no"
      shift
      ;;
    --skip-web)
      SKIP_WEB=true
      shift
      ;;
    --debug)
      BUILD_DEBUG=true
      shift
      ;;
    -h|--help)
      echo "Sujud — Android APK Builder & ADB Deployer"
      echo ""
      echo "Usage:"
      echo "  ./scripts/build-release-apk.sh [OPTIONS]"
      echo "  npm run build:apk -- [OPTIONS]"
      echo ""
      echo "Options:"
      echo "  -p, --password <pass>  Keystore password (bypasses prompt)"
      echo "  -k, --keystore <path>  Path to release.keystore file"
      echo "  -a, --alias <alias>    Key alias (default: auto-detected from keystore)"
      echo "  -o, --output <dir>     Output directory for the generated APK"
      echo "  --adb                  Auto-install to connected ADB device"
      echo "  --no-adb               Skip ADB installation prompt"
      echo "  --skip-web             Skip npm run build & cap sync"
      echo "  --debug                Build debug APK instead of signed release"
      echo "  -h, --help             Show this help message"
      exit 0
      ;;
    *)
      echo "Unknown option: $1"
      echo "Run './scripts/build-release-apk.sh --help' for usage."
      exit 1
      ;;
  esac
done

echo "========================================================"
echo "🕋  Sujud — Android APK Builder"
echo "========================================================"
echo "Project Root : $PROJECT_ROOT"

# Resolve Output Directory
if [ -z "$OUTPUT_DIR" ]; then
  if [ -d "$PROJECT_ROOT/internal/release" ]; then
    OUTPUT_DIR="$PROJECT_ROOT/internal/release"
  else
    OUTPUT_DIR="$PROJECT_ROOT/release"
  fi
fi
mkdir -p "$OUTPUT_DIR"
echo "Output Dir   : $OUTPUT_DIR"

# ------------------------------------------------------------------------------
# 1. Environment & Prerequisite Checks
# ------------------------------------------------------------------------------

# Check Java
if ! command -v java >/dev/null 2>&1; then
  echo "❌ Error: Java (JDK 17 or 21) is required but not found in PATH."
  exit 1
fi

# Resolve JAVA_HOME if not explicitly set
if [ -z "$JAVA_HOME" ]; then
  JAVA_BIN=$(which java 2>/dev/null || true)
  if [ -n "$JAVA_BIN" ]; then
    REAL_JAVA=$(readlink -f "$JAVA_BIN" 2>/dev/null || true)
    if [ -n "$REAL_JAVA" ]; then
      export JAVA_HOME="$(dirname "$(dirname "$REAL_JAVA")")"
    fi
  fi
fi

# Check Android SDK
if [ -z "$ANDROID_HOME" ] && [ -z "$ANDROID_SDK_ROOT" ]; then
  # Try common default locations
  if [ -d "$HOME/Android/Sdk" ]; then
    export ANDROID_HOME="$HOME/Android/Sdk"
  elif [ -d "/opt/android-sdk" ]; then
    export ANDROID_HOME="/opt/android-sdk"
  elif [ -d "$HOME/Library/Android/sdk" ]; then
    export ANDROID_HOME="$HOME/Library/Android/sdk"
  fi
fi

if [ -n "$ANDROID_HOME" ]; then
  echo "Android SDK  : $ANDROID_HOME"
else
  echo "⚠️ Warning: ANDROID_HOME is not set. Gradle will attempt to use local.properties."
fi

# ------------------------------------------------------------------------------
# 2. Keystore Resolution & Verification (Release mode)
# ------------------------------------------------------------------------------
if [ "$BUILD_DEBUG" = false ]; then
  # Auto-discover keystore if not specified
  if [ -z "$KEYSTORE_FILE" ]; then
    SEARCH_LOCATIONS=(
      "$PROJECT_ROOT/internal/secrets/release.keystore"
      "$PROJECT_ROOT/android/app/release.keystore"
      "$PROJECT_ROOT/release.keystore"
    )
    for LOC in "${SEARCH_LOCATIONS[@]}"; do
      if [ -f "$LOC" ]; then
        KEYSTORE_FILE="$LOC"
        break
      fi
    done
  fi

  if [ -z "$KEYSTORE_FILE" ] || [ ! -f "$KEYSTORE_FILE" ]; then
    echo ""
    echo "⚠️  No release keystore found."
    echo "   Locations checked:"
    echo "     - internal/secrets/release.keystore"
    echo "     - android/app/release.keystore"
    echo "     - release.keystore"
    echo ""
    read -rp "Would you like to build an unsigned Debug APK instead? [Y/n]: " FALLBACK_DEBUG
    if [[ "$FALLBACK_DEBUG" =~ ^[Nn]$ ]]; then
      echo "❌ Build cancelled. Please specify a valid keystore with -k <path>."
      exit 1
    else
      BUILD_DEBUG=true
    fi
  else
    echo "Keystore     : $KEYSTORE_FILE"
  fi
fi

# Prompt for password if in Release mode
if [ "$BUILD_DEBUG" = false ]; then
  if [ -z "$KEYSTORE_PASS" ]; then
    MAX_TRIES=3
    ATTEMPT=1
    while [ $ATTEMPT -le $MAX_TRIES ]; do
      echo -n "🔑 Enter keystore password (input hidden): "
      read -rs KEYSTORE_PASS
      echo ""

      if [ -z "$KEYSTORE_PASS" ]; then
        echo "⚠️ Password cannot be empty. Try again ($ATTEMPT/$MAX_TRIES)."
        ((ATTEMPT++))
        continue
      fi

      if keytool -list -keystore "$KEYSTORE_FILE" -storepass "$KEYSTORE_PASS" >/dev/null 2>&1; then
        echo "✅ Keystore unlocked successfully!"
        break
      else
        echo "❌ Incorrect password. Try again ($ATTEMPT/$MAX_TRIES)."
        KEYSTORE_PASS=""
        ((ATTEMPT++))
      fi
    done

    if [ -z "$KEYSTORE_PASS" ]; then
      echo "❌ Failed to unlock keystore after $MAX_TRIES attempts."
      exit 1
    fi
  else
    if ! keytool -list -keystore "$KEYSTORE_FILE" -storepass "$KEYSTORE_PASS" >/dev/null 2>&1; then
      echo "❌ Error: The provided keystore password is incorrect."
      exit 1
    fi
    echo "✅ Keystore unlocked successfully!"
  fi

  # Auto-detect Alias
  if [ -z "$KEY_ALIAS" ]; then
    KEY_ALIAS=$(keytool -list -v -keystore "$KEYSTORE_FILE" -storepass "$KEYSTORE_PASS" 2>/dev/null | grep -i "Alias name:" | head -n 1 | sed -e 's/.*Alias name: //I' | tr -d '\r\n ' || true)
    if [ -z "$KEY_ALIAS" ]; then
      KEY_ALIAS="my-key-alias"
    fi
  fi
  echo "Key Alias    : $KEY_ALIAS"
fi

# Read version from package.json
VERSION=$(node -p "try { require('$PROJECT_ROOT/package.json').version } catch(e) { 'unknown' }")
echo "App Version  : v$VERSION"
echo "Build Type   : $( [ "$BUILD_DEBUG" = true ] && echo "Debug (unsigned)" || echo "Release (signed)" )"
echo "========================================================"
echo ""

# ------------------------------------------------------------------------------
# 3. Web Asset Build & Capacitor Sync
# ------------------------------------------------------------------------------
if [ "$SKIP_WEB" = false ]; then
  echo "🔨 [1/3] Compiling web assets (npm run build)..."
  cd "$PROJECT_ROOT"
  npm run build

  echo "🔄 [2/3] Syncing Capacitor Android assets (npx cap sync android)..."
  npx cap sync android
else
  echo "⏩ Skipping web assets build and Capacitor sync."
fi

# ------------------------------------------------------------------------------
# 4. Gradle Build
# ------------------------------------------------------------------------------
echo ""
echo "⚙️  [3/3] Building APK with Gradle..."
cd "$PROJECT_ROOT/android"

if [ "$BUILD_DEBUG" = true ]; then
  ./gradlew assembleDebug
  APK_SOURCE=$(find "$PROJECT_ROOT/android/app/build/outputs/apk/debug" -type f -name "*.apk" 2>/dev/null | head -n 1 || true)
  TARGET_NAME="sujud-v${VERSION}-debug.apk"
  LATEST_NAME="sujud-debug-latest.apk"
else
  ./gradlew assembleRelease \
    -Pandroid.injected.signing.store.file="$KEYSTORE_FILE" \
    -Pandroid.injected.signing.store.password="$KEYSTORE_PASS" \
    -Pandroid.injected.signing.key.alias="$KEY_ALIAS" \
    -Pandroid.injected.signing.key.password="$KEYSTORE_PASS"

  APK_SOURCE=$(find "$PROJECT_ROOT/android/app/build/outputs/apk/release" -type f -name "*.apk" 2>/dev/null | head -n 1 || true)
  TARGET_NAME="sujud-v${VERSION}-release.apk"
  LATEST_NAME="sujud-release-latest.apk"
fi

if [ -z "$APK_SOURCE" ] || [ ! -f "$APK_SOURCE" ]; then
  echo "❌ Error: Gradle build finished but no APK file was found."
  exit 1
fi

# ------------------------------------------------------------------------------
# 5. Copy Output APK
# ------------------------------------------------------------------------------
DEST_APK="$OUTPUT_DIR/$TARGET_NAME"
LATEST_APK="$OUTPUT_DIR/$LATEST_NAME"

cp -f "$APK_SOURCE" "$DEST_APK"
cp -f "$APK_SOURCE" "$LATEST_APK"

# Also copy to internal/release if different and exists
if [ "$OUTPUT_DIR" != "$PROJECT_ROOT/internal/release" ] && [ -d "$PROJECT_ROOT/internal/release" ]; then
  cp -f "$DEST_APK" "$PROJECT_ROOT/internal/release/$TARGET_NAME"
  cp -f "$LATEST_APK" "$PROJECT_ROOT/internal/release/$LATEST_NAME"
fi

APK_SIZE=$(ls -lh "$DEST_APK" | awk '{print $5}')
APK_SHA=$(sha256sum "$DEST_APK" | awk '{print $1}')

echo ""
echo "========================================================"
echo "🎉 BUILD SUCCESSFUL!"
echo "========================================================"
echo "📁 APK Path : $DEST_APK"
echo "📦 Size     : $APK_SIZE"
echo "🔒 SHA-256  : $APK_SHA"
echo "========================================================"
echo ""

# ------------------------------------------------------------------------------
# 6. ADB Push & Install
# ------------------------------------------------------------------------------
PUSH_CONFIRM="$AUTO_ADB"

if [ -z "$PUSH_CONFIRM" ]; then
  if command -v adb >/dev/null 2>&1; then
    CONNECTED_DEVICES=$(adb devices 2>/dev/null | grep -w "device" | awk '{print $1}' || true)
    if [ -n "$CONNECTED_DEVICES" ]; then
      DEVICE_COUNT=$(echo "$CONNECTED_DEVICES" | wc -l)
      echo "📱 Found $DEVICE_COUNT connected ADB device(s):"
      echo "$CONNECTED_DEVICES" | sed 's/^/   - /'
      echo ""
      read -rp "📲 Would you like to push & install this APK to ADB device? [y/N]: " USER_INPUT
      if [[ "$USER_INPUT" =~ ^[Yy]$ ]]; then
        PUSH_CONFIRM="yes"
      else
        PUSH_CONFIRM="no"
      fi
    else
      echo "ℹ️  No connected ADB devices detected."
      PUSH_CONFIRM="no"
    fi
  else
    echo "ℹ️  'adb' command not found in PATH. Skipping ADB install."
    PUSH_CONFIRM="no"
  fi
fi

if [ "$PUSH_CONFIRM" = "yes" ]; then
  CONNECTED_DEVICES=$(adb devices 2>/dev/null | grep -w "device" | awk '{print $1}' || true)
  if [ -z "$CONNECTED_DEVICES" ]; then
    echo "⚠️ Cannot push to ADB: No active devices connected."
  else
    for DEV in $CONNECTED_DEVICES; do
      echo "🚀 Installing APK to $DEV..."
      if adb -s "$DEV" install -r "$DEST_APK"; then
        echo "✅ Successfully installed on $DEV!"
      else
        echo "❌ Failed to install on $DEV via ADB."
      fi
    done
  fi
else
  echo "📦 APK saved in $OUTPUT_DIR without ADB push."
fi

echo ""
echo "✨ All done! Generated APK:"
echo "   $DEST_APK"
echo "========================================================"
