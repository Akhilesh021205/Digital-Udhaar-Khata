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
   * Check if biometrics are supported and enrolled on the device
   */
  checkSupport: async (): Promise<BiometricSupportInfo> => {
    try {
      const { available, biometryType } = await rnBiometrics.isSensorAvailable();

      if (!available) {
        return { supported: false, biometryType: null };
      }

      let type: 'TouchID' | 'FaceID' | 'Fingerprint' | 'Biometrics' = 'Biometrics';
      
      if (Platform.OS === 'ios') {
        if (biometryType === BiometryTypes.TouchID) {
          type = 'TouchID';
        } else if (biometryType === BiometryTypes.FaceID) {
          type = 'FaceID';
        }
      } else {
        // Android supports generic Biometrics or Fingerprint depending on OS integration
        type = biometryType === BiometryTypes.Biometrics ? 'Biometrics' : 'Fingerprint';
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
   * Trigger the native biometric authentication dialog
   */
  authenticate: async (promptMessage: string = 'Scan to unlock your ledger'): Promise<boolean> => {
    try {
      const { success, error } = await rnBiometrics.simplePrompt({
        promptMessage,
        cancelButtonText: 'Cancel'
      });

      if (success) {
        return true;
      }
      
      if (error) {
        console.warn('Biometric verification error:', error);
      }
      return false;
    } catch (error) {
      console.error('Biometric authentication crash:', error);
      return false;
    }
  }
};
