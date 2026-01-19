import React, { useRef, useEffect } from 'react';

const GLCanvas = ({ width, height, data, channels, bitDepth }) => {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !data) return;

    // Set canvas size
    canvas.width = width;
    canvas.height = height;

    const gl = canvas.getContext('webgl2', {
        preserveDrawingBuffer: true
    });

    if (!gl) {
      console.error("WebGL 2.0 not supported");
      return;
    }

    // Enable extensions
    gl.getExtension('EXT_color_buffer_float');

    // --- SHADERS ---
    const vsSource = `#version 300 es
      in vec2 a_position;
      out vec2 v_texCoord;
      void main() {
        gl_Position = vec4(a_position, 0.0, 1.0);
        v_texCoord = a_position * 0.5 + 0.5;
        v_texCoord.y = 1.0 - v_texCoord.y;
      }
    `;

    const fsSource = `#version 300 es
      precision highp float;
      precision highp usampler2D;

      in vec2 v_texCoord;
      uniform usampler2D u_image;
      uniform float u_maxVal;
      uniform int u_channels;

      out vec4 outColor;

      void main() {
        uvec4 rawVal = texture(u_image, v_texCoord);
        vec3 color;
        if (u_channels == 1) {
          // Monochrome / Bayer
          float val = float(rawVal.r) / u_maxVal;
          color = vec3(val);
        } else {
          // RGB
          color = vec3(rawVal.rgb) / u_maxVal;
        }
        outColor = vec4(color, 1.0);
      }
    `;

    let program = null;
    let vs = null;
    let fs = null;
    let positionBuffer = null;
    let vao = null;
    let texture = null;

    try {
        const createShader = (type, source) => {
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

        vs = createShader(gl.VERTEX_SHADER, vsSource);
        fs = createShader(gl.FRAGMENT_SHADER, fsSource);

        if (!vs || !fs) throw new Error("Shader creation failed");

        program = gl.createProgram();
        gl.attachShader(program, vs);
        gl.attachShader(program, fs);
        gl.linkProgram(program);

        if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
            console.error(gl.getProgramInfoLog(program));
            throw new Error("Program failed to link");
        }

        // --- GEOMETRY ---
        positionBuffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);

        vao = gl.createVertexArray();
        gl.bindVertexArray(vao);
        const positionLoc = gl.getAttribLocation(program, 'a_position');
        gl.enableVertexAttribArray(positionLoc);
        gl.vertexAttribPointer(positionLoc, 2, gl.FLOAT, false, 0, 0);

        // --- TEXTURE ---
        texture = gl.createTexture();
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, texture);

        // Critical for tightly packed data
        gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);

        let internalFormat, format, type;
        if (bitDepth === 16) {
            type = gl.UNSIGNED_SHORT;
            if (channels === 1) {
                internalFormat = gl.R16UI;
                format = gl.RED_INTEGER;
            } else {
                internalFormat = gl.RGB16UI;
                format = gl.RGB_INTEGER;
            }
        } else {
            type = gl.UNSIGNED_BYTE;
            if (channels === 1) {
                internalFormat = gl.R8UI;
                format = gl.RED_INTEGER;
            } else {
                internalFormat = gl.RGB8UI;
                format = gl.RGB_INTEGER;
            }
        }

        gl.texImage2D(gl.TEXTURE_2D, 0, internalFormat, width, height, 0, format, type, data);

        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

        // --- RENDER ---
        gl.viewport(0, 0, width, height);
        gl.useProgram(program);

        gl.uniform1f(gl.getUniformLocation(program, 'u_maxVal'), bitDepth === 16 ? 65535.0 : 255.0);
        gl.uniform1i(gl.getUniformLocation(program, 'u_channels'), channels);
        gl.uniform1i(gl.getUniformLocation(program, 'u_image'), 0);

        gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

    } catch (e) {
        console.error("WebGL Rendering Error:", e);
    }

    // --- CLEANUP ---
    return () => {
        if (texture) gl.deleteTexture(texture);
        if (program) gl.deleteProgram(program);
        if (vs) gl.deleteShader(vs);
        if (fs) gl.deleteShader(fs);
        if (positionBuffer) gl.deleteBuffer(positionBuffer);
        if (vao) gl.deleteVertexArray(vao);
    };

  }, [width, height, data, channels, bitDepth]);

  return <canvas ref={canvasRef} className="max-w-full shadow-lg border border-gray-300" />;
};

export default GLCanvas;
