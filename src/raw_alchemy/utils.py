from typing import Optional
import rawpy
import numpy as np
from raw_alchemy import lensfun_wrapper as lf
from numba import njit, prange

# =========================================================
# Numba 加速核函数 (In-Place / 无内存分配)
# =========================================================

@njit(parallel=True, fastmath=True, cache=True)
def apply_matrix_inplace(img, matrix):
    """
    高性能原位矩阵变换
    优化点: 
    1. 视图打平 (Flatten View) 以最大化并行粒度
    2. 显式读取变量以利用寄存器
    """
    # 获取图像总像素数
    rows, cols, channels = img.shape
    n_pixels = rows * cols
    
    # 创建 (N, 3) 的视图，零拷贝 (Zero-copy)
    # 只要输入是 C-contiguous 的，这步极快
    flat_img = img.reshape(n_pixels, channels)

    # 预加载矩阵参数到寄存器
    m00, m01, m02 = matrix[0, 0], matrix[0, 1], matrix[0, 2]
    m10, m11, m12 = matrix[1, 0], matrix[1, 1], matrix[1, 2]
    m20, m21, m22 = matrix[2, 0], matrix[2, 1], matrix[2, 2]

    # 并行循环：一维化处理
    for i in prange(n_pixels):
        r = flat_img[i, 0]
        g = flat_img[i, 1]
        b = flat_img[i, 2]
        
        # 写入结果
        flat_img[i, 0] = r * m00 + g * m01 + b * m02
        flat_img[i, 1] = r * m10 + g * m11 + b * m12
        flat_img[i, 2] = r * m20 + g * m21 + b * m22

