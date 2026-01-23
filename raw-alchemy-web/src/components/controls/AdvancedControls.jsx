import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ChevronDown, ChevronUp, Activity, Zap } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const AdvancedControls = ({
  inputGamma, setInputGamma,
  handleAnalyze, imgStats
}) => {
  const { t } = useTranslation();
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="mt-4 border-t border-gray-200 dark:border-gray-700 pt-2">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center justify-between w-full py-2 px-1 text-sm font-medium text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 transition-colors"
      >
        <span>{t('advanced.title')}</span>
        {isOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="pt-2 pb-4 space-y-4">
                {/* Input Linearization */}
                <div className="bg-surface-container-light dark:bg-surface-container-dark p-3 rounded-xl">
                    <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-2 flex items-center gap-2">
                         <Zap size={12} className="text-yellow-500" />
                         {t('advanced.inputLinearization')} ({inputGamma.toFixed(1)})
                    </label>
                    <input
                        type="range" min="1.0" max="3.0" step="0.1"
                        value={inputGamma}
                        onChange={(e) => setInputGamma(parseFloat(e.target.value))}
                        className="w-full h-1 bg-gray-300 dark:bg-gray-600 rounded-lg appearance-none cursor-pointer accent-gray-500 dark:accent-gray-400"
                    />
                    <p className="text-[10px] text-gray-500 dark:text-gray-400 mt-1">
                        {t('advanced.inputLinearizationNote')}
                    </p>
                </div>

                {/* Image Verification */}
                <div className="bg-surface-container-light dark:bg-surface-container-dark p-3 rounded-xl">
                    <h4 className="text-xs font-bold text-gray-700 dark:text-gray-300 mb-2 flex items-center gap-2">
                        <Activity size={12} className="text-indigo-500" />
                        {t('advanced.imageVerification')}
                    </h4>
                    <button
                        onClick={handleAnalyze}
                        className="w-full py-1.5 px-3 bg-indigo-100 hover:bg-indigo-200 dark:bg-indigo-900/30 dark:hover:bg-indigo-900/50 text-indigo-700 dark:text-indigo-300 text-xs font-bold rounded-lg transition-colors border border-indigo-200 dark:border-indigo-800"
                    >
                        {t('advanced.analyze')}
                    </button>
                    {imgStats && (
                        <div className="mt-2 text-[10px] font-mono bg-white dark:bg-gray-950 p-2 rounded border border-gray-200 dark:border-gray-800 text-gray-600 dark:text-gray-300">
                            <div className="grid grid-cols-2 gap-x-2">
                                <div>{t('advanced.min')}: {imgStats.min.toFixed(5)}</div>
                                <div>{t('advanced.max')}: {imgStats.max.toFixed(5)}</div>
                                <div className="col-span-2">{t('advanced.mean')}: {imgStats.mean.toFixed(5)}</div>
                            </div>
                            <div className="text-gray-400 dark:text-gray-500 mt-1 italic">
                                * {t('advanced.statsNote')}
                            </div>
                        </div>
                    )}
                </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default AdvancedControls;
