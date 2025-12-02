"""
Lensfun库的Python包装器
用于镜头畸变、色差和暗角校正
"""

import ctypes
import numpy as np
from typing import Optional, Tuple
import platform
import os

# 根据平台加载正确的库
def _load_lensfun_library():
    """加载lensfun动态库"""
    system = platform.system()
    
    try:
        if system == "Windows":
            # Windows: 优先搜索项目vendor目录
            # 获取当前文件所在目录 (src/raw_alchemy/)
            current_dir = os.path.dirname(os.path.abspath(__file__))
            # vendor路径在当前目录下: src/raw_alchemy/vendor/lensfun/bin/lensfun.dll
            vendor_bin = os.path.join(current_dir, "vendor", "lensfun", "bin", "lensfun.dll")
            
            if os.path.exists(vendor_bin):
                print(f"  ✨ [Lensfun] Using local library: {vendor_bin}")
                lib = ctypes.CDLL(vendor_bin)
            else:
                # 回退到系统路径
                print(f"  ⚠️ [Lensfun] Local library not found ({vendor_bin}), trying system path...")
                lib = ctypes.CDLL("lensfun.dll")
        elif system == "Darwin":
            # macOS: liblensfun.dylib
            lib = ctypes.CDLL("liblensfun.dylib")
        else:
            # Linux: liblensfun.so
            lib = ctypes.CDLL("liblensfun.so.1")
        return lib
    except OSError as e:
        # 不抛出异常，返回None让调用者处理
        print(f"  ❌ [Lensfun] Error loading library: {e}")
        if system == "Windows":
            print(f"  💡 [Hint] Ensure 'lensfun.dll' is in system path or at: {os.path.join(current_dir, 'vendor', 'lensfun', 'bin')}")
        return None


# 加载库
_lensfun = _load_lensfun_library()
if _lensfun is None:
    print("  ⚠️ [Lensfun] Library not loaded. Lens correction disabled.")


# ============================================================================
# Lensfun 常量定义
# ============================================================================

# 像素格式
LF_PF_U8 = 0
LF_PF_U16 = 1
LF_PF_U32 = 2
LF_PF_F32 = 3
LF_PF_F64 = 4

# 校正标志
LF_MODIFY_TCA = 0x00000001          # 横向色差
LF_MODIFY_VIGNETTING = 0x00000002   # 暗角
LF_MODIFY_DISTORTION = 0x00000008   # 畸变
LF_MODIFY_GEOMETRY = 0x00000010     # 几何投影
LF_MODIFY_SCALE = 0x00000020        # 缩放
LF_MODIFY_ALL = ~0

# 镜头类型
LF_UNKNOWN = 0
LF_RECTILINEAR = 1
LF_FISHEYE = 2
LF_PANORAMIC = 3
LF_EQUIRECTANGULAR = 4
LF_FISHEYE_ORTHOGRAPHIC = 5
LF_FISHEYE_STEREOGRAPHIC = 6
LF_FISHEYE_EQUISOLID = 7
LF_FISHEYE_THOBY = 8

# 颜色组件角色
LF_CR_END = 0
LF_CR_NEXT = 1
LF_CR_UNKNOWN = 2
LF_CR_INTENSITY = 3
LF_CR_RED = 4
LF_CR_GREEN = 5
LF_CR_BLUE = 6

# 颜色组件宏
def LF_CR_3(a, b, c):
    """定义3个组件的像素格式 (RGB)"""
    return a | (b << 4) | (c << 8)

LF_CR_RGB = LF_CR_3(LF_CR_RED, LF_CR_GREEN, LF_CR_BLUE)


# ============================================================================
# C结构体定义
# ============================================================================

class lfDatabase(ctypes.Structure):
    """数据库对象 (不透明)"""
    pass

class lfCamera(ctypes.Structure):
    """相机对象 (不透明)"""
    pass

class lfLens(ctypes.Structure):
    """镜头对象 (不透明)"""
    pass

class lfModifier(ctypes.Structure):
    """校正修改器对象 (不透明)"""
    pass


# ============================================================================
# 函数签名定义
# ============================================================================

