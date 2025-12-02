from typing import Optional
import colour
import exifread
import numpy as np
from . import lensfun_wrapper as lf

def apply_lens_correction(
    image: np.ndarray,
    raw_path: str,
    camera_maker: Optional[str] = None,
    camera_model: Optional[str] = None,
    lens_maker: Optional[str] = None,
    lens_model: Optional[str] = None,
    focal_length: Optional[float] = None,
    aperture: Optional[float] = None,
    crop_factor: Optional[float] = None,
    correct_distortion: bool = True,
    correct_tca: bool = True,
    correct_vignetting: bool = True,
) -> np.ndarray:
    """
    应用镜头校正到图像
    
    参数:
        image: 输入图像，shape为 (height, width, 3)，dtype为float32，范围0-1
        raw_path: RAW文件路径，用于从EXIF提取缺失的元数据
        camera_maker: 相机制造商（可选，从EXIF提取）
        camera_model: 相机型号（可选，从EXIF提取）
        lens_maker: 镜头制造商（可选，从EXIF提取）
        lens_model: 镜头型号（可选，从EXIF提取）
        focal_length: 焦距 mm（可选，从EXIF提取）
        aperture: 光圈值 f-number（可选，从EXIF提取）
        crop_factor: 裁剪系数（可选，从相机数据库获取）
        correct_distortion: 是否校正畸变
        correct_tca: 是否校正横向色差
        correct_vignetting: 是否校正暗角
    
    返回:
        校正后的图像
    """
    # 从EXIF提取缺失的元数据
    exif_data = extract_lens_exif(raw_path)
    
    # 使用EXIF数据填充缺失参数
    camera_maker = camera_maker or exif_data.get('camera_maker')
    camera_model = camera_model or exif_data.get('camera_model')
    lens_maker = lens_maker or exif_data.get('lens_maker')
    lens_model = lens_model or exif_data.get('lens_model')
    focal_length = focal_length or exif_data.get('focal_length')
    aperture = aperture or exif_data.get('aperture')
    
    # 检查必需参数
    if not camera_model or not lens_model:
        print("  ⚠️  [Warning] Missing camera or lens info. Skipping lens correction.")
        return image
    
    if focal_length is None or aperture is None:
        print("  ⚠️  [Warning] Missing focal length or aperture info. Skipping lens correction.")
        return image
    
    print(f"  🧬 [Lens Correction] {camera_maker} {camera_model} + {lens_maker} {lens_model}")
    print(f"      Details: {focal_length}mm, f/{aperture}")
    
    try:
        corrected = lf.apply_lens_correction(
            image=image,
            camera_maker=camera_maker,
            camera_model=camera_model,
            lens_maker=lens_maker,
            lens_model=lens_model,
            focal_length=focal_length,
            aperture=aperture,
            crop_factor=crop_factor,
            correct_distortion=correct_distortion,
            correct_tca=correct_tca,
            correct_vignetting=correct_vignetting,
        )
        return corrected
    except Exception as e:
        print(f"  ❌ [Error] Lens correction failed: {e}")
        return image
    

def extract_lens_exif(raw_path: str) -> dict:
    """
    从RAW文件的EXIF数据中提取镜头相关信息
    
    返回:
        包含相机和镜头信息的字典
    """
    result = {}
    
    try:
        with open(raw_path, 'rb') as f:
            tags = exifread.process_file(f, details=False)
        
        # 提取相机信息
        camera_make = tags.get('Image Make', None)
        camera_model = tags.get('Image Model', None)
        
        if camera_make:
            result['camera_maker'] = str(camera_make).strip()
        if camera_model:
            result['camera_model'] = str(camera_model).strip()
        
        # 提取镜头信息
        lens_make = tags.get('EXIF LensMake', None)
        lens_model = tags.get('EXIF LensModel', None)
        
        if lens_make:
            result['lens_maker'] = str(lens_make).strip()
        if lens_model:
            result['lens_model'] = str(lens_model).strip()
        
        # 提取焦距
        focal_length = tags.get('EXIF FocalLength', None)
        if focal_length:
            try:
                # 处理分数格式 "50/1"
                focal_val = eval(str(focal_length))
                result['focal_length'] = float(focal_val)
            except:
                pass
        
        # 提取光圈
        aperture = tags.get('EXIF FNumber', None)
        if aperture:
            try:
                aperture_val = eval(str(aperture))
                result['aperture'] = float(aperture_val)
            except:
                pass
        
    except Exception as e:
        print(f"  ❌ [Error] Error extracting EXIF lens info: {e}")
    
    return result

