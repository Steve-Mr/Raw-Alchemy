import LibRaw from 'libraw-wasm';

let decoder = null;

// Matrix Metering Implementation (Approximate)
function calculateMatrixExposure(data, width, height, channels, bitDepth, meta) {
    // 1. Subsample (to approx 200x200)
    // We want to avoid iterating the whole 20MP array.
    const step = Math.max(1, Math.floor(Math.sqrt((width * height) / 40000)));

    // We need to know which channel is Green (or Luminance).
    // In Camera Native RGB (demosaiced), we have RGB.
    // Luma approx for Camera RGB is roughly G or average.
    // Let's use simple Average (R+G+B)/3 for speed and neutrality before WB.
    // OR better: Apply WB from metadata if available?
    // The Python code applies WB *before* metering.
    // Here we have raw linear data *without* WB applied (userMul=[1,1,1,1]).
    // So we should ideally apply WB multipliers to get correct luminance.

    const wb = meta.cam_mul || [1, 1, 1, 1];
    // LibRaw cam_mul is typically [R, G, B, G] or similar.
    // We'll normalize to Green=1.0 for metering.
    const gVal = wb[1];
    const rScale = wb[0] / gVal;
    const bScale = wb[2] / gVal;

    // Luminance Coeffs (Approximate for Camera Space -> perceptual brightness)
    // Standard Rec709 is 0.21, 0.71, 0.07.
    // We'll use simple unweighted for raw or slightly green-heavy.

    const gridSize = 7;
    const gridH = Math.ceil(height / gridSize);
    const gridW = Math.ceil(width / gridSize);

    const gridSums = new Float64Array(gridSize * gridSize);
    const gridCounts = new Int32Array(gridSize * gridSize);

    const maxVal = (bitDepth === 16) ? 65535.0 : 255.0;

    // Iterate with stride
    for (let y = 0; y < height; y += step) {
        const gridY = Math.floor(y / gridH);
        if (gridY >= gridSize) continue;

        const rowOffset = y * width * channels;

        for (let x = 0; x < width; x += step) {
             const gridX = Math.floor(x / gridW);
             if (gridX >= gridSize) continue;

             const idx = rowOffset + x * channels;

             // Extract RGB and apply basic WB
             let r, g, b;
             if (channels >= 3) {
                 r = data[idx] * rScale;
                 g = data[idx + 1] * 1.0;
                 b = data[idx + 2] * bScale;
             } else {
                 // Monochrome/Bayer (not fully supported for metering here, fallback)
                 r = g = b = data[idx];
             }

             // Simple Luminance (Linear)
             // 0.2126 R + 0.7152 G + 0.0722 B (Rec709 approximation)
             const lum = (0.2126 * r + 0.7152 * g + 0.0722 * b) / maxVal;

             gridSums[gridY * gridSize + gridX] += lum;
             gridCounts[gridY * gridSize + gridX]++;
        }
    }

    // Calculate Grid Means
    const gridMeans = new Float32Array(gridSize * gridSize);
    for (let i = 0; i < gridSize * gridSize; i++) {
        if (gridCounts[i] > 0) {
            gridMeans[i] = gridSums[i] / gridCounts[i];
        }
    }

    // Calculate Weights
    // Center Weighted
    const weights = new Float32Array(gridSize * gridSize);
    const center = (gridSize - 1) / 2.0;
    const sigma = gridSize / 2.5;

    for (let y = 0; y < gridSize; y++) {
        for (let x = 0; x < gridSize; x++) {
            const distSq = (x - center)**2 + (y - center)**2;
            const centerBias = Math.exp(-distSq / (2 * sigma * sigma));
            weights[y * gridSize + x] = 1.0 + centerBias * 1.5;
        }
    }

    // Highlight Suppression (Top 10%)
    // Sort means to find percentile
    const sortedMeans = Array.from(gridMeans).sort((a, b) => a - b);
    const p90 = sortedMeans[Math.floor(sortedMeans.length * 0.9)];
    const p10 = sortedMeans[Math.floor(sortedMeans.length * 0.1)];

    for (let i = 0; i < gridSize * gridSize; i++) {
        if (gridMeans[i] > p90) weights[i] *= 0.2;
        if (gridMeans[i] < p10) weights[i] *= 1.2;
    }

    // Weighted Average
    let totalWeight = 0;
    let weightedSum = 0;

    for (let i = 0; i < gridSize * gridSize; i++) {
        weightedSum += gridMeans[i] * weights[i];
        totalWeight += weights[i];
    }

    const weightedAvgLum = (totalWeight > 0) ? (weightedSum / totalWeight) : 0;
    const targetGray = 0.18;

    let gain = 1.0;
    if (weightedAvgLum > 1e-6) {
        gain = targetGray / weightedAvgLum;
    }

    // Highlight Protection (Simplified P99)
    // We need P99 of the *source* pixels to do this accurately.
    // Let's use the grid means max as a proxy or just clamp safely.
    // The Python code re-scans the sample for P99.
    // We'll trust the grid's max to be somewhat representative or skip for perf.
    // Let's do a quick safety clamp: gain shouldn't blow out the average highlight too much.
    // Python limit: peak * gain < 6.0
    // Let's assume P99 is roughly the max grid mean (conservative).
    const maxGridMean = sortedMeans[sortedMeans.length - 1];
    if (maxGridMean * gain > 6.0) {
         gain = 6.0 / maxGridMean;
         console.log(`Worker: Matrix Metering Clamped (P99 approx). New Gain: ${gain}`);
    }

    gain = Math.max(0.1, Math.min(gain, 100.0));

    console.log(`Worker: Matrix Metering Calculated. AvgLum: ${weightedAvgLum.toFixed(4)}, Gain: ${gain.toFixed(4)}`);
    return gain;
}


