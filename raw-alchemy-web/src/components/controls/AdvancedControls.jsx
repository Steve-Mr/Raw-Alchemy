import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Activity, Zap, RotateCcw, ChevronDown, ChevronUp, TrendingUp } from 'lucide-react';
import PrecisionSlider from './PrecisionSlider';

const AdvancedControls = ({
  inputGamma, setInputGamma,
  handleAnalyze, imgStats,
  onReset
}) => {
  const { t } = useTranslation();
  const [isCollapsed, setIsCollapsed] = useState(true);

  return (
    <div className="space-y-2">
        {/* Toggle Header */}
        <button
            onClick={() => setIsCollapsed(!isCollapsed)}
            className="flex items-center justify-between w-full p-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 transition-colors rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800/50"
        >
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider">
                <Zap size={14} className="text-yellow-500" />
                {t('advanced.title')}
            </div>
            {isCollapsed ? <ChevronDown size={16} /> : <ChevronUp size={16} />}
        </button>

        {!isCollapsed && (
            <div className="space-y-6 pt-2 animate-in slide-in-from-top-2 fade-in duration-200">
                {/* Input Linearization */}
                <div className="bg-surface-light dark:bg-surface-dark border border-gray-200 dark:border-gray-800 p-5 rounded-2xl shadow-sm">
                    <div className="flex justify-between items-center mb-4">
                        <h3 className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider flex items-center gap-2">
                            <TrendingUp size={14} className="text-yellow-500" />
                            {t('advanced.inputLinearization')}
                        </h3>
                        <button
                            onClick={onReset}
                            className="text-gray-400 hover:text-primary-light dark:hover:text-primary-dark transition-colors p-1 rounded-md hover:bg-gray-100 dark:hover:bg-gray-800"
                            title={t('actions.reset')}
                        >
                            <RotateCcw size={14} />
                        </button>
                    </div>
                    <div className="flex justify-between items-center mb-2">
                        <span className="text-xs text-gray-500 dark:text-gray-400">{t('advanced.inputLinearizationNote')}</span>
                        <span className="text-xs font-mono bg-gray-100 dark:bg-gray-800 px-1.5 py-0.5 rounded text-gray-700 dark:text-gray-300">
                            {inputGamma.toFixed(1)}
                        </span>
                    </div>
                    <PrecisionSlider
                        value={inputGamma}
                        onChange={setInputGamma}
                        min={1.0} max={3.0} step={0.1}
                    />
                </div>

                {/* Image Verification */}
                <div className="bg-surface-light dark:bg-surface-dark border border-gray-200 dark:border-gray-800 p-5 rounded-2xl shadow-sm">
                    <h4 className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-4 flex items-center gap-2">
                        <Activity size={14} className="text-indigo-500" />
                        {t('advanced.imageVerification')}
                    </h4>
                    <button
                        onClick={handleAnalyze}
                        className="w-full py-2.5 px-4 bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-200 text-xs font-bold rounded-xl transition-colors border border-gray-200 dark:border-gray-700"
                    >
                        {t('advanced.analyze')}
                    </button>
                    {imgStats && (
                        <div className="mt-3 text-[10px] font-mono bg-gray-50 dark:bg-black/30 p-3 rounded-lg border border-gray-200 dark:border-gray-800 text-gray-600 dark:text-gray-400">
                            <div className="grid grid-cols-2 gap-y-1 gap-x-4">
                                <div className="flex justify-between"><span>{t('advanced.min')}:</span> <span className="text-gray-900 dark:text-gray-200">{imgStats.min.toFixed(5)}</span></div>
                                <div className="flex justify-between"><span>{t('advanced.max')}:</span> <span className="text-gray-900 dark:text-gray-200">{imgStats.max.toFixed(5)}</span></div>
                                <div className="flex justify-between col-span-2 border-t border-gray-200 dark:border-gray-800 pt-1 mt-1"><span>{t('advanced.mean')}:</span> <span className="text-gray-900 dark:text-gray-200">{imgStats.mean.toFixed(5)}</span></div>
                            </div>
                            <div className="text-gray-400/80 dark:text-gray-600 mt-2 italic text-[9px]">
                                {t('advanced.statsNote')}
                            </div>
                        </div>
                    )}
                </div>
            </div>
        )}
    </div>
  );
};

export default AdvancedControls;
