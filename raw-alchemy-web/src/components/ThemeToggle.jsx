import React, { useEffect, useState } from 'react';
import { Moon, Sun } from 'lucide-react';

const ThemeToggle = () => {
  // Use state to trigger re-renders, but rely on DOM for truth to sync with index.css
  const [isDark, setIsDark] = useState(false);

  // Helper to update meta theme-color for PWA status bar
  const updateMetaThemeColor = (isDarkMode) => {
    const metaThemeColor = document.querySelector('meta[name="theme-color"]');
    if (metaThemeColor) {
      metaThemeColor.setAttribute('content', isDarkMode ? '#09090b' : '#ffffff');
    }
  };

  useEffect(() => {
    // Initial check
    const root = document.documentElement;
    const storedTheme = localStorage.getItem('theme');
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    const shouldUseDark = storedTheme === 'dark' || (!storedTheme && prefersDark);

    if (shouldUseDark) {
        root.classList.add('dark');
        setIsDark(true);
        updateMetaThemeColor(true);
    } else {
        root.classList.remove('dark');
        setIsDark(false);
        updateMetaThemeColor(false);
    }
  }, []);

  const toggleTheme = () => {
    const root = document.documentElement;
    if (root.classList.contains('dark')) {
      root.classList.remove('dark');
      localStorage.setItem('theme', 'light');
      setIsDark(false);
      updateMetaThemeColor(false);
    } else {
      root.classList.add('dark');
      localStorage.setItem('theme', 'dark');
      setIsDark(true);
      updateMetaThemeColor(true);
    }
  };

  return (
    <button
      onClick={toggleTheme}
      className="p-2 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors text-gray-700 dark:text-gray-200"
      aria-label="Toggle Theme"
    >
      {isDark ? <Moon size={20} /> : <Sun size={20} />}
    </button>
  );
};

export default ThemeToggle;
