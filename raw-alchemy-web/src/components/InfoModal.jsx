import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { X, Github } from 'lucide-react';
import logo from '../assets/logo.png';

const InfoModal = ({ isOpen, onClose }) => {
  const { t } = useTranslation();

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="relative w-full max-w-sm bg-white dark:bg-zinc-900 rounded-3xl shadow-2xl p-8 border border-gray-200 dark:border-white/10"
          >
            <button
              onClick={onClose}
              className="absolute top-4 right-4 p-2 text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white transition-colors rounded-full hover:bg-gray-100 dark:hover:bg-white/10"
            >
              <X size={20} />
            </button>

            <div className="flex flex-col items-center text-center space-y-6">
              <div className="relative w-24 h-24">
                 {/* Glow effect behind logo */}
                 <div className="absolute inset-0 bg-blue-500/20 blur-xl rounded-full"></div>
                 <img src={logo} alt="Logo" className="relative w-full h-full object-contain drop-shadow-lg" />
              </div>

              <div className="space-y-1">
                <h2 className="text-2xl font-bold text-gray-900 dark:text-white tracking-tight">
                  {t('appTitle')}
                </h2>
                <p className="text-xs font-bold text-blue-600 dark:text-blue-400 uppercase tracking-[0.2em]">
                  {t('slogan')}
                </p>
              </div>

              <p className="text-sm text-gray-600 dark:text-gray-300 leading-relaxed">
                {t('appDescription')}
              </p>

              <a
                href="https://github.com/Steve-Mr/Raw-Alchemy"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 px-6 py-2.5 bg-gray-900 dark:bg-white text-white dark:text-black rounded-full text-sm font-semibold transition-transform hover:scale-105 active:scale-95 shadow-lg hover:shadow-xl"
              >
                <Github size={18} />
                <span>{t('viewOnGithub')}</span>
              </a>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};

export default InfoModal;
