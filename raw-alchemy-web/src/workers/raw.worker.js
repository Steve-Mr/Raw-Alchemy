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
      // We use redundant keys (camelCase and snake_case) to ensure the wrapper
      // respects the settings regardless of the specific build version conventions.
      const settings = {
        // Color Space: ProPhoto RGB
        outputColor: 4,
        output_color: 4,

        // Bit Depth: 16-bit
        outputBps: 16,
        output_bps: 16,

        // Gamma: Strict Linear (1.0, 1.0)
        // CRITICAL: Prevent default sRGB Gamma 2.2 fallback which causes "washed out" look
        gamm: [1.0, 1.0],
        gamma: [1.0, 1.0],

        // Brightness/Saturation: Disable auto adjustments
        noAutoBright: true,
        no_auto_bright: true,
        userSat: 0,
        user_sat: 0,

        // White Balance: Use Camera As-Shot
        useCameraWb: true,
        use_camera_wb: true,
        useAutoWb: false,
        use_auto_wb: false,

        // Multipliers: Unit (fallback if WB fails, to avoid green tint if applied manually)
        userMul: [1.0, 1.0, 1.0, 1.0],
        user_mul: [1.0, 1.0, 1.0, 1.0],
      };

      if (mode === 'bayer') {
          // For bayer mode, settings are less critical as we unpack raw data
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
        meta // Pass metadata for Matrix/WB extraction
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
