import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import en from './locales/en.json';
import zh from './locales/zh.json';

// Get language from browser or default to English
const getInitialLanguage = () => {
  const saved = localStorage.getItem('language');
  if (saved) return saved;
  const browserLang = navigator.language || navigator.userLanguage;
  if (browserLang.toLowerCase().includes('zh')) return 'zh';
  return 'en';
};

i18n
  .use(initReactI18next)
  .init({
    resources: {
      en: { translation: en },
      zh: { translation: zh }
    },
    lng: getInitialLanguage(),
    fallbackLng: 'en',
    interpolation: {
      escapeValue: false
    }
  });

export default i18n;
