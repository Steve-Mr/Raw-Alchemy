import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'framer-motion';
import { Settings, Sliders, Palette, Download, Zap } from 'lucide-react';
import ThemeToggle from '../ThemeToggle';
import LanguageToggle from '../LanguageToggle';

const ResponsiveLayout = ({
  children, // The Image Component
  controls, // { basic, tone, color, export, advanced }
  fileInput,
  loading,
  error
}) => {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState('basic');
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 1024);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  const tabs = [
    { id: 'basic', label: t('tabs.basic'), icon: Settings },
    { id: 'tone', label: t('tabs.tone'), icon: Sliders },
    { id: 'color', label: t('tabs.color'), icon: Palette },
    { id: 'export', label: t('tabs.export'), icon: Download },
    // Advanced is now a first-class citizen in mobile tabs
    { id: 'advanced', label: t('tabs.advanced'), icon: Zap },
  ];

  const renderContent = () => {
    return controls[activeTab] || null;
  };

  if (isMobile) {
    // MOBILE: Bottom Navigation Layout
    // Use h-[100dvh] to handle mobile browser address bars correctly
    return (
      <div className="flex flex-col h-[100dvh] w-screen overflow-hidden bg-surface-light dark:bg-surface-dark text-gray-900 dark:text-gray-100">

        {/* Top: Image Area (Flexible Height) */}
        <div className="flex-1 relative bg-black/95 flex items-center justify-center overflow-hidden">
             {/* Header Overlay */}
            <header className="absolute top-0 left-0 right-0 p-3 flex justify-between items-center z-10 pointer-events-none">
                <h1 className="text-xs font-bold text-white/50 pointer-events-auto backdrop-blur-md bg-black/20 px-2 py-1 rounded-lg uppercase tracking-widest">
                    {t('appTitle')}
                </h1>
                <div className="flex items-center gap-2 pointer-events-auto backdrop-blur-md bg-black/20 px-2 py-1 rounded-lg">
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
        {/* We use a fixed height container or flex basis to ensure it doesn't push the nav bar off screen */}
        <div className="h-[45vh] bg-surface-light dark:bg-surface-dark flex flex-col border-t border-border-light dark:border-border-dark relative z-20 shadow-[0_-4px_20px_rgba(0,0,0,0.1)]">
            <div className="flex-1 overflow-y-auto custom-scrollbar p-5">
                <AnimatePresence mode="wait">
                    <motion.div
                        key={activeTab}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                        transition={{ duration: 0.15 }}
                    >
                         {renderContent()}
                    </motion.div>
                </AnimatePresence>
            </div>
        </div>

        {/* Bottom: Tab Navigation Bar (Fixed) */}
        <div className="flex-none bg-surface-light dark:bg-surface-dark border-t border-border-light dark:border-border-dark pb-safe">
            <div className="flex items-stretch h-16">
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

  // DESKTOP LAYOUT (Sidebar)
  return (
    <div className="flex h-screen w-screen bg-surface-light dark:bg-surface-dark text-gray-900 dark:text-gray-100 overflow-hidden font-sans">

      {/* Left Panel: Image Viewer */}
      {/* Always use dark background for image viewing to reduce glare and improve perception */}
      <div className="flex-1 flex flex-col bg-zinc-900 dark:bg-black/95 relative overflow-hidden">
         <header className="absolute top-0 left-0 right-0 p-6 flex justify-between items-center z-10 pointer-events-none">
            <h1 className="text-sm font-bold text-white pointer-events-auto backdrop-blur-md bg-black/50 px-4 py-2 rounded-full border border-white/10 shadow-sm">
                {t('appTitle')}
            </h1>
            <div className="flex items-center gap-3 pointer-events-auto backdrop-blur-md bg-black/50 px-3 py-1.5 rounded-full border border-white/10 shadow-sm text-white">
                <LanguageToggle />
                <div className="w-px h-4 bg-white/20"></div>
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
                    className="relative w-full h-full flex items-center justify-center shadow-2xl rounded-2xl overflow-hidden border border-white/10 bg-black/50 ring-1 ring-white/5"
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
                        <h2 className="text-2xl font-bold mb-2 tracking-tight">Welcome to {t('appTitle')}</h2>
                        <p className="text-gray-500 dark:text-gray-400 mb-8 leading-relaxed">
                            Professional 16-bit RAW processing pipeline in your browser.
                        </p>
                        {fileInput}
                    </div>
                </motion.div>
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
                 Raw Alchemy Web &copy; {new Date().getFullYear()}
             </p>
         </div>
      </div>
    </div>
  );
};

export default ResponsiveLayout;
