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
        outputColor: 0,      // -o 0: Raw Color (Camera Native Space)
        outputBps: 16,       // -4: 16-bit
        noAutoBright: true,  // -W: Don't apply auto brightness (crucial for linearity)
        gamm: [1.0, 1.0],    // -g 1 1: Linear Gamma
        useCameraWb: false,  // -w: Disable camera WB
        useAutoWb: false,    // -a: Disable auto WB
        userMul: [1.0, 1.0, 1.0, 1.0], // -r 1 1 1 1: Unit WB (Pass-through for shader WB)
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

      // Get Metadata
      const meta = await decoder.metadata();
      console.log("Worker: Metadata retrieved", meta);

      // Extract specific Color Metadata
      // Note: Keys might vary, we pass the whole useful parts
      // Typically: 'cam_mul' (WB), 'cam_xyz' or 'rgb_cam' (Matrix)
      // We will let the main thread inspect 'meta' structure.

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
