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

    return multiplyMatrices(XYZ_TO_PROPHOTO_MAT, m3x3);
};

// --- LOG SPACE DEFINITIONS ---

// Log Curve IDs for Shader
export const LOG_CURVE_IDS = {
    ARRI_LOGC3: 0,
    F_LOG: 1,
    F_LOG2: 2,
    S_LOG3: 3,
    V_LOG: 4,
    CANON_LOG2: 5,
    CANON_LOG3: 6,
    N_LOG: 7,
    D_LOG: 8,
    LOG3G10: 9
};

// Target Gamut Matrices: ProPhoto RGB (D50) -> Target Gamut (Usually D65)
// Extracted from colour-science
export const GAMUT_MATRICES = {
    // Arri LogC3
    'Arri LogC3': [
        1.223606, -0.147655, -0.076084,
        -0.105983, 0.919980, 0.186013,
        -0.007071, 0.056733, 0.950105
    ],
    // F-Log
    'F-Log': [
        1.202993, -0.065867, -0.137237,
        -0.067143, 1.072331, -0.005128,
        0.004014, -0.025219, 1.020950
    ],
    // F-Log2
    'F-Log2': [
        1.202993, -0.065867, -0.137237,
        -0.067143, 1.072331, -0.005128,
        0.004014, -0.025219, 1.020950
    ],
    // F-Log2 C (No change, manual tweak or needs specific generation if needed)
    'F-Log2 C': [
        0.959089, 0.114254, -0.073433,
        -0.003432, 0.910793, 0.092660,
        0.002179, 0.003073, 0.994501
    ],
    // S-Log3
    'S-Log3': [
        1.074478, -0.010574, -0.064015,
        -0.025097, 0.903955, 0.121158,
        0.011779, -0.000835, 0.988810
    ],
    // S-Log3.Cine
    'S-Log3.Cine': [
        1.255519, -0.172182, -0.083473,
        0.005015, 0.844135, 0.150852,
        0.037232, 0.018431, 0.944100
    ],
    // V-Log
    'V-Log': [
        1.118011, -0.049443, -0.068685,
        -0.026196, 0.930914, 0.095306,
        0.011479, 0.006510, 0.981766
    ],
    // Canon Log 2
    'Canon Log 2': [
        1.057152, -0.023066, -0.034204,
        -0.004980, 0.844191, 0.160790,
        0.008557, 0.151855, 0.839386
    ],
    // Canon Log 3
    'Canon Log 3': [
        1.057152, -0.023066, -0.034204,
        -0.004980, 0.844191, 0.160790,
        0.008557, 0.151855, 0.839386
    ],
    // N-Log
    'N-Log': [
        1.202993, -0.065867, -0.137237,
        -0.067143, 1.072331, -0.005128,
        0.004014, -0.025219, 1.020950
    ],
    // D-Log (Fallback to DJI D-Gamut approximation from previous code or error)
    'D-Log': [
        1.189488, -0.118310, -0.071278,
        -0.079337, 0.919847, 0.159436,
        0.014704, 0.065238, 0.920005
    ],
    // Log3G10
    'Log3G10': [
        1.021388, 0.027567, -0.049061,
        -0.018345, 0.861719, 0.156631,
        0.051044, 0.201081, 0.747693
    ]
};

// Mapping from UI Name to Curve ID
export const LOG_SPACE_CONFIG = {
    'Arri LogC3': { id: LOG_CURVE_IDS.ARRI_LOGC3 },
    'F-Log': { id: LOG_CURVE_IDS.F_LOG },
    'F-Log2': { id: LOG_CURVE_IDS.F_LOG2 },
    'F-Log2 C': { id: LOG_CURVE_IDS.F_LOG2 }, // Use F-Log2 curve, different gamut
    'S-Log3': { id: LOG_CURVE_IDS.S_LOG3 },
    'S-Log3.Cine': { id: LOG_CURVE_IDS.S_LOG3 }, // Use S-Log3 curve, different gamut
    'V-Log': { id: LOG_CURVE_IDS.V_LOG },
    'Canon Log 2': { id: LOG_CURVE_IDS.CANON_LOG2 },
    'Canon Log 3': { id: LOG_CURVE_IDS.CANON_LOG3 },
    'N-Log': { id: LOG_CURVE_IDS.N_LOG },
    'D-Log': { id: LOG_CURVE_IDS.D_LOG },
    'Log3G10': { id: LOG_CURVE_IDS.LOG3G10 },
};

export const getProPhotoToTargetMatrix = (logSpaceName) => {
    return GAMUT_MATRICES[logSpaceName] || GAMUT_MATRICES['Arri LogC3'];
};

// HELPER: Normalize Matrix for Shader (Flatten if needed)
export const formatMatrixForUniform = (mat) => {
    return new Float32Array(mat);
};

// Keep deprecated export for backward compatibility if needed, but updated to use map
export const getProPhotoToAlexaMatrix = () => {
    return GAMUT_MATRICES['Arri LogC3'];
};
