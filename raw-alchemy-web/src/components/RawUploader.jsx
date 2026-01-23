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
import { UploadCloud } from 'lucide-react';

const RawUploader = () => {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [imageState, setImageState] = useState(null); // { data, width, height, channels, bitDepth, mode }
  // Removed 'mode' state, strictly enforcing 'rgb'

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
      // Strictly enforce 'rgb' mode
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

  // Styled File Input Component
  const FileInput = (
    <div className="flex flex-col items-center">
        <label className="flex flex-col items-center justify-center w-full h-32 px-4 transition bg-white dark:bg-gray-900 border-2 border-gray-300 dark:border-gray-700 border-dashed rounded-2xl appearance-none cursor-pointer hover:border-primary-light dark:hover:border-primary-dark hover:bg-gray-50 dark:hover:bg-gray-800 focus:outline-none">
            <div className="flex flex-col items-center space-y-2">
                <UploadCloud className="w-8 h-8 text-gray-400" />
                <span className="font-medium text-gray-600 dark:text-gray-300">
                    {t('uploadPrompt')}
                </span>
                <span className="text-xs text-gray-500 dark:text-gray-400">
                    .ARW, .CR2, .DNG, .NEF, .ORF, .RAF
                </span>
            </div>
            <input
                type="file"
                name="file_upload"
                className="hidden"
                accept=".ARW,.CR2,.CR3,.DNG,.NEF,.ORF,.RAF"
                onChange={handleFileSelect}
            />
        </label>
    </div>
  );

  return (
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
            />,
            tone: <ToneControls
                highlights={highlights} setHighlights={setHighlights}
                shadows={shadows} setShadows={setShadows}
                whites={whites} setWhites={setWhites}
                blacks={blacks} setBlacks={setBlacks}
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
            />
        }}
    >
        {imageState && (
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
        )}
    </ResponsiveLayout>
  );
};

export default RawUploader;
