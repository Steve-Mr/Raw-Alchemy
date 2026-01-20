
from playwright.sync_api import sync_playwright, expect

def run(playwright):
    browser = playwright.chromium.launch(headless=True)
    page = browser.new_page()

    # Navigate to the app
    page.goto("http://localhost:3000")

    # Wait for the "Color Pipeline Controls" header to appear
    # (Since we forced it visible, it should appear quickly)
    print("Waiting for controls...")
    controls_locator = page.locator("text=Color Pipeline Controls")
    expect(controls_locator).to_be_visible(timeout=10000)

    # Verify LUT controls
    print("Verifying LUT controls...")
    lut_header = page.locator("h4", has_text="3D LUT Application")
    expect(lut_header).to_be_visible()

    file_input = page.locator("input[type='file'][accept='.cube']")
    expect(file_input).to_be_visible()

    # Take screenshot of the controls area
    print("Taking screenshot...")
    page.screenshot(path="lut_ui.png")

    browser.close()
    print("Done.")

with sync_playwright() as playwright:
    run(playwright)
