import React from 'react';
import GalleryThumbnail from './GalleryThumbnail';
import { Plus } from 'lucide-react';
import { useTranslation } from 'react-i18next';

const GalleryPanel = ({ images, activeId, onSelect, onRemove, onAdd, orientation = 'vertical', className = '' }) => {
  const { t } = useTranslation();
  const isVertical = orientation === 'vertical';

  return (
    <div
        className={`
            flex ${isVertical ? 'flex-col' : 'flex-row'} gap-3 p-4
            overflow-x-auto overflow-y-auto custom-scrollbar
            ${className}
        `}
    >
       {/* Add Button */}
       <div
         onClick={onAdd}
         className={`
            flex flex-col items-center justify-center cursor-pointer rounded-lg border-2 border-dashed border-gray-300 dark:border-gray-700
            text-gray-400 hover:text-primary-500 hover:border-primary-500 transition-colors flex-shrink-0 group
            ${isVertical ? 'w-24 h-24' : 'w-24 h-24'}
            bg-gray-50 dark:bg-gray-900/50
         `}
         title={t('actions.addImages') || "Add Images"}
       >
          <Plus size={24} className="group-hover:scale-110 transition-transform duration-200" />
          <span className="text-[10px] mt-1 font-medium">{t('actions.add') || "Add"}</span>
       </div>

       {images.map(img => (
         <GalleryThumbnail
            key={img.id}
            image={img}
            isActive={img.id === activeId}
            onClick={() => onSelect(img.id)}
            onRemove={() => onRemove(img.id)}
         />
       ))}
    </div>
  );
};

export default GalleryPanel;