self.onmessage = async (e) => {
  const { command, fileBuffer, mode, id } = e.data;

  if (command === 'decode') {
    try {
      if (!decoder) {
        console.log("Worker: Initializing LibRaw...");
        decoder = new LibRaw();
      }

      console.log(`Worker: Processing started (Mode: ${mode})`);

      const settings = {
        outputColor: 0,      // -o 0: Raw Color
        outputBps: 16,       // -4: 16-bit
        noAutoBright: true,  // -W: No auto bright
        gamm: [1.0, 1.0],    // -g 1 1: Linear Gamma
        useCameraWb: false,  // -w: No cam WB
        useAutoWb: false,    // -a: No auto WB
        userMul: [1.0, 1.0, 1.0, 1.0], // Unit WB
      };

      console.log("Worker: Opening file with settings:", settings);
      await decoder.open(new Uint8Array(fileBuffer), settings);

      const meta = await decoder.metadata();

      let outputData;
      let width = meta.width;
      let height = meta.height;
      let channels = 3;
      let bitDepth = 8;
      let calculatedExposure = 0.0; // Default (0 EV)

      if (mode === 'bayer') {
        // BAYER PATH
        await decoder.runFn('unpack');
        const result = await decoder.imageData();
        if (result && result.data) {
            outputData = result.data;
            width = result.width;
            height = result.height;
            channels = 1;
            if (outputData instanceof Uint16Array) bitDepth = 16;
        } else {
            throw new Error("No data returned from imageData() in Bayer mode");
        }
      } else {
        // RGB PATH
        const result = await decoder.imageData();
        outputData = result.data;
        width = result.width;
        height = result.height;
        channels = 3;
        if (outputData instanceof Uint16Array) {
          bitDepth = 16;
        } else if (outputData instanceof Uint8Array) {
          bitDepth = 8;
        }

        // Calculate Exposure (Matrix Metering)
        // Only makes sense for linear RGB data
        if (channels === 3) {
             const gain = calculateMatrixExposure(outputData, width, height, channels, bitDepth, meta);
             // Convert Gain to EV (Stop)
             // gain = 2^EV  =>  EV = log2(gain)
             calculatedExposure = Math.log2(gain);
        }
      }

      self.postMessage({
        type: 'success',
        id,
        data: outputData,
        width,
        height,
        channels,
        bitDepth,
        mode,
        meta,
        calculatedExposure // Send back the calculated EV
      }, [outputData.buffer]);

    } catch (err) {
      console.error("Worker Error:", err);
      self.postMessage({
        type: 'error',
        id,
        error: err.message
      });
    }
  }
};
