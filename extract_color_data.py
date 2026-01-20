import colour
import numpy as np

# Define Gamuts to extract
# We need ProPhoto RGB to Target Gamut
# ProPhoto RGB is usually 'ProPhoto RGB' or 'ROMM RGB' in colour library
PROPHOTO = 'ProPhoto RGB'
GAMUTS = [
    'F-Gamut', 'F-Gamut C',
    'S-Gamut3', 'S-Gamut3.Cine',
    'V-Gamut',
    'Cinema Gamut', 'ITU-R BT.2020',
    'DJI D-Gamut', 'REDWideGamutRGB'
]

# Log curves to inspect
LOG_CURVES = [
    'F-Log', 'F-Log2',
    'S-Log3',
    'V-Log',
    'Canon Log 2', 'Canon Log 3',
    'N-Log', 'D-Log',
    'Log3G10'
]

print("=== GAMUT MATRICES (ProPhoto RGB -> Target) ===")
# Ensure ProPhoto RGB is available
if PROPHOTO not in colour.RGB_COLOURSPACES:
    print(f"Error: {PROPHOTO} not found in colour library.")
    exit(1)

cs_prophoto = colour.RGB_COLOURSPACES[PROPHOTO]

for target_name in GAMUTS:
    if target_name in colour.RGB_COLOURSPACES:
        cs_target = colour.RGB_COLOURSPACES[target_name]

        # Calculate Matrix: ProPhoto (D50) -> Target (Usually D65)
        # colour.matrix_RGB_to_RGB handles chromatic adaptation automatically if white points differ
        M = colour.matrix_RGB_to_RGB(cs_prophoto, cs_target)

        print(f"\n--- {target_name} ---")
        # Print as JS Array
        flat_m = M.flatten()
        print(f"Matrix (Flat Row-Major): [{', '.join([f'{x:.6f}' for x in flat_m])}]")
    else:
        print(f"\n--- {target_name} : NOT FOUND IN COLOUR LIB ---")


print("\n\n=== LOG CURVE DATA ===")
# Try to extract constants or definitions if possible, otherwise I might have to rely on known formulas
# But since I need to port them to GLSL, having the parameter values is key.
# colour library often stores these in the object if it uses a parametric function.

for curve_name in LOG_CURVES:
    print(f"\n--- {curve_name} ---")
    # There isn't a direct way to dump the formula source from the object easily
    # But often we can inspect `colour.models.rgb.transfer_functions` or similar.
    # I will just print if it exists to confirm.
    # To get the parameters, I might need to dig into the specific log encoding function's docstring or implementation.
    # However, since I am in a python script, I can use `help()` or `inspect` to read the docstring which usually contains the formula!

    try:
        # Find the function
        # colour.cctf_encoding calls specific functions.
        # I need to find the specific function name.
        # usually `colour.models.log_encoding_VLog` etc.

        # Search in colour.models for something matching
        import inspect

        # Map common names to potential function names if needed, but colour usually has good mapping
        # Let's try to find the encoding function
        # Using `colour.COLOUR_PRIMARIES` ... no
        # The registry for cctf_encoding:
        # colour.LOG_ENCODING_CURVES ? (Depends on version)
        pass

    except Exception as e:
        print(f"Error: {e}")

# Since I can't easily extract the formula *code*, I will assume I need to look up the docstrings or source.
# I will print the `__doc__` of the relevant functions if I can find them.

# Manually mapping based on common colour-science naming
func_map = {
    'F-Log': 'log_encoding_FLog',
    'F-Log2': 'log_encoding_FLog2',
    'S-Log3': 'log_encoding_SLog3',
    'V-Log': 'log_encoding_VLog',
    'Canon Log 2': 'log_encoding_CanonLog2',
    'Canon Log 3': 'log_encoding_CanonLog3',
    'N-Log': 'log_encoding_NLog',
    'D-Log': 'log_encoding_DLog', # might be D-Log, check
    'Log3G10': 'log_encoding_Log3G10'
}

for name, func_name in func_map.items():
    if hasattr(colour.models, func_name):
        f = getattr(colour.models, func_name)
        print(f"\n>>> Docstring for {name} ({func_name}):")
        # Print first 20 lines of docstring which usually has the math
        doc = f.__doc__
        if doc:
            lines = doc.split('\n')
            for line in lines[:50]:
                 if "def" not in line: # avoid printing python defs if inside doc
                     print(line)
    else:
        print(f"\n>>> {name} function {func_name} NOT FOUND in colour.models")
