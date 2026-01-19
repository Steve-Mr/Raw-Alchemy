import React, { useState, useEffect } from 'react';
import LibRaw from 'libraw-wasm';

const RawUploader = () => {
  const [metadata, setMetadata] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleFileChange = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    setLoading(true);
    setError(null);
    setMetadata(null);

    try {
      const arrayBuffer = await file.arrayBuffer();

      // Based on the minified source code inspection:
      // The default export is a class. We need to instantiate it.
      // It has 'open', 'metadata', 'imageData' methods.
      // It uses a worker internally, referenced by URL "./worker.js".

      const decoder = new LibRaw();

      // Pass the buffer to 'open'. The minified code shows runFn("open", t, r).
      await decoder.open(new Uint8Array(arrayBuffer));

      // Get metadata
      const meta = await decoder.metadata();

      if (meta) {
        setMetadata({
          width: meta.width,
          height: meta.height,
          iso: meta.iso,
          make: meta.make,
          model: meta.model,
          shutter: meta.shutter
        });
      } else {
        throw new Error("Failed to extract metadata");
      }

    } catch (err) {
      console.error(err);
      setError(err.message || "Unknown error occurred");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-4 border rounded shadow bg-white max-w-md mx-auto mt-10">
      <h2 className="text-xl font-bold mb-4">RAW File Verification</h2>

      <input
        type="file"
        accept=".ARW,.CR2,.CR3,.DNG,.NEF,.ORF,.RAF"
        onChange={handleFileChange}
        className="block w-full text-sm text-gray-500
          file:mr-4 file:py-2 file:px-4
          file:rounded-full file:border-0
          file:text-sm file:font-semibold
          file:bg-blue-50 file:text-blue-700
          hover:file:bg-blue-100
        "
      />

      {loading && <div className="mt-4 text-blue-600">Processing RAW file... (This may take a moment)</div>}

      {error && <div className="mt-4 text-red-600">Error: {error}</div>}

      {metadata && (
        <div className="mt-6 p-4 bg-gray-50 rounded">
          <h3 className="font-semibold mb-2">Metadata Extracted:</h3>
          <ul className="space-y-1 text-sm">
             <li><strong>Make:</strong> {metadata.make || 'N/A'}</li>
             <li><strong>Model:</strong> {metadata.model || 'N/A'}</li>
             <li><strong>Dimensions:</strong> {metadata.width} x {metadata.height}</li>
             <li><strong>ISO:</strong> {metadata.iso || 'N/A'}</li>
             <li><strong>Shutter:</strong> {metadata.shutter || 'N/A'}</li>
          </ul>
        </div>
      )}
    </div>
  );
};

export default RawUploader;
