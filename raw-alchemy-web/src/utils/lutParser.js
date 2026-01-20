
export function parseCubeLUT(content) {
  const lines = content.split(/\r?\n/);
  let size = 0;
  let title = null;
  const data = [];
  let readingData = false;

  // Simple clean up
  // We can just iterate lines
  for (let i = 0; i < lines.length; i++) {
    let line = lines[i].trim();

    // Skip comments and empty lines
    if (!line || line.startsWith('#')) continue;

    if (!readingData) {
      if (line.startsWith('TITLE')) {
        const match = line.match(/TITLE\s+"?([^"]+)"?/);
        if (match) title = match[1];
      } else if (line.startsWith('LUT_3D_SIZE')) {
        const parts = line.split(/\s+/);
        size = parseInt(parts[1], 10);
        readingData = true; // Data usually follows
      }
      // Note: LUT_1D_SIZE is not supported, we assume 3D based on requirements
      continue;
    }

    // Try parsing numbers
    // Some cube files put multiple triplets on one line?
    // Spec says: "The data lines... define the output values... Each line must contain 3 numbers..."
    // But some parsers are lenient. Let's assume standard 3 numbers per line or space separated.

    // If we haven't found size yet, we shouldn't be here (or data started without size?)
    // Standard requires LUT_3D_SIZE before data.

    if (readingData) {
        // Check if this line is a keyword (e.g. DOMAIN_MIN) which might appear after size?
        // Spec: "Keywords... must appear before the table data".
        // So once we see data, it's data.
        // But let's be safe. If line starts with a letter, check if it's a number?
        // Numbers can start with -, ., or digits.
        if (/^[a-zA-Z]/.test(line)) {
            // It's a keyword?
            // e.g. DOMAIN_MIN
            continue;
        }

        const parts = line.split(/\s+/);
        for (let p of parts) {
            if (p === "") continue;
            const val = parseFloat(p);
            if (!isNaN(val)) {
                data.push(val);
            }
        }
    }
  }

  if (size === 0) {
      throw new Error("Invalid .cube file: LUT_3D_SIZE not found.");
  }

  const expectedCount = size * size * size * 3;
  if (data.length !== expectedCount) {
      console.warn(`LUT data count mismatch. Expected ${expectedCount}, got ${data.length}. Attempting to use what we have or fail.`);
      // If we have less, we might crash. If more, maybe ok.
      if (data.length < expectedCount) {
          throw new Error(`Insufficient data in LUT. Expected ${expectedCount}, got ${data.length}`);
      }
  }

  return {
    title,
    size,
    data: new Float32Array(data)
  };
}
