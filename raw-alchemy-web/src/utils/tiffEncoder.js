// src/utils/tiffEncoder.js

/**
 * Encodes raw 16-bit RGB data into an uncompressed TIFF file.
 *
 * @param {number} width - Image width
 * @param {number} height - Image height
 * @param {Uint16Array} data - Interleaved RGB data (R, G, B, R, G, B...)
 * @param {string} [description] - Optional image description (e.g., Log Space name)
 * @returns {ArrayBuffer} - The TIFF file binary
 */
export function encodeTiff(width, height, data, description = "") {
    const headerSize = 8;
    // IFD Entries: 12 base + 1 optional (ImageDescription)
    const hasDesc = description && description.length > 0;
    const ifdEntryCount = hasDesc ? 13 : 12;
    const ifdSize = 2 + (ifdEntryCount * 12) + 4; // Count + Entries + NextOffset

    // Extra values storage (BitsPerSample, XRes, YRes, DescriptionString)
    // BitsPerSample: 3 * 2 bytes = 6 bytes
    // XResolution: 2 * 4 bytes = 8 bytes (Rational)
    // YResolution: 2 * 4 bytes = 8 bytes (Rational)
    // Description: Length + 1 (null terminator)
    // Total Extra = 22 bytes + Description Bytes
    const descBytes = hasDesc ? new TextEncoder().encode(description + "\0") : new Uint8Array(0);
    // Align description to 2 bytes (Short alignment) - Optional but good practice?
    // TIFF strings are just bytes.

    const extraValuesSize = 22 + descBytes.length + (descBytes.length % 2); // Padding for word alignment if needed

    const pixelDataSize = data.byteLength;
    const totalSize = headerSize + ifdSize + extraValuesSize + pixelDataSize;

    const buffer = new ArrayBuffer(totalSize);
    const view = new DataView(buffer);

    let offset = 0;

    // --- 1. Header ---
    view.setUint16(offset, 0x4949, true); // "II" (Little Endian)
    offset += 2;
    view.setUint16(offset, 0x002A, true); // 42
    offset += 2;
    view.setUint32(offset, 8, true); // Offset to first IFD (immediately after header)
    offset += 4;

    // --- 2. IFD ---
    // We calculate offsets for "Extra Values" which come after IFD
    const extraValuesOffset = headerSize + ifdSize;
    // Pointers into Extra Values Block
    const bitsPerSampleOffset = extraValuesOffset;
    const xResOffset = extraValuesOffset + 6;
    const yResOffset = extraValuesOffset + 14;
    const descOffset = extraValuesOffset + 22;

    const pixelDataOffset = extraValuesOffset + extraValuesSize;

    const writeTag = (tagId, type, count, valueOrOffset) => {
        view.setUint16(offset, tagId, true);
        offset += 2;
        view.setUint16(offset, type, true);
        offset += 2;
        view.setUint32(offset, count, true);
        offset += 4;
        view.setUint32(offset, valueOrOffset, true);
        offset += 4;
    };

    view.setUint16(offset, ifdEntryCount, true); // Number of entries
    offset += 2;

    // Tags must be sorted by ID!
    // 256: ImageWidth
    writeTag(256, 4, 1, width);

    // 257: ImageLength
    writeTag(257, 4, 1, height);

    // 258: BitsPerSample
    writeTag(258, 3, 3, bitsPerSampleOffset);

    // 259: Compression
    writeTag(259, 3, 1, 1);

    // 262: PhotometricInterpretation
    writeTag(262, 3, 1, 2);

    // 270: ImageDescription (Optional) - Inserted here to maintain sort order (270 < 273)
    if (hasDesc) {
        writeTag(270, 2, descBytes.length, descOffset); // Type 2 = ASCII
    }

    // 273: StripOffsets
    writeTag(273, 4, 1, pixelDataOffset);

    // 277: SamplesPerPixel
    writeTag(277, 3, 1, 3);

    // 278: RowsPerStrip
    writeTag(278, 4, 1, height);

    // 279: StripByteCounts
    writeTag(279, 4, 1, pixelDataSize);

    // 282: XResolution
    writeTag(282, 5, 1, xResOffset);

    // 283: YResolution
    writeTag(283, 5, 1, yResOffset);

    // 296: ResolutionUnit
    writeTag(296, 3, 1, 2);

    // Next IFD Offset (0 = None)
    view.setUint32(offset, 0, true);
    offset += 4;

    // --- 3. Extra Values ---
    // BitsPerSample: [16, 16, 16]
    view.setUint16(offset, 16, true); offset += 2;
    view.setUint16(offset, 16, true); offset += 2;
    view.setUint16(offset, 16, true); offset += 2;

    // XResolution: 300/1
    view.setUint32(offset, 300, true); offset += 4;
    view.setUint32(offset, 1, true); offset += 4;

    // YResolution: 300/1
    view.setUint32(offset, 300, true); offset += 4;
    view.setUint32(offset, 1, true); offset += 4;

    // Description String (if exists)
    if (hasDesc) {
        const descView = new Uint8Array(buffer, offset, descBytes.length);
        descView.set(descBytes);
        offset += descBytes.length;
        // Padding if odd (though we calculated totalSize with modulo, so buffer is big enough)
        if (descBytes.length % 2 !== 0) {
            view.setUint8(offset, 0); // Pad with null
            offset += 1;
        }
    }

    // --- 4. Pixel Data ---
    // Copy the Uint16Array data into the buffer
    // Align offset to start of pixel data (should be accurate if calculations are correct)
    // Just to be safe, use pixelDataOffset relative to buffer start
    const pixelView = new Uint16Array(buffer, pixelDataOffset, width * height * 3);
    pixelView.set(data);

    return buffer;
}
