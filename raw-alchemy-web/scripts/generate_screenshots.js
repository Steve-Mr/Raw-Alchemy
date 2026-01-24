import { chromium } from 'playwright';
import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PUBLIC_DIR = path.join(__dirname, '../public');

async function main() {
  console.log('Starting Vite server...');
  const vite = spawn('npm', ['run', 'dev', '--', '--port', '5174'], {
    cwd: path.join(__dirname, '..'),
    stdio: 'pipe',
    shell: true
  });

  // Wait for server to start
  await new Promise((resolve) => {
    vite.stdout.on('data', (data) => {
      const output = data.toString();
      if (output.includes('Local:') || output.includes('ready in')) {
        resolve();
      }
    });
  });

  console.log('Server started on port 5174');

  const browser = await chromium.launch();
  const page = await browser.newPage();

  try {
    // Desktop Screenshot
    console.log('Taking desktop screenshot...');
    await page.setViewportSize({ width: 1920, height: 1080 });
    await page.goto('http://localhost:5174', { waitUntil: 'networkidle' });
    // Add a small delay to ensure rendering (esp WebGL or animations)
    await page.waitForTimeout(3000);
    await page.screenshot({ path: path.join(PUBLIC_DIR, 'screenshot-desktop.png') });
    console.log('Saved screenshot-desktop.png');

    // Mobile Screenshot
    console.log('Taking mobile screenshot...');
    await page.setViewportSize({ width: 375, height: 812 });
    // Reload to trigger responsive layout changes properly if needed
    await page.reload({ waitUntil: 'networkidle' });
    await page.waitForTimeout(3000);
    await page.screenshot({ path: path.join(PUBLIC_DIR, 'screenshot-mobile.png') });
    console.log('Saved screenshot-mobile.png');

  } catch (err) {
    console.error('Error taking screenshots:', err);
  } finally {
    await browser.close();
    // Kill the vite process
    // On Windows, tree-kill might be better, but we'll try standard kill first
    // Since we used shell: true, the PID is the shell, not the node process.
    // In this environment (Linux), it should be okay.
    vite.kill();

    // Explicitly exit to ensure cleanup
    process.exit(0);
  }
}

main();
