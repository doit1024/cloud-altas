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
  uniform float quality;
  uniform vec3 accent;
  uniform sampler3D noiseVolume;

  const float PI = 3.14159265359;

  float saturate(float x) { return clamp(x, 0.0, 1.0); }

  float remap(float value, float originalMin, float originalMax, float newMin, float newMax) {
    float range = max(originalMax - originalMin, 1e-4);
    return mix(newMin, newMax, saturate((value - originalMin) / range));
  }

  float hash13(vec3 p) {
    p = fract(p * 0.1031);
    p += dot(p, p.yzx + 33.33);
    return fract((p.x + p.y) * p.z);
  }

  float interleavedGradientNoise(vec2 pixel) {
    return fract(52.9829189 * fract(dot(pixel, vec2(0.06711056, 0.00583715))));
  }

  float valueNoise3(vec3 p) {
    vec3 cell = floor(p);
    vec3 t = fract(p);
    t = t * t * (3.0 - 2.0 * t);
    float n000 = hash13(cell);
    float n100 = hash13(cell + vec3(1.0, 0.0, 0.0));
    float n010 = hash13(cell + vec3(0.0, 1.0, 0.0));
    float n110 = hash13(cell + vec3(1.0, 1.0, 0.0));
    float n001 = hash13(cell + vec3(0.0, 0.0, 1.0));
    float n101 = hash13(cell + vec3(1.0, 0.0, 1.0));
    float n011 = hash13(cell + vec3(0.0, 1.0, 1.0));
    float n111 = hash13(cell + vec3(1.0, 1.0, 1.0));
    return mix(
      mix(mix(n000, n100, t.x), mix(n010, n110, t.x), t.y),
      mix(mix(n001, n101, t.x), mix(n011, n111, t.x), t.y),
      t.z
    );
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
    } else if (cloudType < 1.5) {
      vec2 grid = vec2(0.78, 0.62);
      vec2 cellId = floor((p.xz + grid * 0.5) / grid);
      vec2 local = mod(p.xz + grid * 0.5, grid) - grid * 0.5;
      float randomA = hash13(vec3(cellId, 1.7));
      float randomB = hash13(vec3(cellId + vec2(7.1, 3.4), 2.3));
      vec3 q = vec3(local.x + (randomA - 0.5) * 0.14, p.y + (randomB - 0.5) * 0.12, local.y);
      envelope = ellipsoid(q, vec3(0.0, 0.52, 0.0), vec3(0.24 + randomA * 0.09, 0.085 + randomB * 0.045, 0.22 + randomB * 0.08));
      envelope -= max(abs(p.x) - 2.95, 0.0) * 0.72;
      envelope -= max(abs(p.z) - 1.55, 0.0) * 0.55;
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

  float erosionScale() {
    if (cloudType < 0.5) return 0.82;
    if (cloudType < 1.5) return 1.05;
    if (cloudType < 2.5) return 1.00;
    if (cloudType < 3.5) return 0.42;
    if (cloudType < 4.5) return 0.32;
    if (cloudType < 5.5) return 1.08;
    if (cloudType < 6.5) return 1.14;
    return 1.18;
  }

  float typeDensityMul() {
    if (cloudType < 0.5) return 0.78;
    if (cloudType < 1.5) return 0.74;
    if (cloudType < 2.5) return 0.90;
    if (cloudType < 3.5) return 0.50;
    if (cloudType < 4.5) return 1.18;
    return 1.0;
  }

  vec3 noiseCoord(vec3 p, vec3 wind) {
    if (cloudType < 0.5) {
      return fract(vec3(p.x * 0.22, p.y * 0.52, p.z * 0.40) + wind * vec3(1.2, 0.35, 0.5) + vec3(0.37, 0.61, 0.19));
    }
    return fract(p * 0.42 + wind + vec3(0.37, 0.61, 0.19));
  }

  float densityAt(vec3 p, bool detail) {
    float envelope = cloudEnvelope(p);
    if (envelope < -0.40) return 0.0;

    vec3 wind = vec3(time * 0.0115, time * 0.0018, time * 0.0009);
    vec4 coarse = texture(noiseVolume, noiseCoord(p, wind));
    float heightBlend = saturate((p.y + 0.85) / 2.35);
    float worleyFbm = coarse.g * 0.50 + coarse.b * 0.32 + coarse.a * 0.18;

    if (cloudType < 0.5) {
      float filament = coarse.r * 0.38 + coarse.g * 0.62;
      float shaped = envelope * 3.35 + (filament - 0.28) * 0.85;
      if (detail) {
        shaped += (valueNoise3(vec3(p.x * 0.70, p.y * 6.0, p.z * 4.6) + wind * 2.0) - 0.5) * 0.20;
      }
      float density = smoothstep(-0.04, 0.055, shaped);
      density *= smoothstep(-0.09, 0.02, envelope);
      return density * mix(0.92, 1.28, coverage);
    }

    float displaced = envelope + (coarse.r - 0.5) * 0.40 + (worleyFbm - 0.50) * 0.32;
    if (detail) {
      displaced += (valueNoise3(p * 7.6 + wind * 3.2) - 0.5) * 0.07;
    }
    if (displaced < -0.24) return 0.0;

    float env = saturate(displaced * 1.12);
    float erode = erosionScale();
    float carve = (1.0 - worleyFbm) * mix(0.16, 0.46, heightBlend) * erode;
    float shaped = env - carve * (1.14 - env);
    shaped += pow(coarse.g, 2.0) * env * 0.11;

    if (cloudType > 4.5) {
      shaped *= remap(p.y, -1.05, -0.72, 0.0, 1.0);
      shaped += (1.0 - heightBlend) * 0.035 * env;
    }

    if (detail) {
      vec4 fine = texture(noiseVolume, fract(p * vec3(1.28, 1.55, 1.28) + wind * 1.65 + vec3(0.17, 0.43, 0.29)));
      float micro = valueNoise3(p * 8.4 + wind * 3.4);
      float micro2 = valueNoise3(p * 16.5 + wind * 5.0 + 4.2);
      float fineMix = mix(fine.a, 1.0 - fine.b, heightBlend);
      float fineCarve = (1.0 - mix(fineMix, micro, 0.38)) * mix(0.045, 0.22, heightBlend) * erode;
      shaped -= fineCarve * (1.04 - saturate(shaped));
      shaped += (micro2 - 0.5) * mix(0.02, 0.05, heightBlend) * (1.0 - env);
    }

    float threshold = mix(0.36, 0.068, coverage);
    float softness = mix(0.038, 0.020, saturate(quality + 0.15));
    float density = smoothstep(threshold, threshold + softness, shaped);
    density *= smoothstep(-0.05, 0.02, displaced);
    return density * mix(0.70, 1.04, coverage) * typeDensityMul();
  }

  float henyeyGreenstein(float g, float cosTheta) {
    float g2 = g * g;
    return (1.0 - g2) / (4.0 * PI * pow(max(1.0 + g2 - 2.0 * g * cosTheta, 0.001), 1.5));
  }

  float cloudPhase(float cosTheta) {
    return mix(henyeyGreenstein(0.72, cosTheta), henyeyGreenstein(-0.28, cosTheta), 0.24);
  }

  float lightTransmittance(vec3 p, vec3 lightDirection) {
    float opticalDepth = 0.0;
    float lightStep = quality > 0.5 ? 0.20 : 0.26;
    int steps = quality > 0.5 ? 6 : 4;
    for (int i = 0; i < 6; i++) {
      if (i >= steps) break;
      p += lightDirection * lightStep;
      opticalDepth += densityAt(p, false) * lightStep;
      lightStep *= 1.36;
    }
    float beer = exp(-opticalDepth * 1.75);
    float secondary = exp(-opticalDepth * 0.48) * 0.40;
    return saturate(beer + secondary + 0.18);
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
    vec3 sunColor = vec3(1.16, 1.12, 1.06);
    vec3 skyAmbient = vec3(0.96, 0.97, 0.99);
    vec3 shadowTint = vec3(0.90, 0.91, 0.94);
    float typeSunlight = 1.12;
    if (cloudType < 0.5) {
      skyAmbient = vec3(0.98, 0.99, 1.0);
      shadowTint = vec3(0.94, 0.95, 0.98);
      typeSunlight = 1.36;
    } else if (cloudType < 1.5) {
      skyAmbient = vec3(0.97, 0.98, 1.0);
      shadowTint = vec3(0.92, 0.94, 0.97);
      typeSunlight = 1.22;
    } else if (cloudType < 2.5) {
      skyAmbient = vec3(0.95, 0.96, 0.99);
      typeSunlight = 1.12;
    } else if (cloudType < 3.5) {
      skyAmbient = vec3(0.94, 0.95, 0.97);
      shadowTint = vec3(0.88, 0.89, 0.92);
      typeSunlight = 0.88;
    } else if (cloudType < 4.5) {
      skyAmbient = vec3(0.78, 0.80, 0.84);
      shadowTint = vec3(0.72, 0.74, 0.78);
      typeSunlight = 0.64;
    }
    float cosTheta = dot(rayDirection, lightDirection);
    float phase = cloudPhase(cosTheta);

    float nearDistance = 2.05;
    float farDistance = 9.20;
    int maxSteps = quality > 0.5 ? 80 : 52;
    float baseStep = (farDistance - nearDistance) / float(maxSteps);
    float jitter = interleavedGradientNoise(gl_FragCoord.xy);
    float travel = nearDistance + baseStep * jitter;
    float transmittance = 1.0;
    vec3 accumulated = vec3(0.0);
    bool insideCloud = false;

    for (int i = 0; i < 80; i++) {
      if (i >= maxSteps || travel > farDistance || transmittance < 0.012) break;

      vec3 samplePosition = rayOrigin + rayDirection * travel;
      samplePosition.z *= 0.86;
      float density = densityAt(samplePosition, true);

      if (density > 0.006) {
        insideCloud = true;
        float lightVisibility = lightTransmittance(samplePosition, lightDirection);
        float dR = densityAt(samplePosition + vec3(0.10, 0.0, 0.0), false);
        float dU = densityAt(samplePosition + vec3(0.0, 0.10, 0.0), false);
        float dF = densityAt(samplePosition + vec3(0.0, 0.0, 0.10), false);
        vec3 gradient = vec3(dR - density, dU - density, dF - density);
        float gradLen = max(length(gradient), 1e-4);
        vec3 normal = normalize(mix(vec3(0.12, 1.0, 0.08), -gradient / gradLen, saturate(gradLen * 7.5)));
        vec4 puff = texture(noiseVolume, noiseCoord(samplePosition, vec3(time * 0.0115, time * 0.0018, time * 0.0009)));
        float heightFrac = saturate((samplePosition.y + 0.95) / 2.45);
        float powder = 1.0 - exp(-density * 2.9);
        float ndotl = saturate(dot(normal, lightDirection) * 0.42 + 0.58);
        float silver = pow(saturate(1.0 - lightVisibility), 0.48) * max(phase, 0.04) * mix(0.45, 0.12, density);
        float wrap = ndotl * mix(0.52, 1.06, lightVisibility) * mix(0.78, 1.06, pow(heightFrac, 0.85));
        wrap *= mix(0.88, 1.10, puff.g) * mix(1.0, 0.92, (1.0 - puff.a) * (1.0 - heightFrac));
        vec3 lighting = mix(skyAmbient * shadowTint, sunColor, saturate(wrap * sunlight * typeSunlight));
        lighting *= 1.04 + 0.16 * powder;
        lighting += sunColor * silver * 0.55 * sunlight * typeSunlight;
        lighting += sunColor * 0.16 * sunlight * typeSunlight * pow(heightFrac, 2.4) * ndotl;
        lighting = mix(lighting, accent, 0.008);

        float sampleAlpha = 1.0 - exp(-density * baseStep * 2.18);
        accumulated += transmittance * lighting * sampleAlpha;
        transmittance *= 1.0 - sampleAlpha;
      }

      float stride = insideCloud ? 1.0 : (density > 0.0 ? 1.18 : 1.85);
      if (insideCloud && density <= 0.003) insideCloud = false;
      travel += baseStep * stride;
    }

    float opacity = 1.0 - transmittance;
    if (opacity < 0.004) {
      fragColor = vec4(0.0);
      return;
    }

    vec3 averageColor = accumulated / max(opacity, 0.001);
    averageColor = max(averageColor, 0.0);
    averageColor = pow(averageColor, vec3(0.96));
    vec3 color = 1.0 - exp(-averageColor * 1.62);
    color = mix(color, color * color * (3.0 - 2.0 * color), 0.04);
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
    let h =
      Math.imul(Math.floor(x * 1024), 374761393) +
      Math.imul(Math.floor(y * 1024), 668265263) +
      Math.imul(Math.floor(z * 1024), 1274126177);
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    return (h >>> 0) / 4294967296;
  }

  function fade(value) {
    return value * value * value * (value * (value * 6 - 15) + 10);
  }

  function mix(a, b, t) {
    return a + (b - a) * t;
  }

  function grad(h, x, y, z) {
    const dir = (h * 255) & 15;
    const u = dir < 8 ? x : y;
    const v = dir < 4 ? y : dir === 12 || dir === 14 ? x : z;
    return ((dir & 1) === 0 ? u : -u) + ((dir & 2) === 0 ? v : -v);
  }

  function perlin(x, y, z) {
    const ix = Math.floor(x), iy = Math.floor(y), iz = Math.floor(z);
    const fx = x - ix, fy = y - iy, fz = z - iz;
    const u = fade(fx), v = fade(fy), w = fade(fz);
    const sample = (dx, dy, dz) => grad(hash(ix + dx, iy + dy, iz + dz), fx - dx, fy - dy, fz - dz);
    const x00 = mix(sample(0, 0, 0), sample(1, 0, 0), u);
    const x10 = mix(sample(0, 1, 0), sample(1, 1, 0), u);
    const x01 = mix(sample(0, 0, 1), sample(1, 0, 1), u);
    const x11 = mix(sample(0, 1, 1), sample(1, 1, 1), u);
    return mix(mix(x00, x10, v), mix(x01, x11, v), w);
  }

  function worley(x, y, z, frequency) {
    x *= frequency;
    y *= frequency;
    z *= frequency;
    const ix = Math.floor(x), iy = Math.floor(y), iz = Math.floor(z);
    const fx = x - ix, fy = y - iy, fz = z - iz;
    let nearest = 9;
    for (let dz = -1; dz <= 1; dz++) {
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          const cx = ix + dx, cy = iy + dy, cz = iz + dz;
          const sx = dx + hash(cx, cy, cz) - fx;
          const sy = dy + hash(cx + 19.1, cy + 7.7, cz + 3.3) - fy;
          const sz = dz + hash(cx + 5.4, cy + 13.8, cz + 23.2) - fz;
          const dist = sx * sx + sy * sy + sz * sz;
          if (dist < nearest) nearest = dist;
        }
      }
    }
    return Math.min(Math.sqrt(nearest), 1);
  }

  function createNoiseTexture(gl) {
    const size = 64;
    const data = new Uint8Array(size * size * size * 4);
    let index = 0;
    for (let z = 0; z < size; z++) {
      for (let y = 0; y < size; y++) {
        for (let x = 0; x < size; x++) {
          const nx = x / size, ny = y / size, nz = z / size;
          const perlinFbm = perlin(nx * 4.0, ny * 4.0, nz * 4.0) * 0.62 +
            perlin(nx * 8.0 + 3.1, ny * 8.0 + 1.7, nz * 8.0 + 5.4) * 0.38;
          const perlin01 = Math.min(1, Math.max(0, perlinFbm * 0.5 + 0.5));
          const worley4 = 1 - worley(nx, ny, nz, 4.0);
          const worley8 = 1 - worley(nx + 0.17, ny + 0.41, nz + 0.73, 8.0);
          const worley12 = 1 - worley(nx + 0.39, ny + 0.11, nz + 0.58, 12.0);
          const worleyFbm = worley4 * 0.625 + worley8 * 0.25 + worley12 * 0.125;
          const perlinWorley = Math.min(1, Math.max(0, worleyFbm + perlin01 * (1 - worleyFbm)));
          data[index++] = Math.round(perlinWorley * 255);
          data[index++] = Math.round(worley4 * 255);
          data[index++] = Math.round(worley8 * 255);
          data[index++] = Math.round(worley12 * 255);
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

  function isMobileView() {
    return innerWidth <= 900 || (navigator.maxTouchPoints > 0 && matchMedia("(pointer: coarse)").matches);
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
      for (const name of ["resolution", "time", "cloudType", "coverage", "sunlight", "yaw", "pitch", "zoom", "quality", "accent", "noiseVolume"]) {
        uniforms[name] = gl.getUniformLocation(program, name);
      }

      const noiseTexture = createNoiseTexture(gl);
      const startedAt = performance.now();
      let quality = isMobileView() ? 0 : 1;
      let lastNow = startedAt;
      let slowFrames = 0;

      function render(now) {
        const frameMs = now - lastNow;
        lastNow = now;
        if (quality > 0) {
          if (frameMs > 33) {
            slowFrames += 1;
            if (slowFrames > 18) quality = 0;
          } else {
            slowFrames = Math.max(0, slowFrames - 1);
          }
        }

        const mobile = isMobileView();
        const scale = mobile ? 0.90 : 0.90;
        const pixelRatio = Math.min(devicePixelRatio || 1, mobile ? 1.4 : 1.6) * scale;
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
        gl.uniform1f(uniforms.quality, quality);
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
