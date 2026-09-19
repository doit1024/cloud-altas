(function () {
  const VERTEX_SHADER = `#version 300 es
  in vec2 aPosition;
  void main() { gl_Position = vec4(aPosition, 0.0, 1.0); }
  `;

  const FRAGMENT_SHADER = `#version 300 es
  precision highp float;
  precision highp sampler3D;

  out vec4 fragColor;
  uniform vec2 resolution;
  uniform float time;
  uniform float cloudType;
  uniform float coverage;
  uniform float sunlight;
  uniform float yaw;
  uniform float pitch;
  uniform float zoom;
  uniform vec3 accent;
  uniform sampler3D noiseVolume;

  const float PI = 3.14159265359;

  float hash13(vec3 p) {
    p = fract(p * 0.1031);
    p += dot(p, p.yzx + 33.33);
    return fract((p.x + p.y) * p.z);
  }

  mat2 rotate2d(float angle) {
    float c = cos(angle), s = sin(angle);
    return mat2(c, -s, s, c);
  }

  float ellipsoid(vec3 p, vec3 center, vec3 radii) {
    return 1.0 - length((p - center) / radii);
  }

  float cloudEnvelope(vec3 p) {
    float envelope = -2.0;

    if (cloudType < 0.5) {
      vec3 qA = p;
      qA.x += qA.y * 1.45 + sin(qA.z * 1.8) * 0.22;
      float ribbonA = 0.105 - abs(qA.y - 0.70 - sin(qA.x * 0.72) * 0.12) - abs(qA.z) * 0.055;
      vec3 qB = p - vec3(-0.65, 0.18, 0.42);
      qB.x += qB.y * 1.12;
      float ribbonB = 0.075 - abs(qB.y - 0.58 + sin(qB.x * 0.86) * 0.10) - abs(qB.z) * 0.065;
      envelope = max(ribbonA, ribbonB);
      envelope -= max(abs(p.x) - 3.15, 0.0) * 0.48;
    } else if (cloudType < 2.5) {
      vec2 grid = vec2(1.62, 1.28);
      vec2 cellId = floor((p.xz + grid * 0.5) / grid);
      vec2 local = mod(p.xz + grid * 0.5, grid) - grid * 0.5;
      float randomA = hash13(vec3(cellId, 4.1));
      float randomB = hash13(vec3(cellId + vec2(5.3, 8.7), 6.2));
      vec3 q = vec3(local.x + (randomA - 0.5) * 0.42, p.y + (randomB - 0.5) * 0.34, local.y + (randomA - 0.5) * 0.25);
      envelope = ellipsoid(q, vec3(0.0, 0.18, 0.0), vec3(0.64 + randomA * 0.28, 0.30 + randomB * 0.24, 0.56 + randomB * 0.27));
      envelope -= max(abs(p.x) - 3.0, 0.0) * 0.52;
    } else if (cloudType < 3.5) {
      envelope = 0.17 - abs(p.y - 0.30 + sin(p.x * 0.42) * 0.035);
      envelope -= max(abs(p.z) - 2.35, 0.0) * 0.16;
      envelope -= max(abs(p.x) - 3.35, 0.0) * 0.12;
    } else if (cloudType < 4.5) {
      envelope = 0.58 - abs(p.y + 0.20 + sin(p.x * 0.38) * 0.075);
      envelope -= max(abs(p.z) - 2.30, 0.0) * 0.14;
      envelope -= max(abs(p.x) - 3.45, 0.0) * 0.10;
    } else if (cloudType < 5.5) {
      envelope = max(envelope, ellipsoid(p, vec3(-1.62, -0.16, -0.04), vec3(1.82, 0.80, 1.30)));
      envelope = max(envelope, ellipsoid(p, vec3(-0.30, 0.10, 0.02), vec3(1.76, 1.06, 1.38)));
      envelope = max(envelope, ellipsoid(p, vec3(1.34, -0.12, 0.08), vec3(1.72, 0.84, 1.26)));
      envelope = max(envelope, ellipsoid(p, vec3(-0.72, 0.70, -0.06), vec3(1.18, 0.90, 1.02)));
      envelope = max(envelope, ellipsoid(p, vec3(0.75, 0.62, 0.10), vec3(1.12, 0.84, 0.98)));
      envelope = min(envelope, p.y + 1.02);
    } else if (cloudType < 6.5) {
      envelope = max(envelope, ellipsoid(p, vec3(-0.92, -0.30, 0.0), vec3(1.22, 0.80, 1.08)));
      envelope = max(envelope, ellipsoid(p, vec3(0.20, -0.04, 0.0), vec3(1.56, 1.18, 1.24)));
      envelope = max(envelope, ellipsoid(p, vec3(1.10, -0.28, 0.08), vec3(1.06, 0.78, 0.94)));
      envelope = max(envelope, ellipsoid(p, vec3(0.08, 0.82, -0.05), vec3(1.00, 1.02, 0.92)));
      envelope = min(envelope, p.y + 0.96);
    } else {
      envelope = max(envelope, ellipsoid(p, vec3(-0.30, -0.62, 0.0), vec3(1.82, 0.72, 1.28)));
      envelope = max(envelope, ellipsoid(p, vec3(0.20, 0.08, 0.0), vec3(1.44, 1.34, 1.08)));
      envelope = max(envelope, ellipsoid(p, vec3(0.02, 1.16, 0.0), vec3(1.12, 1.22, 0.90)));
      envelope = max(envelope, ellipsoid(p, vec3(0.16, 2.02, 0.0), vec3(1.72, 0.42, 0.94)));
    }

    return envelope;
  }

  float densityAt(vec3 p) {
    float envelope = cloudEnvelope(p);
    if (envelope < -0.48) return 0.0;

    vec3 wind = vec3(time * 0.0115, time * 0.0018, time * 0.0009);
    vec3 uvw = fract(p * 0.285 + wind + vec3(0.37, 0.61, 0.19));
    vec3 coarse = texture(noiseVolume, uvw).rgb;
    vec3 fine = texture(noiseVolume, fract(uvw * 2.37 + vec3(0.17, 0.43, 0.29))).rgb;

    float heightBlend = smoothstep(-0.65, 1.45, p.y);
    float perlinWorley = mix(coarse.r, 1.0 - coarse.r, heightBlend * 0.22);
    float erosion = coarse.g * 0.58 + fine.b * 0.42;
    float edgeNoise = (perlinWorley - 0.50) * 1.34;
    edgeNoise += (coarse.g - 0.50) * 0.56;
    edgeNoise += (fine.b - 0.50) * 0.32;
    float shaped = envelope * 0.58 + edgeNoise;
    shaped -= (1.0 - erosion) * 0.09;

    float threshold = mix(0.19, -0.005, coverage);
    float density = smoothstep(threshold, threshold + 0.065, shaped);
    density *= smoothstep(-0.22, 0.08, envelope + edgeNoise * 0.52);
    float typeDensity = 1.0;
    if (cloudType < 0.5) typeDensity = 0.56;
    else if (cloudType < 2.5) typeDensity = 0.84;
    else if (cloudType < 3.5) typeDensity = 0.42;
    else if (cloudType < 4.5) typeDensity = 1.18;
    return density * mix(0.72, 1.12, coverage) * typeDensity;
  }

  float henyeyGreenstein(float g, float cosTheta) {
    float g2 = g * g;
    return (1.0 - g2) / (4.0 * PI * pow(max(1.0 + g2 - 2.0 * g * cosTheta, 0.001), 1.5));
  }

  float cloudPhase(float cosTheta) {
    return mix(henyeyGreenstein(0.62, cosTheta), henyeyGreenstein(-0.26, cosTheta), 0.22);
  }

  float lightTransmittance(vec3 p, vec3 lightDirection) {
    float opticalDepth = 0.0;
    float lightStep = 0.34;
    for (int i = 0; i < 4; i++) {
      p += lightDirection * lightStep;
      opticalDepth += densityAt(p) * lightStep;
    }
    float primary = exp(-opticalDepth * 2.75);
    float secondary = exp(-opticalDepth * 0.72) * 0.30;
    float tertiary = exp(-opticalDepth * 0.18) * 0.10;
    return primary + secondary + tertiary;
  }

  void main() {
    vec2 screen = (gl_FragCoord.xy * 2.0 - resolution) / resolution.y;
    float framing = mix(1.16, 1.0, smoothstep(0.82, 1.35, resolution.x / resolution.y));
    vec3 rayOrigin = vec3(0.34, 0.18, 5.65 * zoom * framing);
    vec3 rayDirection = normalize(vec3(screen.x - 0.055, screen.y + 0.015, -1.74));

    rayOrigin.xz = rotate2d(yaw) * rayOrigin.xz;
    rayDirection.xz = rotate2d(yaw) * rayDirection.xz;
    rayOrigin.yz = rotate2d(pitch) * rayOrigin.yz;
    rayDirection.yz = rotate2d(pitch) * rayDirection.yz;

    vec3 lightDirection = normalize(vec3(0.72, 0.82, 0.46));
    vec3 sunColor = vec3(1.08, 1.06, 1.02);
    vec3 skyAmbient = vec3(0.80, 0.84, 0.89);
    float typeSunlight = 1.0;
    if (cloudType < 0.5) {
      skyAmbient = vec3(0.94, 0.97, 1.0);
      typeSunlight = 1.24;
    } else if (cloudType < 2.5) {
      skyAmbient = vec3(0.82, 0.87, 0.93);
      typeSunlight = 1.02;
    } else if (cloudType < 3.5) {
      skyAmbient = vec3(0.88, 0.91, 0.94);
      typeSunlight = 0.76;
    } else if (cloudType < 4.5) {
      skyAmbient = vec3(0.54, 0.62, 0.70);
      typeSunlight = 0.48;
    }
    float cosTheta = dot(rayDirection, lightDirection);
    float phase = cloudPhase(cosTheta) * 7.0;

    float camDist = 5.65 * zoom * framing;
    float nearDistance = max(0.24, camDist - 3.9);
    float farDistance = camDist + 4.8;
    float baseStep = (farDistance - nearDistance) / 56.0;
    float jitter = hash13(vec3(gl_FragCoord.xy, mod(time, 19.0)));
    float travel = nearDistance + baseStep * jitter;
    float transmittance = 1.0;
    vec3 accumulated = vec3(0.0);
    bool insideCloud = false;

    for (int i = 0; i < 56; i++) {
      if (travel > farDistance || transmittance < 0.018) break;

      vec3 samplePosition = rayOrigin + rayDirection * travel;
      samplePosition.z *= 0.86;
      float density = densityAt(samplePosition);

      if (density > 0.008) {
        insideCloud = true;
        float lightVisibility = lightTransmittance(samplePosition, lightDirection);
        float localOcclusion = densityAt(samplePosition + lightDirection * 0.14);
        float surfaceLight = mix(0.52, 1.18, exp(-localOcclusion * 2.2));
        float powder = 1.0 - exp(-density * 2.6);
        float silver = pow(clamp(1.0 - lightVisibility, 0.0, 1.0), 0.45) * phase;
        vec3 lighting = skyAmbient * (0.50 + 0.27 * powder);
        lighting += sunColor * sunlight * typeSunlight * lightVisibility * surfaceLight * (1.92 + phase * 1.36);
        lighting += sunColor * silver * 0.14 * sunlight * typeSunlight;
        lighting = mix(lighting, accent, 0.025);

        float sampleAlpha = 1.0 - exp(-density * baseStep * 2.04);
        accumulated += transmittance * lighting * sampleAlpha;
        transmittance *= 1.0 - sampleAlpha;
      }

      float stride = insideCloud ? 1.0 : (density > 0.0 ? 1.35 : 2.15);
      if (insideCloud && density <= 0.004) insideCloud = false;
      travel += baseStep * stride;
    }

    float opacity = 1.0 - transmittance;
    if (opacity < 0.006) {
      fragColor = vec4(0.0);
      return;
    }

    vec3 averageColor = accumulated / max(opacity, 0.001);
    vec3 color = 1.0 - exp(-averageColor * 1.56);
    color = pow(max(color, 0.0), vec3(0.92));
    fragColor = vec4(color * opacity, opacity);
  }
  `;

  function compileShader(gl, type, source) {
    const shader = gl.createShader(type);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      const message = gl.getShaderInfoLog(shader) || "Unknown shader error";
      gl.deleteShader(shader);
      throw new Error(message);
    }
    return shader;
  }

  function hash(x, y, z) {
    const value = Math.sin(x * 127.1 + y * 311.7 + z * 74.7) * 43758.5453;
    return value - Math.floor(value);
  }

  function smooth(value) {
    return value * value * (3 - 2 * value);
  }

  function mix(a, b, t) {
    return a + (b - a) * t;
  }

  function valueNoise(x, y, z) {
    const ix = Math.floor(x), iy = Math.floor(y), iz = Math.floor(z);
    const fx = smooth(x - ix), fy = smooth(y - iy), fz = smooth(z - iz);
    const sample = (dx, dy, dz) => hash(ix + dx, iy + dy, iz + dz);
    const x00 = mix(sample(0, 0, 0), sample(1, 0, 0), fx);
    const x10 = mix(sample(0, 1, 0), sample(1, 1, 0), fx);
    const x01 = mix(sample(0, 0, 1), sample(1, 0, 1), fx);
    const x11 = mix(sample(0, 1, 1), sample(1, 1, 1), fx);
    return mix(mix(x00, x10, fy), mix(x01, x11, fy), fz);
  }

  function worley(x, y, z, frequency) {
    x *= frequency;
    y *= frequency;
    z *= frequency;
    const ix = Math.floor(x), iy = Math.floor(y), iz = Math.floor(z);
    let nearest = 9;
    for (let dz = -1; dz <= 1; dz++) {
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          const cx = ix + dx, cy = iy + dy, cz = iz + dz;
          const px = cx + hash(cx, cy, cz);
          const py = cy + hash(cx + 19.1, cy + 7.7, cz + 3.3);
          const pz = cz + hash(cx + 5.4, cy + 13.8, cz + 23.2);
          const sx = px - x, sy = py - y, sz = pz - z;
          nearest = Math.min(nearest, sx * sx + sy * sy + sz * sz);
        }
      }
    }
    return Math.min(Math.sqrt(nearest), 1);
  }

  function createNoiseTexture(gl) {
    const size = 48;
    const data = new Uint8Array(size * size * size * 4);
    let index = 0;
    for (let z = 0; z < size; z++) {
      for (let y = 0; y < size; y++) {
        for (let x = 0; x < size; x++) {
          const nx = x / size, ny = y / size, nz = z / size;
          const perlin = valueNoise(nx * 4.0, ny * 4.0, nz * 4.0) * 0.64 +
            valueNoise(nx * 8.0 + 13.2, ny * 8.0 + 7.1, nz * 8.0 + 3.4) * 0.36;
          const worley4 = 1 - worley(nx, ny, nz, 4.0);
          const worley8 = 1 - worley(nx + 0.17, ny + 0.41, nz + 0.73, 8.0);
          const perlinWorley = Math.max(0, Math.min(1, perlin * 0.72 + worley4 * 0.28));
          data[index++] = Math.round(perlinWorley * 255);
          data[index++] = Math.round(worley4 * 255);
          data[index++] = Math.round(worley8 * 255);
          data[index++] = 255;
        }
      }
    }

    const texture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_3D, texture);
    gl.texParameteri(gl.TEXTURE_3D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_3D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_3D, gl.TEXTURE_WRAP_S, gl.REPEAT);
    gl.texParameteri(gl.TEXTURE_3D, gl.TEXTURE_WRAP_T, gl.REPEAT);
    gl.texParameteri(gl.TEXTURE_3D, gl.TEXTURE_WRAP_R, gl.REPEAT);
    gl.texImage3D(gl.TEXTURE_3D, 0, gl.RGBA8, size, size, size, 0, gl.RGBA, gl.UNSIGNED_BYTE, data);
    return texture;
  }

  function start(canvas, state, getCloud) {
    const gl = canvas.getContext("webgl2", {
      antialias: false,
      alpha: true,
      premultipliedAlpha: true,
      powerPreference: "high-performance",
    });
    if (!gl) return false;

    try {
      const program = gl.createProgram();
      gl.attachShader(program, compileShader(gl, gl.VERTEX_SHADER, VERTEX_SHADER));
      gl.attachShader(program, compileShader(gl, gl.FRAGMENT_SHADER, FRAGMENT_SHADER));
      gl.linkProgram(program);
      if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
        throw new Error(gl.getProgramInfoLog(program) || "Shader program link failed");
      }

      const buffer = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
      const position = gl.getAttribLocation(program, "aPosition");
      gl.enableVertexAttribArray(position);
      gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0);

      const uniforms = {};
      for (const name of ["resolution", "time", "cloudType", "coverage", "sunlight", "yaw", "pitch", "zoom", "accent", "noiseVolume"]) {
        uniforms[name] = gl.getUniformLocation(program, name);
      }

      const noiseTexture = createNoiseTexture(gl);
      const startedAt = performance.now();

      function render(now) {
        const scale = innerWidth > 900 ? 0.72 : 0.86;
        const pixelRatio = Math.min(devicePixelRatio || 1, 1.25) * scale;
        const width = Math.max(1, Math.floor(canvas.clientWidth * pixelRatio));
        const height = Math.max(1, Math.floor(canvas.clientHeight * pixelRatio));
        if (canvas.width !== width || canvas.height !== height) {
          canvas.width = width;
          canvas.height = height;
          gl.viewport(0, 0, width, height);
        }

        const cloud = getCloud();
        const accentRgb = cloud.accent.slice(1).match(/.{2}/g).map((hex) => parseInt(hex, 16) / 255);
        gl.clearColor(0, 0, 0, 0);
        gl.clear(gl.COLOR_BUFFER_BIT);
        gl.useProgram(program);
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_3D, noiseTexture);
        gl.uniform1i(uniforms.noiseVolume, 0);
        gl.uniform2f(uniforms.resolution, width, height);
        gl.uniform1f(uniforms.time, (now - startedAt) / 1000);
        gl.uniform1f(uniforms.cloudType, cloud.type);
        gl.uniform1f(uniforms.coverage, state.density);
        gl.uniform1f(uniforms.sunlight, state.sunlight);
        gl.uniform1f(uniforms.yaw, state.yaw);
        gl.uniform1f(uniforms.pitch, state.pitch);
        gl.uniform1f(uniforms.zoom, state.zoom);
        gl.uniform3f(uniforms.accent, ...accentRgb);
        gl.drawArrays(gl.TRIANGLES, 0, 3);
        requestAnimationFrame(render);
      }

      requestAnimationFrame(render);
      return true;
    } catch (error) {
      console.error("Volumetric cloud renderer failed", error);
      return false;
    }
  }

  window.CloudRenderer = { start };
})();
