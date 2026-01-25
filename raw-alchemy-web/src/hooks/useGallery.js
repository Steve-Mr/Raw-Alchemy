import { useState, useEffect, useCallback, useRef } from 'react';
import {
    saveImageToGallery,
    getImages,
    deleteImage,
    updateImageState,
    saveLut,
    getLuts,
    deleteLut
} from '../utils/galleryStore';

export const useGallery = () => {
    const [images, setImages] = useState([]);
    const [luts, setLuts] = useState([]);
    const [activeImageId, setActiveImageId] = useState(null);
    const [processingQueue, setProcessingQueue] = useState([]);
    const [error, setError] = useState(null);

    // Worker for background thumbnail generation
    const thumbWorkerRef = useRef(null);

    useEffect(() => {
        refreshGallery();
        return () => {
            thumbWorkerRef.current?.terminate();
        };
    }, []);

    const refreshGallery = async () => {
        try {
            const imgs = await getImages();
            const storedLuts = await getLuts();
            // Sort by date desc (newest first)
            imgs.sort((a, b) => new Date(b.date) - new Date(a.date));
            setImages(imgs);
            setLuts(storedLuts);
        } catch (err) {
            console.error("Failed to load gallery:", err);
            setError(err.message);
        }
    };

    const processUploads = useCallback(async (files) => {
        setError(null);
        if (!files || files.length === 0) return;

        // Initialize worker if needed
        if (!thumbWorkerRef.current) {
            thumbWorkerRef.current = new Worker(new URL('../workers/raw.worker.js', import.meta.url), { type: 'module' });
        }

        const queue = Array.from(files).map(f => ({
            file: f,
            id: crypto.randomUUID(),
            status: 'pending'
        }));

        setProcessingQueue(prev => [...prev, ...queue]);

        // Process sequentially to avoid OOM
        for (const item of queue) {
            setProcessingQueue(prev => prev.map(p => p.id === item.id ? { ...p, status: 'processing' } : p));

            try {
                const buffer = await item.file.arrayBuffer();

                // Use a Promise to wait for worker response
                const thumbData = await new Promise((resolve, reject) => {
                    const handler = (e) => {
                        if (e.data.id === item.id) {
                            thumbWorkerRef.current.removeEventListener('message', handler);
                            if (e.data.type === 'thumbnail_success') {
                                resolve(e.data);
                            } else if (e.data.type === 'error') {
                                reject(new Error(e.data.error));
                            }
                        }
                    };
                    thumbWorkerRef.current.addEventListener('message', handler);

                    thumbWorkerRef.current.postMessage({
                        command: 'thumbnail',
                        fileBuffer: buffer,
                        id: item.id
                    }, [buffer]);
                });

                // Create Blob from buffer if needed (if worker returned ArrayBuffer)
                let thumbBlob;
                if (thumbData.blob) {
                    thumbBlob = thumbData.blob;
                } else if (thumbData.buffer) {
                    const canvas = new OffscreenCanvas(thumbData.width, thumbData.height);
                    const ctx = canvas.getContext('2d');
                    const imgData = new ImageData(new Uint8ClampedArray(thumbData.buffer), thumbData.width, thumbData.height);
                    ctx.putImageData(imgData, 0, 0);
                    thumbBlob = await canvas.convertToBlob({ type: 'image/jpeg', quality: 0.7 });
                }

                await saveImageToGallery(
                    item.id,
                    item.file,
                    thumbBlob,
                    thumbData.meta,
                    thumbData.width || 0, // Fallback if meta missing
                    thumbData.height || 0
                );

                // Refresh list
                await refreshGallery();

                // Auto-select if it's the first one and nothing selected
                setActiveImageId(curr => curr === null ? item.id : curr);

            } catch (err) {
                console.error(`Failed to process ${item.file.name}:`, err);
                setError(`Failed to process ${item.file.name}: ${err.message}`);
            } finally {
                // Must ensure this update happens
                setProcessingQueue(prev => {
                    const next = prev.filter(p => p.id !== item.id);
                    return next;
                });
            }
        }
    }, []);

    const removeImage = useCallback(async (id) => {
        try {
            await deleteImage(id);
            if (activeImageId === id) {
                setActiveImageId(null);
            }
            await refreshGallery();
        } catch (err) {
            setError(err.message);
        }
    }, [activeImageId]);

    const saveState = useCallback(async (id, state) => {
        if (!id) return;
        try {
            await updateImageState(id, state);
        } catch (err) {
            console.error("Failed to save state:", err);
        }
    }, []);

    // Let's expose helpers.
    const importLut = useCallback(async (name, data, size) => {
        try {
            await saveLut({ id: crypto.randomUUID(), name, data, size });
            await refreshGallery();
        } catch (err) {
            setError(err.message);
        }
    }, []);

    const removeLut = useCallback(async (id) => {
        try {
            await deleteLut(id);
            await refreshGallery();
        } catch (err) {
            setError(err.message);
        }
    }, []);

    return {
        images,
        luts,
        activeImageId,
        setActiveImageId,
        processingQueue,
        error,
        processUploads,
        removeImage,
        saveState,
        importLut,
        removeLut
    };
};
