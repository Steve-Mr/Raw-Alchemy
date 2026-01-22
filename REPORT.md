# 项目对比分析报告：Python Backend vs Web Frontend

## 1. 概述
本报告详细对比了 `raw-alchemy` (Python) 和 `raw-alchemy-web` (Web) 项目的图片处理流程。虽然整体架构和处理步骤在宏观上保持了一致，但在**核心色彩科学 (Color Science)** 的实现上存在重大差异，特别是色彩空间转换矩阵的准确性问题，这将直接导致 Web 端的输出颜色与 Python 端（及标准流程）不一致。

## 2. 流程一致性分析 (Process Consistency)

两者在处理链路的步骤顺序上高度一致：

| 步骤 | Python (`rawpy` + `numpy`) | Web (`libraw-wasm` + WebGL) | 结论 |
| :--- | :--- | :--- | :--- |
| **1. 解码 (Decode)** | `rawpy` 解码为 16-bit ProPhoto RGB (Linear)。 | `libraw-wasm` 解码为 16-bit ProPhoto RGB (Linear)。 | ✅ **一致** |
| **2. 白平衡 (WB)** | 解码时应用 As-Shot WB (`use_camera_wb=True`)。 | 解码时应用 As-Shot WB，Shader 中支持二次调整。 | ✅ **一致** (Web 更灵活) |
| **3. 曝光/增益** | 线性空间乘法增益。 | 线性空间乘法增益 (Shader)。 | ✅ **一致** |
| **4. 风格化 Boost** | Saturation/Contrast 算法（基于 Luminance）。 | Shader 中复刻了完全相同的数学公式。 | ✅ **一致** |
| **5. Gamut 转换** | ProPhoto -> Target Gamut (Log Color Space)。 | ProPhoto -> Target Gamut (Shader Matrix)。 | ⚠️ **流程一致，参数错误** (见下文) |
| **6. Log 编码** | 应用 Log 曲线 (LogC3, S-Log3 等)。 | Shader 中复刻了完全相同的 Log 曲线公式。 | ✅ **一致** |
| **7. 3D LUT** | Tetrahedral 插值应用 LUT。 | WebGL 3D Texture (Linear Filter) + 半像素修正。 | ✅ **一致** |

---

## 3. 发现的问题：色彩科学不规范 (Color Science Discrepancies)

### 3.1. 严重的色彩空间矩阵错误 (CRITICAL)
这是 Web 项目中最严重的问题。虽然 Log3G10 (RED) 的矩阵是正确的，但**几乎所有其他 Log 空间的转换矩阵都与标准值不匹配**。

*   **现象**：Web 端硬编码的 `GAMUT_MATRICES` 与 Python 端动态生成的矩阵存在巨大差异。
*   **验证数据** (以 Arri LogC3 为例，保留2位小数)：
    *   **Python (标准)**: `ProPhoto -> Arri` (Forward Matrix) ≈ **1.22** (R通道主元)
    *   **Web (现状)**: `Arri LogC3` ≈ **0.84** (R通道主元)
    *   **Python (逆向)**: `Arri -> ProPhoto` (Inverse Matrix) ≈ **0.83**
*   **分析**：
    *   Web 端的矩阵数值（0.84）极其接近逆向矩阵（0.83），这暗示可能使用了**倒置矩阵 (Target -> ProPhoto)** 或者使用了完全错误的源/目标定义。
    *   然而，Shader 的逻辑 `vec3 target = u_prophoto_to_target * prophoto` 需要的是 **Forward Matrix (ProPhoto -> Target)**。
    *   **后果**：将 "Target -> ProPhoto" 的矩阵当作 "ProPhoto -> Target" 使用，会导致原本应该压缩的色域被进一步扩张，造成**严重的过饱和、色相偏移和高光溢出**。

*   **受影响范围**：
    *   ❌ **Arri LogC3**: 错误
    *   ❌ **F-Log / F-Log2**: 错误
    *   ❌ **S-Log3**: 错误
    *   ❌ **V-Log**: 错误
    *   ❌ **Canon Log 2/3**: 错误
    *   ❌ **N-Log**: 错误
    *   ❌ **D-Log**: 错误
    *   ✅ **Log3G10 (RED)**: **正确** (完全匹配标准 Bradford CAT 转换)

### 3.2. 白点适配的不确定性
*   **现状**：Log3G10 的矩阵验证了 Web 项目 *意图* 使用 **Bradford Chromatic Adaptation (D50 -> D65)**。
*   **风险**：其他错误矩阵的来源不明，可能混杂了 "无适配 (None CAT)" 或 "错误适配" 的数据。如果修复时只修正了矩阵数值但忽略了白点适配（ProPhoto 是 D50，大多数 Log 空间是 D65），会导致画面整体偏黄或偏蓝。

## 4. 优化建议 (Recommendations)

### 4.1. 立即修正色彩矩阵 (High Priority)
不要依赖硬编码的神秘数字。建议编写一个 Python 脚本（利用 `colour-science` 库），一次性生成所有目标色域的 `ProPhoto RGB (Linear) -> Target Gamut (Linear)` 的标准矩阵，并替换 `src/utils/colorMath.js` 中的内容。

*   **必须确保**：使用 **Bradford** 色彩适配变换 (CAT)，因为 ProPhoto 是 D50，而 Arri/S-Log/Canon 等通常是 D65。

### 4.2. 移除重复的白平衡应用 (Minor Optimization)
*   **现状**：Worker 使用 `useCameraWb: true` (应用了一次)，Shader 又乘了一次 `u_wb_multipliers`。
*   **建议**：
    *   如果 Web UI 的 WB 滑块默认值是 `1.0, 1.0, 1.0`，则现状没问题。
    *   为了更纯粹的管线，建议 Worker 改为 `useCameraWb: false, userMul: [1,1,1,1]` (Unit WB)，然后完全由 Shader 接管白平衡。这样可以避免 LibRaw 的黑箱操作，让前端对色彩有 100% 的控制权（但需注意 LibRaw 的 `outputColor: 4` 转换矩阵是否依赖正确的 WB 才能准确转换到 ProPhoto，通常是的，所以保持现状可能更稳妥，只需确保 UI 默认值为 1.0）。

### 4.3. 统一 Log 曲线实现
Web 端手动实现了 Log 曲线，虽然看起来很精细，但维护成本高。如果将来 Python 端更新了 `colour` 库，Web 端不会自动同步。
*   **建议**：虽然在 Shader 中必须写 GLSL 代码，但建议在注释中明确标注参考的公式来源（如 `colour-science` 文档），并定期核对关键参数（Cutoff 点、斜率等）。目前的实现看起来是直接翻译自标准文档，质量较高，保持即可。

## 5. 结论
Web 项目在架构和流程设计上非常优秀，忠实还原了 Python 版的管线。然而，**`colorMath.js` 中的色彩矩阵数据存在系统性错误**，除 Log3G10 外几乎全军覆没。这不仅是“不规范”，而是直接的 Bug。

**首要任务**：使用 Python `colour-science` 库重新生成正确的 ProPhoto -> Target (Bradford) 矩阵，并更新到 Web 项目中。
