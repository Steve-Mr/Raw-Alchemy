from playwright.sync_api import sync_playwright
import time
import os

def verify_app(page):
    print("Navigating to app...")
    page.goto("http://localhost:5173")

    print("Waiting for page load...")
    page.wait_for_selector("h1")

    # Check if title is correct
    title = page.locator("h1").text_content()
    print(f"Page Title: {title}")

    # Check if new controls are visible (White Balance)
    # Note: They only appear after loading an image, so we can't test them fully without a sample file.
    # But we can verify the app loads and didn't crash on startup.

    # Take a screenshot of the initial state
    print("Taking initial screenshot...")
    page.screenshot(path="verification/initial_state.png")

    # We can try to upload a dummy file if we have one, but for now we just check the UI structure.
    # The file input should be present.
    input_selector = "input[type='file']"
    if page.is_visible(input_selector):
        print("File input found.")
    else:
        print("File input NOT found.")

    print("Verification script finished.")

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
