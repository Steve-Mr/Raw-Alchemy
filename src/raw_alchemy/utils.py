from typing import Optional
import rawpy
import numpy as np
from raw_alchemy import lensfun_wrapper as lf
from numba import njit, prange

# =========================================================
# Numba 加速核函数 (In-Place / 无内存分配)
# =========================================================

@njit(parallel=True, fastmath=True)
def apply_matrix_inplace(img, matrix):
    """(保持不变) 原位应用 3x3 颜色矩阵"""
    rows, cols, _ = img.shape
    m00, m01, m02 = matrix[0, 0], matrix[0, 1], matrix[0, 2]
    m10, m11, m12 = matrix[1, 0], matrix[1, 1], matrix[1, 2]
    m20, m21, m22 = matrix[2, 0], matrix[2, 1], matrix[2, 2]

    for r in prange(rows):
        for c in range(cols):
            r_val, g_val, b_val = img[r, c, 0], img[r, c, 1], img[r, c, 2]
            img[r, c, 0] = r_val * m00 + g_val * m01 + b_val * m02
            img[r, c, 1] = r_val * m10 + g_val * m11 + b_val * m12
            img[r, c, 2] = r_val * m20 + g_val * m21 + b_val * m22

@njit(parallel=True, fastmath=True)
def apply_lut_inplace(img, lut_table, domain_min, domain_max):
    """(保持不变) 原位 3D LUT 插值"""
    # ... (代码与你提供的一致，省略以节省篇幅，直接保留你原来的即可) ...
    # 为了完整性，这里简写，请务必保留你原来完整的逻辑
    input_is_2d = img.ndim == 2
    if input_is_2d:
        rows, cols = img.shape[0], 1
        img_3d = img.reshape(rows, 1, 3)
    else:
        rows, cols, _ = img.shape
        img_3d = img

    size = lut_table.shape[0]
    size_minus_1 = size - 1
    scale_r = size_minus_1 / (domain_max[0] - domain_min[0])
    scale_g = size_minus_1 / (domain_max[1] - domain_min[1])
    scale_b = size_minus_1 / (domain_max[2] - domain_min[2])
    min_r, min_g, min_b = domain_min

    for r in prange(rows):
        for c in range(cols):
            in_r, in_g, in_b = img_3d[r, c, 0], img_3d[r, c, 1], img_3d[r, c, 2]
            idx_r = (in_r - min_r) * scale_r
            idx_g = (in_g - min_g) * scale_g
            idx_b = (in_b - min_b) * scale_b
            
            if idx_r < 0: idx_r = 0.0
            elif idx_r > size_minus_1: idx_r = float(size_minus_1)
            if idx_g < 0: idx_g = 0.0
            elif idx_g > size_minus_1: idx_g = float(size_minus_1)
            if idx_b < 0: idx_b = 0.0
            elif idx_b > size_minus_1: idx_b = float(size_minus_1)

            x0, y0, z0 = int(idx_r), int(idx_g), int(idx_b)
            x1 = x0 + 1 if x0 < size_minus_1 else size_minus_1
            y1 = y0 + 1 if y0 < size_minus_1 else size_minus_1
            z1 = z0 + 1 if z0 < size_minus_1 else size_minus_1
            
            dx, dy, dz = idx_r - x0, idx_g - y0, idx_b - z0
            
            for k in range(3):
                c00 = lut_table[x0, y0, z0, k] * (1 - dx) + lut_table[x1, y0, z0, k] * dx
                c01 = lut_table[x0, y0, z1, k] * (1 - dx) + lut_table[x1, y0, z1, k] * dx
                c10 = lut_table[x0, y1, z0, k] * (1 - dx) + lut_table[x1, y1, z0, k] * dx
                c11 = lut_table[x0, y1, z1, k] * (1 - dx) + lut_table[x1, y1, z1, k] * dx
                c0 = c00 * (1 - dy) + c10 * dy
                c1 = c01 * (1 - dy) + c11 * dy
                img_3d[r, c, k] = c0 * (1 - dz) + c1 * dz

