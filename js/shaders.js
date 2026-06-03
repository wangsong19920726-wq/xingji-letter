const NoiseChunk = `
    vec4 permute(vec4 x){return mod(((x*34.0)+1.0)*x, 289.0);}
    vec4 taylorInvSqrt(vec4 r){return 1.79284291400159 - 0.85373472095314 * r;}
    float snoise(vec3 v){ 
      const vec2  C = vec2(1.0/6.0, 1.0/3.0) ; const vec4  D = vec4(0.0, 0.5, 1.0, 2.0);
      vec3 i  = floor(v + dot(v, C.yyy) ); vec3 x0 =   v - i + dot(i, C.xxx) ;
      vec3 g = step(x0.yzx, x0.xyz); vec3 l = 1.0 - g;
      vec3 i1 = min( g.xyz, l.zxy ); vec3 i2 = max( g.xyz, l.zxy );
      vec3 x1 = x0 - i1 + 1.0 * C.xxx; vec3 x2 = x0 - i2 + 2.0 * C.xxx; vec3 x3 = x0 - 1. + 3.0 * C.xxx;
      i = mod(i, 289.0 ); 
      vec4 p = permute( permute( permute( i.z + vec4(0.0, i1.z, i2.z, 1.0 )) + i.y + vec4(0.0, i1.y, i2.y, 1.0 )) + i.x + vec4(0.0, i1.x, i2.x, 1.0 ));
      float n_ = 1.0/7.0; vec3  ns = n_ * D.wyz - D.xzx;
      vec4 j = p - 49.0 * floor(p * ns.z *ns.z); vec4 x_ = floor(j * ns.z); vec4 y_ = floor(j - 7.0 * x_ );
      vec4 x = x_ *ns.x + ns.yyyy; vec4 y = y_ *ns.x + ns.yyyy; vec4 h = 1.0 - abs(x) - abs(y);
      vec4 b0 = vec4( x.xy, y.xy ); vec4 b1 = vec4( x.zw, y.zw );
      vec4 s0 = floor(b0)*2.0 + 1.0; vec4 s1 = floor(b1)*2.0 + 1.0; vec4 sh = -step(h, vec4(0.0));
      vec4 a0 = b0.xzyw + s0.xzyw*sh.xxyy ; vec4 a1 = b1.xzyw + s1.xzyw*sh.zzww ;
      vec3 p0 = vec3(a0.xy,h.x); vec3 p1 = vec3(a0.zw,h.y); vec3 p2 = vec3(a1.xy,h.z); vec3 p3 = vec3(a1.zw,h.w);
      vec4 norm = taylorInvSqrt(vec4(dot(p0,p0), dot(p1,p1), dot(p2, p2), dot(p3,p3)));
      p0 *= norm.x; p1 *= norm.y; p2 *= norm.z; p3 *= norm.w;
      vec4 m = max(0.6 - vec4(dot(x0,x0), dot(x1,x1), dot(x2,x2), dot(x3,x3)), 0.0); m = m * m;
      return 42.0 * dot( m*m, vec4( dot(p0,x0), dot(p1,x1), dot(p2,x2), dot(p3,x3) ) );
    }
    float hash(vec3 p) { p = fract(p * 0.1031); p += dot(p, p.yzx + 33.33); return fract((p.x + p.y) * p.z); }
    float fractalNoise(vec3 p) { float n = snoise(p); n += 0.5 * snoise(p * 2.1); n += 0.25 * snoise(p * 4.3); return n * 0.5714; }
    vec3 curlNoise(vec3 p) {
        float e = 0.1; vec3 dx = vec3(e, 0.0, 0.0); vec3 dy = vec3(0.0, e, 0.0); vec3 dz = vec3(0.0, 0.0, e);
        float x = snoise(p + dy) - snoise(p - dy) - snoise(p + dz) + snoise(p - dz);
        float y = snoise(p + dz) - snoise(p - dz) - snoise(p + dx) + snoise(p - dx);
        float z = snoise(p + dx) - snoise(p - dx) - snoise(p + dy) + snoise(p - dy);
        return normalize(vec3(x, y, z));
    }
`;

const ColorChunk = `
    vec3 c = color;
    c *= uBrightness;
    c = (c - 0.5) * uContrast + 0.5;
    float lum = dot(c, vec3(0.299, 0.587, 0.114));
    c = mix(vec3(lum), c, uSaturation);
    c = clamp(c, 0.0, 1.0);
    vColor = c; 
`;

