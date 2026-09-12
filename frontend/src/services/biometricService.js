import { Capacitor } from '@capacitor/core';
import { NativeBiometric } from 'capacitor-native-biometric';

const SERVER_NAME = 'com.aidigitalkhata.app';

export const BiometricService = {
  // Check if biometric sensor hardware is available on mobile device or browser
  isAvailable: async () => {
    if (Capacitor.isNativePlatform()) {
      try {
        const result = await NativeBiometric.isAvailable();
        return !!result.isAvailable;
      } catch (err) {
        console.warn('Error checking native biometric availability:', err);
        return false;
      }
    }

    // Check WebAuthn platform authenticator (Android Fingerprint / iOS TouchID / FaceID in mobile browsers)
    if (typeof window !== 'undefined' && window.PublicKeyCredential && typeof window.PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable === 'function') {
      try {
        return await window.PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
      } catch (err) {
        return false;
      }
    }

    return true; // Enable hardware fingerprint trigger for testing/demo
  },

  // Perform native biometric fingerprint scan on real phone
  authenticate: async (promptTitle = 'Unlock AI Digital Khata') => {
    if (Capacitor.isNativePlatform()) {
      try {
        await NativeBiometric.verifyIdentity({
          reason: 'Scan fingerprint to access your AI Digital Khata ledger',
          title: promptTitle,
          subtitle: 'Use your fingerprint biometric',
          description: 'Verify your identity to log in securely.',
          negativeButtonText: 'Cancel'
        });
        return true;
      } catch (err) {
        console.error('Native biometric verification failed:', err);
        throw err;
      }
    }

    // Trigger phone OS native fingerprint prompt via WebAuthn Credential API in mobile browser
    if (typeof window !== 'undefined' && window.PublicKeyCredential && navigator.credentials) {
      try {
        const challenge = new Uint8Array(32);
        window.crypto.getRandomValues(challenge);

        const credential = await navigator.credentials.get({
          publicKey: {
            challenge,
            timeout: 60000,
            userVerification: 'required',
            rpId: window.location.hostname === 'localhost' ? 'localhost' : window.location.hostname
          }
        });
        return !!credential;
      } catch (webAuthnErr) {
        console.warn('WebAuthn fingerprint prompt error or canceled:', webAuthnErr);
        return false;
      }
    }

    return false;
  },

  // Save JWT and email to secure Keystore
  saveCredentials: async (email, token) => {
    if (!Capacitor.isNativePlatform()) return;
    try {
      await NativeBiometric.setCredentials({
        username: email,
        password: token,
        server: SERVER_NAME,
      });
    } catch (err) {
      console.error('Failed to save credentials in Keystore:', err);
    }
  },

  // Retrieve saved credentials from secure Keystore
  getCredentials: async () => {
    if (!Capacitor.isNativePlatform()) return null;
    try {
      const creds = await NativeBiometric.getCredentials({
        server: SERVER_NAME,
      });
      return creds;
    } catch (err) {
      console.warn('No credentials found in Keystore:', err);
      return null;
    }
  },

  // Clear credentials on logout
  clearCredentials: async () => {
    if (!Capacitor.isNativePlatform()) return;
    try {
      await NativeBiometric.deleteCredentials({
        server: SERVER_NAME,
      });
    } catch (err) {
      console.error('Failed to delete credentials from Keystore:', err);
    }
  }
};
