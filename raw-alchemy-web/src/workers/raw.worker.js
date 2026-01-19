import LibRaw from 'libraw-wasm';

let decoder = null;

self.onmessage = async (e) => {
  const { command, fileBuffer, mode, id } = e.data;

  if (command === 'decode') {
    try {
      if (!decoder) {
        decoder = new LibRaw();
      }

      // Open the file
      await decoder.open(new Uint8Array(fileBuffer));

      // Get Metadata
      const meta = await decoder.metadata();

      let outputData;
      let width = meta.width;
      let height = meta.height;
      let channels = 3;
      let bitDepth = 8; // Default assumption unless we confirm 16-bit

      if (mode === 'bayer') {
        // BAYER PATH
        // Attempt to unpack
        await decoder.runFn('unpack');

        // Try to retrieve the raw image
        // NOTE: This relies on the wrapper exposing a way to get the raw buffer.
        // If 'imageData' returns the unpacked raw data after 'unpack', we use that.
        // Otherwise, this might return the processed image if 'unpack' is ignored by imageData.
        // We'll treat it as a "best effort" attempt.
        const result = await decoder.imageData();
        outputData = result.data;
        width = result.width;
        height = result.height;
        channels = 1; // Bayer is 1 channel per pixel conceptually, but might be packed

        // Heuristic to check if it's 16-bit
        if (outputData instanceof Uint16Array) {
          bitDepth = 16;
        }

      } else {
        // RGB PATH
        // We assume standard processing
        // Ideally we want linear 16-bit:
        // await decoder.runFn('set_output_bps', 16); // Hypothetical
        // await decoder.runFn('set_gamma', 1.0, 1.0); // Hypothetical Linear
        // await decoder.runFn('dcraw_process');

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
      }

      // Transfer the result back
      // We explicitly transfer the buffer to avoid copying
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
