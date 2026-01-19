import React, { useEffect, useState } from 'react';

const WebGLStatus = () => {
  const [status, setStatus] = useState({
    webgl2: false,
    floatTexture: false,
    linearFloat: false
  });

  useEffect(() => {
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl2');

    if (!gl) {
      setStatus(s => ({ ...s, webgl2: false }));
      return;
    }

    const extColorBufferFloat = gl.getExtension('EXT_color_buffer_float');
    const extFloatLinear = gl.getExtension('OES_texture_float_linear');

    setStatus({
      webgl2: true,
      floatTexture: !!extColorBufferFloat,
      linearFloat: !!extFloatLinear
    });

    // Cleanup
    const loseContext = gl.getExtension('WEBGL_lose_context');
    if (loseContext) loseContext.loseContext();

  }, []);

  return (
    <div className="p-4 border rounded shadow bg-white max-w-md mx-auto mt-4">
      <h2 className="text-xl font-bold mb-4">Environment Check</h2>
      <ul className="space-y-2 text-sm">
        <li className="flex justify-between">
          <span>WebGL 2.0 Support:</span>
          <span className={status.webgl2 ? "text-green-600 font-bold" : "text-red-600 font-bold"}>
            {status.webgl2 ? "YES" : "NO"}
          </span>
        </li>
        <li className="flex justify-between">
          <span>Float Texture (EXT_color_buffer_float):</span>
          <span className={status.floatTexture ? "text-green-600 font-bold" : "text-red-600 font-bold"}>
            {status.floatTexture ? "YES" : "NO"}
          </span>
        </li>
        <li className="flex justify-between">
          <span>Linear Float Filtering (OES_texture_float_linear):</span>
          <span className={status.linearFloat ? "text-green-600 font-bold" : "text-red-600 font-bold"}>
            {status.linearFloat ? "YES" : "NO"}
          </span>
        </li>
      </ul>
      <p className="text-xs text-gray-500 mt-2">
        * "Float Texture" is required for 16-bit precision processing.<br/>
        * "Linear Float" is recommended for smooth 3D LUT interpolation.
      </p>
    </div>
  );
};

export default WebGLStatus;
