import React, { createContext, useContext, useState, useEffect } from 'react';
import { useAuth } from '../hooks/useAuth';
import SecurityLockScreen from '../components/Security/SecurityLockScreen';

const SecurityLockContext = createContext();

export const SecurityLockProvider = ({ children }) => {
  const { user, loading } = useAuth();
  const [unlocked, setUnlocked] = useState(() => {
    return sessionStorage.getItem('udhaar-unlocked') === 'true';
  });

  // Sync state with sessionStorage changes on auth update
  useEffect(() => {
    const isUnlocked = sessionStorage.getItem('udhaar-unlocked') === 'true';
    if (isUnlocked && !unlocked) {
      setUnlocked(true);
    }
  }, [user, unlocked]);

  // Lock the app when visibility becomes hidden (minimized, tab switch, locked screen)
  useEffect(() => {
    if (!user || !user.hasPin) return;

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        setUnlocked(false);
        sessionStorage.setItem('udhaar-unlocked', 'false');
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [user]);

  // Reset unlocked state when user logs out
  useEffect(() => {
    if (!user) {
      setUnlocked(false);
      sessionStorage.removeItem('udhaar-unlocked');
    }
  }, [user]);

  const handleUnlock = () => {
    sessionStorage.setItem('udhaar-unlocked', 'true');
    setUnlocked(true);
  };

  if (loading) {
    return null; // Let the main router handle loading
  }

  // Show lock screen if user is logged in, has setup a PIN, and app is locked
  if (user && user.hasPin && !unlocked) {
    return <SecurityLockScreen onUnlock={handleUnlock} />;
  }

  return (
    <SecurityLockContext.Provider value={{ unlocked, setUnlocked: handleUnlock }}>
      {children}
    </SecurityLockContext.Provider>
  );
};

export const useSecurityLock = () => useContext(SecurityLockContext);
