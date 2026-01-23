import React from 'react';
import { useTranslation } from 'react-i18next';
import { Sun, Contrast, Droplets, Gauge } from 'lucide-react';
import PrecisionSlider from './PrecisionSlider';

const ControlItem = ({ label, value, onChange, min, max, step, icon: Icon }) => (
  <div className="mb-6">
    <div className="flex justify-between items-center mb-2">
      <div className="flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-300">
        {Icon && <Icon size={14} className="text-gray-500" />}
        {label}
      </div>
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
      <div className="bg-surface-light dark:bg-surface-dark border border-gray-200 dark:border-gray-800 p-5 rounded-2xl shadow-sm">
        <h3 className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-4 flex items-center gap-2">
          <Sun size={14} />
          {t('basic.wb')}
        </h3>
        <ControlItem label={t('basic.red')} value={wbRed} onChange={setWbRed} min={0.1} max={5.0} step={0.01} />
        <ControlItem label={t('basic.green')} value={wbGreen} onChange={setWbGreen} min={0.1} max={5.0} step={0.01} />
        <ControlItem label={t('basic.blue')} value={wbBlue} onChange={setWbBlue} min={0.1} max={5.0} step={0.01} />
      </div>

      {/* Exposure & Metering */}
      <div className="bg-surface-light dark:bg-surface-dark border border-gray-200 dark:border-gray-800 p-5 rounded-2xl shadow-sm">
        <div className="flex justify-between items-center mb-4">
             <h3 className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider flex items-center gap-2">
                <Gauge size={14} />
                {t('basic.metering')}
            </h3>
            <select
                value={meteringMode}
                onChange={(e) => setMeteringMode(e.target.value)}
                className="text-xs bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-1.5 text-gray-700 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-primary-light/50"
            >
                <option value="hybrid">{t('basic.meteringModes.hybrid')}</option>
                <option value="matrix">{t('basic.meteringModes.matrix')}</option>
                <option value="center-weighted">{t('basic.meteringModes.center-weighted')}</option>
                <option value="highlight-safe">{t('basic.meteringModes.highlight-safe')}</option>
                <option value="average">{t('basic.meteringModes.average')}</option>
            </select>
        </div>
        <ControlItem label={t('basic.exposure')} value={exposure} onChange={setExposure} min={-5.0} max={5.0} step={0.1} />
      </div>

      {/* Contrast & Saturation */}
      <div className="bg-surface-light dark:bg-surface-dark border border-gray-200 dark:border-gray-800 p-5 rounded-2xl shadow-sm">
         <h3 className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-4 flex items-center gap-2">
            <Contrast size={14} />
            Adjustments
        </h3>
        <ControlItem
            label={t('basic.contrast')}
            value={contrast}
            onChange={setContrast}
            min={0.5} max={1.5} step={0.05}
            icon={Contrast}
        />
        <ControlItem
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
