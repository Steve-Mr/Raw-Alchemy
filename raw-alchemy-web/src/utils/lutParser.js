
export function parseCubeLUT(content) {
  const lines = content.split(/\r?\n/);
  let size = 0;
  let title = null;
  let domainMin = [0.0, 0.0, 0.0];
  let domainMax = [1.0, 1.0, 1.0];
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
      } else if (line.startsWith('DOMAIN_MIN')) {
        const parts = line.split(/\s+/);
        if (parts.length >= 4) {
            domainMin = [parseFloat(parts[1]), parseFloat(parts[2]), parseFloat(parts[3])];
        }
      } else if (line.startsWith('DOMAIN_MAX')) {
        const parts = line.split(/\s+/);
        if (parts.length >= 4) {
            domainMax = [parseFloat(parts[1]), parseFloat(parts[2]), parseFloat(parts[3])];
        }
      }
      // Note: LUT_1D_SIZE is not supported, we assume 3D based on requirements
      continue;
    }

    // Try parsing numbers
    if (readingData) {
        // Check if this line is a keyword (e.g. DOMAIN_MIN) which might appear after size?
        if (/^[a-zA-Z]/.test(line)) {
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
      if (data.length < expectedCount) {
          throw new Error(`Insufficient data in LUT. Expected ${expectedCount}, got ${data.length}`);
      }
  }

  return {
    title,
    size,
    domainMin,
    domainMax,
    data: new Float32Array(data)
  };
}
