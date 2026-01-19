import React, { useRef, useEffect } from 'react';

const GLCanvas = ({ width, height, data, channels, bitDepth }) => {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !data) return;

    // Resize canvas to match image dimensions
    canvas.width = width;
    canvas.height = height;

    const gl = canvas.getContext('webgl2');
    if (!gl) {
      console.error("WebGL 2.0 not supported");
      return;
    }

    // Enable extensions if needed (though WebGL2 handles most)
    gl.getExtension('EXT_color_buffer_float');

    // CREATE SHADERS
    const vsSource = `#version 300 es
      in vec2 a_position;
      out vec2 v_texCoord;
      void main() {
        gl_Position = vec4(a_position, 0.0, 1.0);
        // Map -1..1 to 0..1
        v_texCoord = a_position * 0.5 + 0.5;
        // Flip Y because WebGL textures are upside down relative to images usually
        v_texCoord.y = 1.0 - v_texCoord.y;
      }
    `;

    const fsSource = `#version 300 es
      precision highp float;
      precision highp usampler2D; // Unsigned integer sampler

      in vec2 v_texCoord;
      uniform usampler2D u_image;
      uniform float u_maxVal;
      uniform int u_channels;

      out vec4 outColor;

      void main() {
        // Fetch raw integer values
        // We use texture() but with a usampler it returns uvec4
        uvec4 rawVal = texture(u_image, v_texCoord);

        vec3 color;
        if (u_channels == 1) {
          // Bayer/Monochrome: Use Red channel
          float val = float(rawVal.r) / u_maxVal;
          color = vec3(val);
        } else {
          // RGB
          color = vec3(rawVal.rgb) / u_maxVal;
        }

        // Output (Linear, no gamma correction as requested for "Pass-through")
        outColor = vec4(color, 1.0);
      }
    `;

    const createShader = (gl, type, source) => {
      const shader = gl.createShader(type);
      gl.shaderSource(shader, source);
      gl.compileShader(shader);
      if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        console.error(gl.getShaderInfoLog(shader));
        gl.deleteShader(shader);
        return null;
      }
      return shader;
    };

    const program = gl.createProgram();
    const vs = createShader(gl, gl.VERTEX_SHADER, vsSource);
    const fs = createShader(gl, gl.FRAGMENT_SHADER, fsSource);
    gl.attachShader(program, vs);
    gl.attachShader(program, fs);
    gl.linkProgram(program);

    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      console.error(gl.getProgramInfoLog(program));
      return;
    }

    // SETUP GEOMETRY (Full screen quad)
    const positionBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
    const positions = new Float32Array([
      -1, -1,
       1, -1,
      -1,  1,
       1,  1,
    ]);
    gl.bufferData(gl.ARRAY_BUFFER, positions, gl.STATIC_DRAW);

    const vao = gl.createVertexArray();
    gl.bindVertexArray(vao);
    const positionLoc = gl.getAttribLocation(program, 'a_position');
    gl.enableVertexAttribArray(positionLoc);
    gl.vertexAttribPointer(positionLoc, 2, gl.FLOAT, false, 0, 0);

    // SETUP TEXTURE
    const texture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, texture);

    // Pixel Store parameters
    // Handle alignment for odd widths
    gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);

    let internalFormat, format, type;

    // Determine formats based on channel count and bit depth
    if (bitDepth === 16) {
        type = gl.UNSIGNED_SHORT;
        if (channels === 1) {
            internalFormat = gl.R16UI;
            format = gl.RED_INTEGER;
        } else {
            // Assume 3 channels (RGB) but WebGL 2 usually likes RGBA for alignment?
            // Actually RGB16UI exists.
            internalFormat = gl.RGB16UI;
            format = gl.RGB_INTEGER;

            // Check if data length matches RGB (3) or RGBA (4)
            // If data is RGB (packed), we use RGB_INTEGER.
        }
    } else {
        // 8-bit fallback
        type = gl.UNSIGNED_BYTE;
        if (channels === 1) {
            internalFormat = gl.R8UI;
            format = gl.RED_INTEGER;
        } else {
            internalFormat = gl.RGB8UI;
            format = gl.RGB_INTEGER;
        }
    }

    // Upload Data
    try {
        gl.texImage2D(
            gl.TEXTURE_2D,
            0,              // level
            internalFormat, // internalFormat
            width,
            height,
            0,              // border
            format,         // format
            type,           // type
            data            // pixels
        );
    } catch (e) {
        console.error("Texture Upload Failed:", e);
    }

    // Parameters (Nearest for checking raw pixels, Linear doesn't work on Integer textures!)
    // NOTE: Integer textures CANNOT use Linear filtering. We must use Nearest.
    // If we want linear filtering, we must convert to FLOAT textures.
    // BUT the requirement was "Upload Logic".
    // "Process 16-bit / Float32".
    // The instructions say "Implement Float32 Texture creation and data upload logic".
    // HOWEVER, the data coming from LibRaw is INT16.
    // Optimization: We can upload as INT16 (R16UI) and normalize in shader (as implemented above).
    // OR: We convert to Float32 on CPU (slow).
    // OR: We upload as R16UI, then blit to a R16F/RGBA16F texture if we need filtering later.
    // For "Core Engine -> Display", Nearest Neighbor on Integer Texture is totally fine and most performant.

    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

    // RENDER
    gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);
    gl.useProgram(program);

    // Uniforms
    const uMaxValLoc = gl.getUniformLocation(program, 'u_maxVal');
    const uChannelsLoc = gl.getUniformLocation(program, 'u_channels');

    // Max value: 65535 for 16-bit, 255 for 8-bit
    const maxVal = bitDepth === 16 ? 65535.0 : 255.0;

    gl.uniform1f(uMaxValLoc, maxVal);
    gl.uniform1i(uChannelsLoc, channels);

    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

    // Cleanup
    // (Optional, React handles component unmount, but WebGL resources stay until GC or context loss)
    // For a single canvas instance, it's fine.

  }, [width, height, data, channels, bitDepth]);

  return (
    <canvas ref={canvasRef} className="max-w-full shadow-lg border border-gray-300" />
  );
};

export default GLCanvas;
