/**
 * Auto-Exposure Metering Strategies
 * Ported from Python backend (metering.py)
 */

// ProPhoto RGB Luminance Coefficients
const R_COEFF = 0.288040;
const G_COEFF = 0.711874;
const B_COEFF = 0.000086;
const TARGET_GRAY = 0.18;

/**
 * Calculates exposure gain (EV) based on selected metering strategy.
 *
 * @param {Uint16Array|Uint8Array} data - Raw image data (interleaved RGB)
 * @param {number} width - Image width
 * @param {number} height - Image height
 * @param {string} mode - 'hybrid' | 'matrix' | 'center-weighted' | 'highlight-safe' | 'average'
 * @param {number} bitDepth - 16 or 8
 * @returns {number} Recommended Exposure Value (EV)
 */
export const calculateAutoExposure = (data, width, height, mode = 'hybrid', bitDepth = 16) => {
    if (!data || width === 0 || height === 0) return 0.0;

    const maxVal = bitDepth === 16 ? 65535.0 : 255.0;
    const channels = 3; // Assuming RGB input

    // 1. Subsample / Gather Luminance Data
    // We stride to process ~40k pixels for speed.
    const totalPixels = width * height;
    const targetSampleCount = 40000; // Sufficient for metering
    const stride = Math.max(1, Math.floor(Math.sqrt(totalPixels / targetSampleCount)));

    const lumas = [];
    const positions = []; // [x, y] for spatial metering (Matrix/Center)

    for (let y = 0; y < height; y += stride) {
        for (let x = 0; x < width; x += stride) {
            const idx = (y * width + x) * channels;
            // Safety check
            if (idx + 2 >= data.length) continue;

            const r = data[idx];
            const g = data[idx + 1];
            const b = data[idx + 2];

            // Calculate Luminance (0.0 - 1.0)
            const lum = (r * R_COEFF + g * G_COEFF + b * B_COEFF) / maxVal;
            lumas.push(lum);

            if (mode === 'center-weighted' || mode === 'matrix') {
                positions.push([x, y]);
            }
        }
    }

    if (lumas.length === 0) return 0.0;

    let gain = 1.0;

    // 2. Apply Strategy
    switch (mode) {
        case 'center-weighted':
            gain = strategyCenterWeighted(lumas, positions, width, height);
            break;
        case 'highlight-safe':
            gain = strategyHighlightSafe(lumas);
            break;
        case 'matrix':
            gain = strategyMatrix(lumas, positions, width, height);
            break;
        case 'average':
            gain = strategyAverage(lumas);
            break;
        case 'hybrid':
        default:
            gain = strategyHybrid(lumas);
            break;
    }

    // Convert Gain to EV
    // gain = 2^EV  =>  EV = log2(gain)
    if (gain <= 0) return 0.0;
    return Math.log2(gain);
};

// --- STRATEGIES ---

// 1. Average (Geometric Mean)
const strategyAverage = (lumas) => {
    let sumLog = 0.0;
    let count = 0;
    for (let i = 0; i < lumas.length; i++) {
        const val = Math.max(lumas[i], 1e-10); // Avoid log(0)
        sumLog += Math.log(val);
        count++;
    }
    const avgLog = sumLog / count;
    const avgLum = Math.exp(avgLog);

    if (avgLum < 0.0001) return 1.0;
    return TARGET_GRAY / avgLum;
};

// 2. Hybrid (Geometric Mean + Highlight Protection)
const strategyHybrid = (lumas) => {
    // Base Gain (Geometric Mean)
    const baseGain = strategyAverage(lumas);

    // Highlight Check (99th Percentile)
    const p99 = getPercentile(lumas, 99.0);

    const potentialPeak = p99 * baseGain;
    const maxAllowedPeak = 6.0; // Allow some highlight compression/rolloff, but prevent blowing out

    if (potentialPeak > maxAllowedPeak) {
        // Limit gain
        if (p99 < 1e-6) return baseGain;
        return maxAllowedPeak / p99;
    }

    return baseGain;
};

// 3. Highlight Safe (ETTR-like)
const strategyHighlightSafe = (lumas) => {
    const p99 = getPercentile(lumas, 99.0);
    const targetHigh = 0.9; // Map 99% brightest pixels to 90% range

    if (p99 < 1e-6) return 1.0;
    return targetHigh / p99;
};

