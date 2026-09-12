import React, { createContext, useContext, useState, useEffect } from 'react';
import { useAuth } from '../hooks/useAuth';
import SecurityLockScreen from '../components/Security/SecurityLockScreen';

const SecurityLockContext = createContext();

const INACTIVITY_TIMEOUT_MS = 60000; // 1 minute inactivity timeout

export const SecurityLockProvider = ({ children }) => {
  const { user, loading } = useAuth();
  const [unlocked, setUnlocked] = useState(() => {
    const wasUnlocked = localStorage.getItem('udhaar-unlocked') === 'true';
    if (wasUnlocked) {
      const lastActiveRaw = localStorage.getItem('udhaar-last-active');
      if (!lastActiveRaw) {
        localStorage.setItem('udhaar-last-active', Date.now().toString());
        return true;
      }
      const lastActive = parseInt(lastActiveRaw, 10);
      const now = Date.now();
      if (!isNaN(lastActive) && lastActive > 0 && (now - lastActive < INACTIVITY_TIMEOUT_MS)) {
        return true;
      } else {
        localStorage.setItem('udhaar-unlocked', 'false');
        return false;
      }
    }
    return false;
  });

  const handleUnlock = () => {
    const now = Date.now().toString();
    localStorage.setItem('udhaar-unlocked', 'true');
    localStorage.setItem('udhaar-last-active', now);
    setUnlocked(true);
  };

  // Keep last-active timestamp updated during active user sessions & check for inactivity timeout
  useEffect(() => {
    if (!unlocked || !user || !user.hasPin) return;

    let lastUpdate = Date.now();
    localStorage.setItem('udhaar-last-active', lastUpdate.toString());

    const updateActivity = () => {
      const now = Date.now();
      // Throttle localStorage updates to once per second
      if (now - lastUpdate > 1000) {
        lastUpdate = now;
        localStorage.setItem('udhaar-last-active', now.toString());
      }
    };

    // Periodic check for 1-minute inactivity timeout
    const checkInactivityInterval = setInterval(() => {
      const lastActiveRaw = localStorage.getItem('udhaar-last-active');
      const now = Date.now();

      if (!lastActiveRaw) {
        localStorage.setItem('udhaar-last-active', now.toString());
        return;
      }

      const lastActive = parseInt(lastActiveRaw, 10);
      if (isNaN(lastActive) || lastActive <= 0) {
        localStorage.setItem('udhaar-last-active', now.toString());
        return;
      }

      if (now - lastActive >= INACTIVITY_TIMEOUT_MS) {
        setUnlocked(false);
        localStorage.setItem('udhaar-unlocked', 'false');
      }
    }, 3000);

    window.addEventListener('mousemove', updateActivity);
    window.addEventListener('keydown', updateActivity);
    window.addEventListener('click', updateActivity);
    window.addEventListener('scroll', updateActivity);
    window.addEventListener('touchstart', updateActivity);

    return () => {
      clearInterval(checkInactivityInterval);
      window.removeEventListener('mousemove', updateActivity);
      window.removeEventListener('keydown', updateActivity);
      window.removeEventListener('click', updateActivity);
      window.removeEventListener('scroll', updateActivity);
      window.removeEventListener('touchstart', updateActivity);
    };
  }, [unlocked, user]);

  // Sync state with localStorage changes on auth update
  useEffect(() => {
    const isUnlocked = localStorage.getItem('udhaar-unlocked') === 'true';
    if (isUnlocked && !unlocked) {
      const lastActiveRaw = localStorage.getItem('udhaar-last-active');
      const now = Date.now();
      if (!lastActiveRaw) {
        localStorage.setItem('udhaar-last-active', now.toString());
        setUnlocked(true);
        return;
      }
      const lastActive = parseInt(lastActiveRaw, 10);
      if (!isNaN(lastActive) && (now - lastActive < INACTIVITY_TIMEOUT_MS)) {
        setUnlocked(true);
      } else {
        localStorage.setItem('udhaar-unlocked', 'false');
      }
    }
  }, [user, unlocked]);

  // Lock the app when visibility becomes hidden (minimized, tab switch) only after 1 minute
  useEffect(() => {
    if (!user || !user.hasPin) return;

    const handleVisibilityChange = () => {
      const now = Date.now();
      if (document.visibilityState === 'hidden') {
        localStorage.setItem('udhaar-last-active', now.toString());
      } else if (document.visibilityState === 'visible') {
        const wasUnlocked = localStorage.getItem('udhaar-unlocked') === 'true';
        if (wasUnlocked) {
          const lastActiveRaw = localStorage.getItem('udhaar-last-active');
          if (!lastActiveRaw) {
            localStorage.setItem('udhaar-last-active', now.toString());
            return;
          }
          const lastActive = parseInt(lastActiveRaw, 10);
          if (!isNaN(lastActive) && (now - lastActive >= INACTIVITY_TIMEOUT_MS)) {
            setUnlocked(false);
            localStorage.setItem('udhaar-unlocked', 'false');
          } else {
            localStorage.setItem('udhaar-last-active', now.toString());
          }
        }
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
      localStorage.removeItem('udhaar-unlocked');
      localStorage.removeItem('udhaar-last-active');
    }
  }, [user]);

  if (loading) {
    return null;
  }

  const isLocked = user && user.hasPin && !unlocked;

  return (
    <SecurityLockContext.Provider value={{ unlocked, setUnlocked: handleUnlock }}>
      <div inert={isLocked ? "" : undefined} className={isLocked ? "select-none pointer-events-none" : ""}>
        {children}
      </div>
      {isLocked && (
        <SecurityLockScreen onUnlock={handleUnlock} />
      )}
    </SecurityLockContext.Provider>
  );
};

export const useSecurityLock = () => useContext(SecurityLockContext);
