import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'framer-motion';
import { Settings, Sliders, Palette, Download, Info, Image as ImageIcon, ChevronRight } from 'lucide-react';
import ThemeToggle from '../ThemeToggle';
import LanguageToggle from '../LanguageToggle';
import InfoModal from '../InfoModal';

const ResponsiveLayout = ({
  children, // The Image Component
  controls, // { basic, tone, color, export }
  gallerySidebar, // The Gallery Component
  loading,
  error
}) => {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState('basic');
  const [isMobile, setIsMobile] = useState(false);
  const [showInfo, setShowInfo] = useState(false);
  const [isGalleryCollapsed, setIsGalleryCollapsed] = useState(false);

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 1024);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Update tabs for mobile: Add Gallery, Remove Advanced (merged into Color)
  const tabs = [
    { id: 'gallery', label: t('gallery', 'Gallery'), icon: ImageIcon },
    { id: 'basic', label: t('tabs.basic'), icon: Settings },
    { id: 'tone', label: t('tabs.tone'), icon: Sliders },
    { id: 'color', label: t('tabs.color'), icon: Palette },
    { id: 'export', label: t('tabs.export'), icon: Download },
  ];

  const renderContent = () => {
    if (activeTab === 'gallery') return gallerySidebar; // For mobile
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

            <div className="w-full h-full p-2">
                 {children}
            </div>
        </div>

        {/* Middle: Controls Content (Scrollable) */}
        <div className="h-[45vh] bg-surface-light dark:bg-surface-dark flex flex-col border-t border-border-light dark:border-border-dark relative z-20 shadow-[0_-4px_20px_rgba(0,0,0,0.1)]">
            <div className="flex-1 overflow-y-auto custom-scrollbar p-0"> {/* Removed padding to fit gallery nicely */}
                <AnimatePresence mode="wait">
                    <motion.div
                        key={activeTab}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                        transition={{ duration: 0.15 }}
                        className="h-full"
                    >
                         {activeTab === 'gallery' ? (
                            // Render Gallery Sidebar in mobile mode (custom styling potentially needed)
                            <div className="h-full overflow-hidden">
                                {React.cloneElement(gallerySidebar, { isMobile: true })}
                            </div>
                         ) : (
                            <div className="p-5">
                                {renderContent()}
                            </div>
                         )}
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

  // DESKTOP LAYOUT (3-Column)
  return (
    <div className="flex h-screen w-screen bg-surface-light dark:bg-surface-dark text-gray-900 dark:text-gray-100 overflow-hidden font-sans">
      <InfoModal isOpen={showInfo} onClose={() => setShowInfo(false)} />

      {/* LEFT PANEL: GALLERY */}
      {/* We use React.cloneElement or pass props if we want to control collapse state from here,
          but GallerySidebar already accepts isCollapsed props.
          We need to ensure the width transitions correctly.
      */}
      <div className="shrink-0 h-full z-30 shadow-xl">
         {React.cloneElement(gallerySidebar, {
             isCollapsed: isGalleryCollapsed,
             setIsCollapsed: setIsGalleryCollapsed
         })}
      </div>

      {/* MIDDLE PANEL: CANVAS */}
      <div className="flex-1 flex flex-col bg-gray-100 dark:bg-black/95 relative overflow-hidden transition-colors duration-300">
         {isGalleryCollapsed && (
             <button
                 onClick={() => setIsGalleryCollapsed(false)}
                 className="absolute top-1/2 left-0 transform -translate-y-1/2 z-40 p-2 bg-white dark:bg-zinc-900 rounded-r-xl shadow-md border border-l-0 border-gray-200 dark:border-gray-800 text-gray-500 hover:text-primary-500 transition-colors"
             >
                 <ChevronRight size={20} />
             </button>
         )}
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

         <main className="flex-1 flex items-center justify-center p-4 overflow-hidden relative">
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
                    <div className="bg-surface-light/95 dark:bg-gray-900/50 p-12 rounded-3xl shadow-xl border border-gray-100 dark:border-gray-800 text-center backdrop-blur-sm opacity-50">
                        <div className="mb-6 flex justify-center text-gray-300 dark:text-gray-600">
                            <Palette size={64} strokeWidth={1} />
                        </div>
                        <h2 className="text-2xl font-bold mb-2 tracking-tighter text-gray-900 dark:text-white">
                            Select an Image
                        </h2>
                        <p className="text-sm text-gray-500">
                            Choose an image from the gallery to start editing.
                        </p>
                    </div>
                </motion.div>
            )}
         </main>
      </div>

      {/* RIGHT PANEL: CONTROLS */}
      <div className="w-[380px] xl:w-[420px] flex flex-col border-l border-border-light dark:border-border-dark bg-surface-light dark:bg-surface-dark z-20 shadow-2xl shrink-0">
         <div className="flex-1 overflow-y-auto custom-scrollbar p-6 space-y-8">
            {children ? (
                <div className="space-y-8">
                    <section>{controls.basic}</section>
                    <section>{controls.tone}</section>
                    <section>{controls.color}</section>
                    <section>{controls.export}</section>
                    {/* Advanced is now inside Color */}
                </div>
            ) : (
                <div className="h-full flex flex-col items-center justify-center text-gray-300 dark:text-gray-700 space-y-4 opacity-50">
                    <Sliders size={48} strokeWidth={1} />
                    <p className="text-sm font-medium">Controls disabled</p>
                </div>
            )}
         </div>
      </div>
    </div>
  );
};

export default ResponsiveLayout;
