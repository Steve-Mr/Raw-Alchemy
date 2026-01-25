import React, { useState } from 'react';
import GalleryThumbnail from './GalleryThumbnail';
import { Plus, CheckSquare, Trash2, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';

const GalleryPanel = ({
    images,
    activeId,
    onSelect,
    onRemove,
    onAdd,
    orientation = 'vertical',
    className = '',
    selectionMode,
    setSelectionMode,
    selectedIds,
    setSelectedIds
}) => {
  const { t } = useTranslation();
  const isVertical = orientation === 'vertical';

  const toggleSelection = (id) => {
      setSelectedIds(prev =>
          prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
      );
  };

  const handleThumbnailClick = (id) => {
      if (selectionMode) {
          toggleSelection(id);
      } else {
          onSelect(id);
      }
  };

  const handleDeleteSelected = () => {
      if (confirm(t('confirmDelete', 'Delete selected images?'))) {
          selectedIds.forEach(id => onRemove(id));
          setSelectedIds([]);
          setSelectionMode(false);
      }
  };

  return (
    <div className={`flex flex-col h-full ${className}`}>
        {/* Header (Only visible in vertical/drawer mode usually, but useful everywhere) */}
        <div className="flex items-center justify-between px-4 py-2 border-b border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-black/20">
            {selectionMode ? (
                <div className="flex items-center gap-2 w-full">
                    <button onClick={() => { setSelectionMode(false); setSelectedIds([]); }} className="text-gray-500 hover:text-gray-700 dark:text-gray-400">
                        <X size={16} />
                    </button>
                    <span className="text-xs font-medium text-gray-600 dark:text-gray-300 flex-1">
                        {selectedIds.length} Selected
                    </span>
                    <button
                        onClick={handleDeleteSelected}
                        disabled={selectedIds.length === 0}
                        className="text-red-500 hover:text-red-600 disabled:opacity-50"
                    >
                        <Trash2 size={16} />
                    </button>
                </div>
            ) : (
                <div className="flex items-center justify-between w-full">
                     <span className="text-xs font-bold uppercase tracking-wider text-gray-500">
                        {t('tabs.gallery')} ({images.length})
                     </span>
                     <button
                        onClick={() => setSelectionMode(true)}
                        className="text-gray-400 hover:text-primary-500 transition-colors"
                        title="Select"
                        disabled={images.length === 0}
                     >
                        <CheckSquare size={16} />
                     </button>
                </div>
            )}
        </div>

        {/* Scrollable Grid */}
        <div
            className={`
                flex-1 p-3 overflow-y-auto custom-scrollbar
                grid ${isVertical ? 'grid-cols-2' : 'grid-flow-col auto-cols-max grid-rows-1'} gap-3
                content-start
            `}
        >
        {/* Add Button */}
        <div
            onClick={onAdd}
            className={`
                flex flex-col items-center justify-center cursor-pointer rounded-lg border-2 border-dashed border-gray-300 dark:border-gray-700
                text-gray-400 hover:text-primary-500 hover:border-primary-500 transition-colors group
                aspect-square bg-gray-50 dark:bg-gray-900/50
                ${isVertical ? 'w-full' : 'w-24 h-24'}
            `}
            title={t('actions.addImages')}
        >
            <Plus size={24} className="group-hover:scale-110 transition-transform duration-200" />
            <span className="text-[10px] mt-1 font-medium">{t('actions.add')}</span>
        </div>

        {images.map(img => (
            <GalleryThumbnail
                key={img.id}
                image={img}
                isActive={img.id === activeId}
                isSelected={selectedIds.includes(img.id)}
                selectionMode={selectionMode}
                onClick={() => handleThumbnailClick(img.id)}
                onRemove={() => onRemove(img.id)}
            />
        ))}
        </div>
    </div>
  );
};

export default GalleryPanel;
