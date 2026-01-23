import React, { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import GLCanvas from './GLCanvas';
import { getProPhotoToTargetMatrix, formatMatrixForUniform, LOG_SPACE_CONFIG } from '../utils/colorMath';
import { calculateAutoExposure } from '../utils/metering';
import { parseCubeLUT } from '../utils/lutParser';

// Layout & Controls
import ResponsiveLayout from './layout/ResponsiveLayout';
import BasicControls from './controls/BasicControls';
import ToneControls from './controls/ToneControls';
import ColorControls from './controls/ColorControls';
import ExportControls from './controls/ExportControls';
import AdvancedControls from './controls/AdvancedControls';
import { UploadCloud, XCircle, RefreshCw } from 'lucide-react';

const RawUploader = () => {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [imageState, setImageState] = useState(null);
  const [metadata, setMetadata] = useState(null);

  // LUT State
  const [lutData, setLutData] = useState(null);
  const [lutSize, setLutSize] = useState(null);
  const [lutName, setLutName] = useState(null);

  // Pipeline State
  const [wbRed, setWbRed] = useState(1.0);
  const [wbBlue, setWbBlue] = useState(1.0);
  const [wbGreen, setWbGreen] = useState(1.0);

  // Basic Adjustments State
  const [exposure, setExposure] = useState(0.0);
  const [saturation, setSaturation] = useState(1.25);
  const [contrast, setContrast] = useState(1.1);

  // Advanced Tone Mapping
  const [highlights, setHighlights] = useState(0.0);
  const [shadows, setShadows] = useState(0.0);
  const [whites, setWhites] = useState(0.0);
  const [blacks, setBlacks] = useState(0.0);

  const [meteringMode, setMeteringMode] = useState('hybrid');
  const [inputGamma, setInputGamma] = useState(1.0);

  const [camToProPhotoMat, setCamToProPhotoMat] = useState(null);
  const [proPhotoToTargetMat, setProPhotoToTargetMat] = useState(null);
  const [targetLogSpace, setTargetLogSpace] = useState('Arri LogC3');
  const [exportFormat, setExportFormat] = useState('tiff');

  const [exporting, setExporting] = useState(false);
  const glCanvasRef = useRef(null);
  const workerRef = useRef(null);
  const exportWorkerRef = useRef(null);
  const [selectedFile, setSelectedFile] = useState(null);
  const [imgStats, setImgStats] = useState(null);

  // Ref for the hidden file input to trigger it programmatically
  const fileInputRef = useRef(null);

  useEffect(() => {
    return () => {
      workerRef.current?.terminate();
      exportWorkerRef.current?.terminate();
    };
  }, []);

  useEffect(() => {
      if (metadata) {
          const c2p = [1,0,0, 0,1,0, 0,0,1];
          setCamToProPhotoMat(formatMatrixForUniform(c2p));
          const p2t = getProPhotoToTargetMatrix(targetLogSpace);
          setProPhotoToTargetMat(formatMatrixForUniform(p2t));
      }
  }, [metadata, targetLogSpace]);

  useEffect(() => {
      if (imageState && imageState.mode === 'rgb' && imageState.data) {
          const ev = calculateAutoExposure(
              imageState.data,
              imageState.width,
              imageState.height,
              meteringMode,
              imageState.bitDepth
          );
          setExposure(ev);
      }
  }, [imageState, meteringMode]);

  const handleProcess = async (fileToProcess) => {
    if (!fileToProcess) return;

    setLoading(true);
    setError(null);
    setImageState(null);
    setMetadata(null);

    if (workerRef.current) {
        workerRef.current.terminate();
        workerRef.current = null;
    }

    workerRef.current = new Worker(new URL('../workers/raw.worker.js', import.meta.url), { type: 'module' });

    workerRef.current.onmessage = (e) => {
      const { type, data, width, height, channels, bitDepth, error: workerError, mode: resultMode, meta } = e.data;

      if (type === 'success') {
        setMetadata(meta);
        setWbRed(1.0);
        setWbGreen(1.0);
        setWbBlue(1.0);
        setHighlights(0.0);
        setShadows(0.0);
        setWhites(0.0);
        setBlacks(0.0);

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
        mode: 'rgb',
        id: Date.now()
      }, [buffer]);

    } catch (err) {
      setError("Failed to read file: " + err.message);
      setLoading(false);
    }
  };

  const handleExport = () => {
      if (!imageState || !glCanvasRef.current) return;
      setExporting(true);
      setTimeout(async () => {
          try {
              const result = glCanvasRef.current.captureHighRes();
              if (!result) throw new Error("Failed to capture WebGL data");

              const { width, height, data } = result;

              if (exportWorkerRef.current) {
                  exportWorkerRef.current.terminate();
              }
              exportWorkerRef.current = new Worker(new URL('../workers/export.worker.js', import.meta.url), { type: 'module' });

              exportWorkerRef.current.onmessage = (e) => {
                  const { type, buffer, message } = e.data;
                  if (type === 'success') {
                      const mimeType = exportFormat === 'tiff' ? 'image/tiff' : `image/${exportFormat}`;
                      const blob = new Blob([buffer], { type: mimeType });
                      const url = URL.createObjectURL(blob);
                      const a = document.createElement('a');
                      a.href = url;
                      const originalName = selectedFile ? selectedFile.name.split('.').slice(0, -1).join('.') : 'output';
                      const cleanLogName = targetLogSpace.replace(/\s+/g, '-');
                      const ext = exportFormat === 'tiff' ? 'tiff' : exportFormat === 'jpeg' ? 'jpg' : exportFormat;
                      a.download = `${originalName}_${cleanLogName}.${ext}`;
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

              exportWorkerRef.current.postMessage({
                  width,
                  height,
                  data: data,
                  channels: 4,
                  logSpace: targetLogSpace,
                  format: exportFormat,
                  quality: 0.95
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
      handleProcess(e.target.files[0]);
    }
  };

  const handleRemoveImage = () => {
      setImageState(null);
      setSelectedFile(null);
      setMetadata(null);
      // Reset critical pipeline state
      setLutData(null);
      setLutName(null);
      // Reset file input value so same file can be selected again
      if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleTriggerUpload = () => {
      if (fileInputRef.current) {
          fileInputRef.current.click();
      }
  };

  const handleLutSelect = (e) => {
      const file = e.target.files[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = (event) => {
          try {
              const text = event.target.result;
              const { size, data, title } = parseCubeLUT(text);
              setLutData(data);
              setLutSize(size);
              setLutName(title === 'Untitled LUT' ? file.name : title);
          } catch (err) {
              console.error("LUT Parse Error:", err);
              setError("Failed to load LUT: " + err.message);
          }
      };
      reader.readAsText(file);
      e.target.value = '';
  };

  const handleRemoveLut = () => {
      setLutData(null);
      setLutSize(null);
      setLutName(null);
  };

  const handleAnalyze = () => {
      if (glCanvasRef.current) {
          const stats = glCanvasRef.current.getStatistics();
          setImgStats(stats);
      }
  };

  // Reset Functions
  const resetBasic = () => {
      setWbRed(1.0);
      setWbGreen(1.0);
      setWbBlue(1.0);
      setExposure(0.0);
      setContrast(1.1);
      setSaturation(1.25);
      setMeteringMode('hybrid');
  };

  const resetTone = () => {
      setHighlights(0.0);
      setShadows(0.0);
      setWhites(0.0);
      setBlacks(0.0);
  };

  const resetAdvanced = () => {
      setInputGamma(1.0);
      setImgStats(null);
  };

  // Styled File Input Component
  const FileInput = (
    <div className="flex flex-col items-center w-full">
        <label
            onClick={handleTriggerUpload}
            className="flex flex-col items-center justify-center w-full h-40 px-4 transition-all bg-white dark:bg-gray-900 border-2 border-dashed border-gray-300 dark:border-gray-700 rounded-3xl cursor-pointer hover:border-primary-light dark:hover:border-primary-dark hover:bg-gray-50 dark:hover:bg-gray-800/80 group"
        >
            <div className="flex flex-col items-center space-y-4">
                <div className="p-4 rounded-full bg-gray-100 dark:bg-gray-800 group-hover:scale-110 transition-transform">
                    <UploadCloud className="w-8 h-8 text-gray-400 dark:text-gray-500" />
                </div>
                <div className="text-center">
                    <span className="font-semibold text-gray-700 dark:text-gray-200 block mb-1">
                        {t('uploadPrompt')}
                    </span>
                    <span className="text-xs text-gray-400 dark:text-gray-500">
                        RAW (.ARW, .CR2, .DNG...)
                    </span>
                </div>
            </div>
        </label>
    </div>
  );

  return (
    <>
    {/* Hidden Input - Always rendered to preserve ref */}
    <input
        ref={fileInputRef}
        type="file"
        name="file_upload"
        className="hidden"
        accept=".ARW,.CR2,.CR3,.DNG,.NEF,.ORF,.RAF"
        onChange={handleFileSelect}
    />
    <ResponsiveLayout
        fileInput={FileInput}
        loading={loading}
        error={error}
        exporting={exporting}
        controls={{
            basic: <BasicControls
                wbRed={wbRed} setWbRed={setWbRed}
                wbGreen={wbGreen} setWbGreen={setWbGreen}
                wbBlue={wbBlue} setWbBlue={setWbBlue}
                exposure={exposure} setExposure={setExposure}
                contrast={contrast} setContrast={setContrast}
                saturation={saturation} setSaturation={setSaturation}
                meteringMode={meteringMode} setMeteringMode={setMeteringMode}
                onReset={resetBasic}
            />,
            tone: <ToneControls
                highlights={highlights} setHighlights={setHighlights}
                shadows={shadows} setShadows={setShadows}
                whites={whites} setWhites={setWhites}
                blacks={blacks} setBlacks={setBlacks}
                onReset={resetTone}
            />,
            color: <ColorControls
                targetLogSpace={targetLogSpace} setTargetLogSpace={setTargetLogSpace}
                lutName={lutName} onLutSelect={handleLutSelect} onRemoveLut={handleRemoveLut}
            />,
            export: <ExportControls
                exportFormat={exportFormat} setExportFormat={setExportFormat}
                handleExport={handleExport} exporting={exporting}
            />,
            advanced: <AdvancedControls
                inputGamma={inputGamma} setInputGamma={setInputGamma}
                handleAnalyze={handleAnalyze} imgStats={imgStats}
                onReset={resetAdvanced}
            />
        }}
    >
        {imageState && (
            <div className="relative w-full h-full flex items-center justify-center">
                {/* Floating Action Buttons Overlay - Moved to bottom right to avoid header overlap */}
                <div className="absolute bottom-6 right-6 z-50 flex gap-3">
                    <button
                        onClick={handleTriggerUpload}
                        className="p-3 bg-white/10 hover:bg-white/20 text-white rounded-full backdrop-blur-md transition-all shadow-2xl border border-white/10 hover:scale-105 active:scale-95"
                        title={t('actions.replace')}
                    >
                        <RefreshCw size={20} />
                    </button>
                    <button
                        onClick={handleRemoveImage}
                        className="p-3 bg-red-500/80 hover:bg-red-600 text-white rounded-full backdrop-blur-md transition-all shadow-2xl border border-white/10 hover:scale-105 active:scale-95"
                        title={t('actions.remove')}
                    >
                        <XCircle size={20} />
                    </button>
                </div>

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
                    exposure={exposure}
                    saturation={saturation}
                    contrast={contrast}
                    highlights={highlights}
                    shadows={shadows}
                    whites={whites}
                    blacks={blacks}
                    inputGamma={inputGamma}
                    lutData={lutData}
                    lutSize={lutSize}
                />
            </div>
        )}
    </ResponsiveLayout>
    </>
  );
};

export default RawUploader;
