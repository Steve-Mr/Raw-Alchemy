import React, { useState, useEffect, useRef } from 'react';
import GLCanvas from './GLCanvas';
import { calculateCamToProPhoto, getProPhotoToTargetMatrix, formatMatrixForUniform, LOG_SPACE_CONFIG } from '../utils/colorMath';
import { parseCubeLUT } from '../utils/lutParser';

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
  const [proPhotoToTargetMat, setProPhotoToTargetMat] = useState(null);
  const [targetLogSpace, setTargetLogSpace] = useState('Arri LogC3');

  // LUT State
  const [lutData, setLutData] = useState(null); // Float32Array
  const [lutSize, setLutSize] = useState(0);
  const [lutName, setLutName] = useState(null);
  const [lutEnabled, setLutEnabled] = useState(false);

  const [exporting, setExporting] = useState(false);
  const glCanvasRef = useRef(null);
  const workerRef = useRef(null);
  const exportWorkerRef = useRef(null);
  const [selectedFile, setSelectedFile] = useState(null);

  // Terminate workers on component unmount
  useEffect(() => {
    return () => {
      workerRef.current?.terminate();
      exportWorkerRef.current?.terminate();
    };
  }, []);

  // Update matrices when metadata or target log space changes
  useEffect(() => {
      if (metadata) {
          // 1. Initialize WB Sliders from Metadata (As Shot)
          // Only if sliders haven't been moved manually?
          // For now, let's keep it reactive to metadata load only (not resetting on every render)
          // We can't distinguish "initial load" easily without more state, but this effect runs on metadata change.
          // We should be careful not to overwrite user changes if metadata doesn't change.
          // Ideally, we set WB only when metadata *first* arrives.
      }
  }, [metadata]);

  // Separate effect for WB initialization to avoid overwriting user edits on other updates
  useEffect(() => {
    if (metadata && metadata.cam_mul) {
         setWbRed(metadata.cam_mul[0]);
         setWbBlue(metadata.cam_mul[2]);
         setWbGreen(metadata.cam_mul[1]);
    }
  }, [metadata]); // Runs only when metadata object reference changes (new file loaded)

  // Effect to recalculate matrices whenever metadata OR targetLogSpace changes
  useEffect(() => {
      if (metadata) {
          // 1. Calculate Cam -> ProPhoto
          const rawMatrix = metadata.rgb_cam || metadata.cam_xyz;
          const c2p = calculateCamToProPhoto(rawMatrix);
          setCamToProPhotoMat(formatMatrixForUniform(c2p));

          // 2. Calculate ProPhoto -> Target Log Gamut
          const p2t = getProPhotoToTargetMatrix(targetLogSpace);
          setProPhotoToTargetMat(formatMatrixForUniform(p2t));
      }
  }, [metadata, targetLogSpace]);


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

  const handleLutLoad = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (ev) => {
        try {
            const content = ev.target.result;
            const { title, size, data } = parseCubeLUT(content);
            setLutData(data);
            setLutSize(size);
            setLutName(title || file.name);
            setLutEnabled(true);
            setError(null);
        } catch (err) {
            console.error("LUT Parsing Error:", err);
            setError("Failed to load LUT: " + err.message);
        }
    };
    reader.readAsText(file);
  };

  const clearLut = () => {
      setLutData(null);
      setLutSize(0);
      setLutName(null);
      setLutEnabled(false);
  };

  const handleExport = () => {
      if (!imageState || !glCanvasRef.current) return;

      setExporting(true);

      // Allow UI to update (show spinner) before freezing main thread for readPixels
      setTimeout(async () => {
          try {
              // 1. Capture High Res Float Data from WebGL
              const result = glCanvasRef.current.captureHighRes();
              if (!result) {
                  throw new Error("Failed to capture WebGL data");
              }

              const { width, height, data } = result;

              // 2. Initialize Export Worker
              if (exportWorkerRef.current) {
                  exportWorkerRef.current.terminate();
              }
              exportWorkerRef.current = new Worker(new URL('../workers/export.worker.js', import.meta.url), { type: 'module' });

              exportWorkerRef.current.onmessage = (e) => {
                  const { type, buffer, message } = e.data;
                  if (type === 'success') {
                      // 3. Trigger Download
                      const blob = new Blob([buffer], { type: 'image/tiff' });
                      const url = URL.createObjectURL(blob);
                      const a = document.createElement('a');
                      a.href = url;
                      // Construct filename: OriginalName_LogSpace.tiff
                      const originalName = selectedFile ? selectedFile.name.split('.').slice(0, -1).join('.') : 'output';
                      const cleanLogName = targetLogSpace.replace(/\s+/g, '-');
                      a.download = `${originalName}_${cleanLogName}.tiff`;
                      document.body.appendChild(a);
                      a.click();
                      document.body.removeChild(a);
                      URL.revokeObjectURL(url);

                      setExporting(false);
                  } else {
                      setError("Export failed: " + message);
                      setExporting(false);
                  }
              };

              exportWorkerRef.current.onerror = (err) => {
                  console.error("Export Worker Error:", err);
                  setError("Export Worker crashed.");
                  setExporting(false);
              };

              // 3. Send to Worker (Transferable)
              // We pass the raw RGBA Float32Array directly to the worker to avoid main thread freeze.
              // We rely on Transferable objects for zero-copy.

              exportWorkerRef.current.postMessage({
                  width,
                  height,
                  data: data, // RGBA Float32Array
                  channels: 4,
                  logSpace: targetLogSpace // Pass the log space name to the worker
              }, [data.buffer]);

          } catch (err) {
              console.error(err);
              setError("Export Error: " + err.message);
              setExporting(false);
          }
      }, 100);
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

                  {/* Target Space Controls */}
                  <div>
                      <h4 className="text-sm font-semibold text-gray-600 mb-2">Target Log Space</h4>
                      <div className="mb-4">
                          <label className="block text-xs text-gray-500 mb-1">Select Output Format:</label>
                          <select
                              className="block w-full p-2 text-sm border border-gray-300 rounded focus:ring-blue-500 focus:border-blue-500"
                              value={targetLogSpace}
                              onChange={(e) => setTargetLogSpace(e.target.value)}
                          >
                              {Object.keys(LOG_SPACE_CONFIG).map((spaceName) => (
                                  <option key={spaceName} value={spaceName}>
                                      {spaceName}
                                  </option>
                              ))}
                          </select>
                      </div>

                       {/* LUT Integration */}
                       <div className="mb-4 pt-4 border-t border-gray-300">
                          <h4 className="text-sm font-semibold text-gray-600 mb-2">3D LUT Application</h4>
                          <div className="space-y-2">
                              {!lutData ? (
                                  <label className="block text-xs text-gray-500">
                                      Load .cube File:
                                      <input
                                          type="file"
                                          accept=".cube"
                                          onChange={handleLutLoad}
                                          className="block w-full mt-1 text-xs"
                                      />
                                  </label>
                              ) : (
                                  <div className="bg-blue-50 p-2 rounded border border-blue-200">
                                      <div className="flex justify-between items-center mb-1">
                                          <span className="text-xs font-bold text-blue-800 truncate" title={lutName}>{lutName}</span>
                                          <button onClick={clearLut} className="text-xs text-red-500 hover:text-red-700 font-bold ml-2">X</button>
                                      </div>
                                      <label className="flex items-center space-x-2 cursor-pointer">
                                          <input
                                              type="checkbox"
                                              checked={!lutEnabled}
                                              onChange={() => setLutEnabled(!lutEnabled)}
                                              className="rounded text-blue-600 focus:ring-blue-500 h-4 w-4"
                                          />
                                          <span className="text-xs text-gray-700 font-medium">Bypass LUT</span>
                                      </label>
                                  </div>
                              )}
                          </div>
                       </div>

                      {/* Export Button */}
                      <button
                          onClick={handleExport}
                          disabled={exporting}
                          className={`w-full py-2 px-4 rounded font-bold text-white transition-colors
                              ${exporting ? 'bg-gray-400 cursor-not-allowed' : 'bg-green-600 hover:bg-green-700 shadow-md'}
                          `}
                      >
                          {exporting ? 'Encoding TIFF...' : 'Export 16-bit TIFF'}
                      </button>

                      {/* Metadata Debug */}
                      <div className="text-xs font-mono text-gray-500 overflow-auto h-20 bg-gray-100 p-2 rounded mt-4">
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

      {/* Exporting Overlay Spinner */}
      {exporting && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white p-6 rounded shadow-xl flex flex-col items-center">
                 <svg className="animate-spin h-8 w-8 text-green-600 mb-2" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                <span className="text-gray-800 font-semibold">Reading GPU Data & Encoding...</span>
                <span className="text-xs text-gray-500 mt-1">This may take a moment.</span>
            </div>
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
                    ref={glCanvasRef}
                    width={imageState.width}
                    height={imageState.height}
                    data={imageState.data}
                    channels={imageState.channels}
                    bitDepth={imageState.bitDepth}
                    wbMultipliers={[wbRed, wbGreen, wbBlue]}
                    camToProPhotoMatrix={camToProPhotoMat}
                    proPhotoToTargetMatrix={proPhotoToTargetMat}
                    logCurveType={LOG_SPACE_CONFIG[targetLogSpace] ? LOG_SPACE_CONFIG[targetLogSpace].id : 0}
                    lutData={lutData}
                    lutSize={lutSize}
                    lutEnabled={lutEnabled}
                />
            </div>
            <p className="text-xs text-gray-500 text-center">
                * Displaying: {targetLogSpace} | Pipeline: RAW &rarr; WB &rarr; Cam2ProPhoto &rarr; ProPhoto2Target &rarr; {targetLogSpace} Curve {lutEnabled ? '→ 3D LUT' : ''}
            </p>
        </div>
      )}
    </div>
  );
};

export default RawUploader;
