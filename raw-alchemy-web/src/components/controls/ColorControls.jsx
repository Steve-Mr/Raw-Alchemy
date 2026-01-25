import React, { useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { LOG_SPACE_CONFIG } from '../../utils/colorMath';
import { Palette, Upload, X, Grid, Check } from 'lucide-react';
import { useGallery } from '../../hooks/useGallery';

const ColorControls = ({
  targetLogSpace, setTargetLogSpace,
  lutName, onLutSelect, onRemoveLut
}) => {
  const { t } = useTranslation();
  const fileInputRef = useRef(null);
  const { luts, addLuts, removeLut } = useGallery();

  const handleFileChange = (e) => {
      if (e.target.files && e.target.files.length > 0) {
          addLuts(Array.from(e.target.files));
      }
      e.target.value = '';
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

      {/* 3D LUT Library */}
      <div className="bg-surface-light dark:bg-surface-dark border border-gray-200 dark:border-gray-800 p-5 rounded-2xl shadow-sm">
        <div className="flex items-center justify-between mb-4">
             <h3 className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider flex items-center gap-2">
                <Grid size={14} />
                {t('color.lut')} ({luts.length})
            </h3>
             <button
                onClick={() => fileInputRef.current?.click()}
                className="text-primary-500 hover:text-primary-600 text-xs font-bold uppercase tracking-wider flex items-center gap-1"
             >
                 <Upload size={12} /> Add
             </button>
        </div>

        <input
            ref={fileInputRef}
            type="file"
            accept=".cube"
            multiple
            className="hidden"
            onChange={handleFileChange}
        />

        {/* Active LUT Display (if any) */}
        {lutName && (
             <div className="mb-4 flex items-center justify-between bg-blue-50/50 dark:bg-blue-900/20 p-3 rounded-xl border border-blue-100 dark:border-blue-800">
                <div className="flex items-center gap-3 overflow-hidden">
                    <span className="flex items-center justify-center w-6 h-6 rounded-full bg-green-100 dark:bg-green-900/50 text-green-600 dark:text-green-400 text-xs">✓</span>
                    <div className="truncate text-sm font-medium text-blue-900 dark:text-blue-100" title={lutName}>
                        {lutName}
                    </div>
                </div>
                <button
                    onClick={onRemoveLut}
                    className="text-gray-400 hover:text-red-500 transition-colors p-2"
                    title="Clear Active LUT"
                >
                    <X size={16} />
                </button>
            </div>
        )}

        {/* LUT Grid */}
        <div className="grid grid-cols-2 gap-2 max-h-48 overflow-y-auto custom-scrollbar">
            {luts.map(lut => (
                <div
                    key={lut.id}
                    onClick={() => {
                         // Mocking an event object for existing onLutSelect handler
                         // Ideally we should refactor handleLutSelect to take a file directly.
                         // But to avoid changing RawUploader too much, we construct a fake event?
                         // Better: RawUploader should export a function that accepts a File.
                         // For now, let's assume onLutSelect can handle this?
                         // No, onLutSelect expects an event.
                         // Let's pass the file directly if onLutSelect supports it.
                         // We will update RawUploader's handleLutSelect to verify input.
                         onLutSelect(lut.file);
                    }}
                    className={`
                        group relative p-3 rounded-lg border-2 cursor-pointer transition-all
                        ${lutName === lut.name ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20' : 'border-transparent bg-gray-50 dark:bg-gray-800 hover:border-gray-200 dark:hover:border-gray-700'}
                    `}
                >
                    <div className="text-xs font-medium truncate pr-4">{lut.name}</div>

                    <button
                        onClick={(e) => {
                            e.stopPropagation();
                            if (lutName === lut.name) onRemoveLut();
                            removeLut(lut.id);
                        }}
                        className="absolute top-1 right-1 p-1 opacity-0 group-hover:opacity-100 text-gray-400 hover:text-red-500 transition-opacity"
                    >
                        <X size={12} />
                    </button>
                </div>
            ))}

            {luts.length === 0 && (
                <div className="col-span-2 text-center py-6 text-gray-400 text-xs">
                    No LUTs loaded.
                </div>
            )}
        </div>

        <p className="text-[10px] text-gray-400 mt-3 text-center">
            {t('color.lutNote')}
        </p>
      </div>
    </div>
  );
};

export default ColorControls;
