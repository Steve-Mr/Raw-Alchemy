// src/workers/export.worker.js
import { encodeTiff } from '../utils/tiffEncoder.js';

self.onmessage = (e) => {
    const { width, height, data, channels, logSpace } = e.data;

    try {
        if (!data || data.length === 0) {
            throw new Error("No data received for export");
        }

        // Input: 'data' is Float32Array
        // If channels=4, it is RGBA.
        // Output: Uint16Array (RGB only)

        const pixelCount = width * height;
        const uint16Data = new Uint16Array(pixelCount * 3);

        // Loop: Vertical Flip Logic (GL Coordinates -> Image Coordinates)
        for (let y = 0; y < height; y++) {
            // Target: Top to Bottom (y: 0 -> h-1)
            // Source: Bottom to Top (sourceRow: h-1 -> 0)
            const sourceRow = height - 1 - y;

            // Calculate offsets
            // Source is RGBA (4 channels) or RGB (3 channels) depending on input
            const srcChannels = channels || 3;
            const sourceRowOffset = sourceRow * width * srcChannels;

            const targetRowOffset = y * width * 3;

            for (let x = 0; x < width; x++) {
                const sourcePixelOffset = sourceRowOffset + (x * srcChannels);
                const targetPixelOffset = targetRowOffset + (x * 3);

                // Copy R, G, B (skip Alpha if present)
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

        // 2. Encode to TIFF
        // Pass the logSpace description for metadata tagging
        const description = logSpace ? `Log Space: ${logSpace}` : "Raw Alchemy Web Export";
        const buffer = encodeTiff(width, height, uint16Data, description);

        // 3. Send back
        self.postMessage({ type: 'success', buffer }, [buffer]);

    } catch (err) {
        console.error("Export Worker Error:", err);
        self.postMessage({ type: 'error', message: err.message });
    }
};
