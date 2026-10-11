import { useEffect, useRef } from 'react';

export const useSocketSync = (callback, types = []) => {
  const callbackRef = useRef(callback);
  callbackRef.current = callback;

  const typesRef = useRef(types);
  typesRef.current = types;

  useEffect(() => {
    const handleRefresh = (event) => {
      const { type } = event.detail || {};
      const currentTypes = typesRef.current;
      // If no specific types are listed, refresh on all. Otherwise, refresh only if type matches.
      if (!currentTypes || currentTypes.length === 0 || currentTypes.includes(type)) {
        callbackRef.current?.(type);
      }
    };

    window.addEventListener('socket_refresh', handleRefresh);

    return () => {
      window.removeEventListener('socket_refresh', handleRefresh);
    };
  }, []);
};

