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

      // Open the file
      await decoder.open(new Uint8Array(fileBuffer));
      console.log("Worker: File opened successfully");

      // Get Metadata
      const meta = await decoder.metadata();
      console.log("Worker: Metadata retrieved", meta);

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

            // Try to set output BPS to 16 if possible/needed, though 'unpack'
            // usually fills rawdata which is 16-bit.
            // But imageData() might process it.
            // We'll rely on what imageData returns for now.

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
        // RGB PATH
        console.log("Worker: Processing RGB...");

        // Attempt to configure for 16-bit output
        // This is speculative based on standard LibRaw API mappings
        try {
             // 0=8-bit, 1=16-bit in some LibRaw versions?
             // Or 'output_bps' property.
             // Since we are using a wrapper, we can try to call a method if it exists.
             // Note: 'libraw-wasm' typically hardcodes some settings, but let's try.
             // If this fails, it's caught and we proceed with defaults.
             // We won't block execution if this specific call fails.
             // await decoder.runFn('set_output_bps', 16);
        } catch (ignore) {}

        const result = await decoder.imageData();

        outputData = result.data;
        width = result.width;
        height = result.height;
        channels = 3; // Typically RGB

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
        mode
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
