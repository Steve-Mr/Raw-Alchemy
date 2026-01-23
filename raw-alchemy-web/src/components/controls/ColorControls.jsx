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
      <div className="bg-surface-light dark:bg-surface-dark border border-gray-200 dark:border-gray-800 p-5 rounded-2xl shadow-sm">
        <h3 className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-4 flex items-center gap-2">
            <Palette size={14} />
            {t('color.targetSpace')}
        </h3>
        <select
            className="block w-full p-3 text-sm bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl focus:ring-primary-light focus:border-primary-light text-gray-900 dark:text-white appearance-none"
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
      <div className="bg-surface-light dark:bg-surface-dark border border-gray-200 dark:border-gray-800 p-5 rounded-2xl shadow-sm">
        <h3 className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-4">
            {t('color.lut')}
        </h3>

        {lutName ? (
            <div className="flex items-center justify-between bg-blue-50/50 dark:bg-blue-900/20 p-3 rounded-xl border border-blue-100 dark:border-blue-800">
                <div className="flex items-center gap-3 overflow-hidden">
                    <span className="flex items-center justify-center w-6 h-6 rounded-full bg-green-100 dark:bg-green-900/50 text-green-600 dark:text-green-400 text-xs">✓</span>
                    <div className="truncate text-sm font-medium text-blue-900 dark:text-blue-100" title={lutName}>
                        {lutName}
                    </div>
                </div>
                <button
                    onClick={onRemoveLut}
                    className="text-gray-400 hover:text-red-500 transition-colors p-2"
                >
                    <X size={16} />
                </button>
            </div>
        ) : (
            <div
                onClick={handleFileClick}
                className="border-2 border-dashed border-gray-200 dark:border-gray-700 rounded-xl p-6 flex flex-col items-center justify-center cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800/50 hover:border-gray-300 dark:hover:border-gray-600 transition-all group"
            >
                <div className="p-3 bg-gray-100 dark:bg-gray-800 rounded-full mb-3 group-hover:scale-110 transition-transform">
                    <Upload size={20} className="text-gray-400" />
                </div>
                <span className="text-sm text-gray-600 dark:text-gray-300 font-medium">
                    {t('color.loadLut')}
                </span>
                <input
                    ref={fileInputRef}
                    id="lut-upload-input"
                    name="lut_upload"
                    type="file"
                    accept=".cube"
                    onChange={onLutSelect}
                    className="hidden"
                />
            </div>
        )}
        <p className="text-[10px] text-gray-400 mt-3 text-center">
            {t('color.lutNote')}
        </p>
      </div>
    </div>
  );
};

export default ColorControls;
