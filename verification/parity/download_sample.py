import os
import urllib.request
import sys
import time

SAMPLE_URLS = [
    # rawpy test image (small DNG)
    ("https://github.com/letmaik/rawpy/raw/v0.19.0/tests/iss624.dng", "iss624.dng"),
    # Another rawpy test image
    ("https://github.com/letmaik/rawpy/raw/v0.19.0/tests/iss31.dng", "iss31.dng"),
]

DEST_DIR = os.path.dirname(os.path.abspath(__file__))

def download_file(url, filename):
    filepath = os.path.join(DEST_DIR, filename)
    if os.path.exists(filepath):
        print(f"File {filename} already exists at {filepath}")
        return filepath

    print(f"Downloading {url}...")
    try:
        # Use a user agent to avoid 403s
        req = urllib.request.Request(
            url,
            data=None,
            headers={
                'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_9_3) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/35.0.1916.47 Safari/537.36'
            }
        )

        with urllib.request.urlopen(req) as response, open(filepath, 'wb') as out_file:
            data = response.read()
            out_file.write(data)

        print(f"Downloaded to {filepath}")
        return filepath
    except Exception as e:
        print(f"Failed to download {url}: {e}")
        if os.path.exists(filepath):
            os.remove(filepath)
        return None

def main():
    for url, filename in SAMPLE_URLS:
        path = download_file(url, filename)
        if path:
            print(f"Successfully prepared sample file: {path}")
            standard_path = os.path.join(DEST_DIR, "sample.raw")
            if os.path.exists(standard_path):
                os.remove(standard_path)

            try:
                os.symlink(path, standard_path)
            except OSError:
                import shutil
                shutil.copy2(path, standard_path)

            print(f"Linked to {standard_path}")
            sys.exit(0)

    print("Error: Could not download any sample files.")
    print("Please manually place a RAW file at verification/parity/sample.raw")
    # Don't exit 1, just warn, so I can continue my plan if I manually fix it.
    sys.exit(1)

if __name__ == "__main__":
    main()
