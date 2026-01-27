import LibRaw from 'libraw-wasm';

let decoder = null;

// Helper to downscale image data to thumbnail size
const createThumbnailFromImageData = (data, width, height) => {
    // Target size: ~300px long edge
    const scale = Math.min(300 / width, 300 / height);
    if (scale >= 1) return { data, width, height }; // Don't upscale

    const targetW = Math.floor(width * scale);
    const targetH = Math.floor(height * scale);
    const targetSize = targetW * targetH * 3; // RGB 8-bit
    const targetData = new Uint8Array(targetSize);

    // Nearest Neighbor for speed on fallback
    // We assume input is RGB 8-bit or 16-bit.
    // If 16-bit, we need to map to 8-bit.
    // LibRaw imageData() typically returns TypedArray based on outputBps.
    // Default is usually 8-bit unless specified.

    // Check if input is 16-bit (Uint16Array)
    const is16Bit = data instanceof Uint16Array;
    const stride = 3; // RGB

    for (let y = 0; y < targetH; y++) {
        for (let x = 0; x < targetW; x++) {
            const srcX = Math.floor(x / scale);
            const srcY = Math.floor(y / scale);
            const srcIdx = (srcY * width + srcX) * stride;
            const targetIdx = (y * targetW + x) * 3;

            if (srcIdx < data.length - 2) {
                 if (is16Bit) {
                     // Simple tone mapping / range squash for thumbnail
                     targetData[targetIdx] = data[srcIdx] >> 8;
                     targetData[targetIdx + 1] = data[srcIdx + 1] >> 8;
                     targetData[targetIdx + 2] = data[srcIdx + 2] >> 8;
                 } else {
                     targetData[targetIdx] = data[srcIdx];
                     targetData[targetIdx + 1] = data[srcIdx + 1];
                     targetData[targetIdx + 2] = data[srcIdx + 2];
                 }
            }
        }
    }

    return { data: targetData, width: targetW, height: targetH };
};

self.onmessage = async (e) => {
  const { command, fileBuffer, mode, id } = e.data;

  if (command === 'extractThumbnail') {
    try {
      if (!decoder) {
        decoder = new LibRaw();
      }

      const buffer = new Uint8Array(fileBuffer);
      await decoder.open(buffer);

      // 1. Try fast thumbnail extraction (embedded JPEG)
      let thumbResult = await decoder.thumbnailData();

      // 2. Fallback: Half-size decode if no embedded thumbnail
      if (!thumbResult || !thumbResult.data) {
          console.warn("Fast thumbnail extraction failed, using half-size decode fallback.");

          // Re-open with halfSize settings
          // LibRaw-Wasm wrapper doesn't support changing settings mid-flight easily
          // without re-opening or calling specific methods.
          // The example shows passing settings to open().

          await decoder.open(buffer, {
              halfSize: true,
              // Optimized for speed
              useAutoWb: true, // Use auto WB for preview if camera WB fails
              noInterpolation: false,
              outputBps: 8 // Force 8-bit for thumbnail
          });

          const imageData = await decoder.imageData();

          if (!imageData || !imageData.data) {
              throw new Error("Fallback decode failed");
          }

          const downscaled = createThumbnailFromImageData(imageData.data, imageData.width, imageData.height);

          // Convert raw RGB to JPEG Blob using OffscreenCanvas
          if (typeof OffscreenCanvas !== 'undefined') {
              try {
                  const canvas = new OffscreenCanvas(downscaled.width, downscaled.height);
                  const ctx = canvas.getContext('2d');

                  // ImageData expects Uint8ClampedArray and RGBA (4 channels)
                  const pixelCount = downscaled.width * downscaled.height;
                  const rgbaData = new Uint8ClampedArray(pixelCount * 4);

                  for (let i = 0; i < pixelCount; i++) {
                      rgbaData[i * 4] = downscaled.data[i * 3];     // R
                      rgbaData[i * 4 + 1] = downscaled.data[i * 3 + 1]; // G
                      rgbaData[i * 4 + 2] = downscaled.data[i * 3 + 2]; // B
                      rgbaData[i * 4 + 3] = 255;                    // A
                  }

                  const imageData = new ImageData(rgbaData, downscaled.width, downscaled.height);
                  ctx.putImageData(imageData, 0, 0);

                  const blob = await canvas.convertToBlob({ type: 'image/jpeg', quality: 0.8 });
                  const arrayBuffer = await blob.arrayBuffer();

                  thumbResult = {
                      data: new Uint8Array(arrayBuffer),
                      width: downscaled.width,
                      height: downscaled.height,
                      format: 1 // JPEG
                  };
              } catch (cvsErr) {
                  console.error("OffscreenCanvas fallback failed:", cvsErr);
                  thumbResult = {
                      data: downscaled.data,
                      width: downscaled.width,
                      height: downscaled.height,
                      format: 3 // Raw RGB (will likely fail in UI)
                  };
              }
          } else {
              thumbResult = {
                  data: downscaled.data,
                  width: downscaled.width,
                  height: downscaled.height,
                  format: 3
              };
          }
      }

      console.log(`Worker: Thumbnail ready (${thumbResult.width}x${thumbResult.height}, format: ${thumbResult.format})`);

      // Note: We do NOT transfer the buffer here ([thumbResult.data.buffer])
      // because it causes DataCloneError if the buffer was already detached or managed by WASM.
      // Copying for small thumbnails is negligible performance cost.
      self.postMessage({
        type: 'thumbSuccess',
        id,
        data: thumbResult.data,
        width: thumbResult.width,
        height: thumbResult.height,
        format: thumbResult.format
      });

    } catch (err) {
      console.error("Thumbnail extraction failed:", err);
      self.postMessage({
        type: 'thumbError',
        id,
        error: err.message
      });
    }
  } else if (command === 'decode') {
    try {
      if (!decoder) {
        console.log("Worker: Initializing LibRaw...");
        decoder = new LibRaw();
      }

      console.log(`Worker: Processing started (Mode: ${mode})`);

      const settings = {
        outputColor: 4,
        output_color: 4,
        outputBps: 16,
        output_bps: 16,
        gamm: [1.0, 1.0, 0, 0, 0, 0],
        gamma: [1.0, 1.0],
        noAutoBright: true,
        no_auto_bright: true,
        userSat: 0,
        user_sat: 0,
        useCameraWb: true,
        use_camera_wb: true,
        useAutoWb: false,
        use_auto_wb: false,
        userMul: [1.0, 1.0, 1.0, 1.0],
        user_mul: [1.0, 1.0, 1.0, 1.0],
      };

      if (mode === 'bayer') {
          // For bayer mode, settings are less critical as we unpack raw data
      }

      console.log("Worker: Opening file with settings:", settings);
      await decoder.open(new Uint8Array(fileBuffer), settings);
      console.log("Worker: File opened successfully");

      const meta = await decoder.metadata(true);
      console.log("Worker: Metadata retrieved", meta);

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

      if (meta.color_data && meta.color_data.cam_xyz) {
          meta.cam_xyz = flattenMatrix(meta.color_data.cam_xyz);
      }

      if (meta.color_data && meta.color_data.rgb_cam) {
          meta.rgb_cam = flattenMatrix(meta.color_data.rgb_cam);
      }

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
      let bitDepth = 8;

      if (mode === 'bayer') {
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
                channels = 1;

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
        console.log("Worker: Processing RGB (Linear Camera Space)...");
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

      self.postMessage({
        type: 'success',
        id,
        data: outputData,
        width,
        height,
        channels,
        bitDepth,
        mode,
        meta
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
