import { useState, useEffect, useCallback, useRef } from 'react';
import { useGalleryStorage } from './useGalleryStorage';

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

        const fileList = Array.from(files);

        for (const file of fileList) {
             try {
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
        saveSelectedState
    };
};
