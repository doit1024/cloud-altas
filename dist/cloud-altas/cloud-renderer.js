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
  uniform float flash;
  uniform vec3 flashColor;
  uniform int segCount;
  uniform vec4 light0;
  uniform vec4 light1;
  uniform vec4 segA[64];
  uniform vec4 segB[64];

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

  float sphere(vec3 p, vec3 center, float radius) {
    return 1.0 - length(p - center) / max(radius, 0.001);
  }

  // Positive-inside fields. blend is in the same units as the field, not world distance.
  float smoothUnion(float a, float b, float blend) {
    float h = clamp(0.5 + 0.5 * (a - b) / blend, 0.0, 1.0);
    return mix(b, a, h) + blend * h * (1.0 - h);
  }

  float stratocumulusEnvelope(vec3 p) {
    float field = sphere(p, vec3(-1.55, -0.02, 0.06), 0.70);
    field = smoothUnion(field, sphere(p, vec3(-0.72, 0.20, -0.14), 0.62), 0.40);
    field = smoothUnion(field, sphere(p, vec3(0.12, 0.04, 0.16), 0.74), 0.44);
    field = smoothUnion(field, sphere(p, vec3(0.92, 0.24, -0.06), 0.60), 0.40);
    field = smoothUnion(field, sphere(p, vec3(1.62, 0.00, 0.12), 0.66), 0.42);
    field = smoothUnion(field, sphere(p, vec3(-0.28, 0.52, 0.04), 0.48), 0.34);
    field = smoothUnion(field, sphere(p, vec3(0.62, 0.50, 0.16), 0.46), 0.32);
    return min(field, p.y + 0.92);
  }

  float cumulusEnvelope(vec3 p) {
    float field = sphere(p, vec3(0.02, -0.12, 0.0), 0.86);
    field = smoothUnion(field, sphere(p, vec3(-0.58, 0.16, 0.12), 0.58), 0.38);
    field = smoothUnion(field, sphere(p, vec3(0.60, 0.12, -0.10), 0.54), 0.38);
    field = smoothUnion(field, sphere(p, vec3(0.06, 0.52, -0.02), 0.52), 0.36);
    field = smoothUnion(field, sphere(p, vec3(-0.24, 0.92, 0.10), 0.40), 0.32);
    field = smoothUnion(field, sphere(p, vec3(0.34, 0.84, -0.12), 0.36), 0.30);
    return min(field, p.y + 0.82);
  }

  float cumulonimbusEnvelope(vec3 p) {
    float column = sphere(p, vec3(0.04, -0.08, 0.0), 0.74);
    column = smoothUnion(column, sphere(p, vec3(-0.22, 0.48, 0.08), 0.58), 0.40);
    column = smoothUnion(column, sphere(p, vec3(0.20, 0.98, -0.05), 0.52), 0.38);
    column = smoothUnion(column, sphere(p, vec3(-0.02, 1.42, 0.04), 0.46), 0.36);
    column = smoothUnion(column, sphere(p, vec3(0.12, 1.76, 0.0), 0.40), 0.32);
    float anvil = ellipsoid(p, vec3(0.10, 2.02, 0.0), vec3(1.68, 0.40, 0.92));
    anvil = smoothUnion(anvil, sphere(p, vec3(-0.78, 1.90, 0.12), 0.44), 0.34);
    anvil = smoothUnion(anvil, sphere(p, vec3(0.92, 1.86, -0.08), 0.40), 0.32);
    float base = ellipsoid(p, vec3(-0.12, -0.58, 0.0), vec3(1.58, 0.50, 1.08));
    base = smoothUnion(base, sphere(p, vec3(0.82, -0.32, 0.14), 0.52), 0.38);
    base = smoothUnion(base, sphere(p, vec3(-0.92, -0.40, -0.10), 0.48), 0.36);
    return smoothUnion(smoothUnion(column, anvil, 0.42), base, 0.48);
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
      envelope = stratocumulusEnvelope(p);
    } else if (cloudType < 6.5) {
      envelope = cumulusEnvelope(p);
    } else {
      envelope = cumulonimbusEnvelope(p);
    }

    return envelope;
  }

  float cloudDensity(vec3 p, out float envelope) {
    envelope = cloudEnvelope(p);
    if (envelope < -0.48) return 0.0;

    vec3 wind = vec3(time * 0.0115, time * 0.0018, time * 0.0009);
    vec3 uvw = fract(p * 0.285 + wind + vec3(0.37, 0.61, 0.19));
    vec3 coarse = texture(noiseVolume, uvw).rgb;

    float heightBlend = smoothstep(-0.65, 1.45, p.y);
    float perlinWorley = mix(coarse.r, 1.0 - coarse.r, heightBlend * 0.22);
    float coarseEdge = (perlinWorley - 0.50) * 1.34 + (coarse.g - 0.50) * 0.56;
    // Fine noise only shapes the shell. Deep inside uses the mean so the core stays smooth.
    float shell = 1.0 - smoothstep(0.04, 0.40, envelope);
    float fineB = 0.50;
    if (shell > 0.04) {
      fineB = mix(0.50, texture(noiseVolume, fract(uvw * 2.37 + vec3(0.17, 0.43, 0.29))).b, shell);
    }
    float erosion = coarse.g * 0.58 + fineB * 0.42;
    float edgeNoise = coarseEdge + (fineB - 0.50) * 0.32;
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
    float sharp = henyeyGreenstein(0.74, cosTheta);
    float broad = henyeyGreenstein(0.30, cosTheta);
    float back = henyeyGreenstein(-0.24, cosTheta);
    return mix(mix(sharp, broad, 0.38), back, 0.16);
  }

  float lightTransmittance(vec3 p, vec3 lightDirection) {
    float opticalDepth = 0.0;
    float lightSteps[4] = float[4](0.10, 0.18, 0.36, 0.72);
    for (int i = 0; i < 4; i++) {
      float ignored = 0.0;
      p += lightDirection * lightSteps[i];
      opticalDepth += cloudDensity(p, ignored) * lightSteps[i];
    }
    float primary = exp(-opticalDepth * 2.75);
    float secondary = exp(-opticalDepth * 0.96) * 0.34;
    float tertiary = exp(-opticalDepth * 0.33) * 0.14;
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
    float depthMark[6];
    float span = max(farDistance - nearDistance, 0.001);
    for (int k = 0; k < 6; k++) depthMark[k] = 1.0;
    int markCount = 0;

    for (int i = 0; i < 56; i++) {
      if (travel > farDistance || transmittance < 0.018) break;
      for (int k = 0; k < 6; k++) {
        if (markCount >= 6) break;
        float mark = nearDistance + span * float(markCount) / 5.0;
        if (travel + baseStep < mark) break;
        depthMark[markCount] = transmittance;
        markCount++;
      }

      vec3 samplePosition = rayOrigin + rayDirection * travel;
      samplePosition.z *= 0.86;
      float envelope = -2.0;
      float density = cloudDensity(samplePosition, envelope);

      if (density > 0.008) {
        insideCloud = true;
        float lightVisibility = lightTransmittance(samplePosition, lightDirection);
        float ignored = 0.0;
        float localOcclusion = cloudDensity(samplePosition + lightDirection * 0.14, ignored);
        float surfaceLight = mix(0.52, 1.18, exp(-localOcclusion * 2.2));
        float powder = 1.0 - exp(-density * 2.6);
        float silver = pow(clamp(1.0 - lightVisibility, 0.0, 1.0), 0.45) * phase;
        vec3 lighting = skyAmbient * (0.50 + 0.27 * powder);
        lighting += sunColor * sunlight * typeSunlight * lightVisibility * surfaceLight * (1.92 + phase * 1.36);
        lighting += sunColor * silver * 0.14 * sunlight * typeSunlight;
        lighting = mix(lighting, accent, 0.025);
        if (flash > 0.001) {
          float lit = 0.0;
          for (int lamp = 0; lamp < 2; lamp++) {
            vec4 bulb = lamp == 0 ? light0 : light1;
            vec3 toward = bulb.xyz - samplePosition;
            float radius2 = dot(toward, toward);
            float reach = sqrt(max(radius2, 1e-5));
            vec3 lightStep = toward / reach;
            float optical = 0.0;
            float walked = 0.0;
            for (int j = 1; j <= 2; j++) {
              float lightStride = 0.18 * float(j);
              walked += lightStride;
              float lampIgnored = 0.0;
              optical += cloudDensity(samplePosition + lightStep * min(walked, reach), lampIgnored) * lightStride;
            }
            lit += bulb.w * exp(-optical * 2.04) / (radius2 + 0.18);
          }
          lighting += flashColor * flash * 9.0 * lit;
        }

        float sampleAlpha = 1.0 - exp(-density * baseStep * 2.04);
        accumulated += transmittance * lighting * sampleAlpha;
        transmittance *= 1.0 - sampleAlpha;
      }

      float stride = insideCloud ? 1.0 : (density > 0.0 ? 1.35 : 2.15);
      if (envelope < -0.48) {
        float farOutside = -envelope - 0.48;
        stride = clamp(stride + farOutside * 0.65 / max(baseStep, 0.02), stride, 4.2);
        insideCloud = false;
      } else if (insideCloud && density <= 0.004) {
        insideCloud = false;
      }
      travel += baseStep * stride;
    }
    for (int k = 0; k < 6; k++) {
      if (markCount >= 6) break;
      depthMark[markCount] = transmittance;
      markCount++;
    }

    float opacity = 1.0 - transmittance;
    vec3 cloudRgb = vec3(0.0);
    float cloudAlpha = 0.0;
    if (opacity >= 0.006) {
      vec3 averageColor = accumulated / max(opacity, 0.001);
      vec3 color = 1.0 - exp(-averageColor * 1.56);
      color = pow(max(color, 0.0), vec3(0.92));
      cloudRgb = color * opacity;
      cloudAlpha = opacity;
    }

    float coreMask = 0.0;
    float glowMask = 0.0;
    float bloomMask = 0.0;
    if (flash > 0.001 && segCount > 0) {
      vec3 flatOrigin = vec3(rayOrigin.xy, rayOrigin.z * 0.86);
      vec3 flatDirection = vec3(rayDirection.xy, rayDirection.z * 0.86);
      float directionLength2 = max(dot(flatDirection, flatDirection), 1e-6);
      for (int i = 0; i < 64; i++) {
        if (i >= segCount) break;
        vec3 start = segA[i].xyz;
        vec3 endPoint = segB[i].xyz;
        float brightness = segA[i].w;
        float radius = max(segB[i].w, 1e-4);
        vec3 segment = endPoint - start;
        vec3 offset = flatOrigin - start;
        float directionDot = dot(flatDirection, segment);
        float segmentLength2 = dot(segment, segment);
        float originDot = dot(flatDirection, offset);
        float segmentDot = dot(segment, offset);
        float denominator = directionLength2 * segmentLength2 - directionDot * directionDot;
        float along = denominator > 1e-6
          ? clamp((directionLength2 * segmentDot - directionDot * originDot) / denominator, 0.0, 1.0)
          : 0.0;
        float rayTravel = max((directionDot * along - originDot) / directionLength2, 0.0);
        float distanceToBolt = length(offset + flatDirection * rayTravel - segment * along);
        float occlusion = 1.0;
        if (rayTravel > nearDistance && span > 0.0) {
          float depth = clamp((rayTravel - nearDistance) / span, 0.0, 1.0) * 5.0;
          int bin = int(min(depth, 4.0));
          occlusion = mix(depthMark[bin], depthMark[bin + 1], fract(depth));
        }
        brightness *= occlusion;
        float pixelWidth = rayTravel * (2.0 / 1.74) / resolution.y;
        float edge = max(radius * 0.30, pixelWidth * 0.85);
        float normalized = distanceToBolt / radius;
        coreMask = max(coreMask, (1.0 - smoothstep(radius - edge, radius + edge, distanceToBolt)) * brightness);
        glowMask = max(glowMask, exp(-(normalized * normalized) / 15.0) * brightness);
        bloomMask = max(bloomMask, exp(-(distanceToBolt * distanceToBolt) / 0.04) * brightness);
      }
    }

    float flashCover = clamp(flash, 0.0, 1.0);
    vec3 bolt = (vec3(1.0) * 11.0 * coreMask
      + vec3(0.70, 0.82, 1.0) * 1.7 * glowMask
      + vec3(0.56, 0.60, 1.0) * 0.22 * bloomMask) * flash;
    float boltPeak = max(bolt.r, max(bolt.g, bolt.b));
    vec3 boltColor = bolt / (1.0 + boltPeak * 0.18);
    float coreA = clamp(coreMask, 0.0, 1.0) * flashCover;
    float boltCover = clamp((coreMask * 0.95 + glowMask * 0.42 + bloomMask * 0.18) * flashCover, 0.0, 1.0);
    vec3 veil = flashColor * flash * 0.035 * clamp(glowMask + bloomMask, 0.0, 1.0);
    if (cloudAlpha < 0.004 && boltCover < 0.015) {
      fragColor = vec4(0.0);
      return;
    }
    vec3 rgb = cloudRgb * (1.0 - coreA) + boltColor + veil;
    float alpha = min(1.0, cloudAlpha * (1.0 - coreA) + boltCover);
    fragColor = vec4(rgb, alpha);
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

  const BOLT_LIMIT = 64;
  const AUTO_STRIKE_MS = 5000;
  const FLASH_COLOR = [0.74, 0.8, 1];
  const BOLT_GEOMETRY = {
    radius: [0.0105, 0.0062, 0.0038, 0.0024],
    brightness: [1, 0.58, 0.34, 0.2],
    steps: [30, 6, 3, 2],
    length: [0.2, 0.15, 0.11, 0.08],
    count: [7, 8, 6],
    maxLevel: 3,
    kink: 0.42,
    hardProbability: 0.16,
    hook: 2.4,
    persist: 0.72,
    fall: 0.3,
  };
  const BOLT_PROFILES = {
    0: { x: [0.45, 1.55], y: [0.5, 0.78], z: [-0.28, 0.28], scale: 0.45 },
    2: { x: [0.2, 0.85], y: [0.08, 0.42], z: [-0.32, 0.32], scale: 0.55 },
    3: { x: [0.45, 1.5], y: [0.2, 0.42], z: [-0.4, 0.4], scale: 0.5 },
    4: { x: [0.3, 1.15], y: [0.05, 0.5], z: [-0.4, 0.4], scale: 0.72 },
    5: { x: [0.3, 1.1], y: [0.28, 0.82], z: [-0.35, 0.35], scale: 0.82 },
    6: { x: [0.22, 0.82], y: [0.28, 0.92], z: [-0.32, 0.32], scale: 0.84 },
    7: { x: [0.15, 0.55], y: [1.15, 1.95], z: [-0.35, 0.35], scale: 1 },
  };

  function uniformRange(min, max) {
    return min + Math.random() * (max - min);
  }

  function normalize3(vector) {
    const length = Math.hypot(vector[0], vector[1], vector[2]) || 1;
    return [vector[0] / length, vector[1] / length, vector[2] / length];
  }

  function buildStrike(cloudType, limit) {
    const profile = BOLT_PROFILES[cloudType] || BOLT_PROFILES[6];
    const geometry = BOLT_GEOMETRY;
    const segments = [];
    let budget = limit;
    const roomLeft = () => budget - segments.length;

    function walk(origin, direction, level, brightness, steps, leaderSteps) {
      const nodes = [];
      const radius = geometry.radius[level];
      const stepLength = geometry.length[level] * profile.scale;
      let point = origin.slice();
      let heading = direction.slice();
      for (let index = 0; index < steps && roomLeft() > 0; index++) {
        const bend = Math.random() < geometry.hardProbability ? geometry.kink * geometry.hook : geometry.kink;
        const leader = index < leaderSteps;
        const fall = leader ? 0.04 : geometry.fall;
        const verticalCap = leader ? -0.08 : -0.5;
        heading = normalize3([
          heading[0] * geometry.persist + uniformRange(-bend, bend),
          Math.min(heading[1] * geometry.persist - fall, verticalCap),
          heading[2] * geometry.persist + uniformRange(-bend, bend),
        ]);
        const next = [
          point[0] + heading[0] * stepLength * uniformRange(0.7, 1.3),
          point[1] + heading[1] * stepLength * uniformRange(0.7, 1.3),
          point[2] + heading[2] * stepLength * uniformRange(0.7, 1.3),
        ];
        const progress = (index + 1) / steps;
        const fade = level === 0 ? 1 - 0.08 * progress : Math.pow(1 - progress, 0.85);
        segments.push({
          a: point,
          b: next,
          brightness: brightness * fade,
          radius,
          branch: level > 0,
        });
        if (index > 0) nodes.push({ p: next, dir: heading.slice(), brightness: brightness * fade });
        point = next;
      }
      return nodes;
    }

    function channel(channelBudget, amplitude, branchCounts) {
      budget = Math.min(limit, segments.length + channelBudget);
      const side = Math.random() < 0.5 ? -1 : 1;
      const origin = [
        side * uniformRange(profile.x[0], profile.x[1]),
        uniformRange(profile.y[0], profile.y[1]),
        uniformRange(profile.z[0], profile.z[1]),
      ];
      const heading = normalize3([
        side * uniformRange(0.8, 1.1),
        uniformRange(-0.22, -0.05),
        uniformRange(-0.35, 0.35),
      ]);
      const levels = [walk(origin, heading, 0, amplitude, Math.round(geometry.steps[0] * amplitude), Math.round(uniformRange(2, 4)))];
      if (amplitude > 0.8 && levels[0].length > 6 && Math.random() < 0.6) {
        const splitAt = levels[0][Math.floor(uniformRange(0.42, 0.68) * levels[0].length)];
        const splitHeading = normalize3([
          splitAt.dir[0] + uniformRange(-0.7, 0.7),
          splitAt.dir[1],
          splitAt.dir[2] + uniformRange(-0.45, 0.45),
        ]);
        levels[0] = levels[0].concat(walk(
          splitAt.p,
          splitHeading,
          0,
          0.82 * uniformRange(0.85, 1),
          Math.round(geometry.steps[0] * 0.4),
          0,
        ));
      }
      for (let level = 0; level < geometry.maxLevel; level++) {
        const parents = (levels[level] || []).slice();
        const children = [];
        for (let branch = 0; branch < branchCounts[level] && roomLeft() > 3 && parents.length; branch++) {
          const parent = parents.splice(Math.floor(Math.random() * parents.length), 1)[0];
          const branchSide = Math.random() < 0.5 ? -1 : 1;
          const branchHeading = normalize3([
            parent.dir[0] + branchSide * uniformRange(0.55, 1.3),
            parent.dir[1] * uniformRange(0.35, 0.85),
            parent.dir[2] + uniformRange(-0.9, 0.9),
          ]);
          children.push(...walk(
            parent.p,
            branchHeading,
            level + 1,
            parent.brightness * geometry.brightness[level + 1],
            geometry.steps[level + 1],
            0,
          ));
        }
        levels[level + 1] = children;
      }
      return origin;
    }

    const counts = geometry.count.map((count) => Math.max(0, Math.round(count)));
    const doubled = Math.random() < 0.3;
    const origin = channel(
      doubled ? Math.round(limit * 0.58) : limit,
      1,
      doubled ? counts.map((count) => Math.ceil(count * 0.6)) : counts,
    );
    if (doubled) {
      channel(
        limit,
        uniformRange(0.55, 0.75),
        counts.map((count) => Math.ceil(count * 0.4)),
      );
    }

    const strokes = [{ t0: 0, amplitude: 1, tau: uniformRange(0.055, 0.09), branched: 1 }];
    let cursor = 0;
    let afterglow = false;
    if (Math.random() < 0.72) {
      const returns = Math.max(1, Math.round(uniformRange(1, 3)));
      for (let index = 0; index < returns; index++) {
        cursor += uniformRange(0.04, 0.1);
        strokes.push({
          t0: cursor,
          amplitude: uniformRange(0.35, 0.9),
          tau: uniformRange(0.04, 0.08),
          branched: 0.16,
        });
      }
    }
    if (Math.random() < 0.45) {
      strokes.push({ t0: cursor + 0.02, amplitude: 0.13, tau: 0.34, branched: 0.1 });
      afterglow = true;
    }

    return {
      segments: segments.slice(0, limit),
      origin,
      strokes,
      duration: strokes[strokes.length - 1].t0 + (afterglow ? 1 : 0.45),
      startedAt: 0,
    };
  }

  function strikeEnergy(strike, elapsed) {
    let energy = 0;
    let branchEnergy = 0;
    for (const stroke of strike.strokes) {
      if (elapsed < stroke.t0) continue;
      const age = elapsed - stroke.t0;
      const pulse = stroke.amplitude * Math.min(1, age / 0.008) * Math.exp(-age / stroke.tau);
      energy += pulse;
      branchEnergy = Math.max(branchEnergy, pulse * stroke.branched);
    }
    return {
      flash: energy * uniformRange(0.82, 1.18),
      branchGate: energy > 0 ? Math.max(branchEnergy / energy, 0.12) : 0,
    };
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
      for (const name of ["resolution", "time", "cloudType", "coverage", "sunlight", "yaw", "pitch", "zoom", "accent", "noiseVolume", "flash", "flashColor", "segCount", "light0", "light1", "segA[0]", "segB[0]"]) {
        uniforms[name] = gl.getUniformLocation(program, name);
      }
      if (uniforms["segA[0]"] == null || uniforms["segB[0]"] == null) {
        throw new Error("Lightning segment uniforms were not linked");
      }

      const noiseTexture = createNoiseTexture(gl);
      const startedAt = performance.now();
      const segmentStart = new Float32Array(BOLT_LIMIT * 4);
      const segmentEnd = new Float32Array(BOLT_LIMIT * 4);
      let activeCloudId = null;
      let strike = null;
      let nextStrikeAt = Infinity;
      let reportedGlError = false;

      function beginStrike(now, cloudType, limit) {
        strike = buildStrike(cloudType, limit);
        strike.startedAt = now;
        nextStrikeAt = now + AUTO_STRIKE_MS;
      }

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
        const segmentLimit = innerWidth < 700 ? 32 : BOLT_LIMIT;
        if (cloud.id !== activeCloudId) {
          activeCloudId = cloud.id;
          strike = null;
          nextStrikeAt = now + AUTO_STRIKE_MS;
        }
        const strikeElapsed = strike ? (now - strike.startedAt) / 1000 : 0;
        if (strike && strikeElapsed > strike.duration) strike = null;
        if (state.strikeRequested) {
          state.strikeRequested = false;
          beginStrike(now, cloud.type, segmentLimit);
        } else if (!strike && !document.hidden && now >= nextStrikeAt) {
          beginStrike(now, cloud.type, segmentLimit);
        }

        let flash = 0;
        let segmentCount = 0;
        segmentStart.fill(0);
        segmentEnd.fill(0);
        if (strike) {
          const energy = strikeEnergy(strike, strikeElapsed);
          flash = energy.flash;
          const branchGate = energy.branchGate;
          segmentCount = strike.segments.length;
          for (let index = 0; index < segmentCount; index++) {
            const segment = strike.segments[index];
            const brightness = segment.brightness * (segment.branch ? branchGate : 1);
            const offset = index * 4;
            segmentStart[offset] = segment.a[0];
            segmentStart[offset + 1] = segment.a[1];
            segmentStart[offset + 2] = segment.a[2] * 0.86;
            segmentStart[offset + 3] = brightness;
            segmentEnd[offset] = segment.b[0];
            segmentEnd[offset + 1] = segment.b[1];
            segmentEnd[offset + 2] = segment.b[2] * 0.86;
            segmentEnd[offset + 3] = segment.radius;
          }
        }
        const origin = strike ? strike.origin : [0, 0, 0];
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
        gl.uniform1f(uniforms.flash, flash);
        gl.uniform3f(uniforms.flashColor, FLASH_COLOR[0], FLASH_COLOR[1], FLASH_COLOR[2]);
        gl.uniform1i(uniforms.segCount, segmentCount);
        gl.uniform4f(
          uniforms.light0,
          origin[0] * 0.45,
          origin[1] + 0.05,
          origin[2] * 0.45 * 0.86,
          strike ? 1 : 0,
        );
        gl.uniform4f(uniforms.light1, origin[0], origin[1], origin[2] * 0.86, strike ? 0.75 : 0);
        if (segmentCount > 0) {
          gl.uniform4fv(uniforms["segA[0]"], segmentStart);
          gl.uniform4fv(uniforms["segB[0]"], segmentEnd);
        }
        gl.drawArrays(gl.TRIANGLES, 0, 3);
        const glError = gl.getError();
        if (glError && !reportedGlError) {
          reportedGlError = true;
          console.error("Volumetric cloud renderer WebGL error", glError);
        }
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
