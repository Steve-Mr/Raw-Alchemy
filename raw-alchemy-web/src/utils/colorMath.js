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
    // ARRI Wide Gamut 3
    'Arri LogC3': [
        1.221468, -0.140818, -0.080781,
        -0.108081, 0.924029, 0.184063,
        -0.00585, 0.042834, 0.962778
    ],
    // F-Gamut
    'F-Log': [
        1.200579, -0.057563, -0.143126,
        -0.070019, 1.080712, -0.01063,
        0.005544, -0.040786, 1.034982
    ],
    // F-Gamut
    'F-Log2': [
        1.200579, -0.057563, -0.143126,
        -0.070019, 1.080712, -0.01063,
        0.005544, -0.040786, 1.034982
    ],
    // F-Gamut C
    'F-Log2 C': [
        0.956749, 0.121682, -0.078519,
        -0.005843, 0.916751, 0.089114,
        0.003596, -0.011877, 1.008029
    ],
    // S-Gamut3
    'S-Log3': [
        1.072271, -0.003649, -0.068732,
        -0.027404, 0.909306, 0.118116,
        0.013179, -0.015677, 1.002247
    ],
    // S-Gamut3.Cine
    'S-Log3.Cine': [
        1.253375, -0.165253, -0.088257,
        0.002858, 0.848724, 0.148422,
        0.038464, 0.004562, 0.956733
    ],
    // V-Gamut
    'V-Log': [
        1.115819, -0.042517, -0.073417,
        -0.028614, 0.936867, 0.091772,
        0.01285, -0.008168, 0.995069
    ],
    // Cinema Gamut
    'Canon Log 2': [
        1.055058, -0.016789, -0.038385,
        -0.007104, 0.848575, 0.158531,
        0.009321, 0.140483, 0.84999
    ],
    // Cinema Gamut
    'Canon Log 3': [
        1.055058, -0.016789, -0.038385,
        -0.007104, 0.848575, 0.158531,
        0.009321, 0.140483, 0.84999
    ],
    // ITU-R BT.2020
    'N-Log': [
        1.200579, -0.057563, -0.143126,
        -0.070019, 1.080712, -0.01063,
        0.005544, -0.040786, 1.034982
    ],
    // DJI D-Gamut
    'D-Log': [
        1.187343, -0.1115, -0.07594,
        -0.081526, 0.924445, 0.157028,
        0.015815, 0.051985, 0.932143
    ],
    // REDWideGamutRGB
    'Log3G10': [
        1.019202, 0.034277, -0.053583,
        -0.020497, 0.866232, 0.154271,
        0.051454, 0.191729, 0.756633
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
