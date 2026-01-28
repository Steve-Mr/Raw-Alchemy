# Sentinel's Journal

## 2025-02-18 - [MEDIUM] Missing Input Validation on RAW Uploads
**Vulnerability:** The application accepted any file type via the upload input and PWA share target, relying only on UI `accept` attributes and eventual worker failure. This could allow users to upload large non-image files or unsupported formats, potentially filling IndexedDB (DoS) or causing worker crashes.
**Learning:** React hooks managing file inputs (`useGallery`) are the ideal place for validation gates because they centralize logic for both manual uploads and programmatic additions (like PWA shares).
**Prevention:** Implemented strict file extension (allow-list) and size (200MB) validation in `useGallery.js` using a reusable validation utility.
