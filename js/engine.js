import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { AfterimagePass } from 'three/examples/jsm/postprocessing/AfterimagePass.js';
import { vertexShader, fragmentShader } from './shaders.js';
import { AppState, SysState, CLOUD_CAMERA_Z, CLOUD_SCALE, BG_BRIGHTNESS } from './config.js';

export let scene, camera, renderer, composer, points, material, controls;
export let bloomPass, afterimagePass;
export let bgScene, bgCamera, bgMesh;   // 独立背景层（银河图）
let currentCamAnim = null; 

export function initEngine() {
    scene = new THREE.Scene();
    camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.01, 1000);
    camera.position.set(0, 0, CLOUD_CAMERA_Z); // 开局拉近，让点云充满屏幕

    renderer = new THREE.WebGLRenderer({ antialias: false, alpha: true, premultipliedAlpha: false, powerPreference: "high-performance", preserveDrawingBuffer: true });
    renderer.setPixelRatio(SysState.pixelRatio);
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setClearColor(0x000000, 0); // 透明背景，让底层银河图透出来
    renderer.autoClearColor = true;
    renderer.toneMapping = THREE.ACESFilmicToneMapping; 
    renderer.toneMappingExposure = AppState.exposure;
    document.body.appendChild(renderer.domElement);

    const renderScene = new RenderPass(scene, camera);
    bloomPass = new UnrealBloomPass(new THREE.Vector2(window.innerWidth, window.innerHeight), 1.5, 0.4, 0.85);
    bloomPass.threshold = 0.05; bloomPass.strength = AppState.bloomStrength; bloomPass.radius = 1.2;

    afterimagePass = new AfterimagePass();
    afterimagePass.uniforms['damp'].value = AppState.damp;
    afterimagePass.enabled = false; // 关闭残影：它会强制黑底，挡住底层银河图

    // 用带 alpha 的渲染目标，保证整条后期链透明
    const rtParams = { type: THREE.HalfFloatType };
    composer = new EffectComposer(renderer);
    composer.addPass(renderScene);
    composer.addPass(afterimagePass);
    composer.addPass(bloomPass);

    controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true; controls.dampingFactor = 0.06;
    controls.rotateSpeed = 0.6; controls.zoomSpeed = 0.7; controls.panSpeed = 0.6;

    // 不设 scene.background：保持画布透明，让底层 CSS 银河图透出来

    // ===== 银河图背景：作为一个大平面放进主场景最远处 =====
    // 跟点云在同一场景，一起被渲染和后期处理，必定显示，无透明依赖。
    new THREE.TextureLoader().load('./assets/bg-galaxy.jpg', (tex) => {
        tex.colorSpace = THREE.SRGBColorSpace;
        const g = BG_BRIGHTNESS;
        const mat = new THREE.MeshBasicMaterial({
            map: tex, depthWrite: false, depthTest: true,
            transparent: true, opacity: 0.9, toneMapped: true,
            color: new THREE.Color(g, g, g)   // 用灰度系数整体压暗，避免过曝抢戏
        });
        const geo = new THREE.PlaneGeometry(72, 42);
        bgMesh = new THREE.Mesh(geo, mat);
        bgMesh.position.set(0, 0, -30);
        bgMesh.renderOrder = -999;
        scene.add(bgMesh);
    });
    
    // 成品：不显示默认几何体，直接等待点云加载
}

export function createPoints(geometry, isDefault = false) {
    if (points) { 
        scene.remove(points); 
        if(points.geometry) points.geometry.dispose(); 
        if(points.material) points.material.dispose();
    }

    geometry.computeBoundingBox();
    const center = new THREE.Vector3(); geometry.boundingBox.getCenter(center);
    geometry.translate(-center.x, -center.y, -center.z); 
    const size = new THREE.Vector3(); geometry.boundingBox.getSize(size);
    const maxDim = Math.max(size.x, size.y, size.z);
    const scaleFactor = (maxDim === 0 ? 1.0 : 2.0 / maxDim) * CLOUD_SCALE; 
    
    if (!geometry.attributes.color) {
        const count = geometry.attributes.position.count;
        const colors = new Float32Array(count * 3);
        for (let i = 0; i < count; i++) {
            if(isDefault) { colors[i*3] = 0.2; colors[i*3+1] = 0.6; colors[i*3+2] = 1.0; } 
            else { let y = geometry.attributes.position.getY(i) / maxDim; colors[i*3] = 0.5+y; colors[i*3+1] = 0.8; colors[i*3+2] = 1.0; }
        }
        geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    }

    let generatedUniforms = { uTime: { value: 0 }, uPixelRatio: { value: SysState.pixelRatio } };
    for(let key in AppState) {
        let uName = 'u' + key.charAt(0).toUpperCase() + key.slice(1);
        generatedUniforms[uName] = { value: AppState[key] };
    }

    material = new THREE.ShaderMaterial({
        uniforms: generatedUniforms,
        vertexShader, fragmentShader, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, vertexColors: true
    });

    points = new THREE.Points(geometry, material);
    points.scale.set(scaleFactor, scaleFactor, scaleFactor);
    scene.add(points);
}