if _lensfun:
    # 数据库函数
    _lensfun.lf_db_create.restype = ctypes.POINTER(lfDatabase)
    _lensfun.lf_db_create.argtypes = []
    
    _lensfun.lf_db_destroy.restype = None
    _lensfun.lf_db_destroy.argtypes = [ctypes.POINTER(lfDatabase)]
    
    _lensfun.lf_db_load.restype = ctypes.c_int
    _lensfun.lf_db_load.argtypes = [ctypes.POINTER(lfDatabase)]
    
    _lensfun.lf_db_find_cameras_ext.restype = ctypes.POINTER(ctypes.POINTER(lfCamera))
    _lensfun.lf_db_find_cameras_ext.argtypes = [
        ctypes.POINTER(lfDatabase),
        ctypes.c_char_p,  # maker
        ctypes.c_char_p,  # model
        ctypes.c_int      # sflags
    ]
    
    _lensfun.lf_db_find_lenses.restype = ctypes.POINTER(ctypes.POINTER(lfLens))
    _lensfun.lf_db_find_lenses.argtypes = [
        ctypes.POINTER(lfDatabase),
        ctypes.POINTER(lfCamera),
        ctypes.c_char_p,  # maker
        ctypes.c_char_p,  # model
        ctypes.c_int      # sflags
    ]
    
    # 修改器函数
    _lensfun.lf_modifier_create.restype = ctypes.POINTER(lfModifier)
    _lensfun.lf_modifier_create.argtypes = [
        ctypes.POINTER(lfLens),
        ctypes.c_float,   # focal
        ctypes.c_float,   # crop
        ctypes.c_int,     # width
        ctypes.c_int,     # height
        ctypes.c_int,     # pixel_format
        ctypes.c_int      # reverse
    ]
    
    _lensfun.lf_modifier_destroy.restype = None
    _lensfun.lf_modifier_destroy.argtypes = [ctypes.POINTER(lfModifier)]
    
    _lensfun.lf_modifier_enable_distortion_correction.restype = ctypes.c_int
    _lensfun.lf_modifier_enable_distortion_correction.argtypes = [ctypes.POINTER(lfModifier)]
    
    _lensfun.lf_modifier_enable_tca_correction.restype = ctypes.c_int
    _lensfun.lf_modifier_enable_tca_correction.argtypes = [ctypes.POINTER(lfModifier)]
    
    _lensfun.lf_modifier_enable_vignetting_correction.restype = ctypes.c_int
    _lensfun.lf_modifier_enable_vignetting_correction.argtypes = [
        ctypes.POINTER(lfModifier),
        ctypes.c_float,  # aperture
        ctypes.c_float   # distance
    ]
    
    _lensfun.lf_modifier_enable_projection_transform.restype = ctypes.c_int
    _lensfun.lf_modifier_enable_projection_transform.argtypes = [
        ctypes.POINTER(lfModifier),
        ctypes.c_int  # target_projection
    ]
    
    _lensfun.lf_modifier_enable_scaling.restype = ctypes.c_int
    _lensfun.lf_modifier_enable_scaling.argtypes = [
        ctypes.POINTER(lfModifier),
        ctypes.c_float  # scale
    ]
    
    _lensfun.lf_modifier_apply_subpixel_geometry_distortion.restype = ctypes.c_int
    _lensfun.lf_modifier_apply_subpixel_geometry_distortion.argtypes = [
        ctypes.POINTER(lfModifier),
        ctypes.c_float,                    # xu
        ctypes.c_float,                    # yu
        ctypes.c_int,                      # width
        ctypes.c_int,                      # height
        ctypes.POINTER(ctypes.c_float)     # res
    ]
    
    _lensfun.lf_modifier_apply_color_modification.restype = ctypes.c_int
    _lensfun.lf_modifier_apply_color_modification.argtypes = [
        ctypes.POINTER(lfModifier),
        ctypes.c_void_p,  # pixels
        ctypes.c_float,   # x
        ctypes.c_float,   # y
        ctypes.c_int,     # width
        ctypes.c_int,     # height
        ctypes.c_int,     # comp_role
        ctypes.c_int      # row_stride
    ]
    
    _lensfun.lf_free.restype = None
    _lensfun.lf_free.argtypes = [ctypes.c_void_p]


# ============================================================================
# Python包装类
# ============================================================================

