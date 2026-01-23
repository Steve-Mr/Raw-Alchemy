import React from 'react';
import { useTranslation } from 'react-i18next';
import { Download, FileImage } from 'lucide-react';

const ExportControls = ({
  exportFormat, setExportFormat,
  handleExport, exporting
}) => {
  const { t } = useTranslation();

  return (
    <div className="bg-surface-container-light dark:bg-surface-container-dark p-4 rounded-2xl">
      <h3 className="text-sm font-bold text-gray-900 dark:text-gray-100 mb-4 flex items-center gap-2">
        <Download size={16} className="text-green-600 dark:text-green-400" />
        {t('tabs.export')}
      </h3>

      <div className="mb-4">
        <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
            {t('export.format')}
        </label>
        <div className="relative">
            <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
                <FileImage size={14} className="text-gray-500" />
            </div>
            <select
                className="block w-full pl-9 p-2.5 text-sm bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-green-500 focus:border-green-500 text-gray-900 dark:text-white"
                value={exportFormat}
                onChange={(e) => setExportFormat(e.target.value)}
            >
                <option value="tiff">TIFF (16-bit)</option>
                <option value="jpeg">JPEG (8-bit)</option>
                <option value="png">PNG (8-bit)</option>
                <option value="webp">WebP (8-bit)</option>
            </select>
        </div>
      </div>

      <button
        onClick={handleExport}
        disabled={exporting}
        className={`w-full py-3 px-4 rounded-xl font-bold text-white transition-all shadow-lg flex items-center justify-center gap-2
            ${exporting
                ? 'bg-gray-400 dark:bg-gray-600 cursor-not-allowed'
                : 'bg-green-600 hover:bg-green-700 dark:bg-green-700 dark:hover:bg-green-600 hover:shadow-green-500/30'
            }
        `}
      >
        {exporting ? (
            <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                {t('export.encoding')}
            </>
        ) : (
            <>
                <Download size={18} />
                {t('export.button')}
            </>
        )}
      </button>
    </div>
  );
};

export default ExportControls;