def auto_expose_center_weighted(img_linear: np.ndarray, source_colorspace: colour.RGB_Colourspace, target_gray: float = 0.18) -> np.ndarray:
    # 1. 计算亮度
    xyz = colour.RGB_to_XYZ(img_linear, source_colorspace)
    luminance = xyz[:, :, 1]
    
    h, w = luminance.shape
    
    # 2. 生成权重遮罩 (高斯分布，中心为1，边缘接近0)
    # 创建一个坐标网格
    y, x = np.ogrid[:h, :w]
    # 计算距离中心的距离
    center_y, center_x = h / 2, w / 2
    dist_sq = (x - center_x)**2 + (y - center_y)**2
    # 标准差 sigma 控制"中心"的范围大小，通常取短边的 1/2
    sigma = min(h, w) / 2
    weights = np.exp(-dist_sq / (2 * sigma**2))
    
    # 归一化权重，让 sum(weights) = 1 (或者在加权平均时处理)
    # 这里直接做加权平均
    weighted_avg_lum = np.average(luminance, weights=weights)
    
    # 3. 计算增益
    # 注意：加权平均通常使用算术平均，如果想结合几何平均会更复杂，这里用算术平均演示
    # 也可以对 log(luminance) 做加权平均来实现加权几何平均
    if weighted_avg_lum < 1e-6:
        gain = 1.0
    else:
        gain = target_gray / weighted_avg_lum

    # 限制增益
    gain = np.clip(gain, 0.1, 100.0) # 允许小于1.0，因为原图可能过曝
    
    print(f"  ⚖️  [Auto Exposure] Center-Weighted Gain: {gain:.4f}")
    return img_linear * gain

def auto_expose_highlight_safe(img_linear: np.ndarray, clip_threshold: float = 1.0) -> np.ndarray:
    # 1. 找到亮度
    # 使用 max(R, G, B) 而不是亮度 Y，因为任何一个通道溢出都是溢出
    max_vals = np.max(img_linear, axis=2)
    
    # 2. 找到画面的"几乎最亮"的点 (99.5% 分位点)
    # 为什么不用 100% (max)？因为可能有坏点(Hot Pixels)是极亮的噪点，会干扰计算
    high_percentile = np.percentile(max_vals, 99.5)
    
    # 3. 计算增益
    # 目标是让 99.5% 的亮部处于 0.8~0.9 的位置，留一点余量给镜面高光
    target_high = 0.9  
    
    if high_percentile < 1e-6:
        gain = 1.0
    else:
        gain = target_high / high_percentile
        
    print(f"  🛡️  [Auto Exposure] Highlight Safe Gain: {gain:.4f} (99.5% point: {high_percentile:.4f})")
    return img_linear * gain

