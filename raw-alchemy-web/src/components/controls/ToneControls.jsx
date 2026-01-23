import React from 'react';
import { useTranslation } from 'react-i18next';
import { SlidersHorizontal } from 'lucide-react';
import PrecisionSlider from './PrecisionSlider';

const ToneItem = ({ label, value, onChange, min, max, step }) => (
  <div className="mb-6">
    <div className="flex justify-between items-center mb-2">
      <div className="text-sm font-medium text-gray-700 dark:text-gray-300">{label}</div>
      <span className="text-xs font-mono text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-gray-800 px-1.5 py-0.5 rounded">
        {value.toFixed(2)}
      </span>
    </div>
    <PrecisionSlider
      value={value}
      onChange={onChange}
      min={min}
      max={max}
      step={step}
    />
  </div>
);

const ToneControls = ({
  highlights, setHighlights,
  shadows, setShadows,
  whites, setWhites,
  blacks, setBlacks
}) => {
  const { t } = useTranslation();

  return (
    <div className="bg-surface-light dark:bg-surface-dark border border-gray-200 dark:border-gray-800 p-5 rounded-2xl shadow-sm">
      <h3 className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-4 flex items-center gap-2">
        <SlidersHorizontal size={14} />
        {t('tabs.tone')}
      </h3>

      <div className="space-y-2">
        <ToneItem label={t('tone.highlights')} value={highlights} onChange={setHighlights} min={-1.0} max={1.0} step={0.05} />
        <ToneItem label={t('tone.shadows')} value={shadows} onChange={setShadows} min={-1.0} max={1.0} step={0.05} />
        <ToneItem label={t('tone.whites')} value={whites} onChange={setWhites} min={-1.0} max={1.0} step={0.05} />
        <ToneItem label={t('tone.blacks')} value={blacks} onChange={setBlacks} min={-1.0} max={1.0} step={0.05} />
      </div>
    </div>
  );
};

export default ToneControls;