@njit(parallel=True, fastmath=True)
def apply_saturation_contrast_inplace(img, saturation, contrast, pivot, luma_coeffs):
    """
    原位应用饱和度和对比度。
    替代了原先创建 4 个大数组的 Python 函数。
    """
    rows, cols, _ = img.shape
    cr, cg, cb = luma_coeffs[0], luma_coeffs[1], luma_coeffs[2]

    for r in prange(rows):
        for c in range(cols):
            r_val = img[r, c, 0]
            g_val = img[r, c, 1]
            b_val = img[r, c, 2]

            # 1. 计算亮度 (Luminance)
            lum = r_val * cr + g_val * cg + b_val * cb

            # 2. 饱和度 Saturation
            # out = lum + (in - lum) * sat
            r_sat = lum + (r_val - lum) * saturation
            g_sat = lum + (g_val - lum) * saturation
            b_sat = lum + (b_val - lum) * saturation

            # 3. 对比度 Contrast
            # out = (in - pivot) * cont + pivot
            r_fin = (r_sat - pivot) * contrast + pivot
            g_fin = (g_sat - pivot) * contrast + pivot
            b_fin = (b_sat - pivot) * contrast + pivot

            # 4. Clip (防止负数) 并写回
            if r_fin < 0.0: r_fin = 0.0
            if g_fin < 0.0: g_fin = 0.0
            if b_fin < 0.0: b_fin = 0.0

            img[r, c, 0] = r_fin
            img[r, c, 1] = g_fin
            img[r, c, 2] = b_fin

@njit(parallel=True, fastmath=True)
def apply_gain_inplace(img, gain):
    """简单的原位增益，比 numpy 的 img *= gain 稍微快一点点，且绝对不分配内存"""
    rows, cols, _ = img.shape
    for r in prange(rows):
        for c in range(cols):
            img[r, c, 0] *= gain
            img[r, c, 1] *= gain
            img[r, c, 2] *= gain

# =========================================================
# 辅助计算函数 (用于测光)
# =========================================================

def get_luminance_coeffs(colourspace):
    """从 colour 空间对象中提取 RGB -> Y (Luminance) 的系数"""
    # RGB_to_XYZ 矩阵的第二行就是 Y 通道的系数 [Lr, Lg, Lb]
    return colourspace.matrix_RGB_to_XYZ[1, :]

