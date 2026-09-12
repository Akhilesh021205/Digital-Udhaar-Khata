import * as LocalAuthentication from 'expo-local-authentication';
import ReactNativeBiometrics, { BiometryTypes } from 'react-native-biometrics';
import { Platform } from 'react-native';

const rnBiometrics = new ReactNativeBiometrics();

export interface BiometricSupportInfo {
  supported: boolean;
  biometryType?: 'TouchID' | 'FaceID' | 'Fingerprint' | 'Biometrics' | null;
  error?: string;
}

export const biometricService = {
  /**
   * Check if hardware and fingerprints are enrolled via Expo LocalAuthentication
   */
  checkExpoSupport: async (): Promise<boolean> => {
    try {
      const hasHardware = await LocalAuthentication.hasHardwareAsync();
      const isEnrolled = await LocalAuthentication.isEnrolledAsync();
      return hasHardware && isEnrolled;
    } catch (error) {
      console.error('Error checking Expo LocalAuthentication support:', error);
      return false;
    }
  },

  /**
   * Perform biometric fingerprint authentication using Expo LocalAuthentication
   */
  authenticateWithExpo: async (promptMessage: string = 'Unlock AI Digital Khata'): Promise<boolean> => {
    try {
      const result = await LocalAuthentication.authenticateAsync({
        promptMessage,
        fallbackLabel: 'Use Passcode',
        cancelLabel: 'Cancel',
        disableDeviceFallback: false,
      });
      return result.success;
    } catch (error) {
      console.error('Expo LocalAuthentication error:', error);
      return false;
    }
  },

  /**
   * Check if biometrics are supported and enrolled on the device
   */
  checkSupport: async (): Promise<BiometricSupportInfo> => {
    try {
      const expoSupported = await biometricService.checkExpoSupport();
      const { available, biometryType } = await rnBiometrics.isSensorAvailable();

      if (!available && !expoSupported) {
        return { supported: false, biometryType: null };
      }

      let type: 'TouchID' | 'FaceID' | 'Fingerprint' | 'Biometrics' = 'Fingerprint';
      
      if (Platform.OS === 'ios') {
        if (biometryType === BiometryTypes.TouchID) {
          type = 'TouchID';
        } else if (biometryType === BiometryTypes.FaceID) {
          type = 'FaceID';
        }
      } else {
        type = 'Fingerprint';
      }

      return {
        supported: true,
        biometryType: type
      };
    } catch (error) {
      console.error('Error checking biometric support:', error);
      return {
        supported: false,
        error: error instanceof Error ? error.message : 'Unknown error checking biometrics'
      };
    }
  },

  /**
   * Trigger native biometric authentication with Expo LocalAuthentication fallback
   */
  authenticate: async (promptMessage: string = 'Unlock AI Digital Khata'): Promise<boolean> => {
    try {
      // 1. Try Expo LocalAuthentication prompt first
      const expoSuccess = await biometricService.authenticateWithExpo(promptMessage);
      if (expoSuccess) return true;

      // 2. Fallback to react-native-biometrics prompt if needed
      const { success } = await rnBiometrics.simplePrompt({
        promptMessage,
        cancelButtonText: 'Cancel'
      });

      return success;
    } catch (error) {
      console.error('Biometric authentication crash:', error);
      return false;
    }
  }
};
