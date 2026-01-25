import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Download, Check, Layers, Trash2 } from 'lucide-react';

const ExportControls = ({
  exportFormat, setExportFormat,
  handleExport, exporting,
  handleBatchExport, batchExporting,
  hasMultipleImages,
  selectedIdsCount = 0
}) => {
  const { t } = useTranslation();
  const [removeAfterExport, setRemoveAfterExport] = useState(false);

  return (
    <div className="bg-surface-light dark:bg-surface-dark border border-gray-200 dark:border-gray-800 p-5 rounded-2xl shadow-sm">
      <h3 className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-4 flex items-center gap-2">
        <Download size={14} />
        {t('tabs.export')}
      </h3>

      <div className="mb-6">
        <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-2">
            {t('export.format')}
        </label>
        <div className="grid grid-cols-2 gap-2">
            {['tiff', 'jpeg', 'png', 'webp'].map((fmt) => (
                <button
                    key={fmt}
                    onClick={() => setExportFormat(fmt)}
                    className={`flex items-center justify-center gap-2 p-3 text-sm font-medium rounded-xl border transition-all
                        ${exportFormat === fmt
                            ? 'bg-gray-900 dark:bg-white text-white dark:text-black border-transparent shadow-md'
                            : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700'
                        }
                    `}
                >
                    {fmt.toUpperCase()}
                    {exportFormat === fmt && <Check size={12} />}
                </button>
            ))}
        </div>
      </div>

      {/* Remove Option */}
      {hasMultipleImages && (
          <div className="mb-6 flex items-center gap-2">
              <input
                 type="checkbox"
                 id="remove-after"
                 checked={removeAfterExport}
                 onChange={(e) => setRemoveAfterExport(e.target.checked)}
                 className="w-4 h-4 rounded border-gray-300 text-primary-500 focus:ring-primary-500"
              />
              <label htmlFor="remove-after" className="text-xs font-medium text-gray-600 dark:text-gray-300 select-none cursor-pointer">
                  Remove images from gallery after export
              </label>
          </div>
      )}

      <div className="space-y-3">
        <button
            onClick={handleExport}
            disabled={exporting || batchExporting}
            className={`w-full py-4 px-4 rounded-xl font-bold text-white transition-all shadow-lg flex items-center justify-center gap-2
                ${exporting || batchExporting
                    ? 'bg-gray-400 dark:bg-gray-700 cursor-not-allowed'
                    : 'bg-primary-light hover:bg-blue-700 dark:bg-primary-dark dark:hover:bg-blue-400 shadow-primary-light/20'
                }
            `}
        >
            {exporting && !batchExporting ? (
                <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    {t('export.encoding')}
                </>
            ) : (
                <>
                    <Download size={18} />
                    {t('export.button') || "Export Current"}
                </>
            )}
        </button>

        {hasMultipleImages && (
            <button
                onClick={() => handleBatchExport(removeAfterExport)}
                disabled={exporting || batchExporting}
                className={`w-full py-3 px-4 rounded-xl font-semibold border-2 transition-all flex items-center justify-center gap-2
                    ${exporting || batchExporting
                        ? 'border-gray-200 text-gray-400 cursor-not-allowed'
                        : 'border-primary-light dark:border-primary-dark text-primary-light dark:text-primary-dark hover:bg-primary-light/10 dark:hover:bg-primary-dark/10'
                    }
                `}
            >
                 {batchExporting ? (
                    <>
                        <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin"></div>
                        {t('export.batchProcessing') || "Processing Batch..."}
                    </>
                ) : (
                    <>
                        <Layers size={18} />
                        {selectedIdsCount > 0 ? `Export ${selectedIdsCount} Selected` : (t('export.batch') || "Export All")}
                    </>
                )}
            </button>
        )}
      </div>
    </div>
  );
};

export default ExportControls;
