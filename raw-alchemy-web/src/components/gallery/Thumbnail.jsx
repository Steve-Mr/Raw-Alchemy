import React, { useMemo } from 'react';
import { X } from 'lucide-react';

const Thumbnail = ({ image, isActive, onClick, onDelete }) => {
    // image.thumbnail is a Blob
    const thumbUrl = useMemo(() => {
        if (!image.thumbnail) return null;
        return URL.createObjectURL(image.thumbnail);
    }, [image.thumbnail]);

    return (
        <div
            className={`group relative flex flex-col gap-2 p-2 rounded-xl transition-all cursor-pointer border border-transparent
                ${isActive ? 'bg-zinc-100 dark:bg-zinc-800 border-primary-light dark:border-primary-dark shadow-sm' : 'hover:bg-zinc-50 dark:hover:bg-zinc-900/50'}
            `}
            onClick={() => onClick(image.id)}
        >
            <div className="relative aspect-[3/2] bg-zinc-200 dark:bg-zinc-950 rounded-lg overflow-hidden shadow-sm">
                {thumbUrl ? (
                    <img src={thumbUrl} alt={image.filename} className="w-full h-full object-cover" />
                ) : (
                    <div className="w-full h-full flex items-center justify-center text-xs text-gray-400">
                        Pending...
                    </div>
                )}

                {/* Delete Button */}
                <button
                    onClick={(e) => {
                        e.stopPropagation();
                        onDelete(image.id);
                    }}
                    className="absolute top-1 right-1 p-1 bg-black/50 text-white rounded-full opacity-0 group-hover:opacity-100 hover:bg-red-500 transition-all transform hover:scale-110"
                    title="Delete"
                >
                    <X size={12} strokeWidth={3} />
                </button>
            </div>

            <div className="px-1">
                <p className={`text-xs font-medium truncate ${isActive ? 'text-primary-600 dark:text-primary-400' : 'text-gray-700 dark:text-gray-300'}`}>
                    {image.filename}
                </p>
                <p className="text-[10px] text-gray-400">
                    {image.width} x {image.height}
                </p>
            </div>
        </div>
    );
};

export default Thumbnail;