@njit(parallel=True, fastmath=True, cache=True)
def apply_lut_inplace(img, lut_table, domain_min, domain_max):
    """
    高性能原位四面体插值 (Tetrahedral Interpolation)
    
    优势:
    1. 内存访问减少 50% (只读 4 个点，而不是 8 个)
    2. 色彩精度更高，特别是对于灰阶和肤色
    3. 使用了显式的 6 种情况分支，编译器通常能将其优化为高效的跳转表
    """
    # ---------------------------
    # 1. 数据准备与打平
    # ---------------------------
    if img.ndim == 2:
        n_pixels = img.shape[0]
        flat_img = img.reshape(n_pixels, 1) # 防御性代码
    else:
        rows, cols, _ = img.shape
        n_pixels = rows * cols
        flat_img = img.reshape(n_pixels, 3)

    # 预计算常量
    size = lut_table.shape[0]
    size_minus_1 = size - 1
    size_float = float(size_minus_1)
    
    scale_r = size_minus_1 / (domain_max[0] - domain_min[0])
    scale_g = size_minus_1 / (domain_max[1] - domain_min[1])
    scale_b = size_minus_1 / (domain_max[2] - domain_min[2])
    
    min_r, min_g, min_b = domain_min[0], domain_min[1], domain_min[2]

    # ---------------------------
    # 2. 并行像素循环
    # ---------------------------
    for i in prange(n_pixels):
        # --- A. 坐标归一化 ---
        in_r = flat_img[i, 0]
        in_g = flat_img[i, 1]
        in_b = flat_img[i, 2]

        raw_idx_r = (in_r - min_r) * scale_r
        raw_idx_g = (in_g - min_g) * scale_g
        raw_idx_b = (in_b - min_b) * scale_b

        # 钳位 (Clamping)
        idx_r = min(max(raw_idx_r, 0.0), size_float)
        idx_g = min(max(raw_idx_g, 0.0), size_float)
        idx_b = min(max(raw_idx_b, 0.0), size_float)

        # --- B. 计算整数坐标 (x0) 和 小数部分 (d) ---
        x0 = int(idx_r)
        y0 = int(idx_g)
        z0 = int(idx_b)

        # 边界保护：确保 x1 不会越界
        # 注意：如果 x0 已经是 size_minus_1，x1 应该保持 size_minus_1
        x1 = x0 + 1
        if x0 == size_minus_1: x1 = x0
        
        y1 = y0 + 1
        if y0 == size_minus_1: y1 = y0
        
        z1 = z0 + 1
        if z0 == size_minus_1: z1 = z0

        # 计算权重 (Delta)
        dx = idx_r - x0
        dy = idx_g - y0
        dz = idx_b - z0

        # --- C. 四面体判定逻辑 (Tetrahedral Logic) ---
        # 我们需要找到包围该点的 4 个顶点。
        # P0 (x0, y0, z0) 和 P3 (x1, y1, z1) 总是存在的。
        # 剩下的 P1 和 P2 取决于 dx, dy, dz 的大小关系。
        
        # 定义临时变量用于存储插值结果
        r_val = 0.0
        g_val = 0.0
        b_val = 0.0

        # 读取基础点 P0 (Base) 和 对角点 P3 (Opposite)
        # 这样写虽然代码长，但比用数组存储 P1, P2 更快，因为直接操作寄存器
        
        # 优化技巧：我们在 if 分支里直接读取 LUT 并计算，避免不必要的内存读取
        
        if dx >= dy:
            if dy >= dz:
                # Case 1: dx >= dy >= dz
                # P1=(1,0,0), P2=(1,1,0)
                # Weights: (1-dx), (dx-dy), (dy-dz), dz
                
                # P0
                w0 = 1.0 - dx
                c_r = lut_table[x0, y0, z0, 0] * w0
                c_g = lut_table[x0, y0, z0, 1] * w0
                c_b = lut_table[x0, y0, z0, 2] * w0
                
                # P1 (x+1, y, z)
                w1 = dx - dy
                c_r += lut_table[x1, y0, z0, 0] * w1
                c_g += lut_table[x1, y0, z0, 1] * w1
                c_b += lut_table[x1, y0, z0, 2] * w1
                
                # P2 (x+1, y+1, z)
                w2 = dy - dz
                c_r += lut_table[x1, y1, z0, 0] * w2
                c_g += lut_table[x1, y1, z0, 1] * w2
                c_b += lut_table[x1, y1, z0, 2] * w2
                
                # P3 (x+1, y+1, z+1) -> Weight is dz
                c_r += lut_table[x1, y1, z1, 0] * dz
                c_g += lut_table[x1, y1, z1, 1] * dz
                c_b += lut_table[x1, y1, z1, 2] * dz

                r_val, g_val, b_val = c_r, c_g, c_b

            elif dx >= dz:
                # Case 2: dx >= dz > dy
                # P1=(1,0,0), P2=(1,0,1)
                # Weights: (1-dx), (dx-dz), (dz-dy), dy
                
                w0 = 1.0 - dx
                c_r = lut_table[x0, y0, z0, 0] * w0
                c_g = lut_table[x0, y0, z0, 1] * w0
                c_b = lut_table[x0, y0, z0, 2] * w0
                
                w1 = dx - dz
                c_r += lut_table[x1, y0, z0, 0] * w1
                c_g += lut_table[x1, y0, z0, 1] * w1
                c_b += lut_table[x1, y0, z0, 2] * w1
                
                w2 = dz - dy
                c_r += lut_table[x1, y0, z1, 0] * w2
                c_g += lut_table[x1, y0, z1, 1] * w2
                c_b += lut_table[x1, y0, z1, 2] * w2
                
                c_r += lut_table[x1, y1, z1, 0] * dy
                c_g += lut_table[x1, y1, z1, 1] * dy
                c_b += lut_table[x1, y1, z1, 2] * dy
                
                r_val, g_val, b_val = c_r, c_g, c_b
                
            else:
                # Case 3: dz > dx >= dy
                # P1=(0,0,1), P2=(1,0,1)
                # Weights: (1-dz), (dz-dx), (dx-dy), dy
                
                w0 = 1.0 - dz
                c_r = lut_table[x0, y0, z0, 0] * w0
                c_g = lut_table[x0, y0, z0, 1] * w0
                c_b = lut_table[x0, y0, z0, 2] * w0
                
                w1 = dz - dx
                c_r += lut_table[x0, y0, z1, 0] * w1
                c_g += lut_table[x0, y0, z1, 1] * w1
                c_b += lut_table[x0, y0, z1, 2] * w1
                
                w2 = dx - dy
                c_r += lut_table[x1, y0, z1, 0] * w2
                c_g += lut_table[x1, y0, z1, 1] * w2
                c_b += lut_table[x1, y0, z1, 2] * w2
                
                c_r += lut_table[x1, y1, z1, 0] * dy
                c_g += lut_table[x1, y1, z1, 1] * dy
                c_b += lut_table[x1, y1, z1, 2] * dy

                r_val, g_val, b_val = c_r, c_g, c_b

        else: # dy > dx
            if dz >= dy:
                # Case 6: dz > dy > dx
                # P1=(0,0,1), P2=(0,1,1)
                # Weights: (1-dz), (dz-dy), (dy-dx), dx
                
                w0 = 1.0 - dz
                c_r = lut_table[x0, y0, z0, 0] * w0
                c_g = lut_table[x0, y0, z0, 1] * w0
                c_b = lut_table[x0, y0, z0, 2] * w0
                
                w1 = dz - dy
                c_r += lut_table[x0, y0, z1, 0] * w1
                c_g += lut_table[x0, y0, z1, 1] * w1
                c_b += lut_table[x0, y0, z1, 2] * w1
                
                w2 = dy - dx
                c_r += lut_table[x0, y1, z1, 0] * w2
                c_g += lut_table[x0, y1, z1, 1] * w2
                c_b += lut_table[x0, y1, z1, 2] * w2
                
                c_r += lut_table[x1, y1, z1, 0] * dx
                c_g += lut_table[x1, y1, z1, 1] * dx
                c_b += lut_table[x1, y1, z1, 2] * dx
                
                r_val, g_val, b_val = c_r, c_g, c_b

            elif dz >= dx:
                # Case 5: dy >= dz > dx
                # P1=(0,1,0), P2=(0,1,1)
                # Weights: (1-dy), (dy-dz), (dz-dx), dx
                
                w0 = 1.0 - dy
                c_r = lut_table[x0, y0, z0, 0] * w0
                c_g = lut_table[x0, y0, z0, 1] * w0
                c_b = lut_table[x0, y0, z0, 2] * w0
                
                w1 = dy - dz
                c_r += lut_table[x0, y1, z0, 0] * w1
                c_g += lut_table[x0, y1, z0, 1] * w1
                c_b += lut_table[x0, y1, z0, 2] * w1
                
                w2 = dz - dx
                c_r += lut_table[x0, y1, z1, 0] * w2
                c_g += lut_table[x0, y1, z1, 1] * w2
                c_b += lut_table[x0, y1, z1, 2] * w2
                
                c_r += lut_table[x1, y1, z1, 0] * dx
                c_g += lut_table[x1, y1, z1, 1] * dx
                c_b += lut_table[x1, y1, z1, 2] * dx
                
                r_val, g_val, b_val = c_r, c_g, c_b

            else:
                # Case 4: dy > dx >= dz
                # P1=(0,1,0), P2=(1,1,0)
                # Weights: (1-dy), (dy-dx), (dx-dz), dz
                
                w0 = 1.0 - dy
                c_r = lut_table[x0, y0, z0, 0] * w0
                c_g = lut_table[x0, y0, z0, 1] * w0
                c_b = lut_table[x0, y0, z0, 2] * w0
                
                w1 = dy - dx
                c_r += lut_table[x0, y1, z0, 0] * w1
                c_g += lut_table[x0, y1, z0, 1] * w1
                c_b += lut_table[x0, y1, z0, 2] * w1
                
                w2 = dx - dz
                c_r += lut_table[x1, y1, z0, 0] * w2
                c_g += lut_table[x1, y1, z0, 1] * w2
                c_b += lut_table[x1, y1, z0, 2] * w2
                
                c_r += lut_table[x1, y1, z1, 0] * dz
                c_g += lut_table[x1, y1, z1, 1] * dz
                c_b += lut_table[x1, y1, z1, 2] * dz

                r_val, g_val, b_val = c_r, c_g, c_b

        # 写入最终结果
        flat_img[i, 0] = r_val
        flat_img[i, 1] = g_val
        flat_img[i, 2] = b_val

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

def apply_saturation_and_contrast(img_linear, saturation=1.25, contrast=1.10, colourspace=None):
    """
    In-Place 应用饱和度和对比度。
    
    Args:
        img_linear: 线性图像数据
        saturation: 饱和度系数
        contrast: 对比度系数
        colourspace: 色彩空间对象，如果为 None 则使用 ProPhoto RGB
    """
    import colour
    
    # 动态获取亮度系数
    if colourspace is None:
        colourspace = colour.RGB_COLOURSPACES['ProPhoto RGB']
    
    luma_coeffs = get_luminance_coeffs(colourspace).astype(np.float32)
    
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