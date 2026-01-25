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
      const db = await openDB(DB_NAME, DB_VERSION);
      const newLuts = [];

      // Convert FileList to array if needed
      const fileArray = Array.from(files);

      for (const file of fileArray) {
        try {
          const text = await file.text();
          const { size, data, title } = parseCubeLUT(text);

          const lutName = title === 'Untitled LUT' ? file.name : title;

          const lutRecord = {
            id: crypto.randomUUID(),
            name: lutName,
            size,
            data, // Float32Array
            dateAdded: Date.now()
          };

          await db.put(STORE_NAME, lutRecord);
          newLuts.push(lutRecord);
        } catch (parseErr) {
          console.error(`Failed to parse ${file.name}:`, parseErr);
          // We could return a partial error, but for now just log it
        }
      }

      setLuts(prev => [...prev, ...newLuts]);
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
