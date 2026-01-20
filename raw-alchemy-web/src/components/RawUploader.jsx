import React, { useState, useEffect, useRef } from 'react';
import GLCanvas from './GLCanvas';
import { calculateCamToProPhoto, getProPhotoToAlexaMatrix, formatMatrixForUniform } from '../utils/colorMath';

const RawUploader = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [imageState, setImageState] = useState(null); // { data, width, height, channels, bitDepth, mode }
  const [mode, setMode] = useState('rgb'); // 'rgb' or 'bayer'
  const [metadata, setMetadata] = useState(null);

  // Pipeline State
  const [wbRed, setWbRed] = useState(1.0);
  const [wbBlue, setWbBlue] = useState(1.0);
  const [wbGreen, setWbGreen] = useState(1.0); // Usually kept at 1.0 or derived

  const [camToProPhotoMat, setCamToProPhotoMat] = useState(null);
  const [proPhotoToAlexaMat, setProPhotoToAlexaMat] = useState(null);

  const workerRef = useRef(null);
  const [selectedFile, setSelectedFile] = useState(null);

  // Terminate worker on component unmount
  useEffect(() => {
    return () => {
      workerRef.current?.terminate();
    };
  }, []);

  // Update matrices when metadata changes
  useEffect(() => {
      if (metadata) {
          // 1. Initialize WB Sliders from Metadata (As Shot)
          if (metadata.cam_mul) {
              // cam_mul is typically [R, G, B, G] or similar.
              // We want to normalize G to 1.0 ideally, or just use as is.
              // Let's use as is for "As Shot".
              // Note: LibRaw cam_mul often has Green around 1.0.
              setWbRed(metadata.cam_mul[0]);
              setWbBlue(metadata.cam_mul[2]);
              setWbGreen(metadata.cam_mul[1]);
          }

          // 2. Calculate Matrices
          // Extract cam_xyz or rgb_cam
          // Priority: rgb_cam (if available) -> cam_xyz
          const rawMatrix = metadata.rgb_cam || metadata.cam_xyz;

          const c2p = calculateCamToProPhoto(rawMatrix);
          setCamToProPhotoMat(formatMatrixForUniform(c2p));

          const p2a = getProPhotoToAlexaMatrix();
          setProPhotoToAlexaMat(formatMatrixForUniform(p2a));
      }
  }, [metadata]);

  const handleProcess = async (fileToProcess, selectedMode) => {
    if (!fileToProcess) return;

    setLoading(true);
    setError(null);
    setImageState(null);
    setMetadata(null); // Reset metadata

    if (workerRef.current) {
        workerRef.current.terminate();
        workerRef.current = null;
    }

    workerRef.current = new Worker(new URL('../workers/raw.worker.js', import.meta.url), { type: 'module' });

    workerRef.current.onmessage = (e) => {
      const { type, data, width, height, channels, bitDepth, error: workerError, mode: resultMode, meta } = e.data;

      if (type === 'success') {
        setMetadata(meta); // Save metadata for pipeline
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

    try {
      const buffer = await fileToProcess.arrayBuffer();

      workerRef.current.postMessage({
        command: 'decode',
        fileBuffer: buffer,
        mode: selectedMode,
        id: Date.now()
      }, [buffer]);

    } catch (err) {
      setError("Failed to read file: " + err.message);
      setLoading(false);
    }
  };

  const handleFileSelect = (e) => {
    if (e.target.files[0]) {
      setSelectedFile(e.target.files[0]);
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

      {/* --- COLOR PIPELINE CONTROLS --- */}
      {imageState && mode === 'rgb' && (
          <div className="mb-6 p-4 bg-gray-50 rounded border border-gray-200">
              <h3 className="text-md font-bold text-gray-700 mb-3">Color Pipeline Controls</h3>

              <div className="grid grid-cols-2 gap-6">
                  {/* WB Controls */}
                  <div>
                      <h4 className="text-sm font-semibold text-gray-600 mb-2">White Balance (Multipliers)</h4>
                      <div className="space-y-2">
                          <div>
                              <label className="block text-xs text-gray-500">Red Gain: {wbRed.toFixed(3)}</label>
                              <input
                                  type="range" min="0.1" max="5.0" step="0.01"
                                  value={wbRed}
                                  onChange={(e) => setWbRed(parseFloat(e.target.value))}
                                  className="w-full"
                              />
                          </div>
                          <div>
                              <label className="block text-xs text-gray-500">Green Gain: {wbGreen.toFixed(3)} (Ref)</label>
                              <input
                                  type="range" min="0.1" max="5.0" step="0.01"
                                  value={wbGreen}
                                  onChange={(e) => setWbGreen(parseFloat(e.target.value))}
                                  className="w-full"
                              />
                          </div>
                          <div>
                              <label className="block text-xs text-gray-500">Blue Gain: {wbBlue.toFixed(3)}</label>
                              <input
                                  type="range" min="0.1" max="5.0" step="0.01"
                                  value={wbBlue}
                                  onChange={(e) => setWbBlue(parseFloat(e.target.value))}
                                  className="w-full"
                              />
                          </div>
                      </div>
                  </div>

                  {/* Metadata Debug */}
                  <div className="text-xs font-mono text-gray-500 overflow-auto h-32 bg-gray-100 p-2 rounded">
                      <strong>Metadata Extraction:</strong>
                      <pre>{metadata ? JSON.stringify({
                          cam_mul: metadata.cam_mul,
                          rgb_cam: metadata.rgb_cam ? 'Found (Length: ' + metadata.rgb_cam.length + ')' : 'Not Found',
                          cam_xyz: metadata.cam_xyz ? 'Found' : 'Not Found',
                          black: metadata.black,
                          white: metadata.maximum
                      }, null, 2) : 'No Metadata'}</pre>
                  </div>
              </div>
          </div>
      )}

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
                    wbMultipliers={[wbRed, wbGreen, wbBlue]}
                    camToProPhotoMatrix={camToProPhotoMat}
                    proPhotoToAlexaMatrix={proPhotoToAlexaMat}
                />
            </div>
            <p className="text-xs text-gray-500 text-center">
                * Displaying: Arri LogC3 (Flat Look) | Pipeline: RAW &rarr; WB &rarr; Cam2ProPhoto &rarr; ProPhoto2Alexa &rarr; LogC3
            </p>
        </div>
      )}
    </div>
  );
};

export default RawUploader;
