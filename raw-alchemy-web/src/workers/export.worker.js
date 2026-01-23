// src/workers/export.worker.js
import { encodeTiff } from '../utils/tiffEncoder.js';

self.onmessage = async (e) => {
    const { width, height, data, channels, logSpace, format = 'tiff', quality = 0.95 } = e.data;

    try {
        if (!data || data.length === 0) {
            throw new Error("No data received for export");
        }

        // --- TIFF EXPORT (16-bit) ---
        if (format === 'tiff') {
            // Input: 'data' is Float32Array (RGBA)
            // Output: Uint16Array (RGB only)

            const pixelCount = width * height;
            const uint16Data = new Uint16Array(pixelCount * 3);

            // Loop: Vertical Flip Logic (GL Coordinates -> Image Coordinates)
            for (let y = 0; y < height; y++) {
                // Target: Top to Bottom (y: 0 -> h-1)
                // Source: Bottom to Top (sourceRow: h-1 -> 0)
                const sourceRow = height - 1 - y;

                // Source is RGBA (4 channels) from readPixels
                const srcChannels = 4;
                const sourceRowOffset = sourceRow * width * srcChannels;

                const targetRowOffset = y * width * 3;

                for (let x = 0; x < width; x++) {
                    const sourcePixelOffset = sourceRowOffset + (x * srcChannels);
                    const targetPixelOffset = targetRowOffset + (x * 3);

                    // Copy R, G, B (skip Alpha)
                    for (let c = 0; c < 3; c++) {
                        let val = data[sourcePixelOffset + c];

                        // Clip [0.0, 1.0]
                        if (val < 0.0) val = 0.0;
                        if (val > 1.0) val = 1.0;

                        // Scale to 16-bit
                        uint16Data[targetPixelOffset + c] = (val * 65535.0) | 0;
                    }
                }
            }

            // Encode to TIFF
            const description = logSpace ? `Log Space: ${logSpace}` : "Raw Alchemy Web Export";
            const buffer = encodeTiff(width, height, uint16Data, description);

            self.postMessage({ type: 'success', buffer }, [buffer]);

        }
        // --- JPEG / PNG / WEBP EXPORT (8-bit) ---
        else {
            if (typeof OffscreenCanvas === 'undefined') {
                throw new Error("OffscreenCanvas is not supported in this browser's worker.");
            }

            const canvas = new OffscreenCanvas(width, height);
            const ctx = canvas.getContext('2d');

            // Create Uint8ClampedArray for ImageData (RGBA)
            const pixelCount = width * height;
            const uint8Data = new Uint8ClampedArray(pixelCount * 4);

            // Loop: Vertical Flip & Float -> Int8 Conversion
            for (let y = 0; y < height; y++) {
                // Target: Top to Bottom
                const sourceRow = height - 1 - y;
                const sourceRowOffset = sourceRow * width * 4;
                const targetRowOffset = y * width * 4;

                for (let x = 0; x < width; x++) {
                    const srcOff = sourceRowOffset + (x * 4);
                    const tgtOff = targetRowOffset + (x * 4);

                    // R, G, B, A
                    for (let c = 0; c < 4; c++) {
                        let val = data[srcOff + c];
                        // Clamp handled by Uint8ClampedArray implicitly, but we need to scale first
                        // It clamps 0-255 upon assignment
                        uint8Data[tgtOff + c] = val * 255.0;
                    }
                }
            }

            const imageData = new ImageData(uint8Data, width, height);
            ctx.putImageData(imageData, 0, 0);

            // Convert to Blob
            const mimeType = `image/${format}`; // image/jpeg, image/png, image/webp
            const blob = await canvas.convertToBlob({ type: mimeType, quality });

            // Send back as ArrayBuffer
            const buffer = await blob.arrayBuffer();
            self.postMessage({ type: 'success', buffer }, [buffer]);
        }

    } catch (err) {
        console.error("Export Worker Error:", err);
        self.postMessage({ type: 'error', message: err.message });
    }
};
