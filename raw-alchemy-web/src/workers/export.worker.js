// src/workers/export.worker.js
import { encodeTiff } from '../utils/tiffEncoder.js';

self.onmessage = (e) => {
    const { width, height, data } = e.data;

    try {
        if (!data || data.length === 0) {
            throw new Error("No data received for export");
        }

        // 1. Convert Float32Array (0.0 - 1.0) to Uint16Array (0 - 65535)
        // We use a simple loop for maximum compatibility and performance in worker
        const len = data.length;
        const uint16Data = new Uint16Array(len);

        for (let i = 0; i < len; i++) {
            let val = data[i];

            // Clip
            if (val < 0.0) val = 0.0;
            if (val > 1.0) val = 1.0;

            // Scale and Cast
            uint16Data[i] = (val * 65535.0) | 0;
        }

        // 2. Encode to TIFF
        const buffer = encodeTiff(width, height, uint16Data);

        // 3. Send back
        self.postMessage({ type: 'success', buffer }, [buffer]);

    } catch (err) {
        console.error("Export Worker Error:", err);
        self.postMessage({ type: 'error', message: err.message });
    }
};
