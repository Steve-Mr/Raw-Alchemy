import { openDB } from 'idb';

const DB_NAME = 'nitrate-grain-gallery';
const DB_VERSION = 1;

// Approximate limit: 500MB or 20 images
const STORAGE_LIMIT_MB = 500;
const MAX_IMAGES = 20;

export const initDB = async () => {
  return openDB(DB_NAME, DB_VERSION, {
    upgrade(db) {
      if (!db.objectStoreNames.contains('images')) {
        const imgStore = db.createObjectStore('images', { keyPath: 'id' });
        imgStore.createIndex('date', 'date');
      }
      if (!db.objectStoreNames.contains('luts')) {
        db.createObjectStore('luts', { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains('settings')) {
        db.createObjectStore('settings', { keyPath: 'key' });
      }
    },
  });
};

export const checkQuota = async (fileSize) => {
  if (navigator.storage && navigator.storage.estimate) {
    const estimate = await navigator.storage.estimate();
    // detailed logic can go here, for now we rely on logical limits
  }

  const db = await initDB();
  const count = await db.count('images');
  if (count >= MAX_IMAGES) {
    throw new Error(`Gallery limit reached (${MAX_IMAGES} images). Please delete some images.`);
  }

  // We can add size check if we store size metadata
  return true;
};

export const saveImageToGallery = async (id, file, thumbnailBlob, metadata, width, height) => {
  const db = await initDB();

  await checkQuota(file.size);

  const entry = {
    id,
    filename: file.name,
    date: new Date(),
    file, // Blob/File
    thumbnail: thumbnailBlob,
    metadata,
    width,
    height,
    editState: null // Initial state is null
  };

  await db.put('images', entry);
  return entry;
};

export const getImages = async () => {
  const db = await initDB();
  return db.getAllFromIndex('images', 'date');
};

export const getImage = async (id) => {
  const db = await initDB();
  return db.get('images', id);
};

export const deleteImage = async (id) => {
  const db = await initDB();
  return db.delete('images', id);
};

export const updateImageState = async (id, state) => {
  const db = await initDB();
  const image = await db.get('images', id);
  if (image) {
    image.editState = state;
    image.date = new Date(); // Update access time
    await db.put('images', image);
  }
};

// LUTs
export const saveLut = async (lut) => {
  // lut: { id: string, name: string, data: Float32Array, size: number }
  const db = await initDB();
  await db.put('luts', lut);
};

export const getLuts = async () => {
  const db = await initDB();
  return db.getAll('luts');
};

export const deleteLut = async (id) => {
  const db = await initDB();
  await db.delete('luts', id);
};
