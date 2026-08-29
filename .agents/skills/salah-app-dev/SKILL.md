---
name: salah-app-dev
description: >-
  Use this skill for any development tasks in the My Salah App repository.
  Activate this when the user asks to add features, fix bugs, modify UI, or work with Capacitor mobile builds.
---

# My Salah App Development Skill

This skill provides essential context and instructions for developing in the "My Salah App" repository.

## Architecture & Tech Stack
- **Frameworks:** React 18, TypeScript, Vite.
- **Mobile runtime:** CapacitorJS (iOS & Android).
- **Styling:** Tailwind CSS, Radix UI components, Framer Motion for animations.
- **Testing:** Vitest and Testing Library.
- **Database/Storage:** `@capacitor-community/sqlite` and `sql.js` for local data.
- **UI Components:** Uses Radix UI, Ionic React (`@ionic/react`), Lucide React icons, and Swiper.
- **Domain Specific:** Uses `adhan` library for calculating prayer times.

## Key Commands
- **Dev Server:** `npm run dev` (runs Vite server).
- **Build:** `npm run build` (runs TypeScript compiler and Vite build).
- **Test:** `npm test` or `npm run test:ui` (Vitest).
- **Lint:** `npm run lint` (ESLint).

## Development Guidelines
1. **Component Styling:** Use Tailwind CSS for styling. Ensure responsive design and consider mobile-first approaches given the Capacitor target.
2. **Capacitor Plugins:** When adding device-specific features (e.g., Notifications, Geolocation, Filesystem), prefer official `@capacitor/...` or `@capacitor-community/...` plugins as seen in `package.json`.
3. **State & Database:** Local database interactions often rely on SQLite. Be aware of both the web environment and the native environment handling of SQLite.
4. **Vite Configuration:** `vite.config.ts` includes a custom plugin to patch `react-virtualized` for Vite compatibility.
5. **Testing:** Unit tests use Vitest (`setupTests.ts` is configured).

## Project Structure
- `src/` - Main source code (React components, pages, utils).
- `android/` & `ios/` - Capacitor generated native projects.
- `capacitor.config.ts` - Capacitor configuration for mobile builds.
