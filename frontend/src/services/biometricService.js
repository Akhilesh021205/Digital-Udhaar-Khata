import { Capacitor } from '@capacitor/core';
import { NativeBiometric } from 'capacitor-native-biometric';

const SERVER_NAME = 'com.digitaludhaar.app';

export const BiometricService = {
  // Check if native biometric authentication is supported and available on device
  isAvailable: async () => {
    if (!Capacitor.isNativePlatform()) {
      return false;
    }
    try {
      const result = await NativeBiometric.isAvailable();
      return !!result.isAvailable;
    } catch (err) {
      console.warn('Error checking native biometric availability:', err);
      return false;
    }
  },

  // Perform native biometric challenge
  authenticate: async () => {
    if (!Capacitor.isNativePlatform()) {
      throw new Error('Native biometrics only supported on Android/iOS devices.');
    }
    try {
      await NativeBiometric.verifyIdentity({
        reason: 'Authenticate to access your Udhaar Khata ledger',
        title: 'Biometric Unlock',
        subtitle: 'Use your fingerprint or face biometric',
        description: 'Verify your identity to log in securely.',
        negativeButtonText: 'Cancel'
      });
      return true;
    } catch (err) {
      console.error('Biometric authentication failed:', err);
      throw err;
    }
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
      return creds; // returns { username: email, password: token }
    } catch (err) {
      console.warn('No credentials found or failed to retrieve from Keystore:', err);
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
