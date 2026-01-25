import React, { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { openDB } from 'idb';
import GLCanvas from './GLCanvas';
import { getProPhotoToTargetMatrix, formatMatrixForUniform, LOG_SPACE_CONFIG } from '../utils/colorMath';
import { calculateAutoExposure } from '../utils/metering';
import { parseCubeLUT } from '../utils/lutParser';
import { useGallery } from '../hooks/useGallery';
import { getImage } from '../utils/galleryStore';

// Layout & Controls
import ResponsiveLayout from './layout/ResponsiveLayout';
import GallerySidebar from './gallery/GallerySidebar';
import BasicControls from './controls/BasicControls';
import ToneControls from './controls/ToneControls';
import ColorControls from './controls/ColorControls';
import ExportControls from './controls/ExportControls';
import { History } from 'lucide-react';

const RawUploader = () => {
  const { t } = useTranslation();

  // Gallery Hook
  const {
    images,
    activeImageId,
    setActiveImageId,
    processUploads,
    removeImage,
    processingQueue,
    saveState,
    luts,
    importLut,
    removeLut
  } = useGallery();

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [imageState, setImageState] = useState(null);
  const [metadata, setMetadata] = useState(null);
  const [selectedFile, setSelectedFile] = useState(null);

  // LUT State (Loaded from global library)
  const [selectedLutId, setSelectedLutId] = useState('');
  const [lutData, setLutData] = useState(null);
  const [lutSize, setLutSize] = useState(null);

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

  // Tone Mapping
  const [highlights, setHighlights] = useState(0.0);
  const [shadows, setShadows] = useState(0.0);
  const [whites, setWhites] = useState(0.0);
  const [blacks, setBlacks] = useState(0.0);

  const [meteringMode, setMeteringMode] = useState('hybrid');
  const [inputGamma, setInputGamma] = useState(1.0);
  const [imgStats, setImgStats] = useState(null);

  const [camToProPhotoMat, setCamToProPhotoMat] = useState(null);
  const [proPhotoToTargetMat, setProPhotoToTargetMat] = useState(null);
  const [targetLogSpace, setTargetLogSpace] = useState('None');
  const [exportFormat, setExportFormat] = useState('tiff');

  const [exporting, setExporting] = useState(false);
  const glCanvasRef = useRef(null);
  const workerRef = useRef(null);
  const exportWorkerRef = useRef(null);

  // Cleanup Workers
  useEffect(() => {
    return () => {
      workerRef.current?.terminate();
      exportWorkerRef.current?.terminate();
    };
  }, []);

  // Shared File Handling (Legacy support, maybe refactor later to use gallery upload)
  useEffect(() => {
    const checkSharedFile = async () => {
        const urlParams = new URLSearchParams(window.location.search);
        if (urlParams.get('shared_target') === 'true') {
            try {
                const db = await openDB('nitrate-grain-share', 1);
                const file = await db.get('shared-files', 'latest-share');
                if (file && file instanceof Blob) {
                   // Import to gallery
                   processUploads([file]);
                   await db.delete('shared-files', 'latest-share');
                }
                const newUrl = window.location.pathname;
                window.history.replaceState({}, document.title, newUrl);
            } catch (err) {
                console.error("Error retrieving shared file:", err);
            }
        }
    };
    checkSharedFile();
  }, [processUploads]);

  // Load Active Image from Gallery
  useEffect(() => {
    const loadActiveImage = async () => {
      if (!activeImageId) {
        setImageState(null);
        setMetadata(null);
        setSelectedFile(null);
        setImgStats(null);
        return;
      }

      try {
        const record = await getImage(activeImageId);
        if (record) {
           setSelectedFile(record.file);

           if (record.editState) {
               applyEditState(record.editState);
           } else {
               resetAllSettings(); // New image defaults
               // Auto Exposure is calculated after decode
           }

           // Process (Decode)
           handleProcess(record.file, record.editState ? false : true);
        }
      } catch (e) {
         setError("Failed to load image: " + e.message);
      }
    };
    loadActiveImage();
  }, [activeImageId]);

  // Persist State Debounced
  useEffect(() => {
      if (!activeImageId) return;
      const timer = setTimeout(() => {
          saveState(activeImageId, {
              wbRed, wbGreen, wbBlue,
              exposure, contrast, saturation,
              highlights, shadows, whites, blacks,
              targetLogSpace, inputGamma,
              selectedLutId
          });
      }, 500);
      return () => clearTimeout(timer);
  }, [
      wbRed, wbGreen, wbBlue, exposure, contrast, saturation,
      highlights, shadows, whites, blacks,
      targetLogSpace, inputGamma, selectedLutId,
      activeImageId, saveState
  ]);

  // Update LUT Data when Selection Changes
  useEffect(() => {
      if (!selectedLutId) {
          setLutData(null);
          setLutSize(null);
          return;
      }
      const lut = luts.find(l => l.id === selectedLutId);
      if (lut) {
          setLutData(lut.data);
          setLutSize(lut.size);
      }
  }, [selectedLutId, luts]);

  const applyEditState = (state) => {
      if (state.wbRed !== undefined) setWbRed(state.wbRed);
      if (state.wbGreen !== undefined) setWbGreen(state.wbGreen);
      if (state.wbBlue !== undefined) setWbBlue(state.wbBlue);
      if (state.exposure !== undefined) setExposure(state.exposure);
      if (state.contrast !== undefined) setContrast(state.contrast);
      if (state.saturation !== undefined) setSaturation(state.saturation);
      if (state.highlights !== undefined) setHighlights(state.highlights);
      if (state.shadows !== undefined) setShadows(state.shadows);
      if (state.whites !== undefined) setWhites(state.whites);
      if (state.blacks !== undefined) setBlacks(state.blacks);
      if (state.targetLogSpace !== undefined) setTargetLogSpace(state.targetLogSpace);
      if (state.inputGamma !== undefined) setInputGamma(state.inputGamma);
      if (state.selectedLutId !== undefined) setSelectedLutId(state.selectedLutId);
  };

  const resetAllSettings = () => {
        setWbRed(1.0);
        setWbGreen(1.0);
        setWbBlue(1.0);
        setHighlights(0.0);
        setShadows(0.0);
        setWhites(0.0);
        setBlacks(0.0);
        setSaturation(1.0);
        setContrast(1.0);
        setExposure(0.0);
        setInputGamma(1.0);
        setTargetLogSpace('None');
        setSelectedLutId('');
        setImgStats(null);
  };

  useEffect(() => {
      if (metadata) {
          const c2p = [1,0,0, 0,1,0, 0,0,1];
          setCamToProPhotoMat(formatMatrixForUniform(c2p));
          const p2t = getProPhotoToTargetMatrix(targetLogSpace);
          setProPhotoToTargetMat(formatMatrixForUniform(p2t));
      }
  }, [metadata, targetLogSpace]);

  // Handle Processing
  const handleProcess = async (fileToProcess, shouldAutoExpose = false) => {
    if (!fileToProcess) return;

    setLoading(true);
    setError(null);
    setImageState(null);
    // Note: We don't reset metadata here immediately to avoid UI flicker if possible,
    // but typically we should.
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
        setImageState({
          data, width, height, channels, bitDepth, mode: resultMode
        });

        if (shouldAutoExpose) {
             const ev = calculateAutoExposure(data, width, height, meteringMode, bitDepth);
             setExposure(ev);
             setInitialExposure(ev);
        }
        setLoading(false);
      } else if (type === 'error') {
        setError(workerError);
        setLoading(false);
      }
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

  // Export Logic (Same as before)
  const handleExport = () => {
      if (!imageState || !glCanvasRef.current) return;
      setExporting(true);
      setTimeout(async () => {
          try {
              const result = glCanvasRef.current.captureHighRes();
              if (!result) throw new Error("Failed to capture WebGL data");
              const { width, height, data } = result;

              if (exportWorkerRef.current) exportWorkerRef.current.terminate();
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
              exportWorkerRef.current.postMessage({
                  width, height, data, channels: 4, logSpace: targetLogSpace, format: exportFormat, quality: 0.95
              }, [data.buffer]);
          } catch (err) {
              setError("Export Error: " + err.message);
              setExporting(false);
          }
      }, 100);
  };

  const handleLutImport = (file) => {
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (event) => {
          try {
              const text = event.target.result;
              const { size, data, title } = parseCubeLUT(text);
              const name = title === 'Untitled LUT' ? file.name.replace(/\.cube$/i, '') : title;
              importLut(name, data, size);
          } catch (err) {
              setError("Failed to parse LUT: " + err.message);
          }
      };
      reader.readAsText(file);
  };

  const handleAnalyze = () => {
      if (glCanvasRef.current) {
          const stats = glCanvasRef.current.getStatistics();
          setImgStats(stats);
      }
  };

  // Reset Wrappers
  const resetWB = () => { setWbRed(1.0); setWbGreen(1.0); setWbBlue(1.0); };
  const resetExposureSettings = () => { setExposure(initialExposure); setMeteringMode('hybrid'); };
  const resetEnhancements = () => { setContrast(1.0); setSaturation(1.0); };
  const resetTone = () => { setHighlights(0.0); setShadows(0.0); setWhites(0.0); setBlacks(0.0); };
  const resetAdvanced = () => { setInputGamma(1.0); setImgStats(null); };

  return (
    <ResponsiveLayout
        loading={loading}
        error={error}
        gallerySidebar={
            <GallerySidebar
                images={images}
                activeId={activeImageId}
                onSelect={setActiveImageId}
                onDelete={removeImage}
                onUpload={processUploads}
                processingQueue={processingQueue}
            />
        }
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
                luts={luts} selectedLutId={selectedLutId} onSelectLut={setSelectedLutId}
                onImportLut={handleLutImport} onRemoveLutFromLibrary={removeLut}
                inputGamma={inputGamma} setInputGamma={setInputGamma}
                handleAnalyze={handleAnalyze} imgStats={imgStats}
                onResetAdvanced={resetAdvanced}
            />,
            export: <ExportControls
                exportFormat={exportFormat} setExportFormat={setExportFormat}
                handleExport={handleExport} exporting={exporting}
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
  );
};

export default RawUploader;
