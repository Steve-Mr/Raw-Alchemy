import React, { useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { LOG_SPACE_CONFIG } from '../../utils/colorMath';
import { Palette, Upload, X } from 'lucide-react';

const ColorControls = ({
  targetLogSpace, setTargetLogSpace,
  lutName, onLutSelect, onRemoveLut
}) => {
  const { t } = useTranslation();
  const fileInputRef = useRef(null);

  const handleFileClick = () => {
    fileInputRef.current?.click();
  };

  return (
    <div className="space-y-6">
      {/* Target Log Space */}
      <div className="bg-surface-container-light dark:bg-surface-container-dark p-4 rounded-2xl">
        <h3 className="text-sm font-bold text-gray-900 dark:text-gray-100 mb-3 flex items-center gap-2">
            <Palette size={16} className="text-pink-500" />
            {t('color.targetSpace')}
        </h3>
        <select
            className="block w-full p-2.5 text-sm bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-primary-light focus:border-primary-light text-gray-900 dark:text-white"
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

      {/* 3D LUT */}
      <div className="bg-surface-container-light dark:bg-surface-container-dark p-4 rounded-2xl">
        <h3 className="text-sm font-bold text-gray-900 dark:text-gray-100 mb-3">
            {t('color.lut')}
        </h3>

        {lutName ? (
            <div className="flex items-center justify-between bg-blue-50 dark:bg-blue-900/30 p-3 rounded-lg border border-blue-200 dark:border-blue-800">
                <div className="flex items-center gap-2 overflow-hidden">
                    <span className="text-green-600 dark:text-green-400">✓</span>
                    <div className="truncate text-sm font-medium text-blue-800 dark:text-blue-200" title={lutName}>
                        {lutName}
                    </div>
                </div>
                <button
                    onClick={onRemoveLut}
                    className="text-red-500 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300 p-1"
                >
                    <X size={16} />
                </button>
            </div>
        ) : (
            <div
                onClick={handleFileClick}
                className="border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg p-4 flex flex-col items-center justify-center cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors"
            >
                <Upload size={24} className="text-gray-400 mb-2" />
                <span className="text-sm text-gray-500 dark:text-gray-400 font-medium">
                    {t('color.loadLut')}
                </span>
                <input
                    ref={fileInputRef}
                    type="file"
                    accept=".cube"
                    onChange={onLutSelect}
                    className="hidden"
                />
            </div>
        )}
        <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
            {t('color.lutNote')}
        </p>
      </div>
    </div>
  );
};

export default ColorControls;
