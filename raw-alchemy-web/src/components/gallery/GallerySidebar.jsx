import React, { useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Upload, ChevronLeft, Image as ImageIcon, Loader2 } from 'lucide-react';
import Thumbnail from './Thumbnail';
import { motion } from 'framer-motion';

const GallerySidebar = ({
    images,
    activeId,
    onSelect,
    onDelete,
    onUpload,
    processingQueue,
    isCollapsed,
    setIsCollapsed,
    className,
    isMobile = false
}) => {
    const { t } = useTranslation();
    const fileInputRef = useRef(null);

    const handleFileSelect = (e) => {
        if (e.target.files && e.target.files.length > 0) {
            onUpload(e.target.files);
        }
        e.target.value = ''; // Reset
    };

    const ProcessingItem = ({ item }) => (
        <div className="flex items-center gap-3 p-3 rounded-xl bg-zinc-50 dark:bg-zinc-900/50 border border-zinc-100 dark:border-zinc-800/50 opacity-70">
            <div className="w-10 h-10 rounded-lg bg-zinc-200 dark:bg-zinc-800 flex items-center justify-center">
                <Loader2 size={16} className="animate-spin text-gray-400" />
            </div>
            <div className="flex-1 overflow-hidden">
                <p className="text-xs font-medium truncate text-gray-500">{item.file.name}</p>
                <p className="text-[10px] text-gray-400">Processing...</p>
            </div>
        </div>
    );

    const content = (
        <div className={`flex flex-col h-full overflow-hidden ${isMobile ? 'w-full' : 'w-[280px]'}`}>
             {/* Header - Only show on Desktop for collapse */}
             {!isMobile && (
                <div className="p-4 border-b border-border-light dark:border-border-dark flex items-center justify-between shrink-0">
                    <h2 className="text-sm font-bold text-gray-900 dark:text-white flex items-center gap-2">
                        <ImageIcon size={16} className="text-primary-500" />
                        {t('gallery', 'Gallery')}
                    </h2>
                    <button
                        onClick={() => setIsCollapsed(true)}
                        className="p-1 text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors"
                    >
                        <ChevronLeft size={18} />
                    </button>
                </div>
             )}

            {/* Upload Area */}
            <div className="p-4 shrink-0">
                <input
                    ref={fileInputRef}
                    type="file"
                    multiple
                    className="hidden"
                    accept=".ARW,.CR2,.CR3,.DNG,.NEF,.ORF,.RAF"
                    onChange={handleFileSelect}
                />
                <button
                    onClick={() => fileInputRef.current?.click()}
                    className="w-full flex items-center justify-center gap-2 py-2.5 px-4 bg-primary-600 hover:bg-primary-700 text-white rounded-xl shadow-sm transition-all active:scale-95 text-xs font-medium"
                >
                    <Upload size={14} />
                    {t('addImages', 'Add Images')}
                </button>
            </div>

            {/* List */}
            <div className="flex-1 overflow-y-auto custom-scrollbar p-3 space-y-2">
                {/* Processing Queue */}
                {processingQueue.map(item => (
                    <ProcessingItem key={item.id} item={item} />
                ))}

                {/* Image List */}
                {images.length === 0 && processingQueue.length === 0 ? (
                    <div className="text-center py-10 px-4">
                        <p className="text-xs text-gray-400 leading-relaxed">
                            {t('emptyGallery', 'No images yet. Upload some RAW files to get started.')}
                        </p>
                    </div>
                ) : (
                    images.map(img => (
                        <Thumbnail
                            key={img.id}
                            image={img}
                            isActive={activeId === img.id}
                            onClick={onSelect}
                            onDelete={onDelete}
                        />
                    ))
                )}
            </div>

            {/* Stats Footer */}
            <div className="p-2 text-center border-t border-border-light dark:border-border-dark shrink-0">
                <p className="text-[10px] text-gray-400">
                    {images.length} photos
                </p>
            </div>
        </div>
    );

    if (isMobile) {
         return (
             <div className={`relative h-full flex flex-col bg-surface-light dark:bg-surface-dark ${className || ''}`}>
                 {content}
             </div>
         );
    }

    return (
        <motion.div
            className={`relative h-full flex flex-col bg-surface-light dark:bg-surface-dark border-r border-border-light dark:border-border-dark transition-all duration-300 ${className || ''}`}
            initial={false}
            animate={{ width: isCollapsed ? 0 : 280 }}
        >
             {content}
        </motion.div>
    );
};

export default GallerySidebar;
