import LibRaw from 'libraw-wasm';

let decoder = null;

self.onmessage = async (e) => {
  const { command, fileBuffer, mode, id, settings: customSettings } = e.data;

  // Initialize Decoder
  if (!decoder) {
    try {
      decoder = new LibRaw();
    } catch (err) {
      self.postMessage({ type: 'error', id, error: "Failed to load LibRaw: " + err.message });
      return;
    }
  }

  // Common Settings
  const baseSettings = {
    outputColor: 4, output_color: 4, // ProPhoto
    outputBps: 16, output_bps: 16,
    gamm: [1.0, 1.0, 0, 0, 0, 0], gamma: [1.0, 1.0],
    noAutoBright: true, no_auto_bright: true,
    userSat: 0, user_sat: 0,
    useCameraWb: true, use_camera_wb: true,
    useAutoWb: false, use_auto_wb: false,
    userMul: [1.0, 1.0, 1.0, 1.0], user_mul: [1.0, 1.0, 1.0, 1.0],
    ...customSettings
  };

  if (command === 'thumbnail') {
     try {
         console.log("Worker: Generating thumbnail...");
         // Open file
         await decoder.open(new Uint8Array(fileBuffer), baseSettings);

         // Extract Metadata
         const meta = await decoder.metadata(true);

         // Try Fast Thumbnail Path (LibRaw unpack_thumb)
         let thumbData = null;

         try {
             // Try the specific method if available in this fork
             // We check for 'unpack_thumb' or similar.
             // If the fork exposes a direct 'getThumbnail' helper, we'd use that.
             // Assuming we have to call C++ methods via runFn.

             // This is a guess based on standard LibRaw usage
             await decoder.runFn('unpack_thumb');

             // Now we need to retrieve it. If the wrapper doesn't expose a way to read `imgdata.thumbnail`,
             // we might be stuck.
             // However, many wasm wrappers return the result of the function.
             // `unpack_thumb` returns void (int error code).

             // Let's assume if this fails or doesn't produce result, we fall back.
             // But if the user specifically asked for this fork, it likely has a helper.
             // Check for `make_mem_thumb`

             const memThumb = await decoder.runFn('dcraw_make_mem_thumb');
             if (memThumb && memThumb.data) {
                 // It returns a struct with .data (Uint8Array usually JPEG)
                 thumbData = memThumb.data;
                 // We don't know dimenions of JPEG blob easily without parsing, but the frontend can handle a Blob/URL.
                 self.postMessage({
                     type: 'thumbnail_success',
                     id,
                     blob: new Blob([thumbData], { type: 'image/jpeg' }), // Assuming JPEG
                     meta
                 });
                 return;
             }
         } catch (thumbErr) {
             console.warn("Fast thumbnail failed, falling back to full decode:", thumbErr);
         }

         // Fallback: Full Decode + Downscale
         // This is slow but guaranteed to work
         const result = await decoder.imageData();
         const width = result.width;
         const height = result.height;

         // Resize to max 300px
         const maxDim = 300;
         const scale = Math.min(maxDim / width, maxDim / height);
         const targetW = Math.floor(width * scale);
         const targetH = Math.floor(height * scale);

         // We need to convert to 8-bit RGBA for display or Blob
         // data is linear ProPhoto. We should probably gamma correct it for thumb?
         // Or just send it.

         // Ideally we send a small buffer.
         // Let's simple-sample.
         const thumbBuffer = new Uint8Array(targetW * targetH * 4);

         // Simple nearest neighbor or subsample loop
         // Using 3 channels from source (ProPhoto Linear)
         // Convert to sRGB-ish for display? (Gamma 2.2 approximation)

         for(let y=0; y<targetH; y++) {
             for(let x=0; x<targetW; x++) {
                 const sx = Math.floor(x / scale);
                 const sy = Math.floor(y / scale);
                 const srcIdx = (sy * width + sx) * 3;
                 const dstIdx = (y * targetW + x) * 4;

                 let r, g, b;
                 if (result.data instanceof Uint16Array) {
                     r = result.data[srcIdx] / 65535;
                     g = result.data[srcIdx+1] / 65535;
                     b = result.data[srcIdx+2] / 65535;
                 } else {
                     // Float
                      r = result.data[srcIdx];
                      g = result.data[srcIdx+1];
                      b = result.data[srcIdx+2];
                 }

                 // Simple Gamma 2.2 for thumbnail visibility
                 r = Math.pow(Math.max(0, r), 1/2.2) * 255;
                 g = Math.pow(Math.max(0, g), 1/2.2) * 255;
                 b = Math.pow(Math.max(0, b), 1/2.2) * 255;

                 thumbBuffer[dstIdx] = r;
                 thumbBuffer[dstIdx+1] = g;
                 thumbBuffer[dstIdx+2] = b;
                 thumbBuffer[dstIdx+3] = 255; // Alpha
             }
         }

         // Create Bitmap/Blob
         // Since we are in worker, we can send the buffer.
         // Or easier: Send the buffer and let main thread create ImageBitmap/Canvas.

         self.postMessage({
             type: 'thumbnail_success',
             id,
             buffer: thumbBuffer,
             width: targetW,
             height: targetH,
             meta
         }, [thumbBuffer.buffer]);

     } catch (err) {
         console.error("Thumbnail error:", err);
         self.postMessage({ type: 'error', id, error: err.message });
     }
     return;
  }

  if (command === 'decode') {
    try {
      console.log(`Worker: Processing started (Mode: ${mode})`);

      await decoder.open(new Uint8Array(fileBuffer), baseSettings);

      // Get Metadata (Verbose for color matrices)
      const meta = await decoder.metadata(true);

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

      if (meta.color_data && meta.color_data.cam_xyz) {
          meta.cam_xyz = flattenMatrix(meta.color_data.cam_xyz);
      }
      if (meta.color_data && meta.color_data.rgb_cam) {
          meta.rgb_cam = flattenMatrix(meta.color_data.rgb_cam);
      }
      if (meta.color_data && meta.color_data.cam_mul) {
          meta.cam_mul = meta.color_data.cam_mul;
      }

      let outputData;
      let width = meta.width;
      let height = meta.height;
      let channels = 3;
      let bitDepth = 8;

      if (mode === 'bayer') {
        // BAYER PATH
        await decoder.runFn('unpack');
        const result = await decoder.imageData();
        outputData = result.data;
        width = result.width;
        height = result.height;
        channels = 1;
        if (outputData instanceof Uint16Array) bitDepth = 16;
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
