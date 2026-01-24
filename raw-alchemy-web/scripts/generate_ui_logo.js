import sharp from 'sharp';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const INPUT_ICON = path.join(__dirname, '../src/assets/maskable_icon.png');
const OUTPUT_LOGO = path.join(__dirname, '../src/assets/app_logo.png');

async function generateUiLogo() {
    try {
        console.log('Generating UI logo...');

        // Create a 192x192 rounded icon for the app UI
        // Creating a rounded rectangle mask
        const width = 192;
        const height = 192;

        const roundedCorners = Buffer.from(
            `<svg><rect x="0" y="0" width="${width}" height="${height}" rx="40" ry="40"/></svg>`
        );

        await sharp(INPUT_ICON)
            .resize(width, height)
            .composite([{
                input: roundedCorners,
                blend: 'dest-in'
            }])
            .png()
            .toFile(OUTPUT_LOGO);

        console.log('Generated app_logo.png');

    } catch (err) {
        console.error('Error generating UI logo:', err);
        process.exit(1);
    }
}

generateUiLogo();
