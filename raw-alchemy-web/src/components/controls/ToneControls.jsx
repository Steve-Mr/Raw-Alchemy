import React from 'react';
import { useTranslation } from 'react-i18next';
import { SlidersHorizontal } from 'lucide-react';

const ToneSlider = ({ label, value, onChange, min, max, step }) => (
  <div className="mb-4">
    <div className="flex justify-between items-center mb-1">
      <div className="text-sm font-medium text-gray-700 dark:text-gray-300">{label}</div>
      <span className="text-xs font-mono text-gray-500 dark:text-gray-400">{value.toFixed(2)}</span>
    </div>
    <input
      type="range"
      min={min}
      max={max}
      step={step}
      value={value}
      onChange={(e) => onChange(parseFloat(e.target.value))}
      className="w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-lg appearance-none cursor-pointer accent-primary-light dark:accent-primary-dark"
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
    <div className="bg-surface-container-light dark:bg-surface-container-dark p-4 rounded-2xl">
      <h3 className="text-sm font-bold text-gray-900 dark:text-gray-100 mb-4 flex items-center gap-2">
        <SlidersHorizontal size={16} className="text-purple-500" />
        {t('tabs.tone')}
      </h3>

      <div className="space-y-2">
        <ToneSlider label={t('tone.highlights')} value={highlights} onChange={setHighlights} min={-1.0} max={1.0} step={0.05} />
        <ToneSlider label={t('tone.shadows')} value={shadows} onChange={setShadows} min={-1.0} max={1.0} step={0.05} />
        <ToneSlider label={t('tone.whites')} value={whites} onChange={setWhites} min={-1.0} max={1.0} step={0.05} />
        <ToneSlider label={t('tone.blacks')} value={blacks} onChange={setBlacks} min={-1.0} max={1.0} step={0.05} />
      </div>
    </div>
  );
};

export default ToneControls;
