import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { X, Check, CheckSquare, Square } from 'lucide-react';

const BatchExportModal = ({
    isOpen,
    onClose,
    images,
    onExport,
    isProcessing,
    progress
}) => {
    const { t } = useTranslation();
    const [selectedIds, setSelectedIds] = useState(new Set());
    const [removeAfter, setRemoveAfter] = useState(false);

    // Reset selection when modal opens
    useEffect(() => {
        if (isOpen) {
            // Default select all
            setSelectedIds(new Set(images.map(img => img.id)));
            setRemoveAfter(false);
        }
    }, [isOpen, images]);

    if (!isOpen) return null;

    const toggleSelection = (id) => {
        if (isProcessing) return;
        const newSet = new Set(selectedIds);
        if (newSet.has(id)) {
            newSet.delete(id);
        } else {
            newSet.add(id);
        }
        setSelectedIds(newSet);
    };

    const toggleSelectAll = () => {
        if (isProcessing) return;
        if (selectedIds.size === images.length) {
            setSelectedIds(new Set());
        } else {
            setSelectedIds(new Set(images.map(img => img.id)));
        }
    };

    const handleExport = () => {
        if (selectedIds.size === 0) return;
        onExport(Array.from(selectedIds), removeAfter);
    };

    // Prevent body scroll when modal is open
    useEffect(() => {
        document.body.style.overflow = 'hidden';
        return () => {
            document.body.style.overflow = 'unset';
        };
    }, []);

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
            <div className="bg-surface-light dark:bg-surface-dark w-full max-w-4xl max-h-[90vh] rounded-3xl shadow-2xl flex flex-col border border-gray-200 dark:border-gray-700">
                {/* Header */}
                <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-800">
                    <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                        {t('export.batch_title')}
                    </h2>
                    {!isProcessing && (
                        <button
                            onClick={onClose}
                            className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                        >
                            <X size={20} className="text-gray-500" />
                        </button>
                    )}
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-6 custom-scrollbar">
                    {isProcessing ? (
                        <div className="flex flex-col items-center justify-center h-64 space-y-6">
                            <div className="w-16 h-16 border-4 border-primary-light dark:border-primary-dark border-t-transparent rounded-full animate-spin"></div>
                            <div className="text-center">
                                <h3 className="text-lg font-medium text-gray-900 dark:text-white">
                                    {t('export.processing', { current: progress.current, total: progress.total })}
                                </h3>
                                <p className="text-sm text-gray-500 mt-2">{t('export.exportingSub')}</p>
                            </div>
                        </div>
                    ) : (
                        <>
                            <div className="flex items-center justify-between mb-4">
                                <span className="text-sm text-gray-500">
                                    {selectedIds.size} / {images.length} {t('export.select_images')}
                                </span>
                                <button
                                    onClick={toggleSelectAll}
                                    className="flex items-center gap-2 text-sm font-medium text-primary-light dark:text-primary-dark hover:underline"
                                >
                                    {selectedIds.size === images.length ? (
                                        <><CheckSquare size={16} /> {t('export.deselect_all')}</>
                                    ) : (
                                        <><Square size={16} /> {t('export.select_all')}</>
                                    )}
                                </button>
                            </div>

                            {images.length === 0 ? (
                                <div className="text-center py-20 text-gray-400">
                                    {t('gallery.empty')}
                                </div>
                            ) : (
                                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                                    {images.map((img) => {
                                        const isSelected = selectedIds.has(img.id);
                                        return (
                                            <div
                                                key={img.id}
                                                onClick={() => toggleSelection(img.id)}
                                                className={`
                                                    relative aspect-square rounded-xl overflow-hidden cursor-pointer border-2 transition-all group
                                                    ${isSelected
                                                        ? 'border-primary-light dark:border-primary-dark ring-2 ring-primary-light/30'
                                                        : 'border-transparent hover:border-gray-300 dark:hover:border-gray-600'
                                                    }
                                                `}
                                            >
                                                {img.thumbnail ? (
                                                     <img
                                                        src={URL.createObjectURL(img.thumbnail)}
                                                        alt={img.name}
                                                        className="w-full h-full object-cover"
                                                        onLoad={(e) => URL.revokeObjectURL(e.target.src)}
                                                     />
                                                 ) : (
                                                     <div className="w-full h-full bg-gray-200 dark:bg-gray-800 flex items-center justify-center text-gray-400">
                                                         <span className="text-xs break-all px-2">{img.name}</span>
                                                     </div>
                                                 )}

                                                 {/* Selection Checkmark Overlay */}
                                                 <div className={`
                                                    absolute top-2 right-2 p-1 rounded-full transition-all
                                                    ${isSelected ? 'bg-primary-light dark:bg-primary-dark text-white' : 'bg-black/30 text-white/50 group-hover:bg-black/50'}
                                                 `}>
                                                     <Check size={12} strokeWidth={3} />
                                                 </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </>
                    )}
                </div>

                {/* Footer */}
                {!isProcessing && (
                    <div className="p-6 border-t border-gray-200 dark:border-gray-800 flex flex-col sm:flex-row items-center gap-4 justify-between bg-gray-50 dark:bg-gray-900/50 rounded-b-3xl">
                        <label className="flex items-center gap-3 cursor-pointer select-none">
                            <div
                                className={`w-5 h-5 rounded border flex items-center justify-center transition-colors ${
                                    removeAfter
                                    ? 'bg-red-500 border-red-500 text-white'
                                    : 'bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600'
                                }`}
                                onClick={() => setRemoveAfter(!removeAfter)}
                            >
                                {removeAfter && <Check size={14} />}
                            </div>
                            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                                {t('export.remove_after')}
                            </span>
                        </label>

                        <div className="flex items-center gap-3 w-full sm:w-auto">
                            <button
                                onClick={onClose}
                                className="flex-1 sm:flex-none px-6 py-3 rounded-xl text-sm font-bold text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
                            >
                                {t('actions.cancel')}
                            </button>
                            <button
                                onClick={handleExport}
                                disabled={selectedIds.size === 0}
                                className={`
                                    flex-1 sm:flex-none px-8 py-3 rounded-xl text-sm font-bold text-white shadow-lg transition-all flex items-center justify-center gap-2
                                    ${selectedIds.size === 0
                                        ? 'bg-gray-400 dark:bg-gray-700 cursor-not-allowed'
                                        : 'bg-primary-light hover:bg-blue-700 dark:bg-primary-dark dark:hover:bg-blue-400 shadow-primary-light/20'
                                    }
                                `}
                            >
                                {t('export.start')} ({selectedIds.size})
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default BatchExportModal;