def auto_expose_hybrid(img_linear: np.ndarray, source_colorspace: colour.RGB_Colourspace, target_gray: float = 0.18) -> np.ndarray:
    # --- 步骤 A: 计算几何平均 (你原来的方法) ---
    xyz = colour.RGB_to_XYZ(img_linear, source_colorspace)
    luminance = xyz[:, :, 1]
    
    avg_log_lum = np.mean(np.log(luminance + 1e-6))
    avg_lum = np.exp(avg_log_lum)
    
    # 初步计算增益
    base_gain = target_gray / (avg_lum + 1e-6)
    
    # --- 步骤 B: 检查高光 ---
    # 计算应用 base_gain 后，99% 的像素是否会溢出 (比如 > 1.2)
    # ACES 流程中数值经常大于1，但通常我们不希望线性数据全都堆在极高的数值
    max_vals = np.max(img_linear, axis=2)
    p99 = np.percentile(max_vals, 99.0)
    
    potential_peak = p99 * base_gain
    
    max_allowed_peak = 6.0 # 允许高光最亮到什么程度? 
    # 在线性空间(Linear)中，大于1是正常的(HDR)，但如果为了看清暗部把太阳拉到 1000.0 就太夸张了
    # 这里的 6.0 大约是比标准白亮 2.5 档
    
    if potential_peak > max_allowed_peak:
        # 如果溢出太严重，限制增益
        limited_gain = max_allowed_peak / p99
        print(f"  🛡️  [Auto Exposure] Exposure limited by highlight protection. (Desired: {base_gain:.2f}, Actual: {limited_gain:.2f})")
        gain = limited_gain
    else:
        gain = base_gain
        
    # 最后的安全范围 (允许调暗，也允许调亮)
    gain = np.clip(gain, 0.1, 100.0)
    
    return img_linear * gain

def auto_expose_linear(img_linear: np.ndarray, source_colorspace: colour.RGB_Colourspace, target_gray: float = 0.18) -> np.ndarray:
    """
    自动计算曝光增益，将画面的“几何平均亮度”拉升到 target_gray (默认0.18)。
    这模拟了相机的自动测光。
    """
    # 1. 转换为亮度 (Luminance) 以便分析
    # 从源色彩空间转换到 CIE XYZ，然后取 Y 通道作为精确的亮度


    # # 注意：这里只是为了测光，不用太精确的色彩空间转换
    # luminance = (0.2126 * img_linear[:, :, 0] + 
    #              0.7152 * img_linear[:, :, 1] + 
    #              0.0722 * img_linear[:, :, 2])
    
    xyz_image = colour.RGB_to_XYZ(img_linear, source_colorspace)
    luminance = xyz_image[:, :, 1]
    
    # 2. 计算几何平均值 (Geometric Mean)
    # 使用几何平均值可以避免画面中极亮的高光点（如太阳）把整体曝光压得太低
    # 加一个极小值 1e-6 防止 log(0)
    avg_log_lum = np.mean(np.log(luminance + 1e-6))
    avg_lum = np.exp(avg_log_lum)
    
    # 3. 计算增益
    # 如果是一张该死的全黑图片，避免除以0
    if avg_lum < 0.0001: 
        gain = 1.0 
    else:
        gain = target_gray / avg_lum

    # 4. 限制增益范围（可选）
    # 防止对噪点图进行疯狂提亮，通常限制在 1.0 到 10.0 之间
    # 如果你的RAW普遍非常暗，可以把上限调高，比如 64.0 (相当于+6档快门)
    gain = np.clip(gain, 1.0, 50.0)
    
    print(f"  ⚖️  [Auto Exposure] Gain: {gain:.4f} (Base Avg: {avg_lum:.5f})")
    
    return img_linear * gain


def apply_saturation_and_contrast(img_linear, saturation=1.25, contrast=1.10):
    """
    在 Linear 空间下进行饱和度和对比度的微调，以匹配相机直出的质感。
    默认参数 1.15 (饱和度) 和 1.05 (对比度) 是经验数值，适合大多数 Log 流程。
    """
    # 1. 饱和度 (Saturation)
    # 计算亮度 (Luminance Rec.709 权重)
    lum = 0.2126 * img_linear[:,:,0] + 0.7152 * img_linear[:,:,1] + 0.0722 * img_linear[:,:,2]
    lum = np.expand_dims(lum, axis=2)
    
    # 线性插值增加饱和度
    # 混合原图和灰度图： img = gray + (img - gray) * sat
    img_sat = lum + (img_linear - lum) * saturation
    
    # 2. 对比度 (Contrast) - 这里的中心点选 0.18 (中性灰)
    # 以中性灰为轴心拉伸
    pivot = 0.18
    img_boosted = (img_sat - pivot) * contrast + pivot
    
    # 防止出现负数 (对比度拉伸可能会产生负数)
    return np.maximum(img_boosted, 0.0)