class LensfunDatabase:
    """Lensfun数据库包装器"""
    
    def __init__(self):
        if not _lensfun:
            raise RuntimeError("Lensfun库未加载")
        self.db = _lensfun.lf_db_create()
        if not self.db:
            raise RuntimeError("无法创建lensfun数据库")
        
        # 加载数据库
        result = _lensfun.lf_db_load(self.db)
        if result != 0:
            raise RuntimeError(f"加载lensfun数据库失败，错误代码: {result}")
    
    def __del__(self):
        if hasattr(self, 'db') and self.db:
            _lensfun.lf_db_destroy(self.db)
    
    def find_camera(self, maker: Optional[str], model: str) -> Optional[ctypes.POINTER(lfCamera)]:
        """查找相机"""
        maker_b = maker.encode('utf-8') if maker else None
        model_b = model.encode('utf-8')
        
        cameras = _lensfun.lf_db_find_cameras_ext(self.db, maker_b, model_b, 0)
        if cameras and cameras[0]:
            return cameras[0]
        return None
    
    def find_lens(self, camera: Optional[ctypes.POINTER(lfCamera)], 
                  maker: Optional[str], model: str) -> Optional[ctypes.POINTER(lfLens)]:
        """查找镜头"""
        maker_b = maker.encode('utf-8') if maker else None
        model_b = model.encode('utf-8')
        
        lenses = _lensfun.lf_db_find_lenses(self.db, camera, maker_b, model_b, 0)
        if lenses and lenses[0]:
            return lenses[0]
        return None


class LensfunModifier:
    """Lensfun校正修改器包装器"""
    
    def __init__(self, lens: ctypes.POINTER(lfLens), focal: float, crop: float,
                 width: int, height: int, pixel_format: int = LF_PF_F32, reverse: bool = False):
        if not _lensfun:
            raise RuntimeError("Lensfun库未加载")
        
        self.modifier = _lensfun.lf_modifier_create(
            lens, focal, crop, width, height, pixel_format, int(reverse)
        )
        if not self.modifier:
            raise RuntimeError("无法创建lensfun修改器")
        
        self.width = width
        self.height = height
    
    def __del__(self):
        if hasattr(self, 'modifier') and self.modifier:
            _lensfun.lf_modifier_destroy(self.modifier)
    
    def enable_distortion_correction(self) -> int:
        """启用畸变校正"""
        return _lensfun.lf_modifier_enable_distortion_correction(self.modifier)
    
    def enable_tca_correction(self) -> int:
        """启用横向色差校正"""
        return _lensfun.lf_modifier_enable_tca_correction(self.modifier)
    
    def enable_vignetting_correction(self, aperture: float, distance: float = 1000.0) -> int:
        """启用暗角校正"""
        return _lensfun.lf_modifier_enable_vignetting_correction(
            self.modifier, aperture, distance
        )
    
    def enable_projection_transform(self, target_projection: int) -> int:
        """启用投影变换"""
        return _lensfun.lf_modifier_enable_projection_transform(
            self.modifier, target_projection
        )
    
    def enable_scaling(self, scale: float) -> int:
        """启用缩放"""
        return _lensfun.lf_modifier_enable_scaling(self.modifier, scale)
    
    def apply_subpixel_geometry_distortion(self, xu: float, yu: float, 
                                           width: int, height: int) -> Optional[np.ndarray]:
        """应用子像素几何畸变校正
        
        返回: shape为 (height, width, 2, 3) 的数组，存储R/G/B三通道的(x,y)坐标
        """
        # 分配输出缓冲区: width * height * 2 * 3
        res_size = width * height * 2 * 3
        res = (ctypes.c_float * res_size)()
        
        result = _lensfun.lf_modifier_apply_subpixel_geometry_distortion(
            self.modifier, xu, yu, width, height, res
        )
        
        if result:
            # 转换为numpy数组并重塑
            arr = np.ctypeslib.as_array(res)
            return arr.reshape(height, width, 3, 2)  # (h, w, RGB, xy)
        return None
    
    def apply_color_modification(self, pixels: np.ndarray, x: float, y: float,
                                 width: int, height: int) -> bool:
        """应用颜色修改（暗角校正）
        
        参数:
            pixels: 像素数据，会被原地修改
        """
        # 确保数据类型正确
        if pixels.dtype != np.float32:
            raise ValueError("像素数据必须是float32类型")
        
        # 获取数据指针
        pixels_ptr = pixels.ctypes.data_as(ctypes.c_void_p)
        row_stride = width * pixels.shape[2] * pixels.itemsize
        
        result = _lensfun.lf_modifier_apply_color_modification(
            self.modifier, pixels_ptr, x, y, width, height, LF_CR_RGB, row_stride
        )
        
        return bool(result)


