from PIL import Image, ImageOps, ImageDraw
import numpy as np

def process_icons():
    source_path = 'raw-alchemy-web/src/assets/raw_ico.png'
    output_dir = 'raw-alchemy-web/public'

    print(f"Opening {source_path}...")
    img = Image.open(source_path).convert("RGBA")

    # 1. Remove White Background (Convert to Transparent)
    # Since the user mentioned it has a white background, we need to make it transparent for standard icons
    data = np.array(img)
    r, g, b, a = data.T
    # Define white threshold (e.g., > 240)
    white_areas = (r > 240) & (g > 240) & (b > 240)
    data[..., 3] = np.where(white_areas.T, 0, 255) # Set alpha to 0 for white pixels

    # Create the transparent base image
    transparent_base = Image.fromarray(data)
    # Trim the transparent borders to get the tight logo content
    bbox = transparent_base.getbbox()
    if bbox:
        logo_content = transparent_base.crop(bbox)
    else:
        logo_content = transparent_base # Fallback if empty

    print("Background removed and cropped.")

    # --- A. Standard Icons (Any) ---
    # Add a small padding (10%)
    w, h = logo_content.size
    dim = max(w, h)
    new_size = int(dim * 1.1)
    standard_canvas = Image.new("RGBA", (new_size, new_size), (0, 0, 0, 0))
    offset = ((new_size - w) // 2, (new_size - h) // 2)
    standard_canvas.paste(logo_content, offset)

    for size in [192, 512]:
        out = standard_canvas.resize((size, size), Image.Resampling.LANCZOS)
        out.save(f"{output_dir}/pwa-{size}x{size}.png")
        print(f"Saved standard icon: {size}x{size}")

    # --- B. Maskable Icons (Adaptive) ---
    # Must fill the square. A safe way is to put the logo in the center of a white background
    # with significant padding (safe area is circle with radius 40% of size)
    # We'll use a white background as the 'plate'
    maskable_canvas = Image.new("RGBA", (new_size, new_size), "white")
    # For maskable, we want the logo to be about 60-70% of the canvas to be safe
    # Our 'standard_canvas' has logo at ~90%. Let's shrink it a bit more.
    logo_for_maskable = logo_content.copy()
    logo_for_maskable.thumbnail((int(new_size * 0.65), int(new_size * 0.65)), Image.Resampling.LANCZOS)

    mw, mh = logo_for_maskable.size
    moffset = ((new_size - mw) // 2, (new_size - mh) // 2)
    maskable_canvas.paste(logo_for_maskable, moffset, logo_for_maskable)

    for size in [192, 512]:
        out = maskable_canvas.resize((size, size), Image.Resampling.LANCZOS)
        out.save(f"{output_dir}/pwa-maskable-{size}.png")
        print(f"Saved maskable icon: {size}x{size}")

    # --- C. Monochrome Icon (Themed) ---
    # Need a silhouette. Convert alpha channel to a mask.
    # The logo content (without background) is best for this.
    # We want the logo shape to be white (solid) and background transparent.
    # But wait, monochrome icons in Android use the alpha channel to define the shape.
    # The color comes from the system theme.
    # So we need: Transparent background, and the logo shape in ANY solid color (usually white/black).
    # Since our logo might have internal details, simply using the alpha channel of the whole blob might lose detail.
    # If the logo relies on color contrast (e.g. black text on white), simple alpha mask might be a blob.
    # Let's assume we want to preserve the "dark" parts of the logo as the "ink".

    # Convert original logo content to grayscale
    gray_logo = logo_content.convert("L")
    # Invert it? The original was likely dark on white.
    # If we removed white background, we have dark pixels on transparent.
    # For monochrome, we want the "dark" pixels to become the shape.
    # Let's use the inverse of grayscale as alpha?
    # Or just take the alpha of the cropped image.

    # Strategy: Create a flat image where visible pixels are white.
    mono_canvas = Image.new("RGBA", (new_size, new_size), (0,0,0,0))

    # Create a solid fill version of the logo content
    # Get the alpha channel of the logo content
    content_alpha = logo_content.split()[3]

    # Use the content alpha as the mask for a solid white fill
    solid_fill = Image.new("RGBA", logo_content.size, (255, 255, 255, 255))
    solid_fill.putalpha(content_alpha)

    mono_canvas.paste(solid_fill, offset, solid_fill)

    out_mono = mono_canvas.resize((512, 512), Image.Resampling.LANCZOS)
    out_mono.save(f"{output_dir}/pwa-monochrome.png")
    print("Saved monochrome icon.")

if __name__ == "__main__":
    process_icons()
