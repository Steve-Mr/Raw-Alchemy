import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { openDB } from 'idb';
import GLCanvas from './GLCanvas';
import { getProPhotoToTargetMatrix, formatMatrixForUniform, LOG_SPACE_CONFIG } from '../utils/colorMath';
import { calculateAutoExposure } from '../utils/metering';
import { parseCubeLUT } from '../utils/lutParser';
import { useGallery } from '../hooks/useGallery';

// Layout & Controls
import ResponsiveLayout from './layout/ResponsiveLayout';
import GalleryPanel from './gallery/GalleryPanel';
import BasicControls from './controls/BasicControls';
import ToneControls from './controls/ToneControls';
import ColorControls from './controls/ColorControls';
import ExportControls from './controls/ExportControls';
import AdvancedControls from './controls/AdvancedControls';
import { UploadCloud, XCircle, RefreshCw, History } from 'lucide-react';

const RawUploader = () => {
  const { t } = useTranslation();

  // Gallery Hook
  const {
      images,
      activeId,
      loading: galleryLoading,
      error: galleryError,
      addImages,
      removeImage,
      setActive,
      updateImage,
      clearGallery
  } = useGallery();

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Current Processed State (Decoded RGB data)
  const [imageState, setImageState] = useState(null); // { id, data, width, height... }
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

  // Batch Export State
  const [batchExporting, setBatchExporting] = useState(false);
  const [batchQueue, setBatchQueue] = useState([]); // Array of IDs
  const batchDirHandle = useRef(null);
  const batchZip = useRef(null);

  const glCanvasRef = useRef(null);
  const workerRef = useRef(null);
  const exportWorkerRef = useRef(null);
  const [imgStats, setImgStats] = useState(null);

  // Ref for the hidden file input to trigger it programmatically
  const fileInputRef = useRef(null);

  // Ref to track synchronization to avoid loops
  const lastLoadedId = useRef(null);

  useEffect(() => {
    return () => {
      workerRef.current?.terminate();
      exportWorkerRef.current?.terminate();
    };
  }, []);

  // Handle Shared Files (PWA)
  useEffect(() => {
    const checkSharedFile = async () => {
        const urlParams = new URLSearchParams(window.location.search);
        if (urlParams.get('shared_target') === 'true') {
            try {
                const db = await openDB('nitrate-grain-share', 1);
                const file = await db.get('shared-files', 'latest-share');

                if (file && file instanceof Blob) {
                     // Append shared file to gallery
                     const added = await addImages([file]);
                     if (added && added.length > 0) {
                         setActive(added[0].id);
                     }
                }

                await db.delete('shared-files', 'latest-share');
                const newUrl = window.location.pathname;
                window.history.replaceState({}, document.title, newUrl);
            } catch (err) {
                console.error("Error retrieving shared file:", err);
            }
        }
    };

    checkSharedFile();
  }, [addImages]);

  // Sync Color Matrices
  useEffect(() => {
      if (metadata) {
          const c2p = [1,0,0, 0,1,0, 0,0,1];
          setCamToProPhotoMat(formatMatrixForUniform(c2p));
          const p2t = getProPhotoToTargetMatrix(targetLogSpace);
          setProPhotoToTargetMat(formatMatrixForUniform(p2t));
      }
  }, [metadata, targetLogSpace]);

  // Auto Exposure (Only on initial load/change of metering)
  useEffect(() => {
      if (imageState && imageState.mode === 'rgb' && imageState.data) {
          const ev = calculateAutoExposure(
              imageState.data,
              imageState.width,
              imageState.height,
              meteringMode,
              imageState.bitDepth
          );
          setInitialExposure(ev);

          if (exposure === 0.0 && lastLoadedId.current === imageState.id) {
               if (exposure === 0.0) setExposure(ev);
          }
      }
  }, [imageState, meteringMode]);

  // ---------------------------------------------------------
  // Gallery Synchronization
  // ---------------------------------------------------------

  // 1. Load Image & Settings when Active ID Changes
  useEffect(() => {
      if (galleryLoading) return;

      if (!activeId) {
          setImageState(null);
          setMetadata(null);
          lastLoadedId.current = null;
          return;
      }

      if (activeId === lastLoadedId.current) return;

      const img = images.find(i => i.id === activeId);
      if (!img) return;

      lastLoadedId.current = activeId;
      setError(null);

      // Restore Settings
      const s = img.settings || {};
      setWbRed(s.wbRed ?? 1.0);
      setWbGreen(s.wbGreen ?? 1.0);
      setWbBlue(s.wbBlue ?? 1.0);
      setExposure(s.exposure ?? 0.0);
      setContrast(s.contrast ?? 1.0);
      setSaturation(s.saturation ?? 1.0);
      setHighlights(s.highlights ?? 0.0);
      setShadows(s.shadows ?? 0.0);
      setWhites(s.whites ?? 0.0);
      setBlacks(s.blacks ?? 0.0);
      setMeteringMode(s.meteringMode ?? 'hybrid');
      setInputGamma(s.inputGamma ?? 1.0);
      setTargetLogSpace(s.targetLogSpace ?? 'None');
      setLutData(null);
      setLutName(null);
      setLutSize(null);

      // Process (Decode)
      handleProcess(img.file, activeId);

  }, [activeId, images, galleryLoading]);

  // 2. Save Settings to Gallery when they change (Debounced)
  useEffect(() => {
      if (!activeId || galleryLoading) return;

      const timer = setTimeout(() => {
          updateImage(activeId, {
              settings: {
                  wbRed, wbGreen, wbBlue,
                  exposure, contrast, saturation,
                  highlights, shadows, whites, blacks,
                  meteringMode, inputGamma,
                  targetLogSpace
              }
          });
      }, 500);

      return () => clearTimeout(timer);
  }, [
      activeId, galleryLoading, updateImage,
      wbRed, wbGreen, wbBlue, exposure, contrast, saturation,
      highlights, shadows, whites, blacks, meteringMode, inputGamma, targetLogSpace
  ]);


  // ---------------------------------------------------------
  // Processing Logic
  // ---------------------------------------------------------

  const handleProcess = async (fileToProcess, id) => {
    if (!fileToProcess) return;

    setLoading(true);

    if (workerRef.current) {
        workerRef.current.terminate();
    }

    workerRef.current = new Worker(new URL('../workers/raw.worker.js', import.meta.url), { type: 'module' });

    workerRef.current.onmessage = (e) => {
      const { type, data, width, height, channels, bitDepth, error: workerError, mode: resultMode, meta } = e.data;

      if (type === 'success') {
        setMetadata(meta);
        setImageState({
          id, // Tag with ID
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
        setError("Worker failed. Try reloading.");
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
      // Single Image Export
      if (!imageState || !glCanvasRef.current) return;
      setExporting(true);
      setTimeout(async () => {
          try {
              const result = glCanvasRef.current.captureHighRes();
              if (!result) throw new Error("Failed to capture WebGL data");

              const { width, height, data } = result;

              const currentImg = images.find(i => i.id === activeId);
              const originalName = currentImg ? currentImg.name.split('.').slice(0, -1).join('.') : 'output';

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
                  width,
                  height,
                  data: data,
                  channels: 4,
                  logSpace: targetLogSpace,
                  format: exportFormat,
                  quality: 0.95
              }, [data.buffer]);

          } catch (err) {
              setError("Export Error: " + err.message);
              setExporting(false);
          }
      }, 100);
  };

  // ---------------------------------------------------------
  // Batch Export Logic
  // ---------------------------------------------------------

  const handleBatchExport = async () => {
       if (images.length === 0) return;

       let dirHandle = null;
       let zip = null;

       // Try File System Access API
       try {
           if (window.showDirectoryPicker) {
               try {
                   dirHandle = await window.showDirectoryPicker({ mode: 'readwrite' });
               } catch (e) {
                   if (e.name === 'AbortError') return;
                   // Else proceed to Zip fallback
               }
           }
       } catch (e) {
           console.warn("FSA API not supported", e);
       }

       if (!dirHandle) {
           // Fallback to JSZip
           try {
               const JSZip = (await import('jszip')).default;
               zip = new JSZip();
           } catch (e) {
               setError("Failed to load JSZip: " + e.message);
               return;
           }
       }

       batchDirHandle.current = dirHandle;
       batchZip.current = zip;

       setBatchQueue(images.map(img => img.id));
       setBatchExporting(true);

       // Start with first image
       if (images.length > 0) {
           setActive(images[0].id);
       }
  };

  // Batch Export Process Loop
  useEffect(() => {
      // Conditions to process the current image in the queue
      if (!batchExporting || batchQueue.length === 0) return;

      const currentId = batchQueue[0];

      // Wait until the active image matches the current queue item AND is fully loaded/processed
      if (activeId === currentId && imageState?.id === currentId && !loading && !exporting) {

           const processExport = async () => {
               // Wait for GL render (double RAF)
               await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));

               if (!glCanvasRef.current) return;

               const result = glCanvasRef.current.captureHighRes();
               if (!result) return;

               const { width, height, data } = result;
               const currentImg = images.find(i => i.id === currentId);

               const worker = new Worker(new URL('../workers/export.worker.js', import.meta.url), { type: 'module' });

               // Timeout safety
               const workerTimeout = setTimeout(() => {
                   console.error("Batch export timed out for image", currentId);
                   worker.terminate();
                   setBatchQueue(prev => prev.slice(1));
                   if (batchQueue.length > 1) setActive(batchQueue[1]);
                   else setBatchExporting(false);
               }, 60000);

               worker.onmessage = async (e) => {
                   clearTimeout(workerTimeout);
                   const { type, buffer } = e.data;
                   if (type === 'success') {
                       const mimeType = exportFormat === 'tiff' ? 'image/tiff' : `image/${exportFormat}`;
                       const blob = new Blob([buffer], { type: mimeType });

                       const originalName = currentImg ? currentImg.name.split('.').slice(0, -1).join('.') : 'output';
                       const cleanLogName = targetLogSpace.replace(/\s+/g, '-');
                       const ext = exportFormat === 'tiff' ? 'tiff' : exportFormat === 'jpeg' ? 'jpg' : exportFormat;
                       const filename = `${originalName}_${cleanLogName}.${ext}`;

                       if (batchDirHandle.current) {
                           try {
                               const fileHandle = await batchDirHandle.current.getFileHandle(filename, { create: true });
                               const writable = await fileHandle.createWritable();
                               await writable.write(blob);
                               await writable.close();
                           } catch (err) {
                               console.error("File write failed", err);
                           }
                       } else if (batchZip.current) {
                           batchZip.current.file(filename, blob);
                       }

                       worker.terminate();

                       // Move to next
                       const nextQueue = batchQueue.slice(1);
                       setBatchQueue(nextQueue);

                       if (nextQueue.length > 0) {
                           setActive(nextQueue[0]);
                       } else {
                           // Done
                           if (batchZip.current) {
                               const content = await batchZip.current.generateAsync({ type: "blob" });
                               const a = document.createElement('a');
                               a.href = URL.createObjectURL(content);
                               a.download = `batch_export_${new Date().toISOString().slice(0,10)}.zip`;
                               document.body.appendChild(a);
                               a.click();
                               document.body.removeChild(a);
                               URL.revokeObjectURL(a.href);
                           }
                           setBatchExporting(false);
                           batchDirHandle.current = null;
                           batchZip.current = null;
                           // Optional: notify success
                       }
                   } else {
                       // On Error, try to continue
                       worker.terminate();
                       setBatchQueue(prev => prev.slice(1));
                       if (batchQueue.length > 1) setActive(batchQueue[1]);
                       else setBatchExporting(false);
                   }
               };

               worker.postMessage({
                  width,
                  height,
                  data: data,
                  channels: 4,
                  logSpace: targetLogSpace,
                  format: exportFormat,
                  quality: 0.95
               }, [data.buffer]);
           };

           processExport();
      }
  }, [batchExporting, batchQueue, activeId, imageState, loading, exporting, setActive, exportFormat, targetLogSpace, images]);


  const handleFileSelect = (e) => {
    if (e.target.files && e.target.files.length > 0) {
      addImages(Array.from(e.target.files));
      e.target.value = '';
    }
  };

  const handleTriggerUpload = () => {
      if (fileInputRef.current) {
          fileInputRef.current.click();
      }
  };

  // LUT Handlers ...
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
  const resetWB = () => { setWbRed(1.0); setWbGreen(1.0); setWbBlue(1.0); };
  const resetExposureSettings = () => { setExposure(0.0); setMeteringMode('hybrid'); };
  const resetEnhancements = () => { setContrast(1.0); setSaturation(1.0); };
  const resetTone = () => { setHighlights(0.0); setShadows(0.0); setWhites(0.0); setBlacks(0.0); };
  const resetAdvanced = () => { setInputGamma(1.0); setImgStats(null); };

  // ---------------------------------------------------------
  // UI Components
  // ---------------------------------------------------------

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
                        {t('uploadPrompt') || "Click to Upload"}
                    </span>
                    <span className="text-xs text-gray-400 dark:text-gray-500">
                        RAW (.ARW, .CR2, .DNG...)
                    </span>
                </div>
            </div>
        </label>
    </div>
  );

  const Gallery = (
      <GalleryPanel
        images={images}
        activeId={activeId}
        onSelect={setActive}
        onRemove={removeImage}
        onAdd={handleTriggerUpload}
      />
  );

  const displayError = error || galleryError;

  return (
    <>
    <input
        ref={fileInputRef}
        id="raw-upload-input"
        type="file"
        name="file_upload"
        className="hidden"
        multiple // Enable multiple files
        accept=".ARW,.CR2,.CR3,.DNG,.NEF,.ORF,.RAF"
        onChange={handleFileSelect}
    />
    <ResponsiveLayout
        fileInput={FileInput}
        loading={loading || galleryLoading}
        error={displayError}
        exporting={exporting}
        gallery={Gallery}
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
                lutName={lutName} onLutSelect={handleLutSelect} onRemoveLut={handleRemoveLut}
            />,
            export: <ExportControls
                exportFormat={exportFormat} setExportFormat={setExportFormat}
                handleExport={handleExport} exporting={exporting}
                handleBatchExport={handleBatchExport}
                batchExporting={batchExporting}
                hasMultipleImages={images.length > 1}
            />,
            advanced: <AdvancedControls
                inputGamma={inputGamma} setInputGamma={setInputGamma}
                handleAnalyze={handleAnalyze} imgStats={imgStats}
                onReset={resetAdvanced}
            />
        }}
    >
        {imageState && activeId ? (
            <div
                className="relative w-full h-full flex items-center justify-center select-none"
                onPointerDown={() => setIsComparing(true)}
                onPointerUp={() => setIsComparing(false)}
                onPointerLeave={() => setIsComparing(false)}
                onTouchStart={() => setIsComparing(true)}
                onTouchEnd={() => setIsComparing(false)}
                onTouchCancel={() => setIsComparing(false)}
            >
                {isComparing && (
                    <div className="absolute top-6 left-1/2 transform -translate-x-1/2 z-50 pointer-events-none">
                        <div className="flex items-center gap-2 px-4 py-2 bg-black/70 backdrop-blur-md rounded-full text-white shadow-xl border border-white/20">
                            <History size={16} className="text-primary-400" />
                            <span className="text-sm font-medium tracking-wide">{t('actions.original')}</span>
                        </div>
                    </div>
                )}

                {batchExporting && (
                    <div className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-black/80 backdrop-blur-sm text-white">
                        <div className="w-16 h-16 border-4 border-primary-500 border-t-transparent rounded-full animate-spin mb-4"></div>
                        <h2 className="text-xl font-bold mb-2">Processing Batch</h2>
                        <p className="text-sm text-gray-300">
                            Processing {images.length - batchQueue.length + 1} of {images.length}
                        </p>
                    </div>
                )}

                <div className="absolute bottom-6 right-6 z-50 flex gap-3 pointer-events-auto">
                     <button
                        onClick={() => removeImage(activeId)}
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
        ) : null}
    </ResponsiveLayout>
    </>
  );
};

export default RawUploader;
