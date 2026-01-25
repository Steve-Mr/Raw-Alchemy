import { useState, useEffect, useCallback } from 'react';
import { openDB } from 'idb';

const DB_NAME = 'nitrate-grain-gallery';
const STORE_NAME = 'images';
const META_STORE = 'meta'; // For storing activeId
const LUT_STORE = 'luts';
const MAX_IMAGES = 10;
const MAX_TOTAL_SIZE_BYTES = 500 * 1024 * 1024; // 500MB

export const useGallery = () => {
  const [images, setImages] = useState([]);
  const [luts, setLuts] = useState([]);
  const [activeId, setActiveId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Initialize DB and load data
  useEffect(() => {
    const initDB = async () => {
      try {
        const db = await openDB(DB_NAME, 2, {
          upgrade(db, oldVersion, newVersion, transaction) {
            if (!db.objectStoreNames.contains(STORE_NAME)) {
              db.createObjectStore(STORE_NAME, { keyPath: 'id' });
            }
            if (!db.objectStoreNames.contains(META_STORE)) {
              db.createObjectStore(META_STORE);
            }
            if (!db.objectStoreNames.contains(LUT_STORE)) {
              db.createObjectStore(LUT_STORE, { keyPath: 'id' });
            }
          },
        });

        const storedImages = await db.getAll(STORE_NAME);
        const storedLuts = await db.getAll(LUT_STORE);
        const storedActiveId = await db.get(META_STORE, 'activeId');

        // Verify blob existence
        const validImages = storedImages.filter(img => img.file instanceof Blob);

        setImages(validImages);
        setLuts(storedLuts || []);

        if (storedActiveId && validImages.find(img => img.id === storedActiveId)) {
          setActiveId(storedActiveId);
        } else if (validImages.length > 0) {
          setActiveId(validImages[0].id);
        }

        setLoading(false);
      } catch (err) {
        console.error('Failed to initialize gallery DB:', err);
        setError('Failed to load gallery history');
        setLoading(false);
      }
    };

    initDB();
  }, []);

  const persistActiveId = useCallback(async (id) => {
    try {
      const db = await openDB(DB_NAME, 2);
      await db.put(META_STORE, id, 'activeId');
    } catch (err) {
      console.error('Failed to persist activeId:', err);
    }
  }, []);

  const setActive = useCallback((id) => {
    setActiveId(id);
    persistActiveId(id);
  }, [persistActiveId]);

  const addImages = useCallback(async (newFiles) => {
    setError(null);
    try {
      const db = await openDB(DB_NAME, 2);
      const currentImages = await db.getAll(STORE_NAME);

      let currentTotalSize = currentImages.reduce((acc, img) => acc + img.file.size, 0);
      let addedImages = [];

      for (const file of newFiles) {
        // Check Limits
        if (currentImages.length + addedImages.length >= MAX_IMAGES) {
          setError(`Limit reached: Max ${MAX_IMAGES} images allowed.`);
          break;
        }
        if (currentTotalSize + file.size > MAX_TOTAL_SIZE_BYTES) {
          setError(`Storage limit reached: Max 500MB allowed.`);
          break;
        }

        const id = crypto.randomUUID();
        const newImage = {
          id,
          file,
          name: file.name,
          timestamp: Date.now(),
          settings: null,
          thumbnail: null
        };

        await db.put(STORE_NAME, newImage);
        addedImages.push(newImage);
        currentTotalSize += file.size;
      }

      if (addedImages.length > 0) {
        setImages(prev => [...prev, ...addedImages]);
        if (!activeId && currentImages.length === 0) {
           setActive(addedImages[0].id);
        } else if (addedImages.length === 1 && currentImages.length === 0) {
            setActive(addedImages[0].id);
        }
      }

      return addedImages;
    } catch (err) {
      console.error('Failed to add images:', err);
      setError('Failed to save images to storage.');
      return [];
    }
  }, [activeId, setActive]);

  const removeImage = useCallback(async (id) => {
    try {
      const db = await openDB(DB_NAME, 2);
      await db.delete(STORE_NAME, id);

      setImages(prev => {
        const newImages = prev.filter(img => img.id !== id);
        if (id === activeId) {
           const nextActive = newImages.length > 0 ? newImages[newImages.length - 1].id : null;
           setActive(nextActive);
        }
        return newImages;
      });
    } catch (err) {
      console.error('Failed to remove image:', err);
    }
  }, [activeId, setActive]);

  const updateImage = useCallback(async (id, updates) => {
      setImages(prev => prev.map(img =>
          img.id === id ? { ...img, ...updates } : img
      ));

      try {
          const db = await openDB(DB_NAME, 2);
          const img = await db.get(STORE_NAME, id);
          if (img) {
              Object.assign(img, updates);
              await db.put(STORE_NAME, img);
          }
      } catch (err) {
          console.error("Failed to update image:", err);
      }
  }, []);

  // LUT Management
  const addLuts = useCallback(async (files) => {
      try {
          const db = await openDB(DB_NAME, 2);
          let addedLuts = [];

          for (const file of files) {
              const text = await file.text();
              // Validate simple LUT? We trust the component to validate content if needed,
              // but here we just store raw text/file to avoid reparsing constantly.
              // Actually, parsing in component is better. Storing the File blob is efficient.

              const id = crypto.randomUUID();
              const newLut = {
                  id,
                  name: file.name,
                  file: file, // Store the Blob
                  size: file.size
              };

              await db.put(LUT_STORE, newLut);
              addedLuts.push(newLut);
          }

          setLuts(prev => [...prev, ...addedLuts]);
          return addedLuts;
      } catch (err) {
          console.error("Failed to add LUTs:", err);
          setError("Failed to save LUTs");
      }
  }, []);

  const removeLut = useCallback(async (id) => {
      try {
          const db = await openDB(DB_NAME, 2);
          await db.delete(LUT_STORE, id);
          setLuts(prev => prev.filter(l => l.id !== id));
      } catch (err) {
          console.error("Failed to remove LUT:", err);
      }
  }, []);

  const clearGallery = useCallback(async () => {
      try {
          const db = await openDB(DB_NAME, 2);
          await db.clear(STORE_NAME);
          await db.delete(META_STORE, 'activeId');
          setImages([]);
          setActiveId(null);
      } catch (err) {
          console.error("Failed to clear gallery:", err);
      }
  }, []);

  return {
    images,
    luts,
    activeId,
    loading,
    error,
    addImages,
    removeImage,
    updateImage,
    setActive,
    clearGallery,
    addLuts,
    removeLut
  };
};
