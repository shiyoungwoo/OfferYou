import { test, expect } from '@playwright/test';

test.describe('UI Responsiveness', () => {
  const applicationUrl = '/applications/79433cb0-2c59-4462-9517-6996c6488457';
  const previewUrl = '/applications/79433cb0-2c59-4462-9517-6996c6488457/preview';

  test('Workspace should not have horizontal overflow at 1024px', async ({ page }) => {
    await page.setViewportSize({ width: 1024, height: 768 });
    await page.goto(applicationUrl);
    
    // Check for horizontal overflow
    const overflow = await page.evaluate(() => {
      return document.documentElement.scrollWidth > document.documentElement.clientWidth;
    });
    
    expect(overflow).toBe(false);
  });

  test('Preview Page should not have horizontal overflow at 1024px', async ({ page }) => {
    await page.setViewportSize({ width: 1024, height: 768 });
    await page.goto(previewUrl);
    
    const overflow = await page.evaluate(() => {
      return document.documentElement.scrollWidth > document.documentElement.clientWidth;
    });
    
    expect(overflow).toBe(false);
  });
});
