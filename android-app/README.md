# Math Screen Recorder — Android

Native Kotlin Android screen recorder using `MediaProjection`, `MediaRecorder`, and a foreground service.

## Build

1. Open the `android-app` folder in Android Studio.
2. Allow Gradle sync to finish.
3. Run the `app` configuration on an Android 8.0+ device.
4. Tap **Start recording** and approve Android's screen-capture confirmation.
5. Stop from the app or the persistent notification.

Recordings are saved as MP4 files in `Movies/MathRecorder` on Android 10 and newer. On Android 8–9, files are saved in the app's external Movies directory.

## Important behavior

Android intentionally requires user approval for each new MediaProjection capture session. The app does not bypass or hide that system confirmation. Microphone recording is optional and requests audio permission only when enabled.
