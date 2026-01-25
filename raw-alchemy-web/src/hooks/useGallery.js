import { useState, useEffect, useCallback } from 'react';
import { openDB } from 'idb';

const DB_NAME = 'nitrate-grain-gallery';
const STORE_NAME = 'images';
const META_STORE = 'meta'; // For storing activeId
const MAX_IMAGES = 10;
const MAX_TOTAL_SIZE_BYTES = 500 * 1024 * 1024; // 500MB

export const useGallery = () => {
  const [images, setImages] = useState([]);
  const [activeId, setActiveId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Initialize DB and load data
  useEffect(() => {
    const initDB = async () => {
      try {
        const db = await openDB(DB_NAME, 1, {
          upgrade(db) {
            if (!db.objectStoreNames.contains(STORE_NAME)) {
              db.createObjectStore(STORE_NAME, { keyPath: 'id' });
            }
            if (!db.objectStoreNames.contains(META_STORE)) {
              db.createObjectStore(META_STORE);
            }
          },
        });

        const storedImages = await db.getAll(STORE_NAME);
        const storedActiveId = await db.get(META_STORE, 'activeId');

        // Verify blob existence and validity (sometimes blobs get revoked or fail)
        const validImages = storedImages.filter(img => img.file instanceof Blob);

        setImages(validImages);
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
      const db = await openDB(DB_NAME, 1);
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
      const db = await openDB(DB_NAME, 1);
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
          settings: null // Will be populated when image is first processed
        };

        await db.put(STORE_NAME, newImage);
        addedImages.push(newImage);
        currentTotalSize += file.size;
      }

      if (addedImages.length > 0) {
        setImages(prev => [...prev, ...addedImages]);
        // If no active image, set the first new one as active
        if (!activeId && currentImages.length === 0) {
           setActive(addedImages[0].id);
        } else if (addedImages.length === 1 && currentImages.length === 0) {
            // If it's the first image ever, make it active
            setActive(addedImages[0].id);
        }
      }

      return addedImages; // Return array of added images
    } catch (err) {
      console.error('Failed to add images:', err);
      setError('Failed to save images to storage.');
      return [];
    }
  }, [activeId, setActive]);

  const removeImage = useCallback(async (id) => {
    try {
      const db = await openDB(DB_NAME, 1);
      await db.delete(STORE_NAME, id);

      setImages(prev => {
        const newImages = prev.filter(img => img.id !== id);
        // Handle active ID change if we deleted the active image
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
      // Optimistic update
      setImages(prev => prev.map(img =>
          img.id === id ? { ...img, ...updates } : img
      ));

      try {
          const db = await openDB(DB_NAME, 1);
          const img = await db.get(STORE_NAME, id);
          if (img) {
              Object.assign(img, updates);
              await db.put(STORE_NAME, img);
          }
      } catch (err) {
          console.error("Failed to update image:", err);
      }
  }, []);

  const clearGallery = useCallback(async () => {
      try {
          const db = await openDB(DB_NAME, 1);
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
    activeId,
    loading,
    error,
    addImages,
    removeImage,
    setActive,
    updateImage,
    clearGallery
  };
};
