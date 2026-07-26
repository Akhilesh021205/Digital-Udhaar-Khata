import React, { createContext, useContext, useState, useEffect } from 'react';
import axios from 'axios';
import { secureStorage } from '../services/secureStorage';
import { biometricService } from '../services/biometricService';

// Backend configuration (for development, default to local machine address)
const API_URL = 'http://10.0.2.2:5000/api'; // Android Emulator localhost IP. For iOS, use http://localhost:5000/api

interface User {
  _id: string;
  name: string;
  email: string;
  storeName: string;
  phone?: string;
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  isBiometricsEnabled: boolean;
  deviceSupportsBiometrics: boolean;
  biometryType: 'TouchID' | 'FaceID' | 'Fingerprint' | 'Biometrics' | null;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<boolean>;
  logout: () => Promise<void>;
  setBiometricsPreference: (enabled: boolean) => Promise<boolean>;
  authenticateBiometrically: () => Promise<boolean>;
  bootstrapSession: () => Promise<'login' | 'biometric' | 'error'>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isBiometricsEnabled, setIsBiometricsEnabled] = useState<boolean>(false);
  const [deviceSupportsBiometrics, setDeviceSupportsBiometrics] = useState<boolean>(false);
  const [biometryType, setBiometryType] = useState<'TouchID' | 'FaceID' | 'Fingerprint' | 'Biometrics' | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);

  // Initialize and check biometric support on mount
  useEffect(() => {
    const initBiometrics = async () => {
      const bioInfo = await biometricService.checkSupport();
      setDeviceSupportsBiometrics(bioInfo.supported);
      setBiometryType(bioInfo.biometryType || null);
    };
    initBiometrics();
  }, []);

  /**
   * Bootstrap application: Restores biometric preference and determines routing
   */
  const bootstrapSession = async (): Promise<'login' | 'biometric' | 'error'> => {
    setIsLoading(true);
    try {
      const bioPref = await secureStorage.getBiometricPreference();
      setIsBiometricsEnabled(bioPref);

      const savedToken = await secureStorage.getToken();

      if (savedToken && bioPref && deviceSupportsBiometrics) {
        setToken(savedToken);
        setIsLoading(false);
        return 'biometric'; // Redirect to biometric lockscreen
      }

      // No biometrics or session expired -> require password login
      setIsLoading(false);
      return 'login';
    } catch (error) {
      console.error('Session bootstrap failed:', error);
      setIsLoading(false);
      return 'error';
    }
  };

  /**
   * Login with email and password via MERN backend
   */
  const login = async (email: string, password: string): Promise<boolean> => {
    setIsLoading(true);
    try {
      const response = await axios.post(`${API_URL}/auth/login`, { email, password });
      
      if (response.data?.success) {
        const { token: jwtToken, data: userData } = response.data;
        
        // Save token securely
        await secureStorage.saveToken(jwtToken);
        
        setToken(jwtToken);
        setUser(userData);
        setIsAuthenticated(true);
        setIsLoading(false);
        return true;
      }
      setIsLoading(false);
      return false;
    } catch (error) {
      console.error('Login request failed:', error);
      setIsLoading(false);
      return false;
    }
  };

  /**
   * Biometric verification process
   */
  const authenticateBiometrically = async (): Promise<boolean> => {
    try {
      const success = await biometricService.authenticate(
        `Verify your identity to unlock Digital Udhaar`
      );

      if (success) {
        // Read token from secure storage
        const savedToken = await secureStorage.getToken();
        
        if (savedToken) {
          // Optional: Verify token with backend
          try {
            const res = await axios.get(`${API_URL}/auth/me`, {
              headers: { Authorization: `Bearer ${savedToken}` }
            });
            if (res.data?.success) {
              setUser(res.data.data);
              setToken(savedToken);
              setIsAuthenticated(true);
              return true;
            }
          } catch (apiError) {
            console.warn('Backend validation failed, using cached token:', apiError);
            // Fallback: trust secure storage if offline
            setToken(savedToken);
            setIsAuthenticated(true);
            return true;
          }
        }
      }
      return false;
    } catch (error) {
      console.error('Biometric authentication failed:', error);
      return false;
    }
  };

  /**
   * Save biometric preference
   */
  const setBiometricsPreference = async (enabled: boolean): Promise<boolean> => {
    const success = await secureStorage.saveBiometricPreference(enabled);
    if (success) {
      setIsBiometricsEnabled(enabled);
    }
    return success;
  };

  /**
   * Log out and wipe secure storage
   */
  const logout = async () => {
    setIsLoading(true);
    await secureStorage.clearAll();
    setUser(null);
    setToken(null);
    setIsBiometricsEnabled(false);
    setIsAuthenticated(false);
    setIsLoading(false);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        isLoading,
        isBiometricsEnabled,
        deviceSupportsBiometrics,
        biometryType,
        isAuthenticated,
        login,
        logout,
        setBiometricsPreference,
        authenticateBiometrically,
        bootstrapSession
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
