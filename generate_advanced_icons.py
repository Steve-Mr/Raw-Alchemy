from PIL import Image, ImageOps, ImageDraw
import numpy as np

def process_icons():
    source_path = 'raw-alchemy-web/src/assets/raw_ico.png'
    output_dir = 'raw-alchemy-web/public'

    # Brand Color detected from center pixel: (147, 29, 45) -> Hex #931D2D
    BRAND_RED = (147, 29, 45, 255)

    print(f"Opening {source_path}...")
    img = Image.open(source_path).convert("RGBA")

    # 1. Remove White Background (Convert to Transparent)
    data = np.array(img)
    r, g, b, a = data.T
    # Define white threshold (e.g., > 240)
    white_areas = (r > 240) & (g > 240) & (b > 240)
    data[..., 3] = np.where(white_areas.T, 0, 255) # Set alpha to 0 for white pixels

    transparent_base = Image.fromarray(data)
    bbox = transparent_base.getbbox()
    if bbox:
        logo_content = transparent_base.crop(bbox)
    else:
        logo_content = transparent_base

    print("Background removed and cropped.")

    w, h = logo_content.size
    dim = max(w, h)
    new_size = int(dim * 1.1)

    # --- A. Standard Icons (Original Colors on Transparent) ---
    standard_canvas = Image.new("RGBA", (new_size, new_size), (0, 0, 0, 0))
    offset = ((new_size - w) // 2, (new_size - h) // 2)
    standard_canvas.paste(logo_content, offset)

    for size in [192, 512]:
        out = standard_canvas.resize((size, size), Image.Resampling.LANCZOS)
        out.save(f"{output_dir}/pwa-{size}x{size}.png")
        print(f"Saved standard icon: {size}x{size}")

    # --- B. Maskable Icons (Original Colors on Brand Red) ---
    # Background is Brand Red
    maskable_canvas = Image.new("RGBA", (new_size, new_size), BRAND_RED)

    # Use the original logo content (with transparency), scaled down
    logo_for_maskable = logo_content.copy()
    logo_for_maskable.thumbnail((int(new_size * 0.65), int(new_size * 0.65)), Image.Resampling.LANCZOS)

    mw, mh = logo_for_maskable.size
    moffset = ((new_size - mw) // 2, (new_size - mh) // 2)

    # Paste the original logo onto the red background
    maskable_canvas.paste(logo_for_maskable, moffset, logo_for_maskable)

    for size in [192, 512]:
        out = maskable_canvas.resize((size, size), Image.Resampling.LANCZOS)
        out.save(f"{output_dir}/pwa-maskable-{size}.png")
        print(f"Saved maskable icon: {size}x{size}")

    # --- C. Monochrome Icon (Solid Silhouette) ---
    # Create a white version for the monochrome icon
    # Use the alpha channel of the logo content as the mask
    logo_alpha = logo_content.split()[3]
    white_logo = Image.new("RGBA", logo_content.size, (255, 255, 255, 255))
    white_logo.putalpha(logo_alpha)

    mono_canvas = Image.new("RGBA", (new_size, new_size), (0,0,0,0))
    mono_canvas.paste(white_logo, offset, white_logo)

    out_mono = mono_canvas.resize((512, 512), Image.Resampling.LANCZOS)
    out_mono.save(f"{output_dir}/pwa-monochrome.png")
    print("Saved monochrome icon.")

if __name__ == "__main__":
    process_icons()
