import { openDB } from 'idb';

const DB_NAME = 'nitrate-grain-gallery-store';
const DB_VERSION = 1;
const META_STORE = 'gallery_meta';
const FILE_STORE = 'gallery_files';
const STATE_STORE = 'gallery_states';

export const useGalleryStorage = () => {

  const getDB = async () => {
    return openDB(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains(META_STORE)) {
          db.createObjectStore(META_STORE, { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains(FILE_STORE)) {
          db.createObjectStore(FILE_STORE, { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains(STATE_STORE)) {
          db.createObjectStore(STATE_STORE, { keyPath: 'id' });
        }
      },
    });
  };

  const getImages = async () => {
    const db = await getDB();
    // Returns array of metadata objects (lightweight)
    // sort by date desc
    const images = await db.getAll(META_STORE);
    return images.sort((a, b) => b.date - a.date);
  };

  const addImage = async (file, thumbnailData, id) => {
    const db = await getDB();
    const count = await db.count(META_STORE);
    if (count >= 15) {
      throw new Error("Gallery is full (15 images max). Please delete some images.");
    }

    const tx = db.transaction([META_STORE, FILE_STORE, STATE_STORE], 'readwrite');

    // Meta
    await tx.objectStore(META_STORE).add({
      id,
      name: file.name,
      date: Date.now(),
      thumbnail: thumbnailData // Blob or DataURL
    });

    // File
    await tx.objectStore(FILE_STORE).add({
      id,
      file
    });

    // Default State
    await tx.objectStore(STATE_STORE).add({
        id,
        adjustments: null
    });

    await tx.done;
  };

  const removeImage = async (id) => {
    const db = await getDB();
    const tx = db.transaction([META_STORE, FILE_STORE, STATE_STORE], 'readwrite');
    await tx.objectStore(META_STORE).delete(id);
    await tx.objectStore(FILE_STORE).delete(id);
    await tx.objectStore(STATE_STORE).delete(id);
    await tx.done;
  };

  const getImageFile = async (id) => {
    const db = await getDB();
    const result = await db.get(FILE_STORE, id);
    return result ? result.file : null;
  };

  const saveState = async (id, adjustments) => {
      const db = await getDB();
      await db.put(STATE_STORE, { id, adjustments });
  };

  const loadState = async (id) => {
      const db = await getDB();
      const result = await db.get(STATE_STORE, id);
      return result ? result.adjustments : null;
  };

  return {
    getImages,
    addImage,
    removeImage,
    getImageFile,
    saveState,
    loadState
  };
};
