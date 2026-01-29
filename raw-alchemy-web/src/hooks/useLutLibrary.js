import { useState, useEffect, useCallback } from 'react';
import { openDB } from 'idb';
import { parseCubeLUT } from '../utils/lutParser';

const DB_NAME = 'nitrate-grain-gallery';
const STORE_NAME = 'luts';
const DB_VERSION = 1;

export const useLutLibrary = () => {
  const [luts, setLuts] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  // Initialize DB and load LUTs
  useEffect(() => {
    const initDB = async () => {
      try {
        const db = await openDB(DB_NAME, DB_VERSION, {
          upgrade(db) {
            if (!db.objectStoreNames.contains(STORE_NAME)) {
              db.createObjectStore(STORE_NAME, { keyPath: 'id' });
            }
          },
        });

        const allLuts = await db.getAll(STORE_NAME);
        setLuts(allLuts);
      } catch (err) {
        console.error('Failed to load LUT library:', err);
        setError(err);
      } finally {
        setIsLoading(false);
      }
    };

    initDB();
  }, []);

  const importLuts = useCallback(async (files) => {
    setIsLoading(true);
    setError(null);
    try {
      // Convert FileList to array immediately to avoid race conditions
      // where the input is cleared before the async operation completes
      const fileArray = Array.from(files);

      const db = await openDB(DB_NAME, DB_VERSION);
      // 1. Read and parse files in parallel
      const parsePromises = fileArray.map(async (file) => {
        try {
          const text = await file.text();
          const { size, data, title } = parseCubeLUT(text);

          const lutName = title === 'Untitled LUT' ? file.name : title;

          return {
            id: crypto.randomUUID(),
            name: lutName,
            size,
            data, // Float32Array
            dateAdded: Date.now()
          };
        } catch (parseErr) {
          console.error(`Failed to parse ${file.name}:`, parseErr);
          return null;
        }
      });

      const results = await Promise.all(parsePromises);
      const validLuts = results.filter(lut => lut !== null);

      // 2. Batch write to database in a single transaction
      if (validLuts.length > 0) {
        const tx = db.transaction(STORE_NAME, 'readwrite');
        // idb's transaction.objectStore returns a store wrapper that doesn't need explicit request waiting
        // but parallel operations on the store are faster
        await Promise.all([
          ...validLuts.map(lut => tx.store.put(lut)),
          tx.done
        ]);

        setLuts(prev => [...prev, ...validLuts]);
      }
    } catch (err) {
      console.error('Error importing LUTs:', err);
      setError(err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const deleteLut = useCallback(async (id) => {
    try {
      const db = await openDB(DB_NAME, DB_VERSION);
      await db.delete(STORE_NAME, id);
      setLuts(prev => prev.filter(lut => lut.id !== id));
    } catch (err) {
      console.error('Error deleting LUT:', err);
      setError(err);
    }
  }, []);

  return {
    luts,
    isLoading,
    error,
    importLuts,
    deleteLut
  };
};
