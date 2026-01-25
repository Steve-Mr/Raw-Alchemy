import React from 'react';
import { Image as ImageIcon, X, Check } from 'lucide-react';

const GalleryThumbnail = ({ image, isActive, isSelected, onClick, onRemove, selectionMode }) => {
  return (
    <div
      className={`
        relative group cursor-pointer rounded-lg overflow-hidden border-2 transition-all flex-shrink-0
        ${isActive && !selectionMode ? 'border-primary-500 ring-2 ring-primary-500/30' : 'border-transparent hover:border-gray-300 dark:hover:border-gray-600'}
        ${isSelected ? 'ring-2 ring-primary-500 border-primary-500' : ''}
        bg-gray-200 dark:bg-gray-800 aspect-square
      `}
      onClick={onClick}
    >
      {image.thumbnail ? (
        <img src={image.thumbnail} alt={image.name} className="w-full h-full object-cover" />
      ) : (
        <div className="w-full h-full flex flex-col items-center justify-center text-gray-400 p-2">
          <ImageIcon size={24} className="mb-2 opacity-50" />
          <span className="text-[10px] leading-tight text-center break-all w-full line-clamp-2 px-1">
            {image.name}
          </span>
        </div>
      )}

      {/* Selection Overlay */}
      {selectionMode && (
         <div className={`absolute inset-0 bg-black/20 flex items-center justify-center transition-opacity ${isSelected ? 'opacity-100' : 'opacity-0 hover:opacity-100'}`}>
            <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center ${isSelected ? 'bg-primary-500 border-primary-500 text-white' : 'bg-black/50 border-white text-transparent'}`}>
                <Check size={14} />
            </div>
         </div>
      )}

      {/* Remove Button (Hover) - Only when NOT in selection mode */}
      {!selectionMode && (
        <button
            onClick={(e) => {
            e.stopPropagation();
            onRemove();
            }}
            className="absolute top-1 right-1 p-1 bg-black/50 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-500"
            title="Remove"
        >
            <X size={12} />
        </button>
      )}
    </div>
  );
};

export default GalleryThumbnail;
