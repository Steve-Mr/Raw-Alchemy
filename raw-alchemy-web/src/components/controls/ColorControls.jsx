import React, { useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { LOG_SPACE_CONFIG } from '../../utils/colorMath';
import { Palette, Upload, Grid } from 'lucide-react';
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

  const handleLutChange = (e) => {
      const selectedId = e.target.value;
      if (!selectedId) {
          onRemoveLut();
          return;
      }

      const lut = luts.find(l => l.id === selectedId);
      if (lut) {
          // Pass the stored file/blob to the handler
          onLutSelect(lut.file);
      }
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

        {/* LUT Dropdown */}
        <select
            className="block w-full p-3 text-sm bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl focus:ring-primary-light focus:border-primary-light text-gray-900 dark:text-white appearance-none mb-3"
            value={luts.find(l => l.name === lutName)?.id || ""}
            onChange={handleLutChange}
        >
            <option value="">{t('color.noLut') || "None"}</option>
            {luts.map((lut) => (
                <option key={lut.id} value={lut.id}>
                    {lut.name}
                </option>
            ))}
        </select>

        {/* Helper Actions for Selected LUT (Delete) */}
        {lutName && (
            <div className="flex justify-end">
                 <button
                    onClick={() => {
                        const lut = luts.find(l => l.name === lutName);
                        if (lut && confirm("Delete this LUT?")) {
                            onRemoveLut(); // Clear active first
                            removeLut(lut.id);
                        }
                    }}
                    className="text-xs text-red-500 hover:text-red-600 underline"
                 >
                     Delete Selected LUT
                 </button>
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
