import React, { useState, useLayoutEffect, memo } from 'react';

const Thumbnail = memo(({ blob, alt, className }) => {
    const [src, setSrc] = useState(null);

    useLayoutEffect(() => {
        if (!blob) {
            setSrc(null);
            return;
        }

        const url = URL.createObjectURL(blob);
        setSrc(url);

        return () => {
            URL.revokeObjectURL(url);
        };
    }, [blob]);

    if (!src) return null;

    return (
        <img
            src={src}
            alt={alt}
            className={className}
        />
    );
});

Thumbnail.displayName = 'Thumbnail';

export default Thumbnail;
