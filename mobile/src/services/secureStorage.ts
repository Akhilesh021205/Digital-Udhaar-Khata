import * as Keychain from 'react-native-keychain';

const TOKEN_SERVICE = 'com.digitaludhaarkhata.token';
const PREFERENCE_SERVICE = 'com.digitaludhaarkhata.preference';

export const secureStorage = {
  /**
   * Save JWT token securely
   */
  saveToken: async (token: string): Promise<boolean> => {
    try {
      await Keychain.setGenericPassword('user_session', token, {
        service: TOKEN_SERVICE,
        accessible: Keychain.ACCESSIBLE.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
        securityLevel: Keychain.SECURITY_LEVEL.SECURE_SOFTWARE
      });
      return true;
    } catch (error) {
      console.error('Error saving secure token:', error);
      return false;
    }
  },

  /**
   * Retrieve JWT token securely
   */
  getToken: async (): Promise<string | null> => {
    try {
      const credentials = await Keychain.getGenericPassword({
        service: TOKEN_SERVICE
      });
      if (credentials) {
        return credentials.password;
      }
      return null;
    } catch (error) {
      console.error('Error retrieving secure token:', error);
      return null;
    }
  },

  /**
   * Delete JWT token
   */
  deleteToken: async (): Promise<boolean> => {
    try {
      await Keychain.resetGenericPassword({
        service: TOKEN_SERVICE
      });
      return true;
    } catch (error) {
      console.error('Error resetting secure token:', error);
      return false;
    }
  },

  /**
   * Save biometric preference securely
   */
  saveBiometricPreference: async (enabled: boolean): Promise<boolean> => {
    try {
      await Keychain.setGenericPassword('biometrics_enabled', enabled ? 'true' : 'false', {
        service: PREFERENCE_SERVICE,
        accessible: Keychain.ACCESSIBLE.WHEN_UNLOCKED_THIS_DEVICE_ONLY
      });
      return true;
    } catch (error) {
      console.error('Error saving biometric preference:', error);
      return false;
    }
  },

  /**
   * Retrieve biometric preference securely
   */
  getBiometricPreference: async (): Promise<boolean> => {
    try {
      const credentials = await Keychain.getGenericPassword({
        service: PREFERENCE_SERVICE
      });
      if (credentials) {
        return credentials.password === 'true';
      }
      return false;
    } catch (error) {
      console.error('Error retrieving biometric preference:', error);
      return false;
    }
  },

  /**
   * Clear all secure data on logout
   */
  clearAll: async (): Promise<void> => {
    try {
      await Keychain.resetGenericPassword({ service: TOKEN_SERVICE });
      await Keychain.resetGenericPassword({ service: PREFERENCE_SERVICE });
    } catch (error) {
      console.error('Error clearing secure storage:', error);
    }
  }
};
