# Digital Udhaar - Mobile Biometric Security Integration

This folder contains the complete, clean-architecture React Native code integration for enabling **biometrics (Fingerprint scanner / Face ID / Windows Hello / Android Face Unlock)** in the **Digital Udhaar Khata** ledger mobile application.

---

## 🏗️ Code Architecture

The implementation uses a structured layer design for biometrics and authentication state:

```
App.tsx --> AuthProvider [AuthContext.tsx]
           --> AppNavigator.tsx
                 --> SplashScreen.tsx
                 --> LoginScreen.tsx
                 --> BiometricScreen.tsx
                 --> HomeScreen.tsx
```

### Key Modules:
- **`secureStorage.ts`**: Handles token encryption and hardware-backed storage using Keychain (iOS) and EncryptedSharedPreferences (Android).
- **`biometricService.ts`**: Queries device biometric sensors (Touch ID, Face ID, Fingerprint, Biometrics) and triggers OS-level biometric prompt sheets.
- **`AuthContext.tsx`**: State manager orchestrating login calls to backend API, restoring JWT sessions, tracking biometric enrollment preferences, and handling lockout attempt throttling.

---

## 🔒 Best Security Practices Followed

1. **Hardware-Backed Session Tokens**:
   - The user's JWT token is saved using iOS Keychain or Android EncryptedSharedPreferences, which are encrypted using keys managed in the system's secure element (TEE/Enclave).
   - Saved with accessibility level `WHEN_UNLOCKED_THIS_DEVICE_ONLY`, meaning the data can only be decrypted when the device is actively unlocked.
2. **Zero Biometric Data Transfer**:
   - The application **never** accesses, reads, stores, or transmits fingerprint images or facial features. 
   - All biometrics are processed inside the device's secure hardware chamber (Secure Enclave/TEE). The OS returns only a binary `success` or `failure` result.
3. **Attempt Throttling**:
   - The application enforces a strict maximum of **3 failed biometric validation attempts** per session. Upon exhaustion, it locks access and routes the user back to manual login using email/password.
4. **Transport Layer Protection**:
   - Authentication tokens are communicated via standard authorization headers (`Bearer <token>`) over HTTPS to the backend.

---

## 🛠️ Step-by-Step Native Setup Guide

### 1. Install Dependencies
Run the following commands inside the `mobile/` directory:
```bash
npm install
```

If you are setting this up in a bare React Native project:
```bash
# Install core navigation packages
npm install @react-navigation/native @react-navigation/stack react-native-screens react-native-safe-area-context react-native-gesture-handler

# Install biometric & secure storage utilities
npm install react-native-biometrics react-native-keychain lucide-react-native axios
```

For iOS devices, link native pods:
```bash
cd ios && pod install && cd ..
```

---

### 2. Android Configuration
To support modern biometric prompts on Android devices:

#### A. Add Permissions in `AndroidManifest.xml`
Open `android/app/src/main/AndroidManifest.xml` and insert the biometric permission inside the `<manifest>` tag:
```xml
<uses-permission android:name="android.permission.USE_BIOMETRIC" />
<uses-permission android:name="android.permission.USE_FINGERPRINT" />
```

#### B. Update Build Gradle
Ensure your `minSdkVersion` in `android/build.gradle` is at least **23** (Android 6.0+) to support secure hardware storage:
```gradle
buildscript {
    ext {
        buildToolsVersion = "33.0.0"
        minSdkVersion = 23 // Required for biometric & keychain support
        compileSdkVersion = 33
        targetSdkVersion = 33
    }
}
```

---

### 3. iOS Configuration
To support Face ID on iPhones and iPads:

#### A. Add Face ID Usage Description in `Info.plist`
Open `ios/DigitalUdhaarMobile/Info.plist` and add the security usage description. This text is displayed to the user when requesting authorization:
```xml
<key>NSFaceIDUsageDescription</key>
<string>Digital Udhaar requires Face ID access to securely lock and unlock your financial ledger data.</string>
```

---

## 🚀 Running the App

Start the Metro Bundler:
```bash
npm run start
```

Run on Emulator/Simulator:
- **Android**: `npm run android`
- **iOS**: `npm run ios`

*Note: Since biometric APIs are tied directly to hardware security modules, ensure you have enabled screen lock settings (PIN, Pattern, Fingerprint, or Face) on your emulator or target test device before trying the biometric prompt.*
