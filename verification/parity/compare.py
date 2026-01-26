import sys
import os
import argparse
import numpy as np
import tifffile
from skimage.metrics import structural_similarity as ssim
import matplotlib.pyplot as plt

def load_image(path):
    print(f"Loading {path}...")
    try:
        img = tifffile.imread(path)
        # Handle alpha channel if present (Web export might have it?)
        # raw-alchemy export usually is RGB.
        if img.ndim == 3 and img.shape[2] == 4:
            print("  Dropping Alpha channel...")
            img = img[:, :, :3]
        return img
    except Exception as e:
        print(f"Failed to load {path}: {e}")
        return None

def align_images(img1, img2):
    """
    Aligns images by center-cropping the larger one to match the smaller one.
    This assumes the mismatch is due to slight border differences in decoding.
    """
    h1, w1 = img1.shape[:2]
    h2, w2 = img2.shape[:2]

    if h1 == h2 and w1 == w2:
        return img1, img2

    print(f"Dimensions differ: {w1}x{h1} vs {w2}x{h2}. Cropping to center intersection.")

    target_h = min(h1, h2)
    target_w = min(w1, w2)

    def crop_center(img, th, tw):
        h, w = img.shape[:2]
        y = (h - th) // 2
        x = (w - tw) // 2
        return img[y:y+th, x:x+tw]

    return crop_center(img1, target_h, target_w), crop_center(img2, target_h, target_w)

def compare(path1, path2, output_dir):
    img1_raw = load_image(path1)
    img2_raw = load_image(path2)

    if img1_raw is None or img2_raw is None:
        return False

    img1, img2 = align_images(img1_raw, img2_raw)

    # Normalize to 0-1 Float
    # Assuming 16-bit input
    max_val = 65535.0
    if img1.dtype == np.uint8: max_val = 255.0

    f1 = img1.astype(np.float32) / max_val
    f2 = img2.astype(np.float32) / max_val

    # 1. Basic Diff
    diff = np.abs(f1 - f2)
    max_diff = np.max(diff)
    mae = np.mean(diff)
    mse = np.mean((f1 - f2) ** 2)

    # 2. PSNR
    if mse == 0:
        psnr = 100.0
    else:
        psnr = 20 * np.log10(1.0 / np.sqrt(mse))

    # 3. SSIM (on luminance to save time/complexity)
    # Convert to Gray using Rec.709 or similar (simple average for now is okay for structure check)
    gray1 = np.mean(f1, axis=2)
    gray2 = np.mean(f2, axis=2)

    ssim_val, ssim_map = ssim(gray1, gray2, data_range=1.0, full=True)

    # Report
    report = []
    report.append("# Parity Check Report")
    report.append(f"- **Python Output**: `{os.path.basename(path1)}`")
    report.append(f"- **Web Output**: `{os.path.basename(path2)}`")
    report.append(f"- **Dimensions**: {img1.shape}")
    report.append("")
    report.append("## Metrics")
    report.append(f"- **Max Pixel Difference**: {max_diff:.6f} ({(max_diff*100):.4f}%)")
    report.append(f"- **Mean Absolute Error (MAE)**: {mae:.6f}")
    report.append(f"- **MSE**: {mse:.8f}")
    report.append(f"- **PSNR**: {psnr:.2f} dB")
    report.append(f"- **SSIM**: {ssim_val:.4f}")

    print("\n".join(report))

    with open(os.path.join(output_dir, "report.md"), "w") as f:
        f.write("\n".join(report))

    # Generate Heatmap
    plt.figure(figsize=(10, 5))

    plt.subplot(1, 3, 1)
    plt.title("Python (Ground Truth)")
    plt.imshow(np.clip(f1, 0, 1)) # Simple display
    plt.axis('off')

    plt.subplot(1, 3, 2)
    plt.title("Web (Candidate)")
    plt.imshow(np.clip(f2, 0, 1))
    plt.axis('off')

    plt.subplot(1, 3, 3)
    plt.title("Difference (Boosted 10x)")
    # Boost difference for visibility
    plt.imshow(np.clip(diff * 10, 0, 1), cmap='magma')
    plt.axis('off')

    plt.tight_layout()
    plt.savefig(os.path.join(output_dir, "comparison_heatmap.png"))
    print(f"Heatmap saved to {os.path.join(output_dir, 'comparison_heatmap.png')}")

    return True

if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--python", required=True, help="Path to Python output")
    parser.add_argument("--web", required=True, help="Path to Web output")
    parser.add_argument("--output-dir", required=True, help="Directory to save report/images")
    args = parser.parse_args()

    if not os.path.exists(args.output_dir):
        os.makedirs(args.output_dir)

    success = compare(args.python, args.web, args.output_dir)
    sys.exit(0 if success else 1)
