import React, { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { openDB } from 'idb';
import GLCanvas from './GLCanvas';
import { getProPhotoToTargetMatrix, formatMatrixForUniform, LOG_SPACE_CONFIG } from '../utils/colorMath';
import { calculateAutoExposure } from '../utils/metering';
import { useLutLibrary } from '../hooks/useLutLibrary';
import { useGallery } from '../hooks/useGallery';

// Layout & Controls
import ResponsiveLayout from './layout/ResponsiveLayout';
import GallerySidebar from './gallery/GallerySidebar';
import GalleryGrid from './gallery/GalleryGrid';
import BasicControls from './controls/BasicControls';
import ToneControls from './controls/ToneControls';
import ColorControls from './controls/ColorControls';
import ExportControls from './controls/ExportControls';
import AdvancedControls from './controls/AdvancedControls';
import BatchExportModal from './modals/BatchExportModal';
import { UploadCloud, History } from 'lucide-react';

const RawUploader = () => {
  const { t } = useTranslation();

  // Gallery Hook
  const gallery = useGallery();

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [imageState, setImageState] = useState(null);
  const [metadata, setMetadata] = useState(null);

  // LUT State
  const { luts, importLuts, deleteLut, isLoading: lutLoading, error: lutError } = useLutLibrary();

  // Pipeline State
  const [lutData, setLutData] = useState(null);
  const [lutSize, setLutSize] = useState(null);
  const [lutName, setLutName] = useState(null);

  const [wbRed, setWbRed] = useState(1.0);
  const [wbBlue, setWbBlue] = useState(1.0);
  const [wbGreen, setWbGreen] = useState(1.0);

  const [exposure, setExposure] = useState(0.0);
  const [initialExposure, setInitialExposure] = useState(0.0);
  const [saturation, setSaturation] = useState(1.0);
  const [contrast, setContrast] = useState(1.0);
  const [isComparing, setIsComparing] = useState(false);

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
  const [isBatchModalOpen, setIsBatchModalOpen] = useState(false);
  const [batchProcessing, setBatchProcessing] = useState(false);
  const [batchProgress, setBatchProgress] = useState({ current: 0, total: 0 });

  // Hidden Batch Canvas State
  const [batchImageState, setBatchImageState] = useState(null);
  const [batchAdjustments, setBatchAdjustments] = useState({
      wbRed: 1.0, wbGreen: 1.0, wbBlue: 1.0,
      exposure: 0.0, contrast: 1.0, saturation: 1.0,
      highlights: 0.0, shadows: 0.0, whites: 0.0, blacks: 0.0,
      inputGamma: 1.0,
      lutData: null, lutSize: null,
      targetLogSpace: 'None'
  });
  const [batchMatrices, setBatchMatrices] = useState({
      camToProPhoto: null,
      proPhotoToTarget: null
  });

  const glCanvasRef = useRef(null);
  const workerRef = useRef(null);
  const exportWorkerRef = useRef(null);

  const batchCanvasRef = useRef(null);
  const batchWorkerRef = useRef(null);
  const batchExportWorkerRef = useRef(null);
  const batchRenderResolverRef = useRef(null);

  const [selectedFile, setSelectedFile] = useState(null);
  const [imgStats, setImgStats] = useState(null);

  const isRestoringRef = useRef(false);
  const saveTimeoutRef = useRef(null);

  // Ref for the hidden file input
  const fileInputRef = useRef(null);

  // Sidebar State
  const [isGalleryCollapsed, setIsGalleryCollapsed] = useState(false);

  // Auto-collapse sidebar
  useEffect(() => {
    const handleResize = () => {
        if (window.innerWidth < 1280 && window.innerWidth >= 1024) {
            setIsGalleryCollapsed(true);
        }
    };
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Refs for safe state persistence
  const currentAdjustmentsRef = useRef(null);
  const lastSelectedIdRef = useRef(null);

  // Handle Gallery Selection Change (Save Previous & Load New)
  useEffect(() => {
    // 1. Save Previous Image State (Immediate)
    if (lastSelectedIdRef.current && lastSelectedIdRef.current !== gallery.selectedId) {
        if (currentAdjustmentsRef.current) {
            gallery.saveState(lastSelectedIdRef.current, currentAdjustmentsRef.current);
        }
        // Cancel pending debounced save to prevent overwriting with stale data
        if (saveTimeoutRef.current) {
            clearTimeout(saveTimeoutRef.current);
            saveTimeoutRef.current = null;
        }
    }
    lastSelectedIdRef.current = gallery.selectedId;

    // 2. Load New Image
    const loadSelectedImage = async () => {
        if (!gallery.selectedId) {
            // Clear canvas if no selection
            setImageState(null);
            setSelectedFile(null);
            setMetadata(null);
            return;
        }

        const file = await gallery.getSelectedFile();
        const savedAdjustments = await gallery.getSelectedState();

        if (file) {
            setSelectedFile(file);
            handleProcess(file, savedAdjustments);
        }
    };

    loadSelectedImage();
  }, [gallery.selectedId]);

  // Save Adjustments Debounced
  useEffect(() => {
    // Note: gallery.selectedId is EXCLUDED from dependencies to prevent
    // saving Photo A's state to Photo B during transition race conditions.
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

    // Keep ref updated for immediate save on switch
    currentAdjustmentsRef.current = adjustments;

    // Debounce save for current image
    if (gallery.selectedId) {
        if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
        saveTimeoutRef.current = setTimeout(() => {
            gallery.saveSelectedState(adjustments);
        }, 1000);
    }

  }, [
    wbRed, wbGreen, wbBlue,
    exposure, contrast, saturation,
    highlights, shadows, whites, blacks,
    meteringMode, inputGamma,
    targetLogSpace,
    lutData, lutSize, lutName,
    exportFormat,
    imageState
  ]);

  useEffect(() => {
    return () => {
      workerRef.current?.terminate();
      exportWorkerRef.current?.terminate();
      batchWorkerRef.current?.terminate();
      batchExportWorkerRef.current?.terminate();
    };
  }, []);

  // PWA Share Handling
  useEffect(() => {
    const checkSharedFile = async () => {
        const urlParams = new URLSearchParams(window.location.search);
        if (urlParams.get('shared_target') === 'true') {
            try {
                const db = await openDB('nitrate-grain-share', 1);
                const file = await db.get('shared-files', 'latest-share');

                if (file && file instanceof Blob) {
                    const newId = await gallery.addPhotos([file]);
                    if (newId) gallery.selectPhoto(newId);
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

    setLoading(true);
    setError(null);
    setImageState(null);
    setMetadata(null);

    if (workerRef.current) {
        workerRef.current.terminate();
    }

    workerRef.current = new Worker(new URL('../workers/raw.worker.js', import.meta.url), { type: 'module' });

    workerRef.current.onmessage = (e) => {
      const { type, data, width, height, channels, bitDepth, error: workerError, mode: resultMode, meta } = e.data;

      if (type === 'success') {
        setMetadata(meta);

        if (restoredAdjustments) {
            isRestoringRef.current = true;
            setWbRed(restoredAdjustments.wbRed ?? 1.0);
            setWbGreen(restoredAdjustments.wbGreen ?? 1.0);
            setWbBlue(restoredAdjustments.wbBlue ?? 1.0);
            setHighlights(restoredAdjustments.highlights ?? 0.0);
            setShadows(restoredAdjustments.shadows ?? 0.0);
            setWhites(restoredAdjustments.whites ?? 0.0);
            setBlacks(restoredAdjustments.blacks ?? 0.0);
            setSaturation(restoredAdjustments.saturation ?? 1.0);
            setContrast(restoredAdjustments.contrast ?? 1.0);
            setExposure(restoredAdjustments.exposure ?? 0.0);
            setMeteringMode(restoredAdjustments.meteringMode || 'hybrid');
            setInputGamma(restoredAdjustments.inputGamma || 1.0);
            setTargetLogSpace(restoredAdjustments.targetLogSpace || 'None');
            setExportFormat(restoredAdjustments.exportFormat || 'tiff');

            if (restoredAdjustments.lutData) {
                setLutData(restoredAdjustments.lutData);
                setLutSize(restoredAdjustments.lutSize);
                setLutName(restoredAdjustments.lutName);
            } else {
                setLutData(null);
                setLutName(null);
                setLutSize(null);
            }
        } else {
            // Defaults
            setWbRed(1.0); setWbGreen(1.0); setWbBlue(1.0);
            setHighlights(0.0); setShadows(0.0);
            setWhites(0.0); setBlacks(0.0);
            setSaturation(1.0); setContrast(1.0);
            // Exposure will be set by effect
            setLutData(null); setLutName(null); setLutSize(null);
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
      }
    };

    workerRef.current.onerror = (err) => {
        console.error("Worker Crash:", err);
        setError("Worker failed.");
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

              exportWorkerRef.current.onerror = (err) => {
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
              setError("Export Error: " + err.message);
              setExporting(false);
          }
      }, 100);
  };

  const handleBatchExportClick = () => {
      setIsBatchModalOpen(true);
  };

  const runBatchExport = async (selectedIds, removeAfter) => {
      setBatchProcessing(true);
      setBatchProgress({ current: 0, total: selectedIds.length });

      let dirHandle = null;
      let zip = null;
      const useFileSystem = 'showDirectoryPicker' in window;

      try {
          if (useFileSystem) {
               try {
                   dirHandle = await window.showDirectoryPicker({ mode: 'readwrite' });
               } catch (e) {
                   setBatchProcessing(false);
                   return;
               }
          } else {
               const JSZipModule = await import('jszip');
               zip = new JSZipModule.default();
          }

          if (batchWorkerRef.current) batchWorkerRef.current.terminate();
          batchWorkerRef.current = new Worker(new URL('../workers/raw.worker.js', import.meta.url), { type: 'module' });

          if (batchExportWorkerRef.current) batchExportWorkerRef.current.terminate();
          batchExportWorkerRef.current = new Worker(new URL('../workers/export.worker.js', import.meta.url), { type: 'module' });

          let successCount = 0;
          const processedIds = [];

          for (let i = 0; i < selectedIds.length; i++) {
              const id = selectedIds[i];
              setBatchProgress({ current: i + 1, total: selectedIds.length });

              try {
                  const file = await gallery.getFile(id);
                  const state = await gallery.getState(id);

                  if (!file) continue;

                  const decoded = await new Promise((resolve, reject) => {
                       const worker = batchWorkerRef.current;
                       const msgId = Date.now();
                       const handler = (e) => {
                           if (e.data.id === msgId || (e.data.type === 'error' && e.data.error)) {
                               worker.removeEventListener('message', handler);
                               if (e.data.type === 'success') resolve(e.data);
                               else reject(e.data.error);
                           }
                       };
                       worker.addEventListener('message', handler);
                       file.arrayBuffer().then(buf => {
                           worker.postMessage({ command: 'decode', fileBuffer: buf, mode: 'rgb', id: msgId }, [buf]);
                       }).catch(reject);
                  });

                  const adjustments = {
                      wbRed: state?.wbRed ?? 1.0,
                      wbGreen: state?.wbGreen ?? 1.0,
                      wbBlue: state?.wbBlue ?? 1.0,
                      exposure: state?.exposure ?? 0.0,
                      contrast: state?.contrast ?? 1.0,
                      saturation: state?.saturation ?? 1.0,
                      highlights: state?.highlights ?? 0.0,
                      shadows: state?.shadows ?? 0.0,
                      whites: state?.whites ?? 0.0,
                      blacks: state?.blacks ?? 0.0,
                      inputGamma: state?.inputGamma ?? 1.0,
                      lutData: state?.lutData ?? null,
                      lutSize: state?.lutSize ?? null,
                      targetLogSpace: state?.targetLogSpace ?? 'None'
                  };

                  if (!state) {
                       adjustments.exposure = calculateAutoExposure(
                           decoded.data, decoded.width, decoded.height, 'hybrid', decoded.bitDepth
                       );
                  }

                  const c2p = [1,0,0, 0,1,0, 0,0,1];
                  const p2t = getProPhotoToTargetMatrix(adjustments.targetLogSpace);

                  setBatchMatrices({
                      camToProPhoto: formatMatrixForUniform(c2p),
                      proPhotoToTarget: formatMatrixForUniform(p2t)
                  });
                  setBatchAdjustments(adjustments);
                  setBatchImageState({
                      data: decoded.data,
                      width: decoded.width,
                      height: decoded.height,
                      channels: decoded.channels,
                      bitDepth: decoded.bitDepth
                  });

                  // Wait for GLCanvas to render via callback
                  await new Promise(resolve => {
                      batchRenderResolverRef.current = resolve;
                  });

                  if (!batchCanvasRef.current) throw new Error("Batch Canvas not ready");
                  const result = batchCanvasRef.current.captureHighRes();
                  if (!result) throw new Error("Failed to capture");

                  const exportedBlob = await new Promise((resolve, reject) => {
                       const worker = batchExportWorkerRef.current;
                       const handler = (e) => {
                           worker.removeEventListener('message', handler);
                           if (e.data.type === 'success') {
                               const mime = exportFormat === 'tiff' ? 'image/tiff' : `image/${exportFormat}`;
                               resolve(new Blob([e.data.buffer], { type: mime }));
                           }
                           else reject(e.data.message);
                       };
                       worker.addEventListener('message', handler);
                       worker.postMessage({
                          width: result.width,
                          height: result.height,
                          data: result.data,
                          channels: 4,
                          logSpace: adjustments.targetLogSpace,
                          format: exportFormat,
                          quality: 0.95
                       }, [result.data.buffer]);
                  });

                  // Robust filename generation
                  const baseName = file.name.replace(/\.[^/.]+$/, "");
                  const logSuffix = adjustments.targetLogSpace === 'None' ? '' : `_${adjustments.targetLogSpace.replace(/\s+/g, '-')}`;
                  const ext = exportFormat === 'tiff' ? 'tiff' : exportFormat === 'jpeg' ? 'jpg' : exportFormat;
                  // Sanitize filename for compatibility
                  const safeName = `${baseName}${logSuffix}`.replace(/[^a-z0-9_\-\.]/gi, '_');
                  const filename = `${safeName}.${ext}`;

                  if (useFileSystem && dirHandle) {
                      const fileHandle = await dirHandle.getFileHandle(filename, { create: true });
                      const writable = await fileHandle.createWritable();
                      await writable.write(exportedBlob);
                      await writable.close();
                  } else if (zip) {
                      zip.file(filename, exportedBlob);
                  }

                  successCount++;
                  processedIds.push(id);

              } catch (err) {
                  console.error(`Error exporting ${id}:`, err);
              }
          }

          if (zip && successCount > 0) {
              const content = await zip.generateAsync({ type: "blob" });
              const a = document.createElement("a");
              a.href = URL.createObjectURL(content);
              a.download = "batch_export.zip";
              document.body.appendChild(a);
              a.click();
              document.body.removeChild(a);
              URL.revokeObjectURL(a.href);
          }

          setBatchProcessing(false);
          setIsBatchModalOpen(false);

          if (removeAfter && successCount > 0) {
             if (window.confirm(t('export.delete_confirm', { count: successCount }))) {
                 for (const id of processedIds) {
                     await gallery.deletePhoto(id);
                 }
             }
          }
      } catch (e) {
          console.error("Batch Export Setup Error:", e);
          setBatchProcessing(false);
      }
  };

  const handleFileSelect = async (e) => {
    if (e.target.files && e.target.files.length > 0) {
      const firstId = await gallery.addPhotos(e.target.files);
      if (firstId) gallery.selectPhoto(firstId);
      e.target.value = '';
    }
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
  const resetWB = () => { setWbRed(1.0); setWbGreen(1.0); setWbBlue(1.0); };
  const resetExposureSettings = () => { setExposure(0.0); setMeteringMode('hybrid'); };
  const resetEnhancements = () => { setContrast(1.0); setSaturation(1.0); };
  const resetTone = () => { setHighlights(0.0); setShadows(0.0); setWhites(0.0); setBlacks(0.0); };
  const resetAdvanced = () => { setInputGamma(1.0); setImgStats(null); };

  // File Input
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
        {gallery.error && (
             <div className="mt-4 p-2 bg-red-100 text-red-600 rounded-lg text-sm">
                 {gallery.error}
             </div>
        )}
    </div>
  );

  return (
    <>
    <input
        ref={fileInputRef}
        id="raw-upload-input"
        type="file"
        name="file_upload"
        className="hidden"
        multiple
        accept=".ARW,.CR2,.CR3,.DNG,.NEF,.ORF,.RAF"
        onChange={handleFileSelect}
    />
    <ResponsiveLayout
        fileInput={FileInput}
        loading={loading}
        error={error}
        exporting={exporting}
        gallerySidebar={
            <GallerySidebar
                images={gallery.images}
                selectedId={gallery.selectedId}
                onSelect={gallery.selectPhoto}
                onDelete={gallery.deletePhoto}
                onAdd={handleTriggerUpload}
                isProcessing={gallery.isProcessing}
                isCollapsed={isGalleryCollapsed}
                setIsCollapsed={setIsGalleryCollapsed}
                showAddButton={!!gallery.selectedId} // Only show if image is selected (editing)
            />
        }
        galleryGrid={
            <GalleryGrid
                images={gallery.images}
                selectedId={gallery.selectedId}
                onSelect={gallery.selectPhoto}
                onDelete={gallery.deletePhoto}
                onAdd={handleTriggerUpload}
                isProcessing={gallery.isProcessing}
                showAddButton={!!gallery.selectedId} // Only show if image is selected (editing)
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
                lutName={lutName}
                onRemoveLut={handleRemoveLut}
                luts={luts}
                onImportLuts={importLuts}
                onDeleteLut={deleteLut}
                onApplyLut={handleApplyLut}
                isLoading={lutLoading}
                error={lutError}
            />,
            export: <ExportControls
                exportFormat={exportFormat} setExportFormat={setExportFormat}
                handleExport={handleExport} exporting={exporting}
                onBatchExport={handleBatchExportClick}
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

    <BatchExportModal
        isOpen={isBatchModalOpen}
        onClose={() => setIsBatchModalOpen(false)}
        images={gallery.images}
        onExport={runBatchExport}
        isProcessing={batchProcessing}
        progress={batchProgress}
    />

    <div style={{ display: 'none' }}>
        {batchImageState && (
            <GLCanvas
                ref={batchCanvasRef}
                width={batchImageState.width}
                height={batchImageState.height}
                data={batchImageState.data}
                channels={batchImageState.channels}
                bitDepth={batchImageState.bitDepth}
                wbMultipliers={[batchAdjustments.wbRed, batchAdjustments.wbGreen, batchAdjustments.wbBlue]}
                camToProPhotoMatrix={batchMatrices.camToProPhoto}
                proPhotoToTargetMatrix={batchMatrices.proPhotoToTarget}
                logCurveType={LOG_SPACE_CONFIG[batchAdjustments.targetLogSpace] ? LOG_SPACE_CONFIG[batchAdjustments.targetLogSpace].id : 0}
                exposure={batchAdjustments.exposure}
                saturation={batchAdjustments.saturation}
                contrast={batchAdjustments.contrast}
                highlights={batchAdjustments.highlights}
                shadows={batchAdjustments.shadows}
                whites={batchAdjustments.whites}
                blacks={batchAdjustments.blacks}
                inputGamma={batchAdjustments.inputGamma}
                lutData={batchAdjustments.lutData}
                lutSize={batchAdjustments.lutSize}
                onRender={() => {
                    if (batchRenderResolverRef.current) {
                        batchRenderResolverRef.current();
                        batchRenderResolverRef.current = null;
                    }
                }}
            />
        )}
    </div>
    </>
  );
};

export default RawUploader;
