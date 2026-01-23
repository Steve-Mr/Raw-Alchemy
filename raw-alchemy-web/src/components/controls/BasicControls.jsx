import React from 'react';
import { useTranslation } from 'react-i18next';
import { Sun, Contrast, Droplets, Gauge } from 'lucide-react';

const ControlSlider = ({ label, value, onChange, min, max, step, icon: Icon }) => (
  <div className="mb-4">
    <div className="flex justify-between items-center mb-1">
      <div className="flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-300">
        {Icon && <Icon size={14} />}
        {label}
      </div>
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

const BasicControls = ({
  wbRed, setWbRed,
  wbGreen, setWbGreen,
  wbBlue, setWbBlue,
  exposure, setExposure,
  contrast, setContrast,
  saturation, setSaturation,
  meteringMode, setMeteringMode
}) => {
  const { t } = useTranslation();

  return (
    <div className="space-y-6">
      {/* White Balance */}
      <div className="bg-surface-container-light dark:bg-surface-container-dark p-4 rounded-2xl">
        <h3 className="text-sm font-bold text-gray-900 dark:text-gray-100 mb-3 flex items-center gap-2">
          <Sun size={16} className="text-orange-500" />
          {t('basic.wb')}
        </h3>
        <ControlSlider label={t('basic.red')} value={wbRed} onChange={setWbRed} min={0.1} max={5.0} step={0.01} />
        <ControlSlider label={t('basic.green')} value={wbGreen} onChange={setWbGreen} min={0.1} max={5.0} step={0.01} />
        <ControlSlider label={t('basic.blue')} value={wbBlue} onChange={setWbBlue} min={0.1} max={5.0} step={0.01} />
      </div>

      {/* Exposure & Metering */}
      <div className="bg-surface-container-light dark:bg-surface-container-dark p-4 rounded-2xl">
        <div className="flex justify-between items-center mb-3">
             <h3 className="text-sm font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2">
                <Gauge size={16} className="text-blue-500" />
                {t('basic.metering')}
            </h3>
            <select
                value={meteringMode}
                onChange={(e) => setMeteringMode(e.target.value)}
                className="text-xs bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded p-1 text-gray-700 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-primary-light"
            >
                <option value="hybrid">{t('basic.meteringModes.hybrid')}</option>
                <option value="matrix">{t('basic.meteringModes.matrix')}</option>
                <option value="center-weighted">{t('basic.meteringModes.center-weighted')}</option>
                <option value="highlight-safe">{t('basic.meteringModes.highlight-safe')}</option>
                <option value="average">{t('basic.meteringModes.average')}</option>
            </select>
        </div>
        <ControlSlider label={t('basic.exposure')} value={exposure} onChange={setExposure} min={-5.0} max={5.0} step={0.1} />
      </div>

      {/* Contrast & Saturation */}
      <div className="bg-surface-container-light dark:bg-surface-container-dark p-4 rounded-2xl">
         <h3 className="text-sm font-bold text-gray-900 dark:text-gray-100 mb-3 flex items-center gap-2">
            <Contrast size={16} className="text-gray-500" />
            Adjustments
        </h3>
        <ControlSlider
            label={t('basic.contrast')}
            value={contrast}
            onChange={setContrast}
            min={0.5} max={1.5} step={0.05}
            icon={Contrast}
        />
        <ControlSlider
            label={t('basic.saturation')}
            value={saturation}
            onChange={setSaturation}
            min={0.0} max={2.0} step={0.05}
            icon={Droplets}
        />
      </div>
    </div>
  );
};

export default BasicControls;
