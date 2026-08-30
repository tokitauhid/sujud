<div align="center">
  <img src="./public/assets/icon/icon.png" alt="Sujud Logo" width="120" height="120" />
  <h1>Sujud — سجود</h1>
  <p><em>A personal Salah tracker & habit companion for Android, iOS, and the Web.</em></p>

  <p>
    <img src="https://img.shields.io/badge/Capacitor-119EFF?style=for-the-badge&logo=capacitor&logoColor=white" alt="Capacitor" />
    <img src="https://img.shields.io/badge/React-20232A?style=for-the-badge&logo=react&logoColor=61DAFB" alt="React" />
    <img src="https://img.shields.io/badge/TypeScript-007ACC?style=for-the-badge&logo=typescript&logoColor=white" alt="TypeScript" />
    <img src="https://img.shields.io/badge/Firebase-FFCA28?style=for-the-badge&logo=firebase&logoColor=black" alt="Firebase" />
  </p>
</div>

---

Sujud helps you log your daily prayers, analyse your consistency over time, and build a stronger connection with your Salah — one prostration at a time.

## ✨ Features

- 📿 **Prayer Tracking** — Log each of your five daily prayers with a simple tap.
- 📊 **Trend Analysis** — Beautiful weekly, monthly, and yearly reports with visual charts.
- 🔔 **Smart Notifications** — Adhan alerts and gentle post-prayer logging reminders.
- 🌐 **Cloud Sync** — Seamlessly sync across all your devices using Google Sign-In and Firebase.
- 📅 **Hijri Calendar** — Browse and reflect on your prayer history by Islamic date.
- 🗒️ **Notes** — Attach personal reminders for du'as and adhkar to any prayer.
- 🎨 **Themes** — Multiple colour themes, including a pure OLED black mode.

---

## 🛠️ Tech Stack

| Layer | Technology |
|---|---|
| **Frontend** | React 18 + TypeScript + Vite |
| **Mobile Runtime** | CapacitorJS (Android & iOS) |
| **Styling** | Tailwind CSS, Framer Motion |
| **UI Components** | Radix UI, Ionic React, Swiper |
| **Prayer Times** | [Adhan](https://github.com/batoulapps/adhan-js) |
| **Storage** | `@capacitor-community/sqlite` |
| **Cloud Sync** | Firebase (Firestore + Google Auth) |

---

## 🚀 Getting Started

### Prerequisites
- **Node.js** ≥ 18
- **Android Studio** (for Android builds)
- **Xcode** (for iOS builds, macOS only)

### Install

```bash
git clone https://github.com/your-username/sujud.git
cd sujud
npm install
```

### Environment Variables
Copy `.env.example` to `.env` and fill in your Firebase credentials:
```bash
cp .env.example .env
```

### Development
```bash
# Web dev server
npm run dev

# Build
npm run build

# Sync to Android
npx cap sync android

# Open in Android Studio
npx cap open android
```

---

## 🧪 Testing

```bash
npm test          # Run unit tests (Vitest)
npm run test:ui   # Open Vitest UI
npm run lint      # Run ESLint
```

---

## 📱 Building for Mobile

To generate your mobile bundles and run the native IDEs:
```bash
npm run build
npx cap sync
npx cap open android   # or ios
```

---

## 📦 Releasing & Versioning

Sujud includes an automated release script to easily bump versions and trigger GitHub Action builds:

```bash
# Bumps the patch version (e.g. 1.0.0 -> 1.0.1)
npm run release

# Bump minor version (e.g. 1.0.1 -> 1.1.0)
npm run release minor

# Bump major version (e.g. 1.1.0 -> 2.0.0)
npm run release major
```

This script will automatically:
1. Update `package.json` version.
2. Increment `versionCode` and `versionName` in `android/app/build.gradle`.
3. Commit the changes and tag the release.
4. Prompt you to push the tags to GitHub (triggering the `release-apk.yml` workflow).

---

## 🙏 Credits & Attribution

Sujud is a fork of **[My Salah App](https://github.com/My-Ummah-Apps/My-Salah-App)** — originally created and maintained by [My Ummah Apps](https://github.com/TheFlyingDonut). The core prayer tracking engine, architecture, and design foundations were built by the original author. Full credit and deep gratitude go to them for creating such an incredible open-source tool for the Muslim community.

If you find this app useful, please also ⭐ the [original project](https://github.com/My-Ummah-Apps/My-Salah-App).

---

## 📄 Licence

MIT — see [LICENSE](./LICENSE) for details.
