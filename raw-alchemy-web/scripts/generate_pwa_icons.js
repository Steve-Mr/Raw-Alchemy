import sharp from 'sharp';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const INPUT_ICON = path.join(__dirname, '../src/assets/maskable_icon.png');
const PUBLIC_DIR = path.join(__dirname, '../public');

async function generateIcons() {
    try {
        console.log('Generating icons...');

        // Ensure input exists
        // (Sharp will throw if not found)

        // 192x192
        await sharp(INPUT_ICON)
            .resize(192, 192)
            .toFile(path.join(PUBLIC_DIR, 'pwa-192x192.png'));
        console.log('Generated pwa-192x192.png');

        // 512x512
        await sharp(INPUT_ICON)
            .resize(512, 512)
            .toFile(path.join(PUBLIC_DIR, 'pwa-512x512.png'));
        console.log('Generated pwa-512x512.png');

        // 512x512 Maskable
        await sharp(INPUT_ICON)
            .resize(512, 512)
            .toFile(path.join(PUBLIC_DIR, 'maskable-icon-512x512.png'));
        console.log('Generated maskable-icon-512x512.png');

        // Favicon (64x64) - Overwriting existing one
        await sharp(INPUT_ICON)
            .resize(64, 64)
            .toFile(path.join(PUBLIC_DIR, 'favicon.png'));
        console.log('Updated favicon.png');

    } catch (err) {
        console.error('Error generating icons:', err);
        process.exit(1);
    }
}

generateIcons();