const EffectChunk = `
    float scanAxisPos = position.y;
    if(uScanAxis == 1) scanAxisPos = position.x;
    else if(uScanAxis == 2) scanAxisPos = position.z;
    float maxRadius = max(abs(uScanMin), abs(uScanMax)) * 2.0;
    float distToCenter = length(position);

    if(uMode == 0) { 
        currentThreshold = mix(uScanMin, uScanMax, uProgress); edgeValue = scanAxisPos + noiseMask * uNoiseEdge;
        flowVector = curlNoise(noiseCoords) * 0.5 + vec3(0.0, 1.5, 0.0);
    } else if(uMode == 1) { 
        currentThreshold = mix(0.0, maxRadius, uProgress); edgeValue = distToCenter + noiseMask * uNoiseEdge;
        flowVector = normalize(position + 0.0001) * 1.5 + curlNoise(noiseCoords) * 0.8;
    } else if(uMode == 2) {
        currentThreshold = mix(uScanMin, uScanMax, uProgress); edgeValue = fractalNoise(position * uNoiseScale * 0.5) + noiseMask * uNoiseEdge;
        flowVector = curlNoise(noiseCoords * 2.0) * 1.5;
    } else if(uMode == 3) {
        currentThreshold = mix(uScanMin, uScanMax, uProgress); edgeValue = scanAxisPos + noiseMask * uNoiseEdge;
        float distXZ = length(position.xz); vec3 tangent = vec3(-position.z, 0.0, position.x) / (distXZ + 0.01);
        flowVector = tangent * 3.0 + curlNoise(noiseCoords) * 0.5;
    } else if(uMode == 4) {
        currentThreshold = mix(uScanMin, uScanMax, uProgress); edgeValue = abs(scanAxisPos) + noiseMask * uNoiseEdge;
        flowVector = vec3(0.0, -sign(position.y)*2.5, 0.0) + curlNoise(noiseCoords) * vec3(0.3, 1.0, 0.3);
    } else if(uMode == 5) {
        currentThreshold = mix(uScanMax, uScanMin, uProgress); edgeValue = scanAxisPos + noiseMask * uNoiseEdge;
        flowVector = vec3(0.0, 2.0, 0.0) + curlNoise(noiseCoords * 0.5) * 1.5;
    } else if(uMode == 6) { // 纯正的平面撕裂
        currentThreshold = mix(uScanMin, uScanMax, uProgress); edgeValue = scanAxisPos + noiseMask * uNoiseEdge;
        float glitch = step(0.9, fract(noiseCoords.y * 10.0));
        flowVector = vec3(glitch * 5.0, 0.0, 0.0) + curlNoise(noiseCoords) * 0.2;
    } else if(uMode == 7) {
        currentThreshold = mix(uScanMin, uScanMax, uProgress); edgeValue = scanAxisPos + noiseMask * uNoiseEdge;
        flowVector = curlNoise(noiseCoords * 0.3) * 3.0;
    } else if(uMode == 8) {
        currentThreshold = mix(maxRadius, 0.0, uProgress); edgeValue = distToCenter + noiseMask * uNoiseEdge;
        flowVector = -normalize(position + 0.0001) * 3.0;
    } else if(uMode == 9) {
        currentThreshold = mix(uScanMax, uScanMin, uProgress); edgeValue = position.y + noiseMask * uNoiseEdge;
        float toCenter = -sign(position.y) * length(position.xz); 
        flowVector = vec3(-position.x * toCenter, -3.0, -position.z * toCenter);
    } else if(uMode == 10) {
        currentThreshold = mix(uScanMin, uScanMax, uProgress); edgeValue = scanAxisPos + noiseMask * uNoiseEdge;
        vec3 offset = vec3(0.0, snoise(vec3(floor(position.x*10.0))), 0.0);
        flowVector = step(0.5, fract(offset)) * vec3(0.0, 5.0, 0.0);
    } else if(uMode == 11) {
        currentThreshold = mix(0.0, maxRadius, uProgress); edgeValue = abs(scanAxisPos) + noiseMask * uNoiseEdge; 
        flowVector = vec3(sign(position.x) * 2.0, curlNoise(noiseCoords).y, sign(position.z) * 2.0);
    } else if(uMode == 12) {
        currentThreshold = mix(uScanMin, uScanMax, uProgress); edgeValue = scanAxisPos + noiseMask * uNoiseEdge;
        float blockMask = step(0.5, fractalNoise(floor(position * 4.0)));
        flowVector = vec3(blockMask * 3.0, (1.0-blockMask) * -3.0, 0.0) + curlNoise(noiseCoords);
    } else if(uMode == 13) {
        currentThreshold = mix(uScanMin, uScanMax, uProgress); edgeValue = scanAxisPos + noiseMask * uNoiseEdge;
        flowVector = vec3(hash(position), hash(position+1.0), hash(position+2.0)) * 4.0 - 2.0;
    } else if(uMode == 14) {
        currentThreshold = mix(maxRadius, 0.0, uProgress); edgeValue = distToCenter + noiseMask * uNoiseEdge;
        flowVector = -position * 2.0; 
    } else if(uMode == 15) {
        currentThreshold = mix(uScanMin, uScanMax, uProgress); edgeValue = scanAxisPos + noiseMask * uNoiseEdge;
        float angle = atan(position.z, position.x) + uTime * 2.0;
        flowVector = vec3(cos(angle)*distToCenter - position.x, 1.5, sin(angle)*distToCenter - position.z);
    } else if(uMode == 16) {
        currentThreshold = mix(0.0, maxRadius, uProgress); 
        float ring = sin(distToCenter * 15.0 - uTime * 5.0);
        edgeValue = distToCenter + ring * 0.2 + noiseMask * uNoiseEdge;
        flowVector = normalize(position) * ring * 3.0;
    } else if(uMode == 17) {
        currentThreshold = mix(0.0, maxRadius, uProgress); edgeValue = distToCenter + noiseMask * uNoiseEdge;
        vec3 crossV = vec3(step(abs(position.y), 0.2), step(abs(position.x), 0.2), step(abs(position.z), 0.2));
        flowVector = normalize(position) * (crossV.x + crossV.y + crossV.z) * 5.0;
    } else if(uMode == 18) {
        currentThreshold = mix(uScanMin, uScanMax, uProgress); edgeValue = scanAxisPos + noiseMask * uNoiseEdge;
        float jump = step(0.9, hash(position + uTime));
        flowVector = position * jump * 6.0; 
    } else if(uMode == 19) {
        currentThreshold = mix(uScanMin, uScanMax, uProgress); edgeValue = scanAxisPos + noiseMask * uNoiseEdge;
        vec3 voxelPos = floor(position * 5.0) / 5.0; 
        flowVector = (voxelPos - position) * 10.0 + curlNoise(noiseCoords) * 0.2;
    } else if(uMode == 20) {
        currentThreshold = mix(uScanMin, uScanMax, uProgress); edgeValue = scanAxisPos + noiseMask * uNoiseEdge;
        flowVector = curlNoise(noiseCoords * 0.1) * 2.0; 
    } else if(uMode == 21) {
        currentThreshold = mix(uScanMin, uScanMax, uProgress); edgeValue = scanAxisPos + noiseMask * uNoiseEdge;
        float dens = fractalNoise(position * 2.0);
        flowVector = -normalize(position) * step(0.6, dens) * 3.0 + vec3(0,-1,0); 
    } else if(uMode == 22) {
        currentThreshold = mix(uScanMin, uScanMax, uProgress); edgeValue = scanAxisPos + noiseMask * uNoiseEdge;
        vec3 magNorm = normalize(vec3(position.x, 0.0, position.z) + 0.01);
        flowVector = magNorm * (1.0 + snoise(position * 3.0)) * 2.0;
    } else if(uMode == 23) {
        currentThreshold = mix(0.0, maxRadius, uProgress); edgeValue = distToCenter + noiseMask * uNoiseEdge;
        float tension = sin(position.x*10.0) * sin(position.y*10.0) * sin(position.z*10.0);
        flowVector = normalize(position) * tension * 3.0;
    } else if(uMode == 24) {
        currentThreshold = mix(uScanMin, uScanMax, uProgress); edgeValue = scanAxisPos + noiseMask * uNoiseEdge;
        flowVector = vec3(0.0, 3.0, 0.0) + curlNoise(noiseCoords * 5.0) * 2.0;
    } else if(uMode == 25) {
        currentThreshold = mix(uScanMax, uScanMin, uProgress); edgeValue = scanAxisPos + noiseMask * uNoiseEdge;
        flowVector = vec3(0.0, 1.0, 0.0) * (2.0 - distToCenter);
    } else if(uMode == 26) {
        currentThreshold = mix(uScanMax, uScanMin, uProgress); edgeValue = position.y + noiseMask * uNoiseEdge;
        flowVector = vec3(curlNoise(noiseCoords).x, 4.0, curlNoise(noiseCoords).z);
    } else if(uMode == 27) {
        currentThreshold = mix(uScanMin, uScanMax, uProgress); edgeValue = scanAxisPos + noiseMask * uNoiseEdge;
        float arc = step(0.95, fract(sin(dot(position.xy, vec2(12.9898,78.233))) * 43758.5453 + uTime));
        flowVector = normalize(cross(position, vec3(0,1,0))) * arc * 10.0;
    } else if(uMode == 28) {
        currentThreshold = mix(uScanMin, uScanMax, uProgress); edgeValue = scanAxisPos + noiseMask * uNoiseEdge;
        flowVector = vec3(0.0, -1.0, 0.0) + curlNoise(noiseCoords*0.5)*0.5;
    } else if(uMode == 29) {
        currentThreshold = mix(uScanMin, uScanMax, uProgress); edgeValue = scanAxisPos + noiseMask * uNoiseEdge;
        flowVector = normalize(curlNoise(noiseCoords)) * 3.0; 
    } else if(uMode == 30) {
        currentThreshold = mix(uScanMin, uScanMax, uProgress); edgeValue = scanAxisPos + noiseMask * uNoiseEdge;
        vec3 hex = round(position * 3.0) / 3.0; 
        flowVector = (hex - position) * 8.0;
    } else if(uMode == 31) {
        currentThreshold = mix(0.0, maxRadius, uProgress); edgeValue = distToCenter + noiseMask * uNoiseEdge;
        float phi = distToCenter * 10.0;
        flowVector = vec3(cos(phi), 0.0, sin(phi)) * 2.0;
    } else if(uMode == 32) {
        currentThreshold = mix(uScanMin, uScanMax, uProgress); edgeValue = scanAxisPos + noiseMask * uNoiseEdge;
        float a = atan(position.y, position.x);
        flowVector = vec3(cos(a*2.0), sin(a*2.0), 0.0) * 2.0;
    } else if(uMode == 33) {
        currentThreshold = mix(uScanMin, uScanMax, uProgress); edgeValue = scanAxisPos + noiseMask * uNoiseEdge;
        float wave = sin(position.x*5.0) + cos(position.z*5.0);
        flowVector = vec3(0.0, wave, 0.0) * 2.0;
    } else if(uMode == 34) {
        currentThreshold = mix(uScanMin, uScanMax, uProgress); edgeValue = scanAxisPos + noiseMask * uNoiseEdge;
        vec3 slice = step(0.8, fract(position * 2.0));
        flowVector = slice * normalize(position) * 4.0;
    } else if(uMode == 35) {
        currentThreshold = mix(uScanMin, uScanMax, uProgress); edgeValue = scanAxisPos + noiseMask * uNoiseEdge;
        vec3 cell = floor(position * 4.0) + 0.5;
        flowVector = normalize(position - cell/4.0) * 2.0;
    } else if(uMode == 36) {
        currentThreshold = mix(uScanMin, uScanMax, uProgress); edgeValue = scanAxisPos + noiseMask * uNoiseEdge;
        vec3 p = position * 3.0;
        flowVector = vec3(10.0*(p.y-p.x), p.x*(28.0-p.z)-p.y, p.x*p.y - 2.66*p.z) * 0.05;
    } else if(uMode == 37) {
        currentThreshold = mix(uScanMin, uScanMax, uProgress); edgeValue = scanAxisPos + noiseMask * uNoiseEdge;
        flowVector = vec3(sin(position.z*3.0), 0.0, cos(position.x*3.0)) * 2.0;
    } else if(uMode == 38) {
        currentThreshold = mix(uScanMin, uScanMax, uProgress); edgeValue = scanAxisPos + noiseMask * uNoiseEdge;
        vec2 q = vec2(position.x * 1.1547, position.x * 0.5773 + position.z);
        flowVector = vec3(fract(q.x)-0.5, 0.0, fract(q.y)-0.5) * 3.0;
    } else if(uMode == 39) {
        currentThreshold = mix(uScanMin, uScanMax, uProgress); edgeValue = scanAxisPos + noiseMask * uNoiseEdge;
        vec3 frac = fract(position * 2.0) - 0.5;
        flowVector = normalize(frac) * 2.0;
    } else if(uMode == 40) {
        currentThreshold = mix(maxRadius, 0.0, uProgress); edgeValue = distToCenter + noiseMask * uNoiseEdge;
        flowVector = -normalize(position) * (hash(position)*3.0); 
    } else if(uMode == 41) {
        currentThreshold = mix(uScanMin, uScanMax, uProgress); edgeValue = scanAxisPos + noiseMask * uNoiseEdge;
        flowVector = vec3(position.z, position.x, position.y) * 2.0; 
    } else if(uMode == 42) {
        currentThreshold = mix(uScanMin, uScanMax, uProgress); edgeValue = scanAxisPos + noiseMask * uNoiseEdge;
        flowVector = vec3(sin(uTime*10.0+position.y*20.0), cos(uTime*15.0+position.z*20.0), 0.0) * 0.5;
    } else if(uMode == 43) {
        currentThreshold = mix(uScanMin, uScanMax, uProgress); edgeValue = scanAxisPos + noiseMask * uNoiseEdge;
        flowVector = curlNoise(position*10.0) * step(0.8, fractalNoise(position*2.0)) * 5.0;
    } else if(uMode == 44) {
        currentThreshold = mix(0.0, maxRadius, uProgress); edgeValue = distToCenter + noiseMask * uNoiseEdge;
        flowVector = normalize(position) * snoise(position * 2.0 - uTime) * 3.0;
    } else if(uMode == 45) {
        currentThreshold = mix(uScanMin, uScanMax, uProgress); edgeValue = scanAxisPos + noiseMask * uNoiseEdge;
        float horizon = smoothstep(0.4, 0.5, distToCenter);
        flowVector = mix(vec3(0, -5, 0), normalize(cross(position, vec3(0,1,0))) * 5.0, horizon);
    } else if(uMode == 46) {
        currentThreshold = mix(uScanMin, uScanMax, uProgress); edgeValue = scanAxisPos + noiseMask * uNoiseEdge;
        flowVector = vec3(sin(uTime)*position.y, -cos(uTime)*position.x, 0.0) * 2.0;
    } else if(uMode == 47) {
        currentThreshold = mix(0.0, maxRadius, uProgress); edgeValue = distToCenter + noiseMask * uNoiseEdge;
        vec3 flare = curlNoise(noiseCoords * 0.5) + normalize(position);
        flowVector = flare * step(0.7, snoise(noiseCoords)) * 4.0;
    } else if(uMode == 48) {
        currentThreshold = mix(uScanMin, uScanMax, uProgress); edgeValue = scanAxisPos + noiseMask * uNoiseEdge;
        float prob = hash(position + uTime);
        flowVector = position * step(0.99, prob) * 10.0; 
    } else if(uMode == 49) {
        currentThreshold = mix(maxRadius, 0.0, uProgress); edgeValue = distToCenter + noiseMask * uNoiseEdge;
        flowVector = -position * step(0.5, snoise(position*5.0)); 
    }
`;

