/* eslint-disable no-undef */
import { test, expect } from '@playwright/test';

test.describe('Gallery Upload', () => {
  test('should upload multiple images and display them in the gallery', async ({ page }) => {
    // Navigate to the app
    await page.goto('/');

    // Create dummy file buffers
    const file1 = {
      name: 'test1.ARW',
      mimeType: 'image/x-sony-arw',
      buffer: Buffer.from('dummy content')
    };
    const file2 = {
      name: 'test2.ARW',
      mimeType: 'image/x-sony-arw',
      buffer: Buffer.from('dummy content 2')
    };

    // Locate the file input
    // RawUploader has a hidden input with id="raw-upload-input"
    const fileInput = page.locator('#raw-upload-input');

    // Upload files
    await fileInput.setInputFiles([file1, file2]);

    // Verify images appear in the gallery
    // In Desktop mode, GallerySidebar renders the file names
    await Promise.all([
      expect(page.getByText('test1.ARW')).toBeVisible({ timeout: 10000 }),
      expect(page.getByText('test2.ARW')).toBeVisible({ timeout: 10000 })
    ]);
  });
});
