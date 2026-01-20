// src/utils/tiffEncoder.js

/**
 * Encodes raw 16-bit RGB data into an uncompressed TIFF file.
 *
 * @param {number} width - Image width
 * @param {number} height - Image height
 * @param {Uint16Array} data - Interleaved RGB data (R, G, B, R, G, B...)
 * @returns {ArrayBuffer} - The TIFF file binary
 */
export function encodeTiff(width, height, data) {
    const headerSize = 8;
    const ifdEntryCount = 12;
    const ifdSize = 2 + (ifdEntryCount * 12) + 4; // Count + Entries + NextOffset

    // Extra values storage (BitsPerSample, XRes, YRes)
    // BitsPerSample: 3 * 2 bytes = 6 bytes
    // XResolution: 2 * 4 bytes = 8 bytes (Rational)
    // YResolution: 2 * 4 bytes = 8 bytes (Rational)
    // Total Extra = 22 bytes
    const extraValuesSize = 22;

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

    // Tag 256: ImageWidth (Type 4: Long)
    writeTag(256, 4, 1, width);

    // Tag 257: ImageLength (Type 4: Long)
    writeTag(257, 4, 1, height);

    // Tag 258: BitsPerSample (Type 3: Short, Count 3) -> Pointer to extra values
    writeTag(258, 3, 3, extraValuesOffset);

    // Tag 259: Compression (Type 3: Short) -> 1 (Uncompressed)
    writeTag(259, 3, 1, 1);

    // Tag 262: PhotometricInterpretation (Type 3: Short) -> 2 (RGB)
    writeTag(262, 3, 1, 2);

    // Tag 273: StripOffsets (Type 4: Long) -> Pointer to pixel data
    writeTag(273, 4, 1, pixelDataOffset);

    // Tag 277: SamplesPerPixel (Type 3: Short) -> 3
    writeTag(277, 3, 1, 3);

    // Tag 278: RowsPerStrip (Type 4: Long) -> Height (One strip)
    writeTag(278, 4, 1, height);

    // Tag 279: StripByteCounts (Type 4: Long) -> Size of pixel data
    writeTag(279, 4, 1, pixelDataSize);

    // Tag 282: XResolution (Type 5: Rational) -> Pointer to extra values + 6
    writeTag(282, 5, 1, extraValuesOffset + 6);

    // Tag 283: YResolution (Type 5: Rational) -> Pointer to extra values + 14
    writeTag(283, 5, 1, extraValuesOffset + 14);

    // Tag 296: ResolutionUnit (Type 3: Short) -> 2 (Inch)
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

    // --- 4. Pixel Data ---
    // Copy the Uint16Array data into the buffer
    // Since 'data' is Uint16Array, we can copy its buffer directly or set values.
    // However, data.buffer might be larger (offset), so using set is safer or typed array set.
    const pixelView = new Uint16Array(buffer, offset, width * height * 3);
    pixelView.set(data);

    return buffer;
}
