from playwright.sync_api import sync_playwright, expect
import time

def run():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()
        page.goto("http://localhost:5173")

        # Wait for the app to load
        page.wait_for_selector("h1.text-3xl")

        # Check if 3D LUT controls are visible (they are nested under imageState, so not visible initially)
        # But we check for any JS errors in console which might indicate the crash logic.

        page.on("console", lambda msg: print(f"PAGE LOG: {msg.text}"))
        page.on("pageerror", lambda err: print(f"PAGE ERROR: {err}"))

        expect(page.locator("h1")).to_have_text("Raw Alchemy Web")

        page.screenshot(path="verification/lut_upload_fix.png")
        browser.close()

if __name__ == "__main__":
    run()
