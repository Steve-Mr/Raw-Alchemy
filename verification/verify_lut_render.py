from playwright.sync_api import sync_playwright, expect
import time

def verify_app(page):
    # Navigate to the app
    print("Navigating to app...")
    page.goto("http://localhost:5173")

    # Wait for the Title to be visible (verifies React mounted)
    print("Waiting for title...")
    expect(page.get_by_text("RAW Processing Engine")).to_be_visible()

    # Check if the file input exists
    print("Checking for file input...")
    expect(page.locator("input[type='file']")).to_be_visible()

    # Take a screenshot of the initial state
    print("Taking screenshot...")
    page.screenshot(path="verification/verification.png")
    print("Screenshot taken.")

if __name__ == "__main__":
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()
        try:
            verify_app(page)
        except Exception as e:
            print(f"Error: {e}")
            page.screenshot(path="verification/error.png")
        finally:
            browser.close()
