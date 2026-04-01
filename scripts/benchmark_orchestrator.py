import os
import timeit
import tempfile
import shutil

SUPPORTED_RAW_EXTENSIONS = [
    '.dng', '.cr2', '.cr3', '.nef', '.arw', '.rw2', '.raf', '.orf', '.pef', '.srw'
]

def original_method(input_path):
    raw_files = []
    for ext in SUPPORTED_RAW_EXTENSIONS:
        raw_files.extend([f for f in os.listdir(input_path) if f.lower().endswith(ext)])
    return raw_files

def optimized_method(input_path):
    extensions = tuple(SUPPORTED_RAW_EXTENSIONS)
    return [f for f in os.listdir(input_path) if f.lower().endswith(extensions)]

def benchmark():
    # Create a temporary directory with many files
    temp_dir = tempfile.mkdtemp()
    try:
        # Create 1000 files, 100 for each supported extension, and 1000 other files
        for i in range(1000):
            for ext in SUPPORTED_RAW_EXTENSIONS:
                open(os.path.join(temp_dir, f"file_{i}{ext}"), 'a').close()
            open(os.path.join(temp_dir, f"other_{i}.txt"), 'a').close()

        print(f"Number of files in directory: {len(os.listdir(temp_dir))}")

        original_time = timeit.timeit(lambda: original_method(temp_dir), number=100)
        optimized_time = timeit.timeit(lambda: optimized_method(temp_dir), number=100)

        print(f"Original method: {original_time:.4f} seconds")
        print(f"Optimized method: {optimized_time:.4f} seconds")
        print(f"Improvement: {(original_time - optimized_time) / original_time * 100:.2f}%")

        # Verify correctness
        orig_res = sorted(original_method(temp_dir))
        opt_res = sorted(optimized_method(temp_dir))
        assert orig_res == opt_res
        print("Verification successful: Results are identical.")

    finally:
        shutil.rmtree(temp_dir)

if __name__ == "__main__":
    benchmark()
