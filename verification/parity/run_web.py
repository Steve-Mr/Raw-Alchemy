import os
import sys
import time
import subprocess
import argparse
import signal
from playwright.sync_api import sync_playwright

WEB_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), '../../raw-alchemy-web'))

def run_web_pipeline(input_path, output_path):
    print(f"Running Web Pipeline...")
    input_path = os.path.abspath(input_path)
    output_path = os.path.abspath(output_path)

    # 1. Start Vite Server (Preview Mode for better WASM/Worker support)
    print("Starting Vite Preview server...")
    port = 5174

    # Ensure build exists (fast check)
    if not os.path.exists(os.path.join(WEB_DIR, 'dist')):
        print("Dist folder not found. Running build...")
        subprocess.run(['npm', 'run', 'build'], cwd=WEB_DIR, check=True)

    kwargs = {}
    if os.name == 'nt':
        kwargs['creationflags'] = subprocess.CREATE_NEW_PROCESS_GROUP
    else:
        kwargs['preexec_fn'] = os.setsid

    vite_process = subprocess.Popen(
        ['npm', 'run', 'preview', '--', '--port', str(port)],
        cwd=WEB_DIR,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        **kwargs
    )

    time.sleep(3)
    url = f"http://localhost:{port}"
    print(f"Server should be up at {url}")

    try:
        with sync_playwright() as p:
            browser = p.chromium.launch(headless=True) # Headless for CI
            page = browser.new_page()

            page.on("console", lambda msg: print(f"PAGE LOG: {msg.text}"))
            page.on("pageerror", lambda exc: print(f"PAGE ERROR: {exc}"))
            page.on("requestfailed", lambda req: print(f"REQ FAILED: {req.url} - {req.failure}"))

            print("Navigating to app...")
            page.goto(url)

            file_input = page.locator('input[type="file"][accept*=".ARW"]')
            file_input.wait_for()

            print(f"Uploading {input_path}...")
            file_input.set_input_files(input_path)

            print("Waiting for processing...")
            try:
                page.locator('canvas').wait_for(timeout=60000)
            except Exception as e:
                print("Timeout waiting for canvas. Capturing screenshot...")
                page.screenshot(path="web_error.png")
                raise e

            print("Forcing settings for parity...")

            def set_range(label_text, value):
                page.evaluate(f"""
                    () => {{
                        const labels = Array.from(document.querySelectorAll('label'));
                        const label = labels.find(l => l.textContent.includes('{label_text}'));
                        if (label) {{
                            const input = label.parentElement.querySelector('input[type="range"]');
                            if (input) {{
                                input.value = {value};
                                input.dispatchEvent(new Event('input', {{ bubbles: true }}));
                                input.dispatchEvent(new Event('change', {{ bubbles: true }}));
                            }}
                        }}
                    }}
                """)
                time.sleep(0.1)

            set_range("Exposure (EV)", 0.0)
            set_range("Red Gain", 1.0)
            set_range("Green Gain", 1.0)
            set_range("Blue Gain", 1.0)
            set_range("Saturation", 1.25)
            set_range("Contrast", 1.1)
            set_range("Input Linearization", 1.0)

            print("Setting Target Log Space...")
            # Use specific locator to avoid confusing with Metering Mode select
            page.locator('select').filter(has_text="Arri LogC3").select_option(label='Arri LogC3')

            time.sleep(1)

            print("Clicking Export...")
            with page.expect_download(timeout=60000) as download_info:
                page.locator("button:has-text('Export')").first.click()

            download = download_info.value
            print(f"Download started: {download.suggested_filename}")
            download.save_as(output_path)
            print(f"Saved Web output to {output_path}")

            browser.close()
            return True

    except Exception as e:
        print(f"Web pipeline failed: {e}")
        import traceback
        traceback.print_exc()
        return False

    finally:
        print("Stopping Vite server...")
        if vite_process:
            if os.name == 'nt':
                 subprocess.call(['taskkill', '/F', '/T', '/PID', str(vite_process.pid)])
            else:
                 try:
                    os.killpg(os.getpgid(vite_process.pid), signal.SIGTERM)
                 except:
                    vite_process.terminate()

if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--input", required=True, help="Path to input RAW file")
    parser.add_argument("--output", required=True, help="Path to output TIFF file")
    args = parser.parse_args()

    if not os.path.exists(args.input):
        print(f"Input file not found: {args.input}")
        sys.exit(1)

    success = run_web_pipeline(args.input, args.output)
    sys.exit(0 if success else 1)
