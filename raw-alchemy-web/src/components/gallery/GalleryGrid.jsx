import React from 'react';
import { Plus, Trash2, Image as ImageIcon } from 'lucide-react';
import { useTranslation } from 'react-i18next';

const GalleryGrid = ({
    images,
    selectedId,
    onSelect,
    onDelete,
    onAdd,
    isProcessing,
    showAddButton // Controlled by parent (RawUploader)
}) => {
    const { t } = useTranslation();

    return (
        <div className="h-full flex flex-col p-4 bg-surface-light dark:bg-surface-dark relative">
             <div className="flex items-center justify-between mb-4">
                 <h2 className="text-lg font-bold text-gray-900 dark:text-white">{t('gallery.title')}</h2>
                 <span className="text-xs text-gray-500">{images.length} / 15</span>
             </div>

             {images.length === 0 && !showAddButton ? (
                 <div className="flex-1 flex flex-col items-center justify-center text-gray-400 opacity-60 pb-20">
                     <ImageIcon size={48} strokeWidth={1} className="mb-3" />
                     <span className="text-sm font-medium">{t('gallery.empty')}</span>
                 </div>
             ) : (
                 <div className="grid grid-cols-3 gap-3 overflow-y-auto pb-20 custom-scrollbar">
                     {/* Add Button Tile */}
                     {showAddButton && (
                         <button
                            onClick={onAdd}
                            disabled={isProcessing}
                            className="aspect-square rounded-xl border-2 border-dashed border-gray-300 dark:border-gray-700 flex flex-col items-center justify-center gap-2 hover:border-primary-light dark:hover:border-primary-dark hover:bg-gray-50 dark:hover:bg-white/5 transition-all"
                         >
                             {isProcessing ? (
                                 <div className="w-6 h-6 border-2 border-gray-400 border-t-transparent rounded-full animate-spin" />
                             ) : (
                                 <>
                                    <Plus size={24} className="text-gray-400" />
                                    <span className="text-xs font-medium text-gray-500">{t('gallery.add')}</span>
                                 </>
                             )}
                         </button>
                     )}

                     {images.map(img => (
                         <div
                            key={img.id}
                            className={`
                                relative aspect-square rounded-xl overflow-hidden cursor-pointer border-2 transition-all group
                                ${selectedId === img.id ? 'border-primary-light dark:border-primary-dark ring-2 ring-primary-light/50' : 'border-transparent'}
                            `}
                            onClick={() => onSelect(img.id)}
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
                                     <ImageIcon size={24} />
                                 </div>
                             )}

                             <button
                                onClick={(e) => { e.stopPropagation(); onDelete(img.id); }}
                                className="absolute top-1 right-1 p-1.5 bg-black/50 text-white rounded-full hover:bg-red-500 transition-colors backdrop-blur-sm"
                             >
                                 <Trash2 size={14} />
                             </button>

                             {/* Selection Indicator Overlay */}
                             {selectedId === img.id && (
                                 <div className="absolute inset-0 bg-primary-light/20 dark:bg-primary-dark/20 pointer-events-none" />
                             )}
                         </div>
                     ))}
                 </div>
             )}
        </div>
    );
};

export default GalleryGrid;