// 4. Center Weighted (Gaussian)
const strategyCenterWeighted = (lumas, positions, w, h) => {
    const centerX = w / 2;
    const centerY = h / 2;
    const sigma = Math.min(w, h) / 2;
    const sigmaSq2 = 2 * sigma * sigma;

    let weightedSum = 0.0;
    let weightTotal = 0.0;

    for (let i = 0; i < lumas.length; i++) {
        const [x, y] = positions[i];
        const distSq = (x - centerX)**2 + (y - centerY)**2;
        const weight = Math.exp(-distSq / sigmaSq2);

        weightedSum += lumas[i] * weight;
        weightTotal += weight;
    }

    const weightedAvg = weightedSum / weightTotal;
    if (weightedAvg < 1e-6) return 1.0;

    return TARGET_GRAY / weightedAvg;
};

// 5. Matrix (Grid + Heuristics)
const strategyMatrix = (lumas, positions, w, h) => {
    // Simplified Matrix: 5x5 Grid
    const gridSize = 5;
    const gridH = h / gridSize;
    const gridW = w / gridSize;

    // Accumulate grid stats
    const gridSums = new Float32Array(gridSize * gridSize);
    const gridCounts = new Int32Array(gridSize * gridSize);

    for (let i = 0; i < lumas.length; i++) {
        const [x, y] = positions[i];
        const gx = Math.min(Math.floor(x / gridW), gridSize - 1);
        const gy = Math.min(Math.floor(y / gridH), gridSize - 1);
        const idx = gy * gridSize + gx;

        gridSums[idx] += lumas[i];
        gridCounts[idx]++;
    }

    // Calculate cell averages
    const cellLumas = [];
    for (let i = 0; i < gridSums.length; i++) {
        if (gridCounts[i] > 0) {
            cellLumas.push(gridSums[i] / gridCounts[i]);
        } else {
            cellLumas.push(0);
        }
    }

    // Weights
    const weights = new Float32Array(cellLumas.length).fill(1.0);

    // Center Bias
    const centerIdx = Math.floor(gridSize / 2);
    for (let gy = 0; gy < gridSize; gy++) {
        for (let gx = 0; gx < gridSize; gx++) {
            const idx = gy * gridSize + gx;
            const dist = Math.sqrt((gx - centerIdx)**2 + (gy - centerIdx)**2);
            if (dist < 1.5) weights[idx] *= 2.0; // Center cells x2 importance
        }
    }

    // Heuristics (Highlight/Shadow)
    // Need sorted cells to find percentiles of the GRID (not pixels)
    const sortedCells = [...cellLumas].sort((a,b) => a - b);
    const p90 = sortedCells[Math.floor(sortedCells.length * 0.9)];
    const p10 = sortedCells[Math.floor(sortedCells.length * 0.1)];

    for (let i = 0; i < cellLumas.length; i++) {
        if (cellLumas[i] > p90) weights[i] *= 0.5; // Suppress highlights
        if (cellLumas[i] < p10) weights[i] *= 1.2; // Boost shadows
    }

    // Final Weighted Average
    let wSum = 0;
    let wTot = 0;
    for (let i = 0; i < cellLumas.length; i++) {
        wSum += cellLumas[i] * weights[i];
        wTot += weights[i];
    }

    let avg = wSum / wTot;
    if (avg < 1e-6) avg = 0.001;

    let gain = TARGET_GRAY / avg;

    // Safety limit (similar to Hybrid)
    const p99 = getPercentile(lumas, 99.0); // Use full pixel stats for safety
    const potentialPeak = p99 * gain;
    if (potentialPeak > 6.0 && p99 > 1e-6) {
        gain = 6.0 / p99;
    }

    return gain;
};

// --- HELPERS ---

const getPercentile = (arr, p) => {
    // Quick approximation or full sort?
    // For 40k samples, sort is fast (~5ms).
    // We copy to avoid mutating original if needed, but here arr is local.
    const sorted = Float32Array.from(arr).sort();
    const idx = Math.floor((p / 100) * (sorted.length - 1));
    return sorted[idx];
};
