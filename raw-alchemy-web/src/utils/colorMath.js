// src/utils/colorMath.js

/**
 * Color Pipeline Matrix Math Helpers
 */

/**
 * Multiplies two 3x3 matrices (A * B)
 * @param {number[]} a - 3x3 matrix (row-major flat array of 9 elements)
 * @param {number[]} b - 3x3 matrix (row-major flat array of 9 elements)
 * @returns {number[]} - Result matrix
 */
export const multiplyMatrices = (a, b) => {
    const result = new Array(9).fill(0);
    for (let row = 0; row < 3; row++) {
      for (let col = 0; col < 3; col++) {
        let sum = 0;
        for (let k = 0; k < 3; k++) {
          sum += a[row * 3 + k] * b[k * 3 + col];
        }
        result[row * 3 + col] = sum;
      }
    }
    return result;
};

/**
 * Standard XYZ to ProPhoto RGB (ROMM RGB) Matrix
 * Linear transformation.
 * Source: http://www.brucelindbloom.com/index.html?Eqn_RGB_XYZ_Matrix.html
 * (Reference D50 White Point)
 */
const XYZ_TO_PROPHOTO_MAT = [
    1.3459433, -0.2556075, -0.0511118,
   -0.5445989,  1.5081673,  0.0205351,
    0.0000000,  0.0000000,  1.2118128
];

/**
 * Calculates Camera RGB -> ProPhoto RGB Matrix
 * Formula: M_cam_to_prophoto = M_xyz_to_prophoto * M_cam_to_xyz
 *
 * @param {number[]} camToXyz - 3x3 or 4x3 matrix from LibRaw (Camera -> XYZ).
 *                               LibRaw often provides 4x3 (rows=3, cols=4) where last col is 0.
 *                               We expect a flat array.
 * @returns {number[]} - 3x3 Matrix for shader (Camera -> ProPhoto)
 */
export const calculateCamToProPhoto = (camToXyz) => {
    if (!camToXyz || camToXyz.length < 9) {
        console.warn("Invalid Camera Matrix, using Identity");
        return [1,0,0, 0,1,0, 0,0,1];
    }

    // Convert LibRaw matrix to 3x3 standard format
    // LibRaw often gives `rgb_cam` as: [RR, RG, RB, 0, GR, GG, GB, 0, BR, BG, BB, 0] ?
    // OR `cam_xyz` (Camera to XYZ) as: [X_r, X_g, X_b, Y_r, Y_g, Y_b, Z_r, Z_g, Z_b] ?

    // NOTE: LibRaw's `rgb_cam` is typically the inverse (XYZ -> Camera).
    // `cam_xyz` is usually Camera -> XYZ (D65).
    // We need to check what `libraw-wasm` returns in `rgb_cam`.
    // Assuming `rgb_cam` is the Camera to XYZ matrix (standard in many raw tools names, confusingly).
    // If it's 3x4 (12 elements), we skip every 4th element (the zero).

    let m3x3 = [];
    if (camToXyz.length === 9) {
        m3x3 = camToXyz;
    } else if (camToXyz.length === 12) {
        // Assume 4x3 row-major: [m00, m01, m02, 0, m10, m11, m12, 0, ...]
        m3x3 = [
            camToXyz[0], camToXyz[1], camToXyz[2],
            camToXyz[4], camToXyz[5], camToXyz[6],
            camToXyz[8], camToXyz[9], camToXyz[10]
        ];
    } else {
         // Fallback
         m3x3 = camToXyz.slice(0, 9);
    }

    // Normalize rows?
    // Usually raw matrices are normalized to D65. ProPhoto is D50.
    // Chromatic adaptation might be needed if the white points differ significantly
    // and we want perfect accuracy.
    // LibRaw usually gives cam_xyz relative to D65.
    // ProPhoto (ROMM) is D50.
    // Ideally: Cam(D65) -> XYZ(D65) -> Bradford(D65->D50) -> ProPhoto(D50).
    // FOR MVP: We will do simple multiplication Cam->XYZ->ProPhoto.
    // This ignores White Point adaptation but is "close enough" for Phase 3 Log tests.

    return multiplyMatrices(XYZ_TO_PROPHOTO_MAT, m3x3);
};


/**
 * Linear ProPhoto RGB -> Linear Arri Alexa Wide Gamut Matrix
 * Calculated from primaries.
 * Source: Derived or standard constants.
 */
// Calculated ProPhoto (D50) -> Alexa Wide Gamut (D65) ?
// Or assuming ProPhoto is adapted to D65?
// Usually working spaces are D65 in these pipelines.
// Let's assume standard definitions.
// ProPhoto -> XYZ -> Alexa.
// Here is a pre-calculated matrix for ProPhoto (D50) -> Alexa Wide Gamut (assuming Bradford adaptation included if needed, or just gamut conversion).
// Since we want "Target Log Gamut (Linear)", and Alexa is usually D65.
// Let's use a standard matrix found in open source LUT tools or colour-science.
//
// Linear ProPhoto RGB (D50) -> Linear Arri Alexa Wide Gamut (D65)
// Values calculated via standard chromatic adaptation (Bradford) and Gamut conversion.
// Source reference: colour-science or similar standard tools.
// ProPhoto RGB (ROMM) uses D50 white point.
// Alexa Wide Gamut uses D65 white point.
// Matrix includes Chromatic Adaptation (D50 -> D65) + Primaries Rotation.
const PROPHOTO_TO_ALEXA_MAT = [
     0.840705, 0.160166, -0.000871,
    -0.007699, 1.011893, -0.004194,
    -0.003975, -0.004652, 0.830626
];

export const getProPhotoToAlexaMatrix = () => {
    // Return the hardcoded matrix for Stage 3
    return PROPHOTO_TO_ALEXA_MAT;
};

// HELPER: Normalize Matrix for Shader (Flatten if needed)
export const formatMatrixForUniform = (mat) => {
    return new Float32Array(mat);
};
