# Nitrate Grain

A minimal, high-performance RAW image editor and color grading tool for the web.

## Features

- **Raw Processing**: Supports various RAW formats (ARW, CR2, DNG, etc.) via LibRaw (WASM).
- **Color Grading**: 3D LUT support (.cube), Log color space transformations.
- **Gallery**: Persistent gallery with thumbnail view (IndexedDB).
- **PWA**: Installable, offline-capable, and supports Share Target API.

## Development

This project uses [Vite](https://vitejs.dev/) and [React](https://reactjs.org/).

### Dependencies

- **LibRaw-Wasm**: Uses the fork `Steve-Mr/LibRaw-Wasm` for efficient thumbnail extraction (`unpackThumb`).

### Commands

- `npm run dev`: Start development server.
- `npm run build`: Build for production.
- `npm run preview`: Preview build.

## License

MIT
