from PIL import Image
import os

def resize_icon(input_path, output_dir):
    try:
        img = Image.open(input_path)
        sizes = [192, 512]

        if not os.path.exists(output_dir):
            os.makedirs(output_dir)

        for size in sizes:
            resized_img = img.resize((size, size), Image.Resampling.LANCZOS)
            output_path = os.path.join(output_dir, f'pwa-{size}x{size}.png')
            resized_img.save(output_path)
            print(f"Saved {output_path}")

    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    resize_icon('raw-alchemy-web/src/assets/logo.png', 'raw-alchemy-web/public')
