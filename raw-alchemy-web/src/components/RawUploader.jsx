import React, { useState, useEffect, useRef } from 'react';
import GLCanvas from './GLCanvas';

const RawUploader = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [imageState, setImageState] = useState(null); // { data, width, height, channels, bitDepth, mode }
  const [mode, setMode] = useState('rgb'); // 'rgb' or 'bayer'

  const workerRef = useRef(null);
  const [selectedFile, setSelectedFile] = useState(null);

  // Terminate worker on component unmount
  useEffect(() => {
    return () => {
      workerRef.current?.terminate();
    };
  }, []);

  const handleProcess = async (fileToProcess, selectedMode) => {
    if (!fileToProcess) return;

    setLoading(true);
    setError(null);
    setImageState(null); // Clear previous image state to unmount GLCanvas

    // 1. Terminate old worker (Reset Engine)
    if (workerRef.current) {
        workerRef.current.terminate();
        workerRef.current = null;
    }

    // 2. Create new worker
    // Using a fresh worker for every file guarantees a clean WASM memory state.
    // This fixes issues with corrupted output on subsequent loads.
    workerRef.current = new Worker(new URL('../workers/raw.worker.js', import.meta.url), { type: 'module' });

    workerRef.current.onmessage = (e) => {
      const { type, data, width, height, channels, bitDepth, error: workerError, mode: resultMode } = e.data;

      if (type === 'success') {
        setImageState({
          data,
          width,
          height,
          channels,
          bitDepth,
          mode: resultMode
        });
        setLoading(false);
      } else if (type === 'error') {
        setError(workerError);
        setLoading(false);
      }
    };

    workerRef.current.onerror = (err) => {
        console.error("Worker Crash:", err);
        setError("Worker failed (Check console). The operation might have crashed.");
        setLoading(false);
    };

    // 3. Process File
    try {
      const buffer = await fileToProcess.arrayBuffer();

      workerRef.current.postMessage({
        command: 'decode',
        fileBuffer: buffer,
        mode: selectedMode,
        id: Date.now()
      }, [buffer]); // Transfer the buffer to worker

    } catch (err) {
      setError("Failed to read file: " + err.message);
      setLoading(false);
    }
  };

  const handleFileSelect = (e) => {
    if (e.target.files[0]) {
      setSelectedFile(e.target.files[0]);
      // Auto-process on select with current mode
      handleProcess(e.target.files[0], mode);
    }
  };

  const handleModeToggle = (newMode) => {
    if (newMode === mode) return;
    setMode(newMode);
    if (selectedFile) {
      handleProcess(selectedFile, newMode);
    }
  };

  return (
    <div className="p-4 border rounded shadow bg-white max-w-4xl mx-auto mt-4">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-bold">RAW Processing Engine</h2>
        <div className="flex space-x-2">
            <button
                onClick={() => handleModeToggle('rgb')}
                className={`px-3 py-1 rounded text-sm font-semibold ${mode === 'rgb' ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-700'}`}
            >
                Linear RGB (16-bit)
            </button>
            <button
                onClick={() => handleModeToggle('bayer')}
                className={`px-3 py-1 rounded text-sm font-semibold ${mode === 'bayer' ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-700'}`}
            >
                Raw Bayer (Unpacked)
            </button>
        </div>
      </div>

      <input
        type="file"
        accept=".ARW,.CR2,.CR3,.DNG,.NEF,.ORF,.RAF"
        onChange={handleFileSelect}
        className="block w-full text-sm text-gray-500
          file:mr-4 file:py-2 file:px-4
          file:rounded-full file:border-0
          file:text-sm file:font-semibold
          file:bg-blue-50 file:text-blue-700
          hover:file:bg-blue-100
          mb-4
        "
      />

      {loading && (
        <div className="flex items-center space-x-2 text-blue-600 mb-4">
            <svg className="animate-spin h-5 w-5 text-blue-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            <span>Decoding RAW data in Web Worker...</span>
        </div>
      )}

      {error && <div className="p-3 bg-red-100 text-red-700 rounded mb-4">Error: {error}</div>}

      {imageState && (
        <div className="space-y-4">
            <div className="bg-gray-100 p-2 rounded text-xs font-mono flex flex-wrap gap-4">
                <span><strong>Dimensions:</strong> {imageState.width} x {imageState.height}</span>
                <span><strong>Channels:</strong> {imageState.channels}</span>
                <span><strong>Bit Depth:</strong> {imageState.bitDepth}-bit</span>
                <span><strong>Mode:</strong> {imageState.mode}</span>
                <span><strong>Buffer Size:</strong> {(imageState.data.byteLength / 1024 / 1024).toFixed(2)} MB</span>
            </div>

            <div className="border border-black bg-gray-900 flex justify-center overflow-auto" style={{ maxHeight: '70vh' }}>
                <GLCanvas
                    width={imageState.width}
                    height={imageState.height}
                    data={imageState.data}
                    channels={imageState.channels}
                    bitDepth={imageState.bitDepth}
                />
            </div>
            <p className="text-xs text-gray-500 text-center">
                * Image is displayed in Linear space (Gamma 1.0). It will appear dark. This is expected.
            </p>
        </div>
      )}
    </div>
  );
};

export default RawUploader;
