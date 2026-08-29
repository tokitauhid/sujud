# Sujud — سجود

> *A personal Salah tracker & habit companion for Android and iOS.*

Sujud helps you log your daily prayers, analyse your consistency over time, and build a stronger connection with your Salah — one prostration at a time.

---

## ✨ Features

- 📿 **Prayer Tracking** — Log each of your five daily prayers with a tap
- 📊 **Trend Analysis** — Weekly, monthly, and yearly reports with visual charts
- 🔔 **Smart Notifications** — Adhan alerts and post-prayer logging reminders
- 🌐 **Cloud Sync** — Google Sign-In backed sync across all your devices (Firebase)
- 📅 **Hijri Calendar** — Browse your prayer history by Islamic date
- 🗒️ **Notes** — Attach personal reminders for du'as and adhkar to any prayer
- 🎨 **Themes** — Multiple colour themes including OLED pure black mode

---

## 🛠️ Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 18 + TypeScript + Vite |
| Mobile Runtime | CapacitorJS (Android & iOS) |
| Styling | Tailwind CSS, Framer Motion |
| UI Components | Radix UI, Ionic React, Swiper |
| Prayer Times | [Adhan](https://github.com/batoulapps/adhan-js) |
| Storage | `@capacitor-community/sqlite` |
| Cloud Sync | Firebase (Firestore + Google Auth) |

---

## 🚀 Getting Started

### Prerequisites

- Node.js ≥ 18
- Android Studio (for Android builds)
- Xcode (for iOS builds, macOS only)

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
npm run lint      # ESLint
```

---

## 📱 Building for Mobile

```bash
npm run build
npx cap sync
npx cap open android   # or ios
```

---

## 🙏 Credits & Attribution

Sujud is a fork of **[My Salah App](https://github.com/My-Ummah-Apps/My-Salah-App)** — originally created and maintained by [My Ummah Apps](https://github.com/TheFlyingDonut). The core prayer tracking engine, architecture, and design foundations were built by the original author. Full credit and deep gratitude goes to them for their work in creating this open-source tool for the Muslim community.

If you find this app useful, please also ⭐ the [original project](https://github.com/My-Ummah-Apps/My-Salah-App).

---

## 📄 Licence

MIT — see [LICENSE](./LICENSE) for details.
