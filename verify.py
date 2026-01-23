import os
import sys
import subprocess
import time

PARITY_DIR = os.path.abspath("verification/parity")
SAMPLE_PATH = os.path.join(PARITY_DIR, "sample.raw")
PYTHON_OUT = os.path.join(PARITY_DIR, "output_python.tiff")
WEB_OUT = os.path.join(PARITY_DIR, "output_web.tiff")

def run_step(description, command):
    print(f"\n=== {description} ===")
    start_time = time.time()
    try:
        # Stream output to console
        process = subprocess.Popen(command, shell=True)
        exit_code = process.wait()
        if exit_code != 0:
            print(f"FAILED: {description} (Exit Code: {exit_code})")
            return False
        else:
            print(f"SUCCESS: {description} ({time.time() - start_time:.2f}s)")
            return True
    except Exception as e:
        print(f"ERROR: {description}: {e}")
        return False

def main():
    print("Starting Raw Alchemy Parity Verification...")

    # 1. Check/Get Sample
    if not os.path.exists(SAMPLE_PATH):
        print("Sample file not found. Attempting download...")
        if not run_step("Downloading Sample", f"python verification/parity/download_sample.py"):
            print("CRITICAL: No sample file available.")
            print(f"Please place a valid RAW file (ARW, NEF, DNG) at: {SAMPLE_PATH}")
            sys.exit(1)
    else:
        print(f"Using existing sample: {SAMPLE_PATH}")

    # 2. Run Python Backend
    cmd_python = f"python verification/parity/run_python.py --input '{SAMPLE_PATH}' --output '{PYTHON_OUT}'"
    if not run_step("Running Python Backend", cmd_python):
        sys.exit(1)

    # 3. Run Web Backend
    cmd_web = f"python verification/parity/run_web.py --input '{SAMPLE_PATH}' --output '{WEB_OUT}'"
    if not run_step("Running Web Backend", cmd_web):
        sys.exit(1)

    # 4. Compare
    cmd_compare = f"python verification/parity/compare.py --python '{PYTHON_OUT}' --web '{WEB_OUT}' --output-dir '{PARITY_DIR}'"
    if not run_step("Comparing Results", cmd_compare):
        sys.exit(1)

    print("\n✅ Verification Complete!")
    print(f"Report: {os.path.join(PARITY_DIR, 'report.md')}")
    print(f"Heatmap: {os.path.join(PARITY_DIR, 'comparison_heatmap.png')}")

    # Read the report to stdout
    print("\n--- Summary ---")
    try:
        with open(os.path.join(PARITY_DIR, "report.md"), "r") as f:
            print(f.read())
    except:
        pass

if __name__ == "__main__":
    main()
