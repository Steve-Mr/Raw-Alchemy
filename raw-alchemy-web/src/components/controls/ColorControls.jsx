import React, { useRef, useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { LOG_SPACE_CONFIG } from '../../utils/colorMath';
import { Palette, Upload, X, Trash2, ChevronDown, Check } from 'lucide-react';

const ColorControls = ({
  targetLogSpace, setTargetLogSpace,
  lutName, onRemoveLut,
  luts = [], onImportLuts, onDeleteLut, onApplyLut,
  isLoading, error
}) => {
  const { t } = useTranslation();
  const fileInputRef = useRef(null);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = useRef(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleUploadClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (e) => {
    if (e.target.files && e.target.files.length > 0) {
      onImportLuts(e.target.files);
    }
    // Reset input
    e.target.value = '';
  };

  const handleDelete = (e, id) => {
    e.stopPropagation();
    if (window.confirm("Delete this LUT from library?")) {
        onDeleteLut(id);
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

      {/* 3D LUT */}
      <div className="bg-surface-light dark:bg-surface-dark border border-gray-200 dark:border-gray-800 p-5 rounded-2xl shadow-sm">
        <h3 className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-4">
            {t('color.lut')}
        </h3>

        {/* Library Controls */}
        <div className="flex gap-2 mb-3">
            {/* Custom Dropdown */}
            <div className="relative flex-grow" ref={dropdownRef}>
                <button
                    onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                    className="w-full flex items-center justify-between p-3 text-sm bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl hover:border-gray-300 dark:hover:border-gray-600 transition-colors text-left"
                >
                    <span className="text-gray-700 dark:text-gray-300 truncate">
                        Select LUT...
                    </span>
                    <ChevronDown size={16} className="text-gray-400" />
                </button>

                {isDropdownOpen && (
                    <div className="absolute top-full left-0 right-0 mt-2 max-h-60 overflow-y-auto bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-lg z-20">
                        {luts.length === 0 ? (
                            <div className="p-4 text-center text-xs text-gray-400">
                                No LUTs in library
                            </div>
                        ) : (
                            <div className="py-1">
                                {luts.map((lut) => (
                                    <div
                                        key={lut.id}
                                        onClick={() => {
                                            onApplyLut(lut);
                                            setIsDropdownOpen(false);
                                        }}
                                        className="flex items-center justify-between px-3 py-2 hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer group"
                                    >
                                        <span className={`text-sm truncate pr-2 ${lutName === lut.name ? 'font-semibold text-primary-600 dark:text-primary-400' : 'text-gray-700 dark:text-gray-300'}`}>
                                            {lut.name}
                                        </span>
                                        <button
                                            onClick={(e) => handleDelete(e, lut.id)}
                                            className="p-1.5 text-gray-300 dark:text-gray-600 hover:text-red-500 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg transition-colors"
                                            title="Delete LUT"
                                        >
                                            <Trash2 size={14} />
                                        </button>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* Import Button */}
            <button
                onClick={handleUploadClick}
                disabled={isLoading}
                className="p-3 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-300 transition-colors disabled:opacity-50 disabled:cursor-wait"
                title="Import LUTs"
            >
                {isLoading ? (
                    <div className="w-5 h-5 border-2 border-gray-400 border-t-transparent rounded-full animate-spin" />
                ) : (
                    <Upload size={20} />
                )}
            </button>
        </div>

        {error && (
            <div className="mb-3 p-2 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 text-xs rounded-lg">
                Error: {error.message || "Failed to load LUT"}
            </div>
        )}

        {/* Applied LUT Display */}
        {lutName && (
            <div className="flex items-center justify-between bg-blue-50/50 dark:bg-blue-900/20 p-3 rounded-xl border border-blue-100 dark:border-blue-800 animate-in fade-in slide-in-from-top-2 duration-300">
                <div className="flex items-center gap-3 overflow-hidden">
                    <span className="flex items-center justify-center w-6 h-6 rounded-full bg-green-100 dark:bg-green-900/50 text-green-600 dark:text-green-400 text-xs">
                        <Check size={12} strokeWidth={3} />
                    </span>
                    <div className="truncate text-sm font-medium text-blue-900 dark:text-blue-100" title={lutName}>
                        {lutName}
                    </div>
                </div>
                <button
                    onClick={onRemoveLut}
                    className="text-gray-400 hover:text-red-500 transition-colors p-2 rounded-lg hover:bg-white/50 dark:hover:bg-black/20"
                >
                    <X size={16} />
                </button>
            </div>
        )}

        {/* Hidden Input */}
        <input
            ref={fileInputRef}
            id="lut-upload-input"
            name="lut_upload"
            type="file"
            accept=".cube,text/plain"
            multiple
            onChange={handleFileChange}
            className="hidden"
        />

        <p className="text-[10px] text-gray-400 mt-3 text-center">
            {t('color.lutNote')}
        </p>
      </div>
    </div>
  );
};

export default ColorControls;