export function playCameraMove(index) {
    if(!window.gsap) return;
    if(currentCamAnim) currentCamAnim.kill();
    window.gsap.killTweensOf(camera.position);
    window.gsap.killTweensOf(camera);

    if(index === 0) return; 

    const T = controls.target.clone(); 
    const startPos = camera.position.clone();
    const cMin = AppState.camMin;
    const cMax = AppState.camMax;
    const clampR = (r) => Math.min(Math.max(r, cMin), cMax);
    
    let R = clampR(startPos.distanceTo(T)); 
    const dir = new THREE.Vector3().subVectors(startPos, T).normalize();

    window.gsap.to(camera, {fov: 60, duration: 1.5, ease: "sine.inOut", onUpdate: () => camera.updateProjectionMatrix()});

    let tl = window.gsap.timeline({repeat: -1}); 
    let proxy, startAng;

    switch(index) {
        case 1: 
            proxy = { angle: 0 }; startAng = Math.atan2(startPos.x - T.x, startPos.z - T.z);
            tl.to(proxy, { angle: Math.PI * 2, duration: 20, ease: "none", onUpdate: () => {
                camera.position.x = T.x + Math.sin(startAng + proxy.angle) * R; camera.position.z = T.z + Math.cos(startAng + proxy.angle) * R; camera.position.y = startPos.y + Math.sin(proxy.angle * 2) * R * 0.05; 
            }});
            break;
        case 2: 
            let closeDist = clampR(R * 0.5);
            tl.to(camera.position, { x: T.x + dir.x * closeDist, y: T.y + dir.y * closeDist, z: T.z + dir.z * closeDist, duration: 15, ease: "sine.inOut", yoyo: true, repeat: -1 });
            break;
        case 3: 
            let farDist = clampR(R * 1.8);
            tl.to(camera.position, { x: T.x + dir.x * farDist, y: T.y + dir.y * farDist, z: T.z + dir.z * farDist, duration: 15, ease: "sine.inOut", yoyo: true, repeat: -1 });
            break;
        case 4: 
            let rightPos = new THREE.Vector3(dir.z, 0, -dir.x).normalize().multiplyScalar(R * 0.6);
            tl.to(camera.position, { x: startPos.x + rightPos.x, z: startPos.z + rightPos.z, duration: 6, ease: "sine.inOut" })
              .to(camera.position, { x: startPos.x - rightPos.x, z: startPos.z - rightPos.z, duration: 12, ease: "sine.inOut" })
              .to(camera.position, { x: startPos.x, z: startPos.z, duration: 6, ease: "sine.inOut" });
            break;
        case 5: 
            let upY = T.y + R * 0.8; let downY = T.y - R * 0.3;
            tl.to(camera.position, { y: upY, duration: 6, ease: "sine.inOut" }).to(camera.position, { y: downY, duration: 12, ease: "sine.inOut" }).to(camera.position, { y: startPos.y, duration: 6, ease: "sine.inOut" });
            break;
        case 6: 
            proxy = { angle: 0, r: R }; startAng = Math.atan2(startPos.x - T.x, startPos.z - T.z); let targetR = clampR(R * 0.6);
            tl.to(proxy, { angle: Math.PI * 2, r: targetR, duration: 18, ease: "sine.inOut", yoyo: true, repeat: -1, onUpdate: () => {
                camera.position.x = T.x + Math.sin(startAng + proxy.angle) * proxy.r; camera.position.z = T.z + Math.cos(startAng + proxy.angle) * proxy.r;
            }});
            break;
        case 7: 
            proxy = { angle: -0.4 }; let arcR = clampR(R * 0.7); startAng = Math.atan2(startPos.x - T.x, startPos.z - T.z);
            tl.fromTo(proxy, {angle: -0.4}, { angle: 0.4, duration: 10, ease: "sine.inOut", yoyo: true, repeat: -1, onUpdate: () => {
                camera.position.x = T.x + Math.sin(startAng + proxy.angle) * arcR; camera.position.z = T.z + Math.cos(startAng + proxy.angle) * arcR; camera.position.y = startPos.y; 
            }});
            break;
        case 8: 
            camera.position.set(T.x + 0.01, T.y + R, T.z + 0.01); proxy = { angle: 0 };
            tl.to(proxy, { angle: Math.PI * 2, duration: 16, ease: "none", onUpdate: () => {
                camera.position.x = T.x + Math.sin(proxy.angle) * R * 0.2; camera.position.z = T.z + Math.cos(proxy.angle) * R * 0.2;
            }});
            break;
        case 9: 
            let lowR = clampR(R * 0.9); camera.position.set(startPos.x, T.y - lowR * 0.4, startPos.z); proxy = { angle: 0 }; startAng = Math.atan2(startPos.x - T.x, startPos.z - T.z);
            tl.to(proxy, { angle: Math.PI * 2, duration: 20, ease: "none", onUpdate: () => { camera.position.x = T.x + Math.sin(startAng + proxy.angle) * lowR; camera.position.z = T.z + Math.cos(startAng + proxy.angle) * lowR; } });
            break;
        case 10: 
            let diagPos = new THREE.Vector3(dir.z, 0.5, -dir.x).normalize().multiplyScalar(R * 0.5);
            tl.to(camera.position, { x: startPos.x + diagPos.x, y: startPos.y + diagPos.y, z: startPos.z + diagPos.z, duration: 7, ease: "sine.inOut" })
              .to(camera.position, { x: startPos.x - diagPos.x, y: startPos.y - diagPos.y, z: startPos.z - diagPos.z, duration: 14, ease: "sine.inOut" })
              .to(camera.position, { x: startPos.x, y: startPos.y, z: startPos.z, duration: 7, ease: "sine.inOut" });
            break;
        case 11: 
            let macroR = clampR(R * 0.5); camera.position.set(T.x + dir.x * macroR, T.y + dir.y * macroR, T.z + dir.z * macroR);
            tl.to(camera.position, { x: () => camera.position.x + (Math.random()-0.5)*macroR*0.08, y: () => camera.position.y + (Math.random()-0.5)*macroR*0.08, z: () => camera.position.z + (Math.random()-0.5)*macroR*0.08, duration: 2, ease: "sine.inOut", repeat: -1, yoyo: true });
            break;
        case 12: 
            let breathR = clampR(R * 1.1);
            tl.to(camera.position, { x: T.x + dir.x * breathR, y: T.y + dir.y * breathR, z: T.z + dir.z * breathR, duration: 5, ease: "power1.inOut", yoyo: true, repeat: -1 });
            break;
        case 13: 
            proxy = { t: 0 }; startAng = Math.atan2(startPos.x - T.x, startPos.z - T.z);
            tl.to(proxy, { t: Math.PI * 2, duration: 16, ease: "none", onUpdate: () => {
                let st = Math.sin(proxy.t) * 0.6; let ct = Math.cos(proxy.t);
                camera.position.x = T.x + Math.sin(startAng + st) * R; camera.position.y = startPos.y + Math.sin(proxy.t * 2) * R * 0.2; camera.position.z = T.z + Math.cos(startAng + st) * R;
            }});
            break;
        case 14: 
            camera.fov = 60; camera.updateProjectionMatrix(); proxy = { r: R, f: 60 }; let maxFov = 90;
            let dollyFar = clampR(R * Math.tan((maxFov/2)*Math.PI/180) / Math.tan((60/2)*Math.PI/180));
            tl.to(proxy, { r: dollyFar, f: maxFov, duration: 15, ease: "sine.inOut", yoyo: true, repeat: -1, onUpdate: () => {
                camera.position.x = T.x + dir.x * proxy.r; camera.position.y = T.y + dir.y * proxy.r; camera.position.z = T.z + dir.z * proxy.r; camera.fov = proxy.f; camera.updateProjectionMatrix();
            }});
            break;
        case 15: 
            proxy = { angle: 0 }; startAng = Math.atan2(startPos.x - T.x, startPos.z - T.z);
            tl.to(proxy, { angle: Math.PI * 2, duration: 20, ease: "none", onUpdate: () => {
                camera.position.x = T.x + Math.sin(startAng + proxy.angle * 0.5) * R; camera.position.z = T.z + Math.cos(startAng + proxy.angle * 0.5) * R; camera.position.y = T.y + Math.sin(proxy.angle * 4) * R * 0.6; 
            }});
            break;
    }
    currentCamAnim = tl;
    // 立即应用初始倍速
    if(currentCamAnim) currentCamAnim.timeScale(AppState.camSpeed);
}

export function updateEngineCore() {
    if (controls) controls.update(); 
    // 实时监听运镜倍速变化
    if (currentCamAnim) currentCamAnim.timeScale(AppState.camSpeed);

    if (material) {
        for(let key in AppState) {
            let uName = 'u' + key.charAt(0).toUpperCase() + key.slice(1);
            if(material.uniforms[uName]) { material.uniforms[uName].value = AppState[key]; }
        }
        material.uniforms.uTime.value = SysState.simulationTime;
    }
    renderer.toneMappingExposure = AppState.exposure;
    if (afterimagePass) afterimagePass.uniforms['damp'].value = AppState.damp;
    if (bloomPass) bloomPass.strength = AppState.bloomStrength;
}