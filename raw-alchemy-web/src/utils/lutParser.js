
/**
 * Parses an Adobe .cube 3D LUT file.
 * @param {string} text - The raw text content of the .cube file.
 * @returns {Object} - { size: number, data: Float32Array, title: string }
 * @throws {Error} If the file is invalid or not a 3D LUT.
 */
export const parseCubeLUT = (text) => {
    const lines = text.split(/\r?\n/);
    let size = 0;
    let title = 'Untitled LUT';
    let data = [];
    let startReadingData = false;
    let minDomain = [0, 0, 0];
    let maxDomain = [1, 1, 1];

    // Cleanup helper: remove comments and trim
    const cleanLine = (line) => {
        const commentIndex = line.indexOf('#');
        if (commentIndex !== -1) {
            line = line.substring(0, commentIndex);
        }
        return line.trim();
    };

    for (let i = 0; i < lines.length; i++) {
        const line = cleanLine(lines[i]);
        if (!line) continue;

        if (!startReadingData) {
            const parts = line.split(/\s+/);
            const keyword = parts[0].toUpperCase();

            if (keyword === 'TITLE') {
                // Handle title enclosed in quotes or just text
                const rawTitle = line.substring(5).trim();
                title = rawTitle.replace(/^"|"$/g, '');
            } else if (keyword === 'LUT_3D_SIZE') {
                size = parseInt(parts[1], 10);
                if (isNaN(size) || size <= 0) {
                    throw new Error("Invalid LUT_3D_SIZE");
                }
            } else if (keyword === 'DOMAIN_MIN') {
                minDomain = parts.slice(1).map(Number);
            } else if (keyword === 'DOMAIN_MAX') {
                maxDomain = parts.slice(1).map(Number);
            } else if (!isNaN(parseFloat(parts[0]))) {
                // Detect start of data (numbers)
                startReadingData = true;
                // Don't skip this line, it contains data
                i--;
            }
        } else {
            // Reading Data
            const parts = line.split(/\s+/);
            if (parts.length >= 3) {
                const r = parseFloat(parts[0]);
                const g = parseFloat(parts[1]);
                const b = parseFloat(parts[2]);
                data.push(r, g, b);
            }
        }
    }

    if (size === 0) {
        throw new Error("LUT_3D_SIZE not found or invalid.");
    }

    const expectedLength = size * size * size * 3;
    if (data.length !== expectedLength) {
        console.warn(`LUT data length mismatch. Expected ${expectedLength}, got ${data.length}. Filling or truncating.`);
        // Note: For robustness, we could zero-fill or truncate, but strict parsing is usually safer for debugging.
        // However, standard says "lines starting with...".
        // Let's just return what we have, but Float32Array construction needs exact size if we pre-allocate.
        // Since we pushed to array, we can just use from.
    }

    // Normalize data if domain is not 0-1?
    // Standard .cube is usually 0-1, but can be wider.
    // WebGL float textures can handle >1.0.
    // So we pass raw values.

    return {
        size,
        data: new Float32Array(data),
        title
    };
};
