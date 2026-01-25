import { useCallback, useRef } from 'react';
import { openDB } from 'idb';

const DB_NAME = 'nitrate-grain-session';
const STORE_NAME = 'session_store';
const KEY_FILE = 'active_file';
const KEY_ADJUSTMENTS = 'active_adjustments';

export const usePersistence = () => {
  const saveTimeoutRef = useRef(null);

  const getDB = async () => {
    return openDB(DB_NAME, 1, {
      upgrade(db) {
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME);
        }
      },
    });
  };

  const saveFile = useCallback(async (file) => {
    try {
      const db = await getDB();
      await db.put(STORE_NAME, file, KEY_FILE);
    } catch (err) {
      console.error('Failed to save file to session:', err);
    }
  }, []);

  const saveAdjustments = useCallback((adjustments) => {
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }

    saveTimeoutRef.current = setTimeout(async () => {
      try {
        const db = await getDB();
        // create a clean object ensuring no non-clonable data if strictly needed,
        // but structured clone handles most things.
        await db.put(STORE_NAME, adjustments, KEY_ADJUSTMENTS);
      } catch (err) {
        console.error('Failed to save adjustments:', err);
      }
    }, 1000); // Debounce 1s
  }, []);

  const loadSession = useCallback(async () => {
    try {
      const db = await getDB();
      const file = await db.get(STORE_NAME, KEY_FILE);
      const adjustments = await db.get(STORE_NAME, KEY_ADJUSTMENTS);

      if (file && adjustments) {
        return { file, adjustments };
      }
      return null;
    } catch (err) {
      console.error('Failed to load session:', err);
      return null;
    }
  }, []);

  const clearSession = useCallback(async () => {
    try {
      const db = await getDB();
      await db.delete(STORE_NAME, KEY_FILE);
      await db.delete(STORE_NAME, KEY_ADJUSTMENTS);
    } catch (err) {
      console.error('Failed to clear session:', err);
    }
  }, []);

  return {
    saveFile,
    saveAdjustments,
    loadSession,
    clearSession
  };
};
