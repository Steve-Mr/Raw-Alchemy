// Security constants
const MAX_FILE_SIZE = 200 * 1024 * 1024; // 200MB
const ALLOWED_EXTENSIONS = [
  '.ARW', '.CR2', '.CR3', '.DNG', '.NEF', '.ORF', '.RAF', '.RW2'
];

/**
 * Validates a file before processing
 * @param {File} file - The file to validate
 * @returns {{ valid: boolean, error?: string }}
 */
export const validateFile = (file) => {
  if (!file) {
    return { valid: false, error: 'No file provided' };
  }

  // Check size
  if (file.size > MAX_FILE_SIZE) {
    return {
      valid: false,
      error: `File ${file.name} exceeds size limit of 200MB`
    };
  }

  // Check extension
  const extension = '.' + file.name.split('.').pop().toUpperCase();
  if (!ALLOWED_EXTENSIONS.includes(extension)) {
    return {
      valid: false,
      error: `File type ${extension} is not supported`
    };
  }

  return { valid: true };
};
