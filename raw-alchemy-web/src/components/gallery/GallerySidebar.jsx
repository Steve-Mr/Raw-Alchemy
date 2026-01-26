import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, Trash2, ChevronLeft, ChevronRight, Image as ImageIcon } from 'lucide-react';
import { useTranslation } from 'react-i18next';

const GallerySidebar = ({
    images,
    selectedId,
    onSelect,
    onDelete,
    onAdd,
    isProcessing,
    isCollapsed,
    setIsCollapsed
}) => {
    const { t } = useTranslation();

    return (
        <motion.div
            animate={{ width: isCollapsed ? 60 : 280 }}
            className="h-full flex flex-col border-r border-border-light dark:border-border-dark bg-surface-light dark:bg-surface-dark z-20 relative transition-colors duration-300 overflow-hidden"
        >
            {/* Header */}
            <div className="p-4 border-b border-border-light dark:border-border-dark flex items-center justify-between h-14">
                {!isCollapsed && (
                    <motion.span
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className="font-bold text-sm tracking-wider uppercase text-gray-500 whitespace-nowrap"
                    >
                        Gallery
                    </motion.span>
                )}
                <button
                    onClick={() => setIsCollapsed(!isCollapsed)}
                    className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors text-gray-500 mx-auto"
                >
                    {isCollapsed ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
                </button>
            </div>

            {/* List */}
            <div className="flex-1 overflow-y-auto custom-scrollbar p-2 space-y-2">
                {images.map(img => (
                    <div
                        key={img.id}
                        onClick={() => onSelect(img.id)}
                        className={`
                            group relative cursor-pointer rounded-xl overflow-hidden border-2 transition-all duration-200
                            ${selectedId === img.id
                                ? 'border-primary-light dark:border-primary-dark bg-gray-50 dark:bg-white/5'
                                : 'border-transparent hover:bg-gray-100 dark:hover:bg-gray-800'
                            }
                        `}
                    >
                        <div className={`flex items-center ${isCollapsed ? 'justify-center p-1' : 'p-2 gap-3'}`}>
                            {/* Thumbnail */}
                            <div className="w-10 h-10 flex-shrink-0 bg-gray-200 dark:bg-gray-700 rounded-lg overflow-hidden relative">
                                {img.thumbnail ? (
                                    <img
                                        src={URL.createObjectURL(img.thumbnail)}
                                        alt={img.name}
                                        className="w-full h-full object-cover"
                                        onLoad={(e) => URL.revokeObjectURL(e.target.src)}
                                    />
                                ) : (
                                    <div className="w-full h-full flex items-center justify-center text-gray-400">
                                        <ImageIcon size={16} />
                                    </div>
                                )}
                            </div>

                            {!isCollapsed && (
                                <div className="flex-1 min-w-0">
                                    <p className={`text-xs font-medium truncate ${selectedId === img.id ? 'text-primary-light dark:text-primary-dark' : 'text-gray-700 dark:text-gray-300'}`}>
                                        {img.name}
                                    </p>
                                    <p className="text-[10px] text-gray-400">
                                        {new Date(img.date).toLocaleDateString()}
                                    </p>
                                </div>
                            )}

                            {/* Delete Button (Hover) */}
                            {!isCollapsed && (
                                <button
                                    onClick={(e) => { e.stopPropagation(); onDelete(img.id); }}
                                    className="opacity-0 group-hover:opacity-100 p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg transition-all"
                                >
                                    <Trash2 size={16} />
                                </button>
                            )}
                        </div>
                    </div>
                ))}
            </div>

            {/* Footer / Add Button */}
            <div className="p-2 border-t border-border-light dark:border-border-dark">
                <button
                    onClick={onAdd}
                    disabled={isProcessing}
                    title="Add Image"
                    className={`
                        w-full flex items-center justify-center gap-2 p-3 rounded-xl
                        ${isProcessing
                            ? 'bg-gray-100 dark:bg-gray-800 cursor-wait'
                            : 'bg-gray-900 dark:bg-white text-white dark:text-black hover:opacity-90 active:scale-95'
                        }
                        transition-all font-medium text-sm
                    `}
                >
                    {isProcessing ? (
                        <div className="w-4 h-4 border-2 border-gray-400 border-t-transparent rounded-full animate-spin" />
                    ) : (
                        <Plus size={20} />
                    )}
                    {!isCollapsed && <span>Add</span>}
                </button>
            </div>
        </motion.div>
    );
};

export default GallerySidebar;