def get_subsampled_view(img, target_size=1024):
    """
    获取图像的下采样视图。
    对于测光来说，分析 1000px 宽的缩略图和分析 8000px 的原图，结果差异可忽略不计。
    """
    h, w, _ = img.shape
    # 计算步长，使得长边大约为 target_size
    step = max(1, max(h, w) // target_size)
    # Numpy切片是视图(View)，不占用新内存
    return img[::step, ::step, :]

# =========================================================
# 业务逻辑函数 (优化版)
# =========================================================

def apply_saturation_and_contrast(img_linear, saturation=1.25, contrast=1.10):
    """
    In-Place 应用饱和度和对比度。
    注意：这里假设 img_linear 是 ProPhoto RGB，我们使用 ProPhoto 的亮度系数。
    """
    # ProPhoto RGB 的近似亮度系数 (R, G, B)
    # 如果要非常严谨，应该从 colour.RGB_COLOURSPACES['ProPhoto RGB'] 获取
    # 这里为了性能直接硬编码，或者你可以传参进来
    # ProPhoto Luma Coeffs: [0.28804, 0.71187, 0.00009]
    luma_coeffs = np.array([0.28804, 0.71187, 0.00009], dtype=np.float32)
    
    # 确保连续，防止 Numba 变慢
    if not img_linear.flags['C_CONTIGUOUS']:
        img_linear = np.ascontiguousarray(img_linear)
        
    apply_saturation_contrast_inplace(
        img_linear, 
        float(saturation), 
        float(contrast), 
        0.18, # Pivot center
        luma_coeffs
    )
    return img_linear # 为了链式调用方便返回，但实际上是原地修改

# ----------------- 测光函数 (全部改为采样 + In-Place) -----------------

def auto_expose_center_weighted(img_linear: np.ndarray, source_colorspace, target_gray: float = 0.18, logger: callable = print) -> np.ndarray:
    # 1. 下采样 (速度提升 50-100 倍)
    sample = get_subsampled_view(img_linear)
    
    # 2. 在小图上计算亮度 (不再转换整个 45MP 大图)
    coeffs = get_luminance_coeffs(source_colorspace)
    # 点乘计算亮度: sample @ coeffs.T
    luminance = np.dot(sample, coeffs)
    
    h, w = luminance.shape
    
    # 3. 计算权重 (在小图上计算，内存忽略不计)
    y, x = np.ogrid[:h, :w]
    center_y, center_x = h / 2, w / 2
    sigma = min(h, w) / 2
    dist_sq = (x - center_x)**2 + (y - center_y)**2
    weights = np.exp(-dist_sq / (2 * sigma**2))
    
    weighted_avg_lum = np.average(luminance, weights=weights)
    
    if weighted_avg_lum < 1e-6:
        gain = 1.0
    else:
        gain = target_gray / weighted_avg_lum

    gain = np.clip(gain, 0.1, 100.0)
    logger(f"  ⚖️  [Auto Exposure] Center-Weighted Gain: {gain:.4f}")
    
    # 4. 原位应用增益到大图
    # img_linear *= gain # Numpy 写法
    apply_gain_inplace(img_linear, float(gain)) # Numba 写法 (稍微更省内存)
    return img_linear

def auto_expose_highlight_safe(img_linear: np.ndarray, clip_threshold: float = 1.0, logger: callable = print) -> np.ndarray:
    # 1. 下采样
    sample = get_subsampled_view(img_linear)
    
    # 2. 在小图上找 Max
    max_vals = np.max(sample, axis=2)
    high_percentile = np.percentile(max_vals, 99.0)
    
    target_high = 0.9  
    if high_percentile < 1e-6:
        gain = 1.0
    else:
        gain = target_high / high_percentile
        
    logger(f"  🛡️  [Auto Exposure] Highlight Safe Gain: {gain:.4f}")
    apply_gain_inplace(img_linear, float(gain))
    return img_linear

def auto_expose_linear(img_linear: np.ndarray, source_colorspace, target_gray: float = 0.18, logger: callable = print) -> np.ndarray:
    # 1. 下采样
    sample = get_subsampled_view(img_linear)
    
    # 2. 计算亮度
    coeffs = get_luminance_coeffs(source_colorspace)
    luminance = np.dot(sample, coeffs)
    
    # 3. 统计
    avg_log_lum = np.mean(np.log(luminance + 1e-6))
    avg_lum = np.exp(avg_log_lum)
    
    if avg_lum < 0.0001: 
        gain = 1.0 
    else:
        gain = target_gray / avg_lum

    gain = np.clip(gain, 1.0, 50.0)
    logger(f"  ⚖️  [Auto Exposure] Avg Gain: {gain:.4f}")
    
    apply_gain_inplace(img_linear, float(gain))
    return img_linear

def auto_expose_hybrid(img_linear: np.ndarray, source_colorspace, target_gray: float = 0.18, logger: callable = print) -> np.ndarray:
    # 1. 下采样
    sample = get_subsampled_view(img_linear)
    
    # 2. 计算亮度
    coeffs = get_luminance_coeffs(source_colorspace)
    luminance = np.dot(sample, coeffs)
    
    avg_log_lum = np.mean(np.log(luminance + 1e-6))
    avg_lum = np.exp(avg_log_lum)
    base_gain = target_gray / (avg_lum + 1e-6)
    
    # 3. 检查高光 (在采样图上检查即可)
    max_vals = np.max(sample, axis=2)
    p99 = np.percentile(max_vals, 99.0)
    
    potential_peak = p99 * base_gain
    max_allowed_peak = 6.0 
    
    if potential_peak > max_allowed_peak:
        limited_gain = max_allowed_peak / p99
        logger(f"  🛡️  [Auto Exposure] Hybrid limited. (Desired: {base_gain:.2f} -> Actual: {limited_gain:.2f})")
        gain = limited_gain
    else:
        gain = base_gain
        
    gain = np.clip(gain, 0.1, 100.0)
    logger(f"  ⚖️  [Auto Exposure] Hybrid Gain: {gain:.4f}")
    
    apply_gain_inplace(img_linear, float(gain))
    return img_linear

def auto_expose_matrix(img_linear: np.ndarray, source_colorspace, target_gray: float = 0.18, logger: callable = print) -> np.ndarray:
    """
    高级评价测光 (模拟矩阵测光)。
    1. 将图像划分为 7x7 网格。
    2. 计算每个网格的平均亮度。
    3. 基于位置、亮度和与中心的关系，为每个网格分配权重。
    4. 计算加权平均亮度并确定曝光增益。
    """
    # 1. 下采样以提高性能
    sample = get_subsampled_view(img_linear)
    h, w, _ = sample.shape
    
    # 2. 计算亮度图
    coeffs = get_luminance_coeffs(source_colorspace)
    luminance = np.dot(sample, coeffs)
    
    # 3. 定义网格
    grid_size = 7
    grid_h, grid_w = h // grid_size, w // grid_size
    
    # 4. 计算每个网格的平均亮度和权重
    grid_lums = np.zeros((grid_size, grid_size))
    for i in range(grid_size):
        for j in range(grid_size):
            cell = luminance[i*grid_h:(i+1)*grid_h, j*grid_w:(j+1)*grid_w]
            if cell.size > 0:
                grid_lums[i, j] = np.mean(cell)

    # 5. 智能加权
    weights = np.ones((grid_size, grid_size))
    
    # 5.1 中心偏置 (高斯权重)
    y, x = np.ogrid[:grid_size, :grid_size]
    center_y, center_x = (grid_size - 1) / 2.0, (grid_size - 1) / 2.0
    dist_sq = (x - center_x)**2 + (y - center_y)**2
    # sigma 稍大，权重分布更平滑
    sigma = grid_size / 2.5
    center_bias = np.exp(-dist_sq / (2 * sigma**2))
    weights *= (1 + center_bias * 1.5) # 中心权重最高为 2.5 倍

    # 5.2 高光抑制
    # 亮度高于 90% 分位数的区域，权重降低
    lum_percentile_90 = np.percentile(grid_lums, 90)
    highlight_zones = grid_lums > lum_percentile_90
    weights[highlight_zones] *= 0.2 # 高光区域权重打 2 折

    # 5.3 暗部关注
    # 亮度低于 10% 分位数的区域，权重轻微提升
    lum_percentile_10 = np.percentile(grid_lums, 10)
    shadow_zones = grid_lums < lum_percentile_10
    weights[shadow_zones] *= 1.2 # 暗部区域权重提升 20%

    # 6. 计算最终加权平均亮度
    weighted_avg_lum = np.average(grid_lums, weights=weights)
    
    if weighted_avg_lum < 1e-6:
        gain = 1.0
    else:
        gain = target_gray / weighted_avg_lum

    # 7. 与 Hybrid 类似的保护性削减
    max_vals = np.max(sample, axis=2)
    p99 = np.percentile(max_vals, 99.0)
    potential_peak = p99 * gain
    max_allowed_peak = 6.0
    
    if potential_peak > max_allowed_peak:
        limited_gain = max_allowed_peak / p99
        logger(f"  🛡️  [Auto Exposure] Matrix limited. (Desired: {gain:.2f} -> Actual: {limited_gain:.2f})")
        gain = limited_gain

    gain = np.clip(gain, 0.1, 100.0)
    logger(f"  🤖 [Auto Exposure] Matrix Gain: {gain:.4f}")
    
    apply_gain_inplace(img_linear, float(gain))
    return img_linear

# ----------------- 镜头校正 (保持逻辑，优化注释) -----------------

def apply_lens_correction(image: np.ndarray, exif_data: dict, custom_db_path: Optional[str] = None, logger: callable = print, **kwargs) -> np.ndarray:
    """
    镜头校正通常需要几何变换，很难完全 In-Place。
    这是整个流程中少数几个必然会产生内存拷贝的地方。
    """
    # exif_data is now passed directly
    
    # 简单的字典合并
    params = {**exif_data, **kwargs}
    
    # 必要的 key 检查
    if not params.get('camera_model') or not params.get('lens_model'):
        logger("  ⚠️  [Lens] Missing info, skipping.")
        return image
    
    if not params.get('focal_length') or not params.get('aperture'):
        logger("  ⚠️  [Lens] Missing optical info, skipping.")
        return image
    
    logger(f"  🧬 [Lens] {params.get('camera_maker')} {params.get('camera_model')} + {params.get('lens_model')}")
    
    try:
        # lensfun_wrapper 内部通常会调用 cv2.remap 或 scipy.map_coordinates
        # 这必然返回新图像
        corrected = lf.apply_lens_correction(
            image=image,
            custom_db_path=custom_db_path,
            logger=logger,
            **params # 传递所有提取到的参数
        )
        
        # 显式帮助 GC (虽然 Python 会自动处理，但在大内存压力下 explicit is better)
        # 这里原来的 image 引用计数会减少，如果外面没有引用，旧内存会被释放
        return corrected
        
    except Exception as e:
        logger(f"  ❌ [Lens Error] {e}")
        return image # 失败则返回原图

def extract_lens_exif(raw: rawpy.RawPy, logger: callable = print) -> dict:
    """使用 rawpy 对象从 RAW 文件中提取 EXIF 和镜头信息。"""
    result = {}
    try:
        # 使用新的 rawpy 参数对象 (rawpy >= 0.20.0)
        result['camera_maker'] = raw.camera_params.make
        result['camera_model'] = raw.camera_params.model
        result['lens_maker'] = raw.lens_params.make
        result['lens_model'] = raw.lens_params.model
        result['focal_length'] = raw.other_params.focal_len
        result['aperture'] = raw.other_params.aperture
            
    except Exception as e:
        logger(f"  ❌ [EXIF Error] {e}")
    
    # 过滤掉 None 值，防止下游出错
    return {k: v for k, v in result.items() if v is not None}