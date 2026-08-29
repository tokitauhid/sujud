#!/bin/bash

# Exit on any error
set -e

# Ensure we are in the project root
cd "$(dirname "$0")"
echo "--- Starting Build and Deploy ---"

echo "[1/4] Building Vite project..."
npm run build

echo "[2/4] Syncing to Android project..."
npx cap sync android

echo "[3/4] Building Android APK (using Java 21)..."
cd android
./gradlew assembleDebug

echo "[4/4] Installing APK to connected device..."
adb install -r app/build/outputs/apk/debug/app-debug.apk

echo "--- Deploy Complete! ---"
