import React, { useRef, useEffect } from 'react';

const GLCanvas = ({ width, height, data, channels, bitDepth, wbMultipliers, camToProPhotoMatrix, proPhotoToAlexaMatrix }) => {
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

      // Stage 1: WB
      uniform vec3 u_wb_multipliers;

      // Stage 2 & 3: Color Matrices
      uniform mat3 u_cam_to_prophoto;
      uniform mat3 u_prophoto_to_alexa;

      out vec4 outColor;

      // Helper for log10 (must be defined before usage)
      float log10(float x) {
          return log(x) / 2.302585093;
      }

      // Arri LogC3 Encoding Function (Linear -> LogC3)
      // Source: Arri LogC3 Curve for EI 800
      // normalized Linear input (0.0 - 1.0) -> LogC3 output (0.0 - 1.0)
      // Parameters for EI 800:
      // cut = 0.010591
      // a = 5.555556
      // b = 0.052272
      // c = 0.247190
      // d = 0.385537
      // e = 5.367655
      // f = 0.092809
      float logC3_EI800(float x) {
          const float cut = 0.010591;
          const float a = 5.555556;
          const float b = 0.052272;
          const float c = 0.247190;
          const float d = 0.385537;
          const float e = 5.367655;
          const float f = 0.092809;

          if (x > cut) {
              return c * log10(a * x + b) + d;
          } else {
              return e * x + f;
          }
      }

      vec3 applyLogC3(vec3 linearColor) {
          return vec3(
              logC3_EI800(linearColor.r),
              logC3_EI800(linearColor.g),
              logC3_EI800(linearColor.b)
          );
      }

      void main() {
        uvec4 rawVal = texture(u_image, v_texCoord);

        // --- STAGE 0: Normalize Input ---
        vec3 linear_cam;
        if (u_channels == 1) {
          // Monochrome / Bayer
          float val = float(rawVal.r) / u_maxVal;
          linear_cam = vec3(val);
        } else {
          // RGB (Linear Camera Native)
          linear_cam = vec3(rawVal.rgb) / u_maxVal;
        }

        // --- STAGE 1: Input & WB (Camera Space) ---
        // Apply WB Multipliers
        // u_wb_multipliers is usually [R_scale, G_scale, B_scale]
        // Note: Raw inputs are usually R, G, B.
        vec3 wb_cam = linear_cam * u_wb_multipliers;

        // --- STAGE 2: To Working Space (ProPhoto RGB) ---
        // Matrix Transform: Camera -> ProPhoto
        vec3 prophoto_linear = u_cam_to_prophoto * wb_cam;

        // --- STAGE 3: To Target Gamut (Alexa Wide Gamut) ---
        // Matrix Transform: ProPhoto -> Alexa
        vec3 alexa_linear = u_prophoto_to_alexa * prophoto_linear;

        // Clip negatives before Log (Log curves don't handle negatives well)
        alexa_linear = max(alexa_linear, 0.0);

        // --- STAGE 4: To Log Curve (Arri LogC3) ---
        vec3 log_image = applyLogC3(alexa_linear);

        outColor = vec4(log_image, 1.0);
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

        // Set Uniforms
        gl.uniform1f(gl.getUniformLocation(program, 'u_maxVal'), bitDepth === 16 ? 65535.0 : 255.0);
        gl.uniform1i(gl.getUniformLocation(program, 'u_channels'), channels);
        gl.uniform1i(gl.getUniformLocation(program, 'u_image'), 0);

        // Color Pipeline Uniforms
        // WB Defaults: [1,1,1] if missing
        const wb = wbMultipliers || [1.0, 1.0, 1.0];
        gl.uniform3f(gl.getUniformLocation(program, 'u_wb_multipliers'), wb[0], wb[1], wb[2]);

        // Matrices (3x3)
        // Default Identity if missing
        const identity = new Float32Array([1,0,0, 0,1,0, 0,0,1]);
        // Note: JS matrices are Row-Major. WebGL default is Column-Major.
        // We set 'transpose' to true so WebGL reads our Row-Major arrays correctly.
        gl.uniformMatrix3fv(gl.getUniformLocation(program, 'u_cam_to_prophoto'), true, camToProPhotoMatrix || identity);
        gl.uniformMatrix3fv(gl.getUniformLocation(program, 'u_prophoto_to_alexa'), true, proPhotoToAlexaMatrix || identity);

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

  }, [width, height, data, channels, bitDepth, wbMultipliers, camToProPhotoMatrix, proPhotoToAlexaMatrix]);

  return <canvas ref={canvasRef} className="max-w-full shadow-lg border border-gray-300" />;
};

export default GLCanvas;
