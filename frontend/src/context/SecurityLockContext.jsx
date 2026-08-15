import React, { createContext, useContext, useState, useEffect } from 'react';
import { useAuth } from '../hooks/useAuth';
import SecurityLockScreen from '../components/Security/SecurityLockScreen';

const SecurityLockContext = createContext();

export const SecurityLockProvider = ({ children }) => {
  const { user, loading } = useAuth();
  const [unlocked, setUnlocked] = useState(() => {
    const wasUnlocked = localStorage.getItem('udhaar-unlocked') === 'true';
    if (wasUnlocked) {
      const lastActive = parseInt(localStorage.getItem('udhaar-last-active') || '0', 10);
      const now = Date.now();
      if (now - lastActive < 40000) {
        return true;
      } else {
        localStorage.setItem('udhaar-unlocked', 'false');
        return false;
      }
    }
    return false;
  });

  // Keep last-active timestamp updated during active user sessions
  useEffect(() => {
    if (!unlocked || !user) return;

    let lastUpdate = Date.now();
    localStorage.setItem('udhaar-last-active', lastUpdate.toString());

    const updateActivity = () => {
      const now = Date.now();
      // Throttle localStorage updates to prevent performance degradation
      if (now - lastUpdate > 5000) {
        lastUpdate = now;
        localStorage.setItem('udhaar-last-active', now.toString());
      }
    };

    window.addEventListener('mousemove', updateActivity);
    window.addEventListener('keydown', updateActivity);
    window.addEventListener('click', updateActivity);
    window.addEventListener('scroll', updateActivity);
    window.addEventListener('touchstart', updateActivity);

    return () => {
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
      const lastActive = parseInt(localStorage.getItem('udhaar-last-active') || '0', 10);
      const now = Date.now();
      if (now - lastActive < 40000) {
        setUnlocked(true);
      } else {
        localStorage.setItem('udhaar-unlocked', 'false');
      }
    }
  }, [user, unlocked]);

  // Lock the app when visibility becomes hidden (minimized, tab switch, locked screen) with a 40s grace period
  useEffect(() => {
    if (!user || !user.hasPin) return;

    const handleVisibilityChange = () => {
      const now = Date.now();
      if (document.visibilityState === 'hidden') {
        localStorage.setItem('udhaar-last-active', now.toString());
      } else if (document.visibilityState === 'visible') {
        const wasUnlocked = localStorage.getItem('udhaar-unlocked') === 'true';
        if (wasUnlocked) {
          const lastActive = parseInt(localStorage.getItem('udhaar-last-active') || '0', 10);
          if (now - lastActive >= 40000) {
            setUnlocked(false);
            localStorage.setItem('udhaar-unlocked', 'false');
          } else {
            // Refreshes the last active time as long as user is active
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

  const handleUnlock = () => {
    localStorage.setItem('udhaar-unlocked', 'true');
    localStorage.setItem('udhaar-last-active', Date.now().toString());
    setUnlocked(true);
  };

  if (loading) {
    return null; // Let the main router handle loading
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