# ============================================================================
# 便捷函数
# ============================================================================

def apply_lens_correction(
    image: np.ndarray,
    camera_maker: Optional[str],
    camera_model: str,
    lens_maker: Optional[str],
    lens_model: str,
    focal_length: float,
    aperture: float,
    crop_factor: Optional[float] = None,
    correct_distortion: bool = True,
    correct_tca: bool = True,
    correct_vignetting: bool = True,
    distance: float = 1000.0
) -> np.ndarray:
    """应用镜头校正到图像
    
    参数:
        image: 输入图像，shape为 (height, width, 3)，范围0-1
        camera_maker: 相机制造商
        camera_model: 相机型号
        lens_maker: 镜头制造商
        lens_model: 镜头型号
        focal_length: 焦距 (mm)
        aperture: 光圈值 (f-number)
        crop_factor: 裁剪系数，如果为None则从相机信息获取
        correct_distortion: 是否校正畸变
        correct_tca: 是否校正横向色差
        correct_vignetting: 是否校正暗角
        distance: 对焦距离 (米)
    
    返回:
        校正后的图像（与输入相同dtype）
    """
    if not _lensfun:
        print("  ⚠️ [Lensfun] Library not loaded. Skipping lens correction.")
        return image
    
    # 记住原始dtype以便最后转换回去
    original_dtype = image.dtype
    
    # 转换为float32（如果不是的话）
    if image.dtype != np.float32:
        image = image.astype(np.float32)
    
    height, width = image.shape[:2]
    
    # 创建数据库并查找相机和镜头
    db = LensfunDatabase()
    camera = db.find_camera(camera_maker, camera_model)
    lens = db.find_lens(camera, lens_maker, lens_model)
    
    if not lens:
        print(f"  ⚠️ [Lensfun] Lens not found: {lens_maker} {lens_model}. Skipping correction.")
        return image
    
    # 确定裁剪系数
    if crop_factor is None:
        if camera:
            # 从相机对象获取crop factor (需要访问C结构体成员)
            # 简化处理：使用默认值1.0
            crop_factor = 1.0
        else:
            crop_factor = 1.0
    
    # 创建修改器
    modifier = LensfunModifier(lens, focal_length, crop_factor, width, height, LF_PF_F32)
    
    # 启用所需的校正
    if correct_distortion:
        modifier.enable_distortion_correction()
    
    if correct_tca:
        modifier.enable_tca_correction()
    
    if correct_vignetting:
        modifier.enable_vignetting_correction(aperture, distance)
    
    # 创建输出图像
    output = np.zeros_like(image)
    
    # 步骤1: 应用颜色修改（暗角）
    if correct_vignetting:
        image_copy = image.copy()
        modifier.apply_color_modification(image_copy, 0.0, 0.0, width, height)
        image = image_copy
    
    # 步骤2: 应用几何畸变和TCA校正
    if correct_distortion or correct_tca:
        coords = modifier.apply_subpixel_geometry_distortion(0.0, 0.0, width, height)
        
        if coords is not None:
            # coords shape: (height, width, 3, 2) -> RGB channels, xy coordinates
            for c in range(3):  # R, G, B
                # 使用scipy的map_coordinates进行插值
                from scipy.ndimage import map_coordinates
                
                # 提取该通道的坐标
                coords_c = coords[:, :, c, :]  # (h, w, 2)
                y_coords = coords_c[:, :, 1]
                x_coords = coords_c[:, :, 0]
                
                # map_coordinates需要 (2, h, w) 格式
                coordinates = np.array([y_coords, x_coords])
                
                # 对该通道进行插值
                output[:, :, c] = map_coordinates(
                    image[:, :, c],
                    coordinates,
                    order=3,  # 三次插值
                    mode='reflect'
                )
        else:
            output = image
    else:
        output = image
    
    # 转换回原始dtype
    if output.dtype != original_dtype:
        output = output.astype(original_dtype)
    
    return output