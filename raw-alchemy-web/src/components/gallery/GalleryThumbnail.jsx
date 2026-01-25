import React from 'react';
import { Image as ImageIcon, X } from 'lucide-react';

const GalleryThumbnail = ({ image, isActive, onClick, onRemove }) => {
  return (
    <div
      className={`
        relative group cursor-pointer rounded-lg overflow-hidden border-2 transition-all flex-shrink-0
        ${isActive ? 'border-primary-500 ring-2 ring-primary-500/30' : 'border-transparent hover:border-gray-300 dark:hover:border-gray-600'}
        w-24 h-24 bg-gray-200 dark:bg-gray-800
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

      {/* Remove Button (Hover) */}
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
    </div>
  );
};

export default GalleryThumbnail;
