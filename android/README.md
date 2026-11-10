# Android

The Android application is generated and managed by Capacitor. App identity and
the web build directory are configured in `../capacitor.config.ts`.

## Open the project

Install dependencies, then run:

```powershell
npm run cap:sync
npm run cap:open
```

`cap:sync` builds the Vite app before copying its output into the Android
project. Opening or building the native project requires Android Studio, a
configured Android SDK, and a compatible Java Development Kit.
