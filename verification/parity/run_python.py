import os
import sys
import argparse
import numpy as np
import tifffile
import rawpy

# Add src to path so we can import raw_alchemy
sys.path.append(os.path.join(os.path.dirname(__file__), '../../src'))

from raw_alchemy import core, config

def run_python_pipeline(input_path, output_path):
    print(f"Running Python Pipeline on {input_path}...")

    # Ensure absolute paths
    input_path = os.path.abspath(input_path)
    output_path = os.path.abspath(output_path)

    # We want to match Web defaults:
    # Saturation: 1.25
    # Contrast: 1.1
    # Exposure: 0.0 (Manual, no auto)
    # Log Space: Arri LogC3
    # WB: As Shot (baked in)
    # Lens Correction: OFF (to isolate decoding/color science)
    # LUT: None

    try:
        core.process_image(
            raw_path=input_path,
            output_path=output_path,
            log_space='Arri LogC3',
            lut_path=None,
            exposure=0.0, # Disable auto-exposure, manual 0 EV
            lens_correct=False, # Disable lens correction for parity
            metering_mode='hybrid' # Ignored if exposure is set
        )
        print(f"Python processing complete. Saved to {output_path}")
        return True
    except Exception as e:
        print(f"Python processing failed: {e}")
        import traceback
        traceback.print_exc()
        return False

if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--input", required=True, help="Path to input RAW file")
    parser.add_argument("--output", required=True, help="Path to output TIFF file")
    args = parser.parse_args()

    if not os.path.exists(args.input):
        print(f"Input file not found: {args.input}")
        sys.exit(1)

    success = run_python_pipeline(args.input, args.output)
    sys.exit(0 if success else 1)
