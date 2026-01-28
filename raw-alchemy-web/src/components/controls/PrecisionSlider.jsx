import React, { useState, useEffect } from 'react';
import { Minus, Plus } from 'lucide-react';

const PrecisionSlider = ({
  value,
  onChange,
  min,
  max,
  step,
  className = ""
}) => {
  const [localValue, setLocalValue] = useState(value);
  const [isDragging, setIsDragging] = useState(false);

  // Sync local state with prop when not dragging
  useEffect(() => {
    if (!isDragging) {
      setLocalValue(value);
    }
  }, [value, isDragging]);

  const handleDecrement = () => {
    const newValue = Math.max(min, value - step);
    onChange(parseFloat(newValue.toFixed(5)));
  };

  const handleIncrement = () => {
    const newValue = Math.min(max, value + step);
    onChange(parseFloat(newValue.toFixed(5)));
  };

  const handleSliderChange = (e) => {
    const newValue = parseFloat(e.target.value);
    setLocalValue(newValue);
    onChange(newValue);
  };

  const handleDragStart = () => setIsDragging(true);
  const handleDragEnd = () => setIsDragging(false);

  return (
    <div className={`flex items-center gap-3 ${className}`}>
      {/* Decrement Button */}
      <button
        onClick={handleDecrement}
        className="p-1.5 rounded-lg bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-300 transition-colors flex-shrink-0 border border-gray-200 dark:border-gray-700"
        aria-label="Decrease"
      >
        <Minus size={14} />
      </button>

      {/* Slider Input */}
      <div className="flex-1">
        <input
            type="range"
            min={min}
            max={max}
            step={step}
            value={localValue}
            onChange={handleSliderChange}
            onPointerDown={handleDragStart}
            onPointerUp={handleDragEnd}
            onTouchStart={handleDragStart}
            onTouchEnd={handleDragEnd}
            className="w-full h-1.5 rounded-lg appearance-none cursor-pointer focus:outline-none focus:ring-2 focus:ring-primary-light/50"
        />
      </div>

      {/* Increment Button */}
      <button
        onClick={handleIncrement}
        className="p-1.5 rounded-lg bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-300 transition-colors flex-shrink-0 border border-gray-200 dark:border-gray-700"
        aria-label="Increase"
      >
        <Plus size={14} />
      </button>
    </div>
  );
};

export default PrecisionSlider;
