import React, { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { openDB } from 'idb';
import GLCanvas from './GLCanvas';
import { getProPhotoToTargetMatrix, formatMatrixForUniform, LOG_SPACE_CONFIG } from '../utils/colorMath';
import { calculateAutoExposure } from '../utils/metering';
import { useLutLibrary } from '../hooks/useLutLibrary';
import { usePersistence } from '../hooks/usePersistence';

// Layout & Controls
import ResponsiveLayout from './layout/ResponsiveLayout';
import BasicControls from './controls/BasicControls';
import ToneControls from './controls/ToneControls';
import ColorControls from './controls/ColorControls';
import ExportControls from './controls/ExportControls';
import AdvancedControls from './controls/AdvancedControls';
import { UploadCloud, XCircle, RefreshCw, History } from 'lucide-react';

const RawUploader = () => {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [imageState, setImageState] = useState(null);
  const [metadata, setMetadata] = useState(null);

  // LUT State
  const { luts, importLuts, deleteLut } = useLutLibrary();
  const { saveFile, saveAdjustments, loadSession, clearSession } = usePersistence();
  const [lutData, setLutData] = useState(null);
  const [lutSize, setLutSize] = useState(null);
  const [lutName, setLutName] = useState(null);

  // Pipeline State
  const [wbRed, setWbRed] = useState(1.0);
  const [wbBlue, setWbBlue] = useState(1.0);
  const [wbGreen, setWbGreen] = useState(1.0);

  // Basic Adjustments State
  const [exposure, setExposure] = useState(0.0);
  const [initialExposure, setInitialExposure] = useState(0.0);
  const [saturation, setSaturation] = useState(1.0);
  const [contrast, setContrast] = useState(1.0);
  const [isComparing, setIsComparing] = useState(false);

  // Advanced Tone Mapping
  const [highlights, setHighlights] = useState(0.0);
  const [shadows, setShadows] = useState(0.0);
  const [whites, setWhites] = useState(0.0);
  const [blacks, setBlacks] = useState(0.0);

  const [meteringMode, setMeteringMode] = useState('hybrid');
  const [inputGamma, setInputGamma] = useState(1.0);

  const [camToProPhotoMat, setCamToProPhotoMat] = useState(null);
  const [proPhotoToTargetMat, setProPhotoToTargetMat] = useState(null);
  const [targetLogSpace, setTargetLogSpace] = useState('None');
  const [exportFormat, setExportFormat] = useState('tiff');

  const [exporting, setExporting] = useState(false);
  const glCanvasRef = useRef(null);
  const workerRef = useRef(null);
  const exportWorkerRef = useRef(null);
  const [selectedFile, setSelectedFile] = useState(null);
  const [imgStats, setImgStats] = useState(null);

  const isRestoringRef = useRef(false);

  // Ref for the hidden file input to trigger it programmatically
  const fileInputRef = useRef(null);

  // Load Session on Mount
  useEffect(() => {
    const checkSession = async () => {
      // If shared target is present, skip session load (shared file takes precedence)
      const urlParams = new URLSearchParams(window.location.search);
      if (urlParams.get('shared_target') === 'true') return;

      const session = await loadSession();
      if (session) {
        setSelectedFile(session.file);
        handleProcess(session.file, session.adjustments);
      }
    };
    checkSession();
  }, []);

  // Save Adjustments on Change
  useEffect(() => {
    if (!imageState) return;

    const adjustments = {
      wbRed, wbGreen, wbBlue,
      exposure, contrast, saturation,
      highlights, shadows, whites, blacks,
      meteringMode, inputGamma,
      targetLogSpace,
      lutData, lutSize, lutName,
      exportFormat
    };
    saveAdjustments(adjustments);
  }, [
    wbRed, wbGreen, wbBlue,
    exposure, contrast, saturation,
    highlights, shadows, whites, blacks,
    meteringMode, inputGamma,
    targetLogSpace,
    lutData, lutSize, lutName,
    exportFormat,
    imageState,
    saveAdjustments
  ]);

  useEffect(() => {
    return () => {
      workerRef.current?.terminate();
      exportWorkerRef.current?.terminate();
    };
  }, []);

  useEffect(() => {
    // Check for shared target query param
    const checkSharedFile = async () => {
        const urlParams = new URLSearchParams(window.location.search);
        if (urlParams.get('shared_target') === 'true') {
            try {
                const db = await openDB('nitrate-grain-share', 1);
                const file = await db.get('shared-files', 'latest-share');

                if (file) {
                    // Check if file is valid
                    if (file instanceof Blob) {
                        setSelectedFile(file);
                        handleProcess(file);
                    }

                    // Clean up
                    await db.delete('shared-files', 'latest-share');
                }

                // Clean URL
                const newUrl = window.location.pathname;
                window.history.replaceState({}, document.title, newUrl);
            } catch (err) {
                console.error("Error retrieving shared file:", err);
            }
        }
    };

    checkSharedFile();
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

          if (isRestoringRef.current) {
             setInitialExposure(ev);
             isRestoringRef.current = false;
          } else {
             setExposure(ev);
             setInitialExposure(ev);
          }
      }
  }, [imageState, meteringMode]);

  const handleProcess = async (fileToProcess, restoredAdjustments = null) => {
    if (!fileToProcess) return;

    if (!restoredAdjustments) {
       saveFile(fileToProcess);
    }

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

        if (restoredAdjustments) {
            isRestoringRef.current = true;
            setWbRed(restoredAdjustments.wbRed);
            setWbGreen(restoredAdjustments.wbGreen);
            setWbBlue(restoredAdjustments.wbBlue);
            setHighlights(restoredAdjustments.highlights);
            setShadows(restoredAdjustments.shadows);
            setWhites(restoredAdjustments.whites);
            setBlacks(restoredAdjustments.blacks);
            setSaturation(restoredAdjustments.saturation);
            setContrast(restoredAdjustments.contrast);
            setExposure(restoredAdjustments.exposure);
            setMeteringMode(restoredAdjustments.meteringMode || 'hybrid');
            setInputGamma(restoredAdjustments.inputGamma || 1.0);
            setTargetLogSpace(restoredAdjustments.targetLogSpace || 'None');
            setExportFormat(restoredAdjustments.exportFormat || 'tiff');

            if (restoredAdjustments.lutData) {
                setLutData(restoredAdjustments.lutData);
                setLutSize(restoredAdjustments.lutSize);
                setLutName(restoredAdjustments.lutName);
            }
        } else {
            setWbRed(1.0);
            setWbGreen(1.0);
            setWbBlue(1.0);
            setHighlights(0.0);
            setShadows(0.0);
            setWhites(0.0);
            setBlacks(0.0);
            setSaturation(1.0);
            setContrast(1.0);
        }

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
        if (!restoredAdjustments) clearSession();
      }
    };

    workerRef.current.onerror = (err) => {
        console.error("Worker Crash:", err);
        setError("Worker failed (Check console). The operation might have crashed.");
        setLoading(false);
        if (!restoredAdjustments) clearSession();
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
      if (!restoredAdjustments) clearSession();
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
      clearSession();
      // Reset file input value so same file can be selected again
      if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleTriggerUpload = () => {
      if (fileInputRef.current) {
          fileInputRef.current.click();
      }
  };

  const handleApplyLut = (lut) => {
      if (!lut) return;
      setLutData(lut.data);
      setLutSize(lut.size);
      setLutName(lut.name);
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
  const resetWB = () => {
      setWbRed(1.0);
      setWbGreen(1.0);
      setWbBlue(1.0);
  };

  const resetExposureSettings = () => {
      setExposure(0.0);
      setMeteringMode('hybrid');
  };

  const resetEnhancements = () => {
      setContrast(1.0);
      setSaturation(1.0);
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
        id="raw-upload-input"
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
                onResetWB={resetWB}
                onResetExposure={resetExposureSettings}
                onResetEnhancements={resetEnhancements}
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
                lutName={lutName}
                onRemoveLut={handleRemoveLut}
                luts={luts}
                onImportLuts={importLuts}
                onDeleteLut={deleteLut}
                onApplyLut={handleApplyLut}
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
            <div
                className="relative w-full h-full flex items-center justify-center select-none"
                onPointerDown={() => setIsComparing(true)}
                onPointerUp={() => setIsComparing(false)}
                onPointerLeave={() => setIsComparing(false)}
                onTouchStart={() => setIsComparing(true)}
                onTouchEnd={() => setIsComparing(false)}
                onTouchCancel={() => setIsComparing(false)}
            >
                {/* Comparison Indicator */}
                {isComparing && (
                    <div className="absolute top-6 left-1/2 transform -translate-x-1/2 z-50 pointer-events-none">
                        <div className="flex items-center gap-2 px-4 py-2 bg-black/70 backdrop-blur-md rounded-full text-white shadow-xl border border-white/20">
                            <History size={16} className="text-primary-400" />
                            <span className="text-sm font-medium tracking-wide">{t('actions.original')}</span>
                        </div>
                    </div>
                )}

                {/* Floating Action Buttons Overlay - Moved to bottom right to avoid header overlap */}
                <div className="absolute bottom-6 right-6 z-50 flex gap-3 pointer-events-auto">
                    <button
                        onClick={handleTriggerUpload}
                        className="p-3 bg-white/80 dark:bg-black/50 hover:bg-white dark:hover:bg-black/70 text-gray-700 dark:text-white rounded-full backdrop-blur-md transition-all shadow-xl border border-gray-200 dark:border-white/10 hover:scale-105 active:scale-95"
                        title={t('actions.replace')}
                    >
                        <RefreshCw size={20} />
                    </button>
                    <button
                        onClick={handleRemoveImage}
                        className="p-3 bg-red-100 dark:bg-red-900/50 hover:bg-red-200 dark:hover:bg-red-900/70 text-red-600 dark:text-red-400 rounded-full backdrop-blur-md transition-all shadow-xl border border-red-200 dark:border-red-800/30 hover:scale-105 active:scale-95"
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
                    wbMultipliers={isComparing ? [1.0, 1.0, 1.0] : [wbRed, wbGreen, wbBlue]}
                    camToProPhotoMatrix={camToProPhotoMat}
                    proPhotoToTargetMatrix={isComparing ? formatMatrixForUniform(getProPhotoToTargetMatrix('None')) : proPhotoToTargetMat}
                    logCurveType={isComparing ? LOG_SPACE_CONFIG['None'].id : (LOG_SPACE_CONFIG[targetLogSpace] ? LOG_SPACE_CONFIG[targetLogSpace].id : 0)}
                    exposure={isComparing ? initialExposure : exposure}
                    saturation={isComparing ? 1.0 : saturation}
                    contrast={isComparing ? 1.0 : contrast}
                    highlights={isComparing ? 0.0 : highlights}
                    shadows={isComparing ? 0.0 : shadows}
                    whites={isComparing ? 0.0 : whites}
                    blacks={isComparing ? 0.0 : blacks}
                    inputGamma={isComparing ? 1.0 : inputGamma}
                    lutData={isComparing ? null : lutData}
                    lutSize={lutSize}
                />
            </div>
        )}
    </ResponsiveLayout>
    </>
  );
};

export default RawUploader;
