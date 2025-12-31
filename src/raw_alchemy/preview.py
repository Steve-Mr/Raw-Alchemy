import sys
import tkinter as tk
from tkinter import ttk
import numpy as np
import rawpy
import colour
import gc
import threading
import os

import matplotlib
matplotlib.use('TkAgg')
from matplotlib.backends.backend_tkagg import FigureCanvasTkAgg
from matplotlib.figure import Figure

from raw_alchemy import utils, config
from raw_alchemy.metering import apply_auto_exposure


class PreviewWindow:
    """实时预览窗口，仅显示图片，所有参数从主界面读取"""
    
    def __init__(self, parent, raw_path: str, gui_app):
        """
        初始化预览窗口
        
        Args:
            parent: 父窗口
            raw_path: RAW文件路径
            gui_app: 主GUI应用实例，用于读取参数
        """
        self.parent = parent
        self.raw_path = raw_path
        self.gui_app = gui_app
        
        # 创建新窗口
        self.window = tk.Toplevel(parent)
        self.window.title(f"Preview - {os.path.basename(raw_path)}")
        self.window.geometry("1200x800")
        
        # --- Icon Setting ---
        try:
            if sys.platform.startswith('win'):
                icon_path = utils.resource_path("icon.ico")
                if os.path.exists(icon_path): self.window.iconbitmap(icon_path)
            else:
                icon_path = utils.resource_path("icon.png")
                if os.path.exists(icon_path):
                    icon_image = tk.PhotoImage(file=icon_path)
                    self.window.iconphoto(True, icon_image)
        except Exception as e:
            print(f"Icon load warning: {e}")


        # 缓存的原始图像数据
        self.prophoto_linear = None  # 原始线性数据
        self.prophoto_corrected = None  # 镜头校正后的数据
        self.exif_data = None
        self.is_loading = False
        self.is_processing = False
        
        # 镜头校正缓存参数
        self.cached_lens_params = None
        
        # 防抖动定时器
        self.debounce_timer = None
        self.debounce_delay = 100  # 毫秒
        
        # 创建UI
        self.create_widgets()
        
        # 加载RAW文件
        self.load_raw_async()
        
        # 监听主界面参数变化
        self.setup_parameter_monitoring()
    
    def create_widgets(self):
        """创建UI组件"""
        # 主容器
        main_container = ttk.Frame(self.window)
        main_container.pack(fill="both", expand=True, padx=10, pady=10)
        
        # 顶部状态栏
        status_frame = ttk.Frame(main_container)
        status_frame.pack(fill="x", pady=(0, 10))
        
        self.status_label = ttk.Label(status_frame, text="Loading...", foreground="blue", font=("Arial", 10))
        self.status_label.pack(side="left")
        
        ttk.Button(status_frame, text="🔄 Refresh", command=self.refresh_preview).pack(side="right")
        
        # 使用 PanedWindow 分割预览区和侧边栏
        self.paned_window = ttk.PanedWindow(main_container, orient=tk.HORIZONTAL)
        self.paned_window.pack(fill="both", expand=True)
        
        # 左侧预览区域
        preview_frame = ttk.Frame(self.paned_window)
        self.paned_window.add(preview_frame, weight=4)
        
        # 右侧侧边栏（直方图等）
        sidebar_frame = ttk.Frame(self.paned_window)
        self.paned_window.add(sidebar_frame, weight=1)
        
        # --- 预览区域内容 ---
        # Matplotlib图形区域
        self.fig = Figure(figsize=(8, 6), dpi=100)
        self.ax = self.fig.add_subplot(111)
        self.ax.axis('off')  # 隐藏坐标轴
        self.fig.subplots_adjust(left=0, right=1, top=1, bottom=0)
        
        # 创建Canvas
        self.canvas = FigureCanvasTkAgg(self.fig, master=preview_frame)
        self.canvas.draw()
        self.canvas.get_tk_widget().pack(fill="both", expand=True)
        
        # --- 侧边栏内容 ---
        # RGB直方图区域
        rgb_hist_container = ttk.LabelFrame(sidebar_frame, text="Histogram")
        rgb_hist_container.pack(fill="x", padx=5, pady=5)
        
        self.rgb_hist_fig = Figure(figsize=(3, 2.5), dpi=100)
        self.rgb_hist_fig.patch.set_facecolor('#f0f0f0')
        
        self.rgb_hist_ax = self.rgb_hist_fig.add_subplot(111)
        self.rgb_hist_ax.set_facecolor('#2b2b2b')
        self.rgb_hist_ax.tick_params(left=False, bottom=False, labelleft=False, labelbottom=False)
        for spine in self.rgb_hist_ax.spines.values():
            spine.set_visible(False)
            
        self.rgb_hist_canvas = FigureCanvasTkAgg(self.rgb_hist_fig, master=rgb_hist_container)
        self.rgb_hist_canvas.draw()
        self.rgb_hist_canvas.get_tk_widget().pack(fill="both", expand=True, padx=2, pady=2)
        
        # 初始化图像对象
        self.image_obj = None
    
    def setup_parameter_monitoring(self):
        """设置参数监听，当主界面参数变化时自动刷新预览"""
        # 监听所有相关参数的变化
        self.gui_app.log_space_var.trace_add("write", self.on_param_change)
        self.gui_app.lut_folder_var.trace_add("write", self.on_param_change)
        self.gui_app.lut_file_var.trace_add("write", self.on_param_change)
        self.gui_app.exposure_mode_var.trace_add("write", self.on_param_change)
        self.gui_app.exposure_stops_var.trace_add("write", self.on_param_change)
        self.gui_app.metering_mode_var.trace_add("write", self.on_param_change)
        self.gui_app.lens_correction_var.trace_add("write", self.on_param_change)
        self.gui_app.custom_lensfun_db_path_var.trace_add("write", self.on_param_change)
    
    def on_param_change(self, *args):
        """参数变化时自动刷新预览（带防抖动）"""
        if self.prophoto_linear is None or self.is_loading:
            return
        
        # 取消之前的定时器
        if self.debounce_timer is not None:
            self.window.after_cancel(self.debounce_timer)
        
        # 设置新的定时器
        self.debounce_timer = self.window.after(self.debounce_delay, self.refresh_preview)
    
    def load_new_image(self, raw_path):
        """加载新图片到当前窗口"""
        # 先清理老图片的内存
        if self.prophoto_linear is not None:
            del self.prophoto_linear
        if self.prophoto_corrected is not None:
            del self.prophoto_corrected
        
        # 清空显示
        self.ax.clear()
        self.ax.axis('off')
        self.canvas.draw()
        
        # 强制垃圾回收
        gc.collect()
        
        # 更新路径和标题
        self.raw_path = raw_path
        self.window.title(f"Preview - {os.path.basename(raw_path)}")
        
        # 重置缓存
        self.prophoto_linear = None
        self.prophoto_corrected = None
        self.exif_data = None
        self.cached_lens_params = None
        
        # 重新加载
        self.load_raw_async()
    
    def load_raw_async(self):
        """异步加载RAW文件"""
        self.is_loading = True
        self.status_label.config(text="Loading RAW...", foreground="blue")
        
        def load_thread():
            try:
                with rawpy.imread(self.raw_path) as raw:
                    # 提取EXIF
                    self.exif_data = utils.extract_lens_exif(raw, logger=print)
                    
                    # 解码RAW - 使用半尺寸解码加快预览速度（速度提升约4倍）
                    prophoto_linear = raw.postprocess(
                        gamma=(1, 1),
                        no_auto_bright=True,
                        use_camera_wb=True,
                        output_bps=16,
                        output_color=rawpy.ColorSpace.ProPhoto,
                        bright=1.0,
                        highlight_mode=2,
                        demosaic_algorithm=rawpy.DemosaicAlgorithm.AAHD,
                        half_size=True,  # 半尺寸解码，分辨率减半但速度提升4倍
                    )
                    
                    # 转为Float32
                    img = prophoto_linear.astype(np.float32) / 65535.0
                    
                    # 缩小图像以加快预览（保持宽高比，最大边1600px）
                    h, w = img.shape[:2]
                    max_dim = 1600
                    if max(h, w) > max_dim:
                        scale = max_dim / max(h, w)
                        new_h, new_w = int(h * scale), int(w * scale)
                        # 使用简单的numpy缩放
                        from scipy.ndimage import zoom
                        img = zoom(img, (scale, scale, 1), order=1)
                    
                    self.prophoto_linear = img
                    del prophoto_linear
                    gc.collect()
                    
                    # 加载完成后刷新预览
                    self.window.after(0, self.on_raw_loaded)
                    
            except Exception as e:
                error_msg = str(e)
                import traceback
                traceback.print_exc()
                self.window.after(0, lambda msg=error_msg: self.on_load_error(msg))
        
        thread = threading.Thread(target=load_thread, daemon=True)
        thread.start()
    
    def on_raw_loaded(self):
        """RAW加载完成的回调"""
        self.is_loading = False
        self.status_label.config(text="Ready", foreground="green")
        self.refresh_preview()
    
    def on_load_error(self, error_msg):
        """RAW加载失败的回调"""
        self.is_loading = False
        self.status_label.config(text=f"Error: {error_msg}", foreground="red")
    
    def get_current_params(self):
        """从主界面获取当前参数"""
        params = {
            'log_space': self.gui_app.log_space_var.get(),
            'lut_path': self.gui_app.get_selected_lut_path(),
            'lens_correct': self.gui_app.lens_correction_var.get(),
            'custom_db_path': self.gui_app.custom_lensfun_db_path_var.get() or None,
        }
        
        # 曝光参数
        if self.gui_app.exposure_mode_var.get() == "Manual":
            params['exposure'] = self.gui_app.exposure_stops_var.get()
            params['metering_mode'] = None
        else:
            params['exposure'] = None
            params['metering_mode'] = self.gui_app.metering_mode_var.get()
        
        return params
    
    def refresh_preview(self):
        """刷新预览图像"""
        if self.prophoto_linear is None or self.is_loading or self.is_processing:
            return
        
        self.is_processing = True
        self.status_label.config(text="Processing...", foreground="orange")
        
        def process_thread():
            try:
                # 获取当前参数
                params = self.get_current_params()
                
                # 检查镜头校正参数是否变化
                current_lens_params = (params['lens_correct'], params['custom_db_path'])
                lens_params_changed = (self.cached_lens_params != current_lens_params)
                
                # 如果镜头校正参数变化，需要重新校正
                if lens_params_changed:
                    img = self.prophoto_linear.copy()
                    source_cs = colour.RGB_COLOURSPACES['ProPhoto RGB']
                    
                    # 镜头校正
                    if params['lens_correct'] and self.exif_data:
                        img = utils.apply_lens_correction(
                            img,
                            exif_data=self.exif_data,
                            custom_db_path=params['custom_db_path'],
                            logger=print
                        )
                    
                    # 缓存校正后的结果
                    self.prophoto_corrected = img.copy()
                    self.cached_lens_params = current_lens_params
                else:
                    # 使用缓存的校正结果
                    img = self.prophoto_corrected.copy()
                
                source_cs = colour.RGB_COLOURSPACES['ProPhoto RGB']
                
                # 1. 曝光控制
                if params['exposure'] is not None:
                    # 手动曝光
                    gain = 2.0 ** params['exposure']
                    utils.apply_gain_inplace(img, gain)
                else:
                    # 自动曝光
                    metering_mode = params['metering_mode']
                    img = apply_auto_exposure(img, source_cs, metering_mode, target_gray=0.18, logger=None)
                
                # 3. 饱和度和对比度增强
                img = utils.apply_saturation_and_contrast(img, saturation=1.25, contrast=1.1, colourspace=source_cs)
                
                # 4. Log转换
                log_space = params['log_space']
                log_color_space_name = config.LOG_TO_WORKING_SPACE.get(log_space)
                log_curve_name = config.LOG_ENCODING_MAP.get(log_space, log_space)
                
                if log_color_space_name:
                    # Gamut变换
                    M = colour.matrix_RGB_to_RGB(
                        colour.RGB_COLOURSPACES['ProPhoto RGB'],
                        colour.RGB_COLOURSPACES[log_color_space_name],
                    )
                    if not img.flags['C_CONTIGUOUS']:
                        img = np.ascontiguousarray(img)
                    if img.dtype != np.float32:
                        img = img.astype(np.float32)
                    utils.apply_matrix_inplace(img, M)
                    
                    # Log编码
                    np.maximum(img, 1e-6, out=img)
                    img = colour.cctf_encoding(img, function=log_curve_name)
                
                # 5. 应用LUT
                lut_path = params['lut_path']
                if lut_path:
                    try:
                        lut = colour.read_LUT(lut_path)
                        if isinstance(lut, colour.LUT3D):
                            if not img.flags['C_CONTIGUOUS']:
                                img = np.ascontiguousarray(img)
                            if img.dtype != np.float32:
                                img = img.astype(np.float32)
                            if lut.table.dtype != np.float32:
                                lut.table = lut.table.astype(np.float32)
                            utils.apply_lut_inplace(img, lut.table, lut.domain[0], lut.domain[1])
                        else:
                            img = lut.apply(img)
                    except Exception as e:
                        print(f"LUT应用错误: {e}")
                
                # 6. 裁剪到有效范围
                img = np.clip(img, 0, 1)
                
                # 更新UI
                self.window.after(0, lambda image=img: self.update_image_display(image))
                
            except Exception as e:
                import traceback
                traceback.print_exc()
                error_msg = str(e)
                self.window.after(0, lambda msg=error_msg: self.on_process_error(msg))
            finally:
                self.is_processing = False
        
        thread = threading.Thread(target=process_thread, daemon=True)
        thread.start()
    
    def update_image_display(self, img_array):
        """更新图像显示"""
        try:
            # 清除之前的图像
            self.ax.clear()
            self.ax.axis('off')
            
            # 使用 Numba 加速的 BT.709 -> sRGB 转换（比 colour 库快 10-50 倍）
            # 确保数据类型和内存布局正确
            if not img_array.flags['C_CONTIGUOUS']:
                img_array = np.ascontiguousarray(img_array)
            if img_array.dtype != np.float32:
                img_array = img_array.astype(np.float32)
            
            utils.bt709_to_srgb_inplace(img_array)
         
            # 显示新图像
            self.image_obj = self.ax.imshow(img_array, interpolation='bilinear')
            
            # 调整布局
            self.fig.tight_layout(pad=0)
            
            # 刷新canvas
            self.canvas.draw()
            
            # 更新直方图
            self.update_histogram(img_array)
            
            self.status_label.config(text="Preview Updated ✓", foreground="green")
            
        except Exception as e:
            import traceback
            traceback.print_exc()
            self.on_process_error(str(e))
    
    def update_histogram(self, img_array):
        """更新直方图"""
        try:
            # 简单的下采样以提高直方图计算速度
            if img_array.shape[0] * img_array.shape[1] > 500000:
                 sample = img_array[::2, ::2, :]
            else:
                 sample = img_array
            
            bins = 128  # 预览不需要太高精度的直方图
            x = np.linspace(0, 1, bins)
            
            # --- 更新 RGB 直方图 ---
            self.rgb_hist_ax.clear()
            self.rgb_hist_ax.set_facecolor('#2b2b2b')
            self.rgb_hist_ax.set_xlim(0, 1)
            
            max_val_rgb = 0
            colors = ['red', 'green', 'blue']
            hists = []
            
            # 1. 计算三个通道的原始数据
            for i in range(3):
                hist, _ = np.histogram(sample[..., i], bins=bins, range=(0, 1))
                hists.append(hist)
            
            # 2. 【核心优化】计算 Y 轴上限时忽略“纯黑”和“纯白”的统计尖峰
            valid_counts = []
            for h in hists:
                # 忽略 hist[0] (纯黑) 和 hist[-1] (纯白)
                valid_counts.extend(h[1:-1])
            
            valid_counts = np.array(valid_counts)
            if len(valid_counts) > 0 and valid_counts.max() > 0:
                # 使用中间有效区域的 95% 分位数作为参考上限
                max_val_rgb = np.percentile(valid_counts, 98) * 1.5
                
                # 保险逻辑：防止缩得太小，如果最大峰值太高，至少保证能看到它的 10%
                absolute_max = max(h.max() for h in hists)
                max_val_rgb = max(max_val_rgb, absolute_max * 0.1)
            else:
                max_val_rgb = max(h.max() for h in hists) if any(h.max() > 0 for h in hists) else 1

            # 3. 绘制填充曲线
            for i, color in enumerate(colors):
                hist = hists[i]
                self.rgb_hist_ax.plot(x, hist, color=color, linewidth=1, alpha=0.9)
                self.rgb_hist_ax.fill_between(x, 0, hist, color=color, alpha=0.2)
            
            # 4. 设置裁剪后的 Y 轴范围
            self.rgb_hist_ax.set_ylim(0, max_val_rgb)
            self.rgb_hist_ax.axis('off')
            self.rgb_hist_fig.tight_layout(pad=0)
            self.rgb_hist_canvas.draw()
            
        except Exception as e:
            print(f"Histogram error: {e}")
    
    def on_process_error(self, error_msg):
        """处理错误的回调"""
        self.status_label.config(text=f"Error: {error_msg}", foreground="red")
        print(f"Preview error: {error_msg}")


def open_preview_window(parent, raw_path: str, gui_app):
    """
    打开预览窗口的便捷函数
    
    Args:
        parent: 父窗口
        raw_path: RAW文件路径
        gui_app: 主GUI应用实例
    
    Returns:
        PreviewWindow实例
    """
    return PreviewWindow(parent, raw_path, gui_app)

