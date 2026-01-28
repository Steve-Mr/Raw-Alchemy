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

    const extractThumbnail = (file) => {
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
    };

    const addPhotos = async (files) => {
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
                // (Or should we process uniqueFiles + duplicates? Logic implies we process original list)
                // If user confirms, we usually want to allow the upload (creating a "copy").
                // So we use fileList.
                // If user cancels, we abort the WHOLE operation or just skip duplicates?
                // Standard behavior: "Skip duplicates" vs "Cancel all".
                // User request: "If user confirms still want to upload, then upload".
                // This implies "Yes" -> Upload everything. "No" -> Cancel.
            } else {
                setIsProcessing(false);
                return null;
            }
        }

        // Process files (either unique list or full list if confirmed)
        // Actually, if I upload the exact same file again, IndexedDB might allow it with a new UUID.

        for (const file of fileList) {
             try {
                 // Validate file
                 const validation = validateFile(file);
                 if (!validation.valid) {
                     console.warn("Validation failed:", validation.error);
                     setError(validation.error);
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
    };

    const deletePhoto = async (id) => {
        await storage.removeImage(id);
        if (selectedId === id) setSelectedId(null);
        await refreshImages();
    };

    const selectPhoto = (id) => {
        setSelectedId(id);
    };

    // Helpers
    const getSelectedFile = async () => {
        if (!selectedId) return null;
        return await storage.getImageFile(selectedId);
    };

    const getSelectedState = async () => {
        if (!selectedId) return null;
        return await storage.loadState(selectedId);
    };

    const saveSelectedState = async (adjustments) => {
        if (!selectedId) return;
        await storage.saveState(selectedId, adjustments);
    };

    const getFile = async (id) => {
        return await storage.getImageFile(id);
    };

    const getState = async (id) => {
        return await storage.loadState(id);
    };

    const saveState = async (id, adjustments) => {
        await storage.saveState(id, adjustments);
    };

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
