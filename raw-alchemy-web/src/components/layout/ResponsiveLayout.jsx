import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'framer-motion';
import { Settings, Sliders, Palette, Download, Menu } from 'lucide-react';
import ThemeToggle from '../ThemeToggle';
import LanguageToggle from '../LanguageToggle';

const ResponsiveLayout = ({
  children, // The Image Component (GLCanvas wrapper)
  controls, // Object containing the control components: { basic, tone, color, export, advanced }
  fileInput, // The file input element
  loading,
  error
}) => {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState('basic');
  const [isMobile, setIsMobile] = useState(false);

  // Simple media query listener
  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 1024); // 1024px breakpoint for split view
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  const tabs = [
    { id: 'basic', label: t('tabs.basic'), icon: Settings },
    { id: 'tone', label: t('tabs.tone'), icon: Sliders },
    { id: 'color', label: t('tabs.color'), icon: Palette },
    { id: 'export', label: t('tabs.export'), icon: Download },
  ];

  const renderContent = () => {
    if (activeTab === 'basic') return controls.basic;
    if (activeTab === 'tone') return controls.tone;
    if (activeTab === 'color') return controls.color;
    if (activeTab === 'export') return controls.export;
    return null;
  };

  if (isMobile) {
    // MOBILE LAYOUT
    return (
      <div className="flex flex-col h-screen bg-surface-light dark:bg-surface-dark text-gray-900 dark:text-gray-100 overflow-hidden">
        {/* Header */}
        <header className="flex justify-between items-center p-4 bg-surface-container-light dark:bg-surface-container-dark shadow-sm z-10">
          <h1 className="text-lg font-bold truncate">{t('appTitle')}</h1>
          <div className="flex items-center gap-2">
            <LanguageToggle />
            <ThemeToggle />
          </div>
        </header>

        {/* Main Content Area (Image) */}
        <main className="flex-1 relative bg-black overflow-hidden flex items-center justify-center">
             {loading && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/50 z-20 text-white gap-2">
                    <div className="animate-spin h-6 w-6 border-2 border-white border-t-transparent rounded-full"></div>
                    <span className="text-sm font-medium">{t('loadingDecoding')}</span>
                </div>
            )}
            {error && (
                 <div className="absolute top-4 left-4 right-4 p-3 bg-red-500/90 text-white rounded-lg z-20 text-sm">
                    {t('error')}: {error}
                </div>
            )}
            {/* If no image loaded yet, show upload prompt */}
            {!children ? (
                <div className="text-center p-8">
                     {fileInput}
                </div>
            ) : (
                <div className="w-full h-full p-2">
                     {children}
                </div>
            )}
        </main>

        {/* Controls Area (Bottom Sheet/Tabs) */}
        <div className="flex flex-col bg-surface-light dark:bg-surface-dark border-t border-gray-200 dark:border-gray-800 h-1/2 max-h-[50vh]">
            {/* Tab Navigation */}
            <div className="flex overflow-x-auto bg-surface-container-light dark:bg-surface-container-dark border-b border-gray-200 dark:border-gray-800">
                {tabs.map((tab) => (
                    <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id)}
                        className={`flex-1 flex flex-col items-center justify-center py-3 px-2 min-w-[70px] transition-colors relative
                            ${activeTab === tab.id ? 'text-primary-light dark:text-primary-dark' : 'text-gray-500 dark:text-gray-400'}
                        `}
                    >
                        <tab.icon size={20} className="mb-1" />
                        <span className="text-[10px] font-medium">{tab.label}</span>
                        {activeTab === tab.id && (
                            <motion.div
                                layoutId="activeTabIndicator"
                                className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary-light dark:bg-primary-dark"
                            />
                        )}
                    </button>
                ))}
            </div>

            {/* Scrollable Control Content */}
            <div className="flex-1 overflow-y-auto p-4 relative">
                <AnimatePresence mode="wait">
                    <motion.div
                        key={activeTab}
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: -20 }}
                        transition={{ duration: 0.2 }}
                    >
                         {renderContent()}
                         {/* Advanced Controls are always available at the bottom of the list in mobile?
                             Or strictly in one tab? Let's put it in Basic or separate.
                             Plan said "Advanced ... hidden/misc".
                             I'll append it to the current view if suitable, or maybe just put it in "Basic" or global footer?
                             Let's put it below the active tab content for now as a footer of the scroll view.
                         */}
                         <div className="mt-8">
                            {controls.advanced}
                         </div>
                    </motion.div>
                </AnimatePresence>
            </div>
        </div>
      </div>
    );
  }

  // DESKTOP LAYOUT
  return (
    <div className="flex h-screen bg-surface-light dark:bg-surface-dark text-gray-900 dark:text-gray-100 overflow-hidden font-sans">
      {/* Left Panel: Image Viewer */}
      <div className="flex-1 flex flex-col bg-gray-100 dark:bg-black/90 relative">
         <header className="absolute top-0 left-0 right-0 p-4 flex justify-between items-center z-10 pointer-events-none">
            <h1 className="text-xl font-bold text-gray-800 dark:text-white pointer-events-auto backdrop-blur-sm bg-white/30 dark:bg-black/30 px-3 py-1 rounded-lg">
                {t('appTitle')}
            </h1>
            <div className="flex items-center gap-2 pointer-events-auto backdrop-blur-sm bg-white/30 dark:bg-black/30 px-2 py-1 rounded-lg">
                <LanguageToggle />
                <ThemeToggle />
            </div>
         </header>

         <main className="flex-1 flex items-center justify-center p-8 overflow-hidden relative">
            {loading && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/50 z-20 text-white gap-3 backdrop-blur-sm">
                    <div className="animate-spin h-8 w-8 border-4 border-white border-t-transparent rounded-full"></div>
                    <span className="text-lg font-medium">{t('loadingDecoding')}</span>
                </div>
            )}
             {error && (
                 <div className="absolute top-20 left-1/2 transform -translate-x-1/2 bg-red-500 text-white px-6 py-3 rounded-xl shadow-xl z-30">
                    <strong>{t('error')}:</strong> {error}
                </div>
            )}

            {children ? (
                 <motion.div
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ duration: 0.5 }}
                    className="relative w-full h-full flex items-center justify-center shadow-2xl rounded-lg overflow-hidden border border-gray-200 dark:border-gray-800 bg-black"
                 >
                     {children}
                 </motion.div>
            ) : (
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.5 }}
                    className="text-center bg-white dark:bg-gray-800 p-12 rounded-3xl shadow-xl border border-gray-200 dark:border-gray-700 max-w-md w-full"
                >
                    <div className="mb-6 flex justify-center text-primary-light dark:text-primary-dark">
                        <Palette size={64} />
                    </div>
                    <h2 className="text-2xl font-bold mb-2">Welcome</h2>
                    <p className="text-gray-500 dark:text-gray-400 mb-6">
                        Upload a RAW file to start editing with full 16-bit pipeline.
                    </p>
                    {fileInput}
                </motion.div>
            )}
         </main>
      </div>

      {/* Right Panel: Controls */}
      <div className="w-[360px] xl:w-[400px] flex flex-col border-l border-gray-200 dark:border-gray-800 bg-surface-light dark:bg-surface-dark shadow-xl z-20">
         <div className="flex-1 overflow-y-auto custom-scrollbar p-6 space-y-8">
            {children && (
                <>
                    <section>
                        {controls.basic}
                    </section>
                    <section>
                        {controls.tone}
                    </section>
                    <section>
                        {controls.color}
                    </section>
                    <section>
                         {controls.export}
                    </section>
                    <section className="pt-4">
                        {controls.advanced}
                    </section>
                </>
            )}
             {!children && (
                <div className="flex-1 flex items-center justify-center text-gray-400 text-center text-sm p-8">
                    No image loaded. Controls disabled.
                </div>
             )}
         </div>
         {/* Footer / Info */}
         <div className="p-4 border-t border-gray-200 dark:border-gray-800 text-center text-[10px] text-gray-400">
             Raw Alchemy Web &copy; {new Date().getFullYear()}
         </div>
      </div>
    </div>
  );
};

export default ResponsiveLayout;