export const vertexShader = `
    varying vec3 vColor; varying float vAlpha;
    uniform float uTime; uniform float uPixelRatio; uniform int uMode;
    uniform float uNoiseScale; uniform float uProgress; 
    uniform float uScanMin; uniform float uScanMax; uniform int uScanAxis;
    uniform float uPointSize; uniform float uFadePower; uniform float uSpeedCurve;
    uniform float uNoiseEdge; uniform float uPersistence;
    uniform float uBrightness; uniform float uContrast; uniform float uSaturation;
    
    ${NoiseChunk}

    void main() {
        ${ColorChunk}
        vec3 pos = position; float flowTime = uTime * 0.15;
        vec3 noiseCoords = position * uNoiseScale * 0.8 + flowTime;
        float noiseMask = fractalNoise(noiseCoords); 
        float currentThreshold; float edgeValue; vec3 flowVector;
        
        ${EffectChunk}
        
        float rawFactor = smoothstep(currentThreshold, currentThreshold + uNoiseEdge + 0.4, edgeValue);
        float pHash = hash(position);

        if(rawFactor > 0.0) {
            if(pHash > uPersistence) {
                float curvedFactor = pow(rawFactor, uSpeedCurve); 
                float intensity = curvedFactor * 3.0; 
                pos += flowVector * intensity;
                vAlpha = max(0.0, 1.0 - pow(rawFactor, uFadePower));
                float ember = max(0.0, sin(rawFactor * 3.14159) * 0.3);
                vColor += vColor * ember * vAlpha; 
            } else { vAlpha = mix(1.0, 0.3, rawFactor); }
        } else { vAlpha = 1.0; }

        vec4 mvPosition = modelViewMatrix * vec4(pos, 1.0);
        gl_Position = projectionMatrix * mvPosition;
        float dynamicSize = mix(uPointSize, uPointSize * 3.5, rawFactor);
        gl_PointSize = (dynamicSize * (2.0 / -mvPosition.z)) * uPixelRatio;
    }
`;

export const fragmentShader = `
    varying vec3 vColor; varying float vAlpha;
    void main() {
        vec2 pt = gl_PointCoord - vec2(0.5); float dist = length(pt);
        float softEdge = exp(-dist * dist * 12.0) * 0.4;
        float core = smoothstep(0.15, 0.0, dist) * 0.8;
        float finalAlpha = vAlpha * (softEdge + core);
        if(finalAlpha < 0.005) discard;
        gl_FragColor = vec4(vColor, finalAlpha);
    }
`;