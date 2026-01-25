import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'framer-motion';
import { Settings, Sliders, Palette, Download, Zap, Info, Images } from 'lucide-react';
import ThemeToggle from '../ThemeToggle';
import LanguageToggle from '../LanguageToggle';
import InfoModal from '../InfoModal';

const ResponsiveLayout = ({
  children, // The Image Component
  controls, // { basic, tone, color, export, advanced }
  gallery, // The Gallery Component (GalleryPanel)
  fileInput,
  loading,
  error
}) => {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState('gallery');
  const [isMobile, setIsMobile] = useState(false);
  const [isWide, setIsWide] = useState(false);
  const [showInfo, setShowInfo] = useState(false);

  useEffect(() => {
    const handleResize = () => {
        setIsMobile(window.innerWidth < 1024);
        setIsWide(window.innerWidth >= 1440);
    };
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const tabs = [
    { id: 'gallery', label: t('tabs.gallery') || 'Gallery', icon: Images },
    { id: 'basic', label: t('tabs.basic'), icon: Settings },
    { id: 'tone', label: t('tabs.tone'), icon: Sliders },
    { id: 'color', label: t('tabs.color'), icon: Palette },
    { id: 'export', label: t('tabs.export'), icon: Download },
  ];

  const renderMobileContent = () => {
    if (activeTab === 'gallery') {
         return gallery ? React.cloneElement(gallery, { orientation: 'vertical', className: 'h-full' }) : null;
    }
    if (activeTab === 'color') {
        return (
            <div className="space-y-8">
                {controls.color}
                <div className="pt-4 border-t border-gray-200 dark:border-gray-800">
                     <h3 className="text-sm font-bold mb-4 flex items-center gap-2 text-gray-900 dark:text-white">
                        <Zap size={16} />
                        {t('tabs.advanced')}
                     </h3>
                     {controls.advanced}
                </div>
            </div>
        );
    }
    return controls[activeTab] || null;
  };

  const handleInfoClick = () => setShowInfo(true);

  if (isMobile) {
    // MOBILE: Bottom Navigation Layout
    return (
      <div className="flex flex-col h-[100dvh] w-screen overflow-hidden bg-surface-light dark:bg-surface-dark text-gray-900 dark:text-gray-100">
        <InfoModal isOpen={showInfo} onClose={() => setShowInfo(false)} />

        {/* Top: Image Area (Flexible Height) */}
        <div className="flex-1 relative bg-gray-100 dark:bg-black/95 flex items-center justify-center overflow-hidden transition-colors duration-300">
             {/* Header Overlay */}
            <header
              className="absolute top-0 left-0 right-0 p-3 flex justify-between items-center z-10 pointer-events-none"
              style={{ paddingTop: 'max(0.75rem, env(safe-area-inset-top))' }}
            >
                <h1 className="text-xs font-bold text-gray-900 dark:text-white pointer-events-auto backdrop-blur-md bg-white/30 dark:bg-black/30 px-3 py-1.5 rounded-full border border-transparent dark:border-white/10 uppercase tracking-widest shadow-sm transition-colors">
                    {t('appTitle')}
                </h1>
                <div className="flex items-center gap-2 pointer-events-auto backdrop-blur-md bg-white/30 dark:bg-black/30 px-3 py-1.5 rounded-full border border-transparent dark:border-white/10 transition-colors text-gray-900 dark:text-white">
                    <button
                        onClick={handleInfoClick}
                        className="p-1 hover:text-primary-light dark:hover:text-primary-dark transition-colors"
                        title="Info"
                    >
                        <Info size={16} />
                    </button>
                    <div className="w-px h-3 bg-gray-400/50 dark:bg-white/20"></div>
                    <LanguageToggle />
                    <ThemeToggle />
                </div>
            </header>

            {loading && (
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/60 z-30 backdrop-blur-sm">
                    <div className="w-10 h-10 border-2 border-white/20 border-t-white rounded-full animate-spin mb-3"></div>
                    <span className="text-xs font-medium text-white tracking-wider animate-pulse">{t('loadingDecoding')}</span>
                </div>
            )}

            {error && (
                 <div className="absolute top-16 left-4 right-4 p-3 bg-red-500/90 text-white rounded-xl z-30 text-xs shadow-lg backdrop-blur-md">
                    <strong>{t('error')}:</strong> {error}
                </div>
            )}

            {!children ? (
                <div className="w-full px-6">
                     {fileInput}
                </div>
            ) : (
                <div className="w-full h-full p-2">
                     {children}
                </div>
            )}
        </div>

        {/* Middle: Controls Content (Scrollable) */}
        <div className="h-[45vh] bg-surface-light dark:bg-surface-dark flex flex-col border-t border-border-light dark:border-border-dark relative z-20 shadow-[0_-4px_20px_rgba(0,0,0,0.1)]">
            <div className="flex-1 overflow-y-auto custom-scrollbar p-5">
                <AnimatePresence mode="wait">
                    <motion.div
                        key={activeTab}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                        transition={{ duration: 0.15 }}
                        className="h-full"
                    >
                         {renderMobileContent()}
                    </motion.div>
                </AnimatePresence>
            </div>
        </div>

        {/* Bottom: Tab Navigation Bar (Fixed) */}
        <div className="flex-none bg-surface-light dark:bg-surface-dark border-t border-border-light dark:border-border-dark">
            <div
              className="flex items-stretch"
              style={{
                  height: 'calc(4rem + env(safe-area-inset-bottom))',
                  paddingBottom: 'env(safe-area-inset-bottom)'
              }}
            >
                {tabs.map((tab) => {
                    const isActive = activeTab === tab.id;
                    return (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id)}
                            className={`flex-1 flex flex-col items-center justify-center gap-1 transition-colors relative
                                ${isActive ? 'text-primary-light dark:text-primary-dark' : 'text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300'}
                            `}
                        >
                            <tab.icon size={20} strokeWidth={isActive ? 2.5 : 2} />
                            <span className="text-[10px] font-medium">{tab.label}</span>
                            {isActive && (
                                <motion.div
                                    layoutId="activeTabIndicatorMobile"
                                    className="absolute top-0 w-8 h-1 rounded-b-full bg-primary-light dark:bg-primary-dark"
                                />
                            )}
                        </button>
                    );
                })}
            </div>
        </div>
      </div>
    );
  }

  // DESKTOP LAYOUT
  return (
    <div className="flex h-screen w-screen bg-surface-light dark:bg-surface-dark text-gray-900 dark:text-gray-100 overflow-hidden font-sans">
      <InfoModal isOpen={showInfo} onClose={() => setShowInfo(false)} />

      {/* Left Panel: Gallery (Only if Wide) */}
      {isWide && (
        <div className="w-80 flex-shrink-0 flex flex-col border-r border-border-light dark:border-border-dark bg-gray-50 dark:bg-black/40 z-20 transition-all">
            {/* Header handled by GalleryPanel now */}
            <div className="flex-1 overflow-hidden relative">
                {gallery && React.cloneElement(gallery, { orientation: 'vertical', className: 'h-full w-full' })}
            </div>
        </div>
      )}

      {/* Middle Panel: Image Viewer */}
      <div className="flex-1 flex flex-col bg-gray-100 dark:bg-black/95 relative overflow-hidden transition-colors duration-300">
         <header className="absolute top-0 left-0 right-0 p-6 flex justify-between items-center z-10 pointer-events-none">
            <h1 className="text-sm font-bold text-gray-900 dark:text-white pointer-events-auto backdrop-blur-md bg-white/50 dark:bg-black/50 px-4 py-2 rounded-full border border-gray-200 dark:border-white/10 shadow-sm transition-colors">
                {t('appTitle')}
            </h1>
            <div className="flex items-center gap-3 pointer-events-auto backdrop-blur-md bg-white/50 dark:bg-black/50 px-4 py-1.5 rounded-full border border-gray-200 dark:border-white/10 shadow-sm text-gray-900 dark:text-white transition-colors">
                <button
                    onClick={handleInfoClick}
                    className="p-1 hover:text-primary-light dark:hover:text-primary-dark transition-colors"
                    title="Info"
                >
                    <Info size={18} />
                </button>
                <div className="w-px h-4 bg-gray-300 dark:bg-white/20"></div>
                <LanguageToggle />
                <div className="w-px h-4 bg-gray-300 dark:bg-white/20"></div>
                <ThemeToggle />
            </div>
         </header>

         <main className="flex-1 flex flex-col overflow-hidden relative">
            <div className="flex-1 relative flex items-center justify-center p-4">
                 {loading && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/60 z-30 backdrop-blur-sm text-white">
                        <div className="w-12 h-12 border-4 border-white/20 border-t-white rounded-full animate-spin mb-4"></div>
                        <span className="text-sm font-bold tracking-widest uppercase">{t('loadingDecoding')}</span>
                    </div>
                )}
                 {error && (
                     <div className="absolute top-24 left-1/2 transform -translate-x-1/2 bg-red-500 text-white px-6 py-3 rounded-xl shadow-xl z-30 flex items-center gap-3">
                        <div className="bg-white/20 p-1 rounded-full">!</div>
                        <strong>{t('error')}:</strong> {error}
                    </div>
                )}

                {children ? (
                     <motion.div
                        initial={{ opacity: 0, scale: 0.98 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ duration: 0.4 }}
                        className="relative w-full h-full flex items-center justify-center shadow-2xl rounded-2xl overflow-hidden border border-transparent"
                     >
                         {children}
                     </motion.div>
                ) : (
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.5 }}
                        className="flex flex-col items-center justify-center max-w-md w-full"
                    >
                        <div className="bg-surface-light/95 dark:bg-gray-900/50 p-12 rounded-3xl shadow-xl border border-gray-100 dark:border-gray-800 text-center backdrop-blur-sm">
                            <div className="mb-6 flex justify-center text-gray-300 dark:text-gray-600">
                                <Palette size={64} strokeWidth={1} />
                            </div>
                            <h2 className="text-3xl font-bold mb-3 tracking-tighter text-gray-900 dark:text-white">
                                {t('appTitle')}
                            </h2>
                            <p className="text-sm font-bold text-blue-600 dark:text-blue-400 uppercase tracking-[0.2em] mb-10">
                                {t('slogan')}
                            </p>
                            {fileInput}
                        </div>
                    </motion.div>
                )}
            </div>

            {/* Standard Desktop: Bottom Gallery Strip (If NOT Wide and has images) */}
            {!isWide && children && gallery && (
                <div className="h-32 flex-shrink-0 bg-surface-light dark:bg-surface-dark border-t border-border-light dark:border-border-dark z-20 shadow-[0_-4px_20px_rgba(0,0,0,0.1)] relative">
                    {React.cloneElement(gallery, { orientation: 'horizontal', className: 'h-full w-full' })}
                </div>
            )}
         </main>
      </div>

      {/* Right Panel: Controls Sidebar */}
      <div className="w-[380px] xl:w-[420px] flex flex-col border-l border-border-light dark:border-border-dark bg-surface-light dark:bg-surface-dark z-20 shadow-2xl">
         <div className="flex-1 overflow-y-auto custom-scrollbar p-6 space-y-8">
            {children ? (
                <div className="space-y-8">
                    <section>{controls.basic}</section>
                    <section>{controls.tone}</section>
                    <section>{controls.color}</section>
                    <section>{controls.export}</section>
                    <section>{controls.advanced}</section>
                </div>
            ) : (
                <div className="h-full flex flex-col items-center justify-center text-gray-300 dark:text-gray-700 space-y-4 opacity-50">
                    <Sliders size={48} strokeWidth={1} />
                    <p className="text-sm font-medium">Load an image to access controls</p>
                </div>
            )}
         </div>

         <div className="p-4 border-t border-border-light dark:border-border-dark text-center">
             <p className="text-[10px] text-gray-400 font-medium tracking-wide uppercase">
                 {t('appTitle')} &copy; {new Date().getFullYear()}
             </p>
         </div>
      </div>
    </div>
  );
};

export default ResponsiveLayout;
