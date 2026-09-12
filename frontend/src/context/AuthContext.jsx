import { createContext, useState, useEffect } from 'react';
import API from '../api/axios';
import { toast } from 'react-toastify';
import { Capacitor } from '@capacitor/core';
import { BiometricService } from '../services/biometricService';

export const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchUser = async () => {
      setLoading(true);
      let nativeUser = null;

      // 1. If running as a native app, check if we have stored credentials in Keystore
      if (Capacitor.isNativePlatform()) {
        try {
          const creds = await BiometricService.getCredentials();
          if (creds && creds.username && creds.password) {
            // Yes, secure credentials exist. Prompt user for biometric verification.
            const verified = await BiometricService.authenticate();
            if (verified) {
              const dummyUser = { email: creds.username, token: creds.password };
              localStorage.setItem('udhaar-user', JSON.stringify(dummyUser));
              setUser(dummyUser);

              const { data } = await API.get('/auth/me');
              if (data.success) {
                const freshUser = { ...dummyUser, ...data.data };
                localStorage.setItem('udhaar-user', JSON.stringify(freshUser));
                setUser(freshUser);
                nativeUser = freshUser;
              } else {
                localStorage.removeItem('udhaar-user');
                setUser(null);
                await BiometricService.clearCredentials();
              }
            }
          }
        } catch (err) {
          console.warn("Biometric auto-login failed or was canceled:", err);
          localStorage.removeItem('udhaar-user');
          setUser(null);
        }
      }

      // 2. Fallback to localStorage check (always active on web and as fallback on mobile)
      if (!nativeUser) {
        const stored = JSON.parse(localStorage.getItem('udhaar-user'));
        if (stored?.token) {
          setUser(stored);
          try {
            const { data } = await API.get('/auth/me');
            if (data.success) {
              const freshUser = { ...stored, ...data.data };
              localStorage.setItem('udhaar-user', JSON.stringify(freshUser));
              setUser(freshUser);
            }
          } catch (err) {
            console.warn("Failed to fetch fresh user profile:", err);
          }
        }
      }
      setLoading(false);
    };
    fetchUser();
  }, []);

  // Inactivity Auto-Logout Tracker (15 minutes of inactivity)
  useEffect(() => {
    if (!user) return;

    let timeoutId;
    const INACTIVITY_LIMIT = 15 * 60 * 1000; // 15 minutes

    const resetTimer = () => {
      if (timeoutId) clearTimeout(timeoutId);
      timeoutId = setTimeout(() => {
        logout();
        toast.info('Logged out due to 15 minutes of inactivity.', {
          toastId: 'inactivity-logout-toast', // prevent duplicates
        });
      }, INACTIVITY_LIMIT);
    };

    const events = ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart', 'click'];
    events.forEach((event) => {
      window.addEventListener(event, resetTimer);
    });

    resetTimer();

    return () => {
      if (timeoutId) clearTimeout(timeoutId);
      events.forEach((event) => {
        window.removeEventListener(event, resetTimer);
      });
    };
  }, [user]);

  const login = async (email, password) => {
    const { data } = await API.post('/auth/login', { email, password });
    const userData = { ...data.data, token: data.token };
    localStorage.removeItem('udhaar-unlocked');
    localStorage.removeItem('udhaar-last-active');
    localStorage.setItem('udhaar-user', JSON.stringify(userData));
    setUser(userData);
    if (Capacitor.isNativePlatform() && userData.isBiometricEnabled) {
      await BiometricService.saveCredentials(userData.email, userData.token);
    }
    return userData;
  };

  const register = async (formData) => {
    const { data } = await API.post('/auth/register', formData);
    const userData = { ...data.data, token: data.token };
    localStorage.setItem('udhaar-user', JSON.stringify(userData));
    setUser(userData);
    return userData;
  };

  const googleSignIn = async (token) => {
    const { data } = await API.post('/auth/google', { token });
    const userData = { ...data.data, token: data.token };
    localStorage.removeItem('udhaar-unlocked');
    localStorage.removeItem('udhaar-last-active');
    localStorage.setItem('udhaar-user', JSON.stringify(userData));
    setUser(userData);
    return userData;
  };

  const mockGoogleSignIn = async (email, name, avatar) => {
    const { data } = await API.post('/auth/google-mock', { email, name, avatar });
    const userData = { ...data.data, token: data.token };
    localStorage.removeItem('udhaar-unlocked');
    localStorage.removeItem('udhaar-last-active');
    localStorage.setItem('udhaar-user', JSON.stringify(userData));
    setUser(userData);
    return userData;
  };

  const logout = () => {
    localStorage.removeItem('udhaar-user');
    localStorage.removeItem('udhaar-unlocked');
    localStorage.removeItem('udhaar-last-active');
    setUser(null);
    if (Capacitor.isNativePlatform()) {
      BiometricService.clearCredentials();
    }
  };

  const updateUser = (updatedData) => {
    const newUser = { ...user, ...updatedData };
    localStorage.setItem('udhaar-user', JSON.stringify(newUser));
    setUser(newUser);
    if (Capacitor.isNativePlatform()) {
      if (newUser?.isBiometricEnabled && newUser?.token) {
        BiometricService.saveCredentials(newUser.email, newUser.token);
      } else if (newUser?.isBiometricEnabled === false) {
        BiometricService.clearCredentials();
      }
    }
  };

  const biometricLogin = async () => {
    const creds = await BiometricService.getCredentials();
    if (!creds || !creds.username || !creds.password) {
      throw new Error("No secure credentials registered.");
    }
    const dummyUser = { email: creds.username, token: creds.password };
    localStorage.setItem('udhaar-user', JSON.stringify(dummyUser));
    setUser(dummyUser);
    try {
      const { data } = await API.get('/auth/me');
      if (data.success) {
        const freshUser = { ...dummyUser, ...data.data };
        localStorage.setItem('udhaar-user', JSON.stringify(freshUser));
        setUser(freshUser);
        return freshUser;
      } else {
        throw new Error("Token verification failed");
      }
    } catch (err) {
      localStorage.removeItem('udhaar-user');
      setUser(null);
      if (Capacitor.isNativePlatform()) {
        await BiometricService.clearCredentials();
      }
      throw err;
    }
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, register, googleSignIn, mockGoogleSignIn, logout, updateUser, biometricLogin }}>
      {children}
    </AuthContext.Provider>
  );
};
