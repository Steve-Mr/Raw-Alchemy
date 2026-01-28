import { useState, useEffect, useCallback, useRef } from 'react';
import { useGalleryStorage } from './useGalleryStorage';
import { validateFile } from '../utils/validation';

export const useGallery = () => {
    const storage = useGalleryStorage();
    const [images, setImages] = useState([]);
    const [selectedId, setSelectedId] = useState(null);
    const [error, setError] = useState(null);
    const [isProcessing, setIsProcessing] = useState(false);

    // Worker for thumbnails
    const workerRef = useRef(null);

    useEffect(() => {
        // Init worker
        workerRef.current = new Worker(new URL('../workers/raw.worker.js', import.meta.url), { type: 'module' });
        return () => workerRef.current?.terminate();
    }, []);

    const refreshImages = useCallback(async () => {
        const list = await storage.getImages();
        setImages(list);
    }, [storage]);

    useEffect(() => {
        refreshImages();
    }, [refreshImages]);

    const extractThumbnail = useCallback((file) => {
        return new Promise((resolve, reject) => {
            const worker = workerRef.current;
            const msgId = Math.random().toString(36).substring(7);

            const handler = (e) => {
                if (e.data.id === msgId) {
                    worker.removeEventListener('message', handler);
                    if (e.data.type === 'thumbSuccess') {
                        resolve(e.data);
                    } else {
                        reject(new Error(e.data.error || 'Unknown thumbnail error'));
                    }
                }
            };

            worker.addEventListener('message', handler);

            file.arrayBuffer().then(buffer => {
                worker.postMessage({
                    command: 'extractThumbnail',
                    fileBuffer: buffer,
                    id: msgId
                }, [buffer]);
            }).catch(reject);
        });
    }, []);

    const addPhotos = useCallback(async (files) => {
        setIsProcessing(true);
        setError(null);
        let firstAddedId = null;

        // Get current images for duplicate detection
        const currentImages = await storage.getImages();
        const fileList = Array.from(files);
        const uniqueFiles = [];
        const duplicates = [];

        // Check for duplicates
        fileList.forEach(file => {
            const isDuplicate = currentImages.some(img =>
                img.name === file.name &&
                img.size === file.size &&
                // Relaxed date check: Only if both exist and match, OR if date is missing (common on mobile) ignore it and trust size/name
                (!img.lastModified || !file.lastModified || img.lastModified === file.lastModified)
            );
            if (isDuplicate) {
                duplicates.push(file.name);
            } else {
                uniqueFiles.push(file);
            }
        });

        // Prompt if duplicates found
        if (duplicates.length > 0) {
            const message = `The following images appear to be duplicates:\n\n${duplicates.join('\n')}\n\nDo you want to upload them anyway?`;
            if (window.confirm(message)) {
                // User confirmed, process all files including duplicates
            } else {
                setIsProcessing(false);
                return null;
            }
        }

        for (const file of fileList) {
             try {
                 // Validate file
                 const validation = validateFile(file);
                 if (!validation.valid) {
                     console.warn("Validation failed:", validation.error);
                     setError(prev => prev ? `${prev}\n${validation.error}` : validation.error);
                     continue;
                 }

                 const id = crypto.randomUUID();

                 // 1. Get Thumbnail
                 let thumbBlob = null;
                 try {
                    const thumbData = await extractThumbnail(file);
                    // LibRaw usually extracts embedded JPEG.
                    thumbBlob = new Blob([thumbData.data], { type: 'image/jpeg' });
                 } catch (thumbErr) {
                     console.warn("Thumbnail extraction failed for", file.name, thumbErr);
                 }

                 // 2. Save to DB
                 await storage.addImage(file, thumbBlob, id);
                 if (!firstAddedId) firstAddedId = id;

             } catch (err) {
                 console.error("Failed to add photo", err);
                 setError(err.message);
                 // If limit reached, break
                 if (err.message.includes("limit") || err.message.includes("full")) break;
             }
        }
        await refreshImages();
        setIsProcessing(false);
        return firstAddedId;
    }, [storage, refreshImages, extractThumbnail]);

    const deletePhoto = useCallback(async (id) => {
        await storage.removeImage(id);
        setSelectedId(current => current === id ? null : current);
        await refreshImages();
    }, [storage, refreshImages]);

    const selectPhoto = useCallback((id) => {
        setSelectedId(id);
    }, []);

    // Helpers
    const getSelectedFile = useCallback(async () => {
        if (!selectedId) return null;
        return await storage.getImageFile(selectedId);
    }, [selectedId, storage]);

    const getSelectedState = useCallback(async () => {
        if (!selectedId) return null;
        return await storage.loadState(selectedId);
    }, [selectedId, storage]);

    const saveSelectedState = useCallback(async (adjustments) => {
        if (!selectedId) return;
        await storage.saveState(selectedId, adjustments);
    }, [selectedId, storage]);

    const getFile = useCallback(async (id) => {
        return await storage.getImageFile(id);
    }, [storage]);

    const getState = useCallback(async (id) => {
        return await storage.loadState(id);
    }, [storage]);

    const saveState = useCallback(async (id, adjustments) => {
        await storage.saveState(id, adjustments);
    }, [storage]);

    return {
        images,
        selectedId,
        selectPhoto,
        addPhotos,
        deletePhoto,
        error,
        refreshImages,
        isProcessing,
        getSelectedFile,
        getSelectedState,
        saveSelectedState,
        getFile,
        getState,
        saveState
    };
};
