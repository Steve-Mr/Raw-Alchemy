import LibRaw from 'libraw-wasm';

let decoder = null;

self.onmessage = async (e) => {
  const { command, fileBuffer, mode, id } = e.data;

  if (command === 'decode') {
    try {
      if (!decoder) {
        console.log("Worker: Initializing LibRaw...");
        decoder = new LibRaw();
      }

      console.log(`Worker: Processing started (Mode: ${mode})`);

      // Open the file with specific settings for Linear Camera Space
      // settings reference: https://github.com/ybouane/LibRaw-Wasm
      const settings = {
        outputColor: 4,      // -o 4: ProPhoto RGB (Linear)
        outputBps: 16,       // -4: 16-bit
        noAutoBright: true,  // -W: Don't apply auto brightness (crucial for linearity)
        gamm: [1.0, 1.0],    // -g 1 1: Linear Gamma
        useCameraWb: true,   // -w: Use Camera WB (As Shot)
        useAutoWb: false,    // -a: Disable auto WB
        userMul: [1.0, 1.0, 1.0, 1.0], // -r 1 1 1 1: Unit WB
        // Ensure interpolation is ON (default) for 'rgb' mode
      };

      if (mode === 'bayer') {
          // For bayer mode, we might want different settings or just use runFn('unpack')
          // But open() applies settings globally for the session usually.
          // LibRaw-Wasm `open` takes settings.
          // We keep settings for 'rgb' mode primarily.
          // For bayer, we rely on unpack.
      }

      console.log("Worker: Opening file with settings:", settings);
      await decoder.open(new Uint8Array(fileBuffer), settings);
      console.log("Worker: File opened successfully");

      // Get Metadata (Verbose for color matrices)
      const meta = await decoder.metadata(true);
      console.log("Worker: Metadata retrieved", meta);

      // Helper to flatten nested arrays
      const flattenMatrix = (mat) => {
          if (!mat || !Array.isArray(mat)) return mat;
          if (mat.length > 0 && Array.isArray(mat[0])) {
             const flat = [];
             for(let i=0; i<mat.length; i++) {
                 if(Array.isArray(mat[i])) {
                     for(let j=0; j<mat[i].length; j++) {
                         flat.push(mat[i][j]);
                     }
                 } else {
                     flat.push(mat[i]);
                 }
             }
             return flat;
          }
          return mat;
      };

      // Extract and normalize Color Metadata from known paths
      // 1. cam_xyz (Camera to XYZ)
      if (meta.color_data && meta.color_data.cam_xyz) {
          meta.cam_xyz = flattenMatrix(meta.color_data.cam_xyz);
      }

      // 2. rgb_cam (sRGB to Camera - usually)
      if (meta.color_data && meta.color_data.rgb_cam) {
          meta.rgb_cam = flattenMatrix(meta.color_data.rgb_cam);
      }

      // 3. cam_mul (White Balance)
      if (meta.color_data && meta.color_data.cam_mul) {
          meta.cam_mul = meta.color_data.cam_mul;
      }

      console.log("Worker: Normalized Metadata:", {
          cam_xyz: meta.cam_xyz,
          rgb_cam: meta.rgb_cam,
          cam_mul: meta.cam_mul
      });

      let outputData;
      let width = meta.width;
      let height = meta.height;
      let channels = 3;
      let bitDepth = 8; // Default assumption

      if (mode === 'bayer') {
        // BAYER PATH
        try {
            console.log("Worker: Attempting unpack...");
            await decoder.runFn('unpack');
            console.log("Worker: Unpack complete");

            console.log("Worker: Fetching image data...");
            const result = await decoder.imageData();

            if (result && result.data) {
                outputData = result.data;
                width = result.width;
                height = result.height;
                channels = 1; // Bayer is single channel

                if (outputData instanceof Uint16Array) {
                    bitDepth = 16;
                }
                console.log(`Worker: Got data. Size: ${width}x${height}, Type: ${outputData.constructor.name}`);
            } else {
                throw new Error("No data returned from imageData() in Bayer mode");
            }

        } catch (bayerErr) {
            console.error("Worker: Bayer mode failed", bayerErr);
            throw new Error(`Bayer Unpack Failed: ${bayerErr.message}`);
        }

      } else {
        // RGB PATH (Linear Camera Space)
        console.log("Worker: Processing RGB (Linear Camera Space)...");

        // Settings were applied in open().
        // Just get the data.

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
        console.log(`Worker: RGB data ready. ${width}x${height} ${bitDepth}-bit`);
      }

      // Calculate Auto Exposure
      let recommendedExposure = 0.0;
      if (mode === 'rgb' && outputData) {
          try {
              // ProPhoto RGB Luma Coefficients
              const R_COEFF = 0.288040;
              const G_COEFF = 0.711874;
              const B_COEFF = 0.000086;
              const TARGET_GRAY = 0.18;

              let sumLuma = 0.0;
              let count = 0;

              // Center 50% Crop
              const startX = Math.floor(width * 0.25);
              const endX = Math.floor(width * 0.75);
              const startY = Math.floor(height * 0.25);
              const endY = Math.floor(height * 0.75);
              const stride = 10; // Sample every 10th pixel for speed

              for (let y = startY; y < endY; y += stride) {
                  for (let x = startX; x < endX; x += stride) {
                      const idx = (y * width + x) * channels;
                      const r = outputData[idx];
                      const g = outputData[idx + 1];
                      const b = outputData[idx + 2];

                      // Calculate Luminance
                      sumLuma += (r * R_COEFF + g * G_COEFF + b * B_COEFF);
                      count++;
                  }
              }

              if (count > 0) {
                  const avgLuma = sumLuma / count;
                  // Normalize if 16-bit
                  const maxVal = bitDepth === 16 ? 65535.0 : 255.0;
                  const normalizedLuma = avgLuma / maxVal;

                  if (normalizedLuma > 0) {
                       recommendedExposure = Math.log2(TARGET_GRAY / normalizedLuma);
                  }
                  console.log(`Worker: Metering - AvgLuma: ${normalizedLuma.toFixed(5)}, RecExp: ${recommendedExposure.toFixed(2)} EV`);
              }
          } catch (ex) {
              console.warn("Worker: Metering failed", ex);
          }
      }

      // Transfer the result back
      self.postMessage({
        type: 'success',
        id,
        data: outputData,
        width,
        height,
        channels,
        bitDepth,
        mode,
        meta, // Pass metadata for Matrix/WB extraction
        recommendedExposure
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
