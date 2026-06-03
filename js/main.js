import * as THREE from 'three';
import { PLYLoader } from 'three/examples/jsm/loaders/PLYLoader.js';
import { AppState, SysState, DEFAULT_CAMERA_MOVE, SITE, SITE_PASSWORD, PASSWORD_HINT_WRONG, NOTES, PLANETS, DEFAULT_PLANET } from './config.js';
import { initEngine, createPoints, updateEngineCore, playCameraMove, renderer, composer, camera, controls } from './engine.js';
import * as ENG from './engine.js';

const clock = new THREE.Clock();
let engineStarted = false;

/* ---------------- 密码门 ---------------- */
const gate = document.getElementById('gate');
const pwInput = document.getElementById('pw-input');
const pwBtn = document.getElementById('pw-btn');
const pwHint = document.getElementById('pw-hint');

function tryUnlock() {
    if (pwInput.value === SITE_PASSWORD) {
        gate.classList.add('opened');
        setTimeout(() => { gate.style.display = 'none'; }, 1200);
        startExperience();
    } else {
        pwHint.textContent = PASSWORD_HINT_WRONG;
        pwHint.classList.add('show');
        pwInput.value = '';
        const box = gate.querySelector('.gate-box');
        box.classList.add('shake');
        setTimeout(() => box.classList.remove('shake'), 500);
    }
}
pwBtn.addEventListener('click', tryUnlock);
pwInput.addEventListener('keydown', e => { if (e.key === 'Enter') tryUnlock(); });

/* ---------------- 进入体验 ---------------- */
function startExperience() {
    if (engineStarted) return;
    engineStarted = true;

    document.getElementById('site-kicker').textContent = '';
    document.getElementById('site-name').innerHTML = SITE.opening.replace('；', '；<br>');
    document.getElementById('site-opening').textContent = SITE.openingEn;
    setTimeout(() => document.getElementById('intro').classList.add('show'), 400);
    setTimeout(() => document.getElementById('intro').classList.add('fade'), 6500);

    initEngine();
    loadCloud();
    buildPlanetNav();   // 底部一排行星
    buildOrbs();        // 当前行星名下的一组公转星
    buildNotes();
    initMoonPhase();
    initMusic();
    showChrome();
    animate();
}

function showChrome() {
    // 底部行星 + 公转星：和点云几乎同时出现，确保第一眼就能看到
    setTimeout(() => {
        document.getElementById('planet-nav').classList.add('show');
        document.getElementById('orbs-layer').classList.add('show');
    }, 1200);
    // 角落功能键稍晚，等开场字幕散去再浮现
    setTimeout(() => {
        const notesBtn = document.getElementById('open-notes');
        if (notesBtn) notesBtn.classList.add('show');
        document.getElementById('music-btn').classList.add('show');
        document.getElementById('moon-phase').classList.add('show');
    }, 6800);
}

/* ---------------- 加载点云 ---------------- */
function loadCloud() {
    const loaderEl = document.getElementById('loading');
    new PLYLoader().load('./assets/cloud.ply', (geometry) => {
        createPoints(geometry, false);
        AppState.progress = 1.0;
        setTimeout(() => playCameraMove(DEFAULT_CAMERA_MOVE), 200);
        startDissipation();   // 启动持续的消散↔重聚流动
        loaderEl.classList.add('done');
    }, (xhr) => {
        if (xhr.total) {
            const pct = Math.round(xhr.loaded / xhr.total * 100);
            document.getElementById('loading-pct').textContent = pct + '%';
        }
    }, (err) => {
        document.getElementById('loading-pct').textContent = '模型加载失败';
        console.error(err);
    });
}

// 持续的"消散→重聚"循环（就是处理器里"自动播放消散动画"的效果）
function startDissipation() {
    if (!window.gsap) return;
    const easeStr = `cubic-bezier(${AppState.curve[0]}, ${AppState.curve[1]}, ${AppState.curve[2]}, ${AppState.curve[3]})`;
    window.gsap.fromTo(AppState,
        { progress: 1 },
        { progress: 0, duration: AppState.animSpeed, ease: easeStr, repeat: -1, yoyo: true }
    );
}

/* ---------------- 底部行星导航 + 当前行星的公转星组 ---------------- */
// 底部一排行星（像图一底部那排月份）。点击切换上方点云周围的一组公转星。
// 公转星沿椭圆轨道在屏幕平面绕中心公转，叠在点云之上；其中 isMain 的那颗最大。

let currentPlanet = DEFAULT_PLANET;
const orbState = [];          // 当前显示的一组公转星
let switchToken = 0;          // 防止快速切换时的竞态

function buildPlanetNav() {
    const nav = document.getElementById('planet-nav');
    nav.innerHTML = '';
    PLANETS.forEach((planet, i) => {
        const item = document.createElement('div');
        item.className = 'planet-item' + (i === currentPlanet ? ' active' : '');
        item.style.setProperty('--p-color', planet.color);
        item.innerHTML = `
            <div class="planet-dot"></div>
            <div class="planet-name">${planet.name}</div>
            ${planet.meaning ? `<div class="planet-meaning">${planet.meaning}</div>` : ''}`;
        item.addEventListener('click', () => selectPlanet(i));
        nav.appendChild(item);
    });
}

function selectPlanet(i) {
    if (i === currentPlanet) return;
    currentPlanet = i;
    // 底部高亮切换
    document.querySelectorAll('.planet-item').forEach((el, idx) =>
        el.classList.toggle('active', idx === i));
    // 上方公转星：旧的淡出 → 新的淡入（点云始终在，不动）
    const layer = document.getElementById('orbs-layer');
    layer.classList.remove('show');
    const myToken = ++switchToken;
    setTimeout(() => {
        if (myToken !== switchToken) return;
        buildOrbs();
        layer.classList.add('show');
    }, 650);
}

// 程序化生成 9 条轨道（1 颗主角在内圈，8 颗小星散布在外圈）
function makeOrbits(n) {
    const arr = [];
    // 主角：小半径、靠中心、转得稳
    arr.push({ radiusXFactor: 0.15, eccentricity: 0.52, rotation: 0.0, speed: 0.0016, startAngle: Math.random() * 6.28, main: true });
    // 其余 n-1 颗小星：半径与角度错开，速度方向各异
    for (let i = 1; i < n; i++) {
        const t = (i - 1) / (n - 1);
        arr.push({
            radiusXFactor: 0.26 + t * 0.26 + (Math.random() - 0.5) * 0.04,
            eccentricity: 0.40 + Math.random() * 0.16,
            rotation: (Math.random() - 0.5) * 0.7,
            speed: (Math.random() > 0.5 ? 1 : -1) * (0.0009 + Math.random() * 0.0011),
            startAngle: (i / (n - 1)) * 6.28 + Math.random(),
            main: false
        });
    }
    return arr;
}

function buildOrbs() {
    const layer = document.getElementById('orbs-layer');
    layer.innerHTML = '';
    orbState.length = 0;
    const planet = PLANETS[currentPlanet];
    const color = planet.color;
    const orbits = makeOrbits(9);   // 固定 9 颗：1 大 8 小
    orbits.forEach((orbit) => {
        const orb = document.createElement('div');
        orb.className = 'film-orb' + (orbit.main ? ' is-main' : '');
        orb.innerHTML = `<div class="orb-core"></div>`;
        const st = { el: orb, orbit, angle: orbit.startAngle || 0, hover: false };
        if (orbit.main) {
            // 只有最大那颗是入口。点击：先飞向中心放大（PDF 那套），再炸开进记忆星图
            orb.addEventListener('mouseenter', () => st.hover = true);
            orb.addEventListener('mouseleave', () => st.hover = false);
            orb.addEventListener('click', () => flyMainOrbThenOpen(st));
        }
        layer.appendChild(orb);
        orbState.push(st);
    });
    void color;
}

// PDF 式入场：主角星飞到屏幕中心 + 放大 + 其余星淡出，800ms 后炸开进记忆星图
let flying = false;
function flyMainOrbThenOpen(mainSt) {
    if (flying) return;
    flying = true;
    const cx = window.innerWidth / 2, cy = window.innerHeight / 2;
    orbState.forEach(st => {
        if (st === mainSt) {
            st.hover = true; // 停止公转
            st.el.style.transition = 'transform .8s cubic-bezier(.25,1,.5,1), opacity .6s ease';
            st.el.style.transform = `translate(${cx}px, ${cy}px) scale(2.4)`;
            st.el.style.opacity = '1';
            st.el.style.zIndex = '50';
        } else {
            st.el.style.transition = 'opacity .5s ease';
            st.el.style.opacity = '0';
        }
    });
    setTimeout(() => {
        openStarmap(currentPlanet);
        flying = false;
        // 重建银河页公转星，复位下次进入
        buildOrbs();
    }, 820);
}

function updateOrbs() {
    if (flying) return;   // 主角星正在飞向中心，别让公转覆盖过渡
    const w = window.innerWidth, h = window.innerHeight;
    const cx = w / 2, cy = h / 2;
    const base = Math.min(w, h);
    orbState.forEach(st => {
        const o = st.orbit;
        if (!st.hover) st.angle += o.speed;
        const rX = base * o.radiusXFactor;
        const rY = rX * o.eccentricity;
        const sinA = Math.sin(st.angle), cosA = Math.cos(st.angle);
        const rot = o.rotation;
        const rx = cosA * rX * Math.cos(rot) - sinA * rY * Math.sin(rot);
        const ry = cosA * rX * Math.sin(rot) + sinA * rY * Math.cos(rot);
        const x = cx + rx, y = cy + ry;
        const depth = ry / rX;
        const scale = (o.main ? 1.0 : 0.78) + depth * 0.22;
        const opacity = Math.max(0.4, (o.main ? 0.95 : 0.7) + depth * 0.35);
        st.el.style.transform = `translate(${x}px, ${y}px) scale(${scale})`;
        st.el.style.opacity = opacity;
        st.el.style.zIndex = 25 + Math.floor(depth * 10) + (o.main ? 6 : 0);
    });
}

/* ---------------- 内容播放（短片 / 照片）——记忆星图页里点日期小球时调用 ---------------- */
const player = document.getElementById('player');
let musicPausedForVideo = false;
function openPlayer(mem) {
    document.getElementById('player-title').textContent = mem.title;
    document.getElementById('player-date').textContent = mem.date || '';
    document.getElementById('player-desc').textContent = mem.description || '';
    const frame = document.getElementById('player-frame');
    if (mem.type === 'photo') {
        if (mem.photoUrl) {
            frame.innerHTML = `<img src="${mem.photoUrl}" alt="${mem.title}"
                style="max-width:100%;max-height:100%;object-fit:contain;border-radius:12px;">`;
        } else {
            frame.innerHTML = `<div class="frame-placeholder">这里将显示一张照片<br><span>（在 config.js 该条目的 photoUrl 填入图片地址或 ./assets/xxx.jpg）</span></div>`;
        }
    } else {
        if (mem.videoUrl) {
            frame.innerHTML = `<video src="${mem.videoUrl}" controls playsinline
                style="width:100%;height:100%;object-fit:contain;"></video>`;
        } else {
            frame.innerHTML = `<div class="frame-placeholder">这里将嵌入短片<br><span>（拿到 Vimeo 链接后，在 config.js 的 videoUrl 填入即可）</span></div>`;
        }
        // 视频页：自动暂停背景音乐
        const bgm = document.getElementById('bgm');
        if (!bgm.paused) {
            bgm.pause();
            musicPausedForVideo = true;
        }
    }
    player.classList.add('show');
    startPlayerStars();
}
document.getElementById('player-back').addEventListener('click', () => {
    player.classList.remove('show');
    document.getElementById('player-frame').innerHTML = '';
    stopPlayerStars();
    // 如果是因为视频暂停的音乐，退出时恢复播放
    if (musicPausedForVideo) {
        const bgm = document.getElementById('bgm');
        bgm.play().catch(() => {});
        musicPausedForVideo = false;
    }
});

/* ---------------- 播放页星空（移植自 PDF 的 reading-canvas）---------------- */
let psCanvas, psCtx, psW, psH, psStars = [], psRAF = null;
function initPlayerStars() {
    psCanvas = document.getElementById('player-stars');
    psCtx = psCanvas.getContext('2d');
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    psW = window.innerWidth; psH = window.innerHeight;
    psCanvas.width = psW * dpr; psCanvas.height = psH * dpr;
    psCanvas.style.width = psW + 'px'; psCanvas.style.height = psH + 'px';
    psCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
    psStars = [];
    // 普通漂移星点
    for (let i = 0; i < 320; i++) psStars.push({ x: Math.random()*psW, y: Math.random()*psH,
        r: Math.random()*1.2, alpha: Math.random(), speed: Math.random()*0.015+0.005,
        dx: (Math.random()-0.5)*0.05, dy: (Math.random()-0.5)*0.05, type: 'normal' });
    // 斜向星流（模拟一条淡淡的银河带）
    for (let i = 0; i < 900; i++) {
        const p = Math.random(), off = (Math.random()-0.5)*(Math.random()*psW*0.4);
        psStars.push({ x: p*psW-off, y: p*psH+off, r: Math.random()*1.5,
            alpha: Math.random(), speed: Math.random()*0.02+0.01, dx: -0.04, dy: -0.04, type: 'normal' });
    }
    // 几颗带四角星芒的亮星
    for (let i = 0; i < 7; i++) psStars.push({ x: Math.random()*psW, y: Math.random()*psH,
        r: Math.random()*1.5+1.5, alpha: Math.random(), speed: Math.random()*0.008+0.002,
        dx: -0.01, dy: -0.01, type: 'sparkle', spike: Math.random()*18+14 });
}
function drawPlayerStars() {
    psCtx.clearRect(0, 0, psW, psH);
    psStars.forEach(s => {
        s.alpha += s.speed; if (s.alpha > 1 || s.alpha < 0) s.speed *= -1;
        s.x += s.dx; s.y += s.dy;
        if (s.x > psW+50) s.x = -50; if (s.x < -50) s.x = psW+50;
        if (s.y > psH+50) s.y = -50; if (s.y < -50) s.y = psH+50;
        const a = Math.abs(s.alpha);
        if (s.type === 'normal') {
            psCtx.beginPath(); psCtx.arc(s.x, s.y, s.r, 0, 6.2832);
            psCtx.fillStyle = `rgba(225,236,255,${a*0.8})`; psCtx.fill();
        } else {
            psCtx.save(); psCtx.translate(s.x, s.y); psCtx.globalAlpha = a*0.9;
            psCtx.beginPath(); psCtx.arc(0, 0, s.r, 0, 6.2832); psCtx.fillStyle = '#fff';
            psCtx.shadowBlur = 14; psCtx.shadowColor = '#fff'; psCtx.fill(); psCtx.shadowBlur = 0;
            psCtx.fillStyle = 'rgba(255,255,255,.7)';
            psCtx.beginPath(); psCtx.moveTo(0,-s.spike); psCtx.lineTo(s.r*0.4,0);
            psCtx.lineTo(0,s.spike); psCtx.lineTo(-s.r*0.4,0); psCtx.fill();
            psCtx.beginPath(); psCtx.moveTo(-s.spike,0); psCtx.lineTo(0,-s.r*0.4);
            psCtx.lineTo(s.spike,0); psCtx.lineTo(0,s.r*0.4); psCtx.fill();
            psCtx.restore();
        }
    });
    psRAF = requestAnimationFrame(drawPlayerStars);
}
function startPlayerStars() {
    initPlayerStars();
    if (psRAF) cancelAnimationFrame(psRAF);
    drawPlayerStars();
}
function stopPlayerStars() {
    if (psRAF) { cancelAnimationFrame(psRAF); psRAF = null; }
}

/* ---------------- Notes 页面星空（同 Player 星空，复用逻辑）---------------- */
let nsCanvas, nsCtx, nsW, nsH, nsStars = [], nsRAF = null;
function initNotesStars() {
    nsCanvas = document.getElementById('notes-stars');
    nsCtx = nsCanvas.getContext('2d');
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    nsW = window.innerWidth; nsH = window.innerHeight;
    nsCanvas.width = nsW * dpr; nsCanvas.height = nsH * dpr;
    nsCanvas.style.width = nsW + 'px'; nsCanvas.style.height = nsH + 'px';
    nsCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
    nsStars = [];
    for (let i = 0; i < 320; i++) nsStars.push({ x: Math.random()*nsW, y: Math.random()*nsH,
        r: Math.random()*1.2, alpha: Math.random(), speed: Math.random()*0.015+0.005,
        dx: (Math.random()-0.5)*0.05, dy: (Math.random()-0.5)*0.05, type: 'normal' });
    for (let i = 0; i < 900; i++) {
        const p = Math.random(), off = (Math.random()-0.5)*(Math.random()*nsW*0.4);
        nsStars.push({ x: p*nsW-off, y: p*nsH+off, r: Math.random()*1.5,
            alpha: Math.random(), speed: Math.random()*0.02+0.01, dx: -0.04, dy: -0.04, type: 'normal' });
    }
    for (let i = 0; i < 7; i++) nsStars.push({ x: Math.random()*nsW, y: Math.random()*nsH,
        r: Math.random()*1.5+1.5, alpha: Math.random(), speed: Math.random()*0.008+0.002,
        dx: -0.01, dy: -0.01, type: 'sparkle', spike: Math.random()*18+14 });
}
function drawNotesStars() {
    nsCtx.clearRect(0, 0, nsW, nsH);
    nsStars.forEach(s => {
        s.alpha += s.speed; if (s.alpha > 1 || s.alpha < 0) s.speed *= -1;
        s.x += s.dx; s.y += s.dy;
        if (s.x > nsW+50) s.x = -50; if (s.x < -50) s.x = nsW+50;
        if (s.y > nsH+50) s.y = -50; if (s.y < -50) s.y = nsH+50;
        const a = Math.abs(s.alpha);
        if (s.type === 'normal') {
            nsCtx.beginPath(); nsCtx.arc(s.x, s.y, s.r, 0, 6.2832);
            nsCtx.fillStyle = `rgba(225,236,255,${a*0.8})`; nsCtx.fill();
        } else {
            nsCtx.save(); nsCtx.translate(s.x, s.y); nsCtx.globalAlpha = a*0.9;
            nsCtx.beginPath(); nsCtx.arc(0, 0, s.r, 0, 6.2832); nsCtx.fillStyle = '#fff';
            nsCtx.shadowBlur = 14; nsCtx.shadowColor = '#fff'; nsCtx.fill(); nsCtx.shadowBlur = 0;
            nsCtx.fillStyle = 'rgba(255,255,255,.7)';
            nsCtx.beginPath(); nsCtx.moveTo(0,-s.spike); nsCtx.lineTo(s.r*0.4,0);
            nsCtx.lineTo(0,s.spike); nsCtx.lineTo(-s.r*0.4,0); nsCtx.fill();
            nsCtx.beginPath(); nsCtx.moveTo(-s.spike,0); nsCtx.lineTo(0,-s.r*0.4);
            nsCtx.lineTo(s.spike,0); nsCtx.lineTo(0,s.r*0.4); nsCtx.fill();
            nsCtx.restore();
        }
    });
    nsRAF = requestAnimationFrame(drawNotesStars);
}
function startNotesStars() { initNotesStars(); if (nsRAF) cancelAnimationFrame(nsRAF); drawNotesStars(); }
function stopNotesStars() { if (nsRAF) { cancelAnimationFrame(nsRAF); nsRAF = null; } }

/* ---------------- 写给你的话 ---------------- */
function buildNotes() {
    document.getElementById('notes-title').textContent = NOTES.title;
    const body = document.getElementById('notes-body');
    body.innerHTML = NOTES.paragraphs.map(p => `<p>${p}</p>`).join('') +
        `<p class="notes-sign">${NOTES.sign}</p>`;
}
const notesPanel = document.getElementById('notes');
const openNotesBtn = document.getElementById('open-notes');
if (openNotesBtn) openNotesBtn.addEventListener('click', () => { notesPanel.classList.add('show'); startNotesStars(); });
document.getElementById('notes-back').addEventListener('click', () => { notesPanel.classList.remove('show'); stopNotesStars(); });

/* ---------------- 农历月相（自动显示今天真实月相）---------------- */
function getMoonPhaseClass(year, month, day) {
    let a = Math.floor((14 - month) / 12);
    let y = year + 4800 - a;
    let m = month + 12 * a - 3;
    let jd = day + Math.floor((153 * m + 2) / 5) + 365 * y + Math.floor(y / 4) - Math.floor(y / 100) + Math.floor(y / 400) - 32045;
    let daysSinceNew = jd - 2451550.1;
    let cycles = daysSinceNew / 29.530588;
    let fraction = cycles - Math.floor(cycles);
    let phase = Math.round(fraction * 8) % 8;
    const names = ['新月','蛾眉月','上弦月','盈凸月','满月','亏凸月','下弦月','残月'];
    const svgs = [
        "%3Ccircle cx='12' cy='12' r='9' fill='none' stroke='white' stroke-width='1.5'/%3E",
        "%3Cpath d='M12 2 A10 10 0 0 1 12 22 A6 10 0 0 0 12 2 Z' fill='white'/%3E",
        "%3Cpath d='M12 2 A10 10 0 0 1 12 22 Z' fill='white'/%3E",
        "%3Cpath d='M12 2 A10 10 0 0 1 12 22 A6 10 0 0 1 12 2 Z' fill='white'/%3E",
        "%3Ccircle cx='12' cy='12' r='10' fill='white'/%3E",
        "%3Cpath d='M12 2 A10 10 0 0 0 12 22 A6 10 0 0 0 12 2 Z' fill='white'/%3E",
        "%3Cpath d='M12 2 A10 10 0 0 0 12 22 Z' fill='white'/%3E",
        "%3Cpath d='M12 2 A10 10 0 0 0 12 22 A6 10 0 0 1 12 2 Z' fill='white'/%3E"
    ];
    return { name: names[phase], svg: svgs[phase] };
}
function initMoonPhase() {
    const now = new Date();
    const { name, svg } = getMoonPhaseClass(now.getFullYear(), now.getMonth() + 1, now.getDate());
    const el = document.getElementById('moon-phase');
    el.querySelector('.moon-icon').style.backgroundImage =
        `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'%3E${svg}%3C/svg%3E")`;
    el.querySelector('.moon-name').textContent = `今夜 · ${name}`;
}

/* ---------------- 背景音乐 ---------------- */
function initMusic() {
    const musicBtn = document.getElementById('music-btn');
    const bgm = document.getElementById('bgm');
    let playing = false;
    function startPlay() {
        bgm.volume = 0;
        bgm.play().then(() => {
            let v = 0;
            const fade = setInterval(() => {
                if (!playing) { clearInterval(fade); return; }
                v += 0.02;
                bgm.volume = Math.min(v, 0.5);
                if (v >= 0.5) clearInterval(fade);
            }, 200);
        }).catch(() => {});
        musicBtn.classList.add('playing');
        playing = true;
    }
    function stopPlay() {
        bgm.pause();
        musicBtn.classList.remove('playing');
        playing = false;
    }
    musicBtn.addEventListener('click', () => {
        if (playing) stopPlay(); else startPlay();
    });
    // 输完密码进入后，延迟 2 秒自动播放（用户刚点过按钮，浏览器允许自动播放）
    setTimeout(startPlay, 2000);
}

/* ---------------- 渲染循环 ---------------- */
function animate() {
    requestAnimationFrame(animate);
    const dt = clock.getDelta();
    SysState.simulationTime += dt;
    updateEngineCore();
    updateOrbs();
    // 背景银河板：始终跟随相机、面向相机、固定在远处，让它始终铺满背景
    if (ENG.bgMesh && camera) {
        const dir = new THREE.Vector3();
        camera.getWorldDirection(dir);
        ENG.bgMesh.position.copy(camera.position).add(dir.multiplyScalar(30));
        ENG.bgMesh.quaternion.copy(camera.quaternion);
    }
    if (composer) composer.render();
}

window.addEventListener('resize', () => {
    if (!engineStarted || !camera) return;
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
    composer.setSize(window.innerWidth, window.innerHeight);
    if (starmapOpen) sizeStarmapCanvas();
});

/* ============================================================
   记忆星图页（第三层）：点公转星进入。
   一片炸开聚拢的银河星云 + 带日期的发光小球公转 + 左下月历。
   点小球 → 调 openPlayer 看短片/照片。视觉统一为冷白蓝 / 思源宋体。
   ============================================================ */
let starmapOpen = false;
let starmapPlanet = 0;
let smCtx, smCanvas, smW, smH, smParticles = [], smRAF = null, smBornAt = 0;
const smOrbs = [];   // 当前星图里的日期小球

function sizeStarmapCanvas() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    smW = window.innerWidth; smH = window.innerHeight;
    smCanvas.width = smW * dpr; smCanvas.height = smH * dpr;
    smCanvas.style.width = smW + 'px'; smCanvas.style.height = smH + 'px';
    smCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
}

function buildStarmapParticles() {
    smParticles = [];
    const maxR = Math.min(smW, smH) * 0.62;
    // 盘面：横向铺开、压扁，水平星河带（PDF 的 disk）—— 密度提高
    for (let i = 0; i < 2200; i++) {
        const r = Math.pow(Math.random(), 1.2) * maxR * 1.6;
        smParticles.push({ angle: Math.random() * 6.28, r, kind: 'disk',
            spd: 0.0007 + Math.random() * 0.0009,
            tw: Math.random() * 6.28, twSpd: 0.02 + Math.random() * 0.04 });
    }
    // 竖直轴：粒子几乎压成一条竖线，纵向铺满（PDF 的 axis）—— 十字的竖笔，密度提高
    for (let i = 0; i < 1100; i++) {
        const r = Math.pow(Math.random(), 1.4) * maxR * 1.0;
        smParticles.push({ angle: Math.random() * 6.28, r, kind: 'axis',
            spd: 0.001,
            tw: Math.random() * 6.28, twSpd: 0.02 + Math.random() * 0.04 });
    }
    // 核心亮团：中心密集球（PDF 的 core）—— 密度提高
    for (let i = 0; i < 600; i++) {
        const r = Math.pow(Math.random(), 2) * maxR * 0.18;
        smParticles.push({ angle: Math.random() * 6.28, r, kind: 'core',
            spd: 0.0012 + Math.random() * 0.0014,
            tw: Math.random() * 6.28, twSpd: 0.03 + Math.random() * 0.05 });
    }
    // 弥散光晕星点（PDF 的 halo）—— 密度提高
    for (let i = 0; i < 900; i++) {
        const r = Math.random() * maxR * 1.05;
        smParticles.push({ angle: Math.random() * 6.28, r, kind: 'halo',
            spd: 0.0003 + Math.random() * 0.0005,
            tw: Math.random() * 6.28, twSpd: 0.015 + Math.random() * 0.03 });
    }
    // 中等星点：和日期小球同在水平面，沿极扁椭圆轨道只在水平方向旋转（参考 PDF 日期小球轨道）
    for (let i = 0; i < 30; i++) {
        smParticles.push({ kind: 'mid',
            radiusXFactor: 0.12 + Math.random() * 0.5,      // 横向半径，沿水平带左右铺开
            ecc: 0.08 + Math.random() * 0.10,                // 极扁 → 几乎只在水平面
            rot: (Math.random() - 0.5) * 0.12,               // 轨道微倾，基本水平
            angle: Math.random() * 6.28,
            spd: (Math.random() > 0.5 ? 1 : -1) * (0.0006 + Math.random() * 0.0010),
            size: 1.8 + Math.random() * 1.4,                 // 约 2~3px，明显小于日期小球
            tw: Math.random() * 6.28, twSpd: 0.01 + Math.random() * 0.03 });
    }
    smBornAt = performance.now();
}

function drawStarmap() {
    if (!starmapOpen) return;
    const cx = smW / 2, cy = smH / 2;
    smCtx.clearRect(0, 0, smW, smH);
    const now = performance.now();
    const t = Math.min(1, (now - smBornAt) / 1100);
    const ease = 1 - Math.pow(1 - t, 3);
    const planet = PLANETS[starmapPlanet];
    const col = hexToRgb(planet.color);
    const maxR = Math.min(smW, smH);
    smParticles.forEach(p => {
        p.angle += p.spd;
        p.tw += p.twSpd;
        const rr = p.r * ease;
        // 中等星点：沿极扁椭圆轨道在水平面旋转，画成带柔光的小圆
        if (p.kind === 'mid') {
            const base = Math.min(smW, smH);
            const rX = base * p.radiusXFactor * ease;
            const rY = rX * p.ecc;
            const sinA = Math.sin(p.angle), cosA = Math.cos(p.angle);
            const px = cx + (cosA * rX * Math.cos(p.rot) - sinA * rY * Math.sin(p.rot));
            const py = cy + (cosA * rX * Math.sin(p.rot) + sinA * rY * Math.cos(p.rot));
            const tw = 0.55 + 0.45 * (0.5 + 0.5 * Math.sin(p.tw));
            const a = Math.min(1, 0.8 * tw * ease);
            smCtx.beginPath();
            smCtx.arc(px, py, p.size, 0, 6.2832);
            smCtx.fillStyle = `rgba(236,242,255,${a})`;
            smCtx.shadowBlur = p.size * 3;
            smCtx.shadowColor = `rgba(225,236,255,${a})`;
            smCtx.fill();
            smCtx.shadowBlur = 0;
            return;
        }
        let px, py, a;
        if (p.kind === 'core') {
            px = cx + Math.cos(p.angle) * rr;
            py = cy + Math.sin(p.angle) * rr * 0.8;
            a = Math.max(0, 0.95 - rr / (maxR * 0.18));
        } else if (p.kind === 'disk') {
            px = cx + Math.cos(p.angle) * rr;        // 横向铺开
            py = cy + Math.sin(p.angle) * rr * 0.08; // 纵向压扁 → 水平带
            a = Math.max(0, 0.65 - rr / (maxR * 1.0));
        } else if (p.kind === 'axis') {
            px = cx + Math.cos(p.angle) * rr * 0.04; // 横向压成一条 → 竖直轴
            py = cy + Math.sin(p.angle) * rr;        // 纵向铺满
            a = Math.max(0, 0.6 - rr / (maxR * 0.7));
        } else {
            px = cx + Math.cos(p.angle) * rr;
            py = cy + Math.sin(p.angle) * rr;
            a = Math.max(0, 0.32 - rr / (maxR * 1.05));
        }
        // 每颗星自身呼吸式闪烁
        const tw = 0.5 + 0.5 * (0.5 + 0.5 * Math.sin(p.tw));
        a *= tw * ease;
        smCtx.fillStyle = `rgba(${200 + col.r * 0.2 | 0},${214 + col.g * 0.15 | 0},${238 + col.b * 0.06 | 0},${a})`;
        const s = p.kind === 'core' ? 1.6 : 1.2;
        smCtx.fillRect(px, py, s, s);
    });
    smRAF = requestAnimationFrame(drawStarmap);
}

function hexToRgb(hex) {
    const m = hex.replace('#', '');
    return { r: parseInt(m.substr(0,2),16), g: parseInt(m.substr(2,2),16), b: parseInt(m.substr(4,2),16) };
}

// 日期小球：每条 memory 一颗，沿椭圆轨道公转，点击看内容
function buildStarmapOrbs() {
    const layer = document.getElementById('sm-orbs');
    layer.innerHTML = '';
    smOrbs.length = 0;
    const planet = PLANETS[starmapPlanet];
    planet.memories.forEach((mem, i) => {
        const n = planet.memories.length;
        const orbit = {
            radiusXFactor: 0.18 + (i / Math.max(1, n - 1)) * 0.26 + (Math.random() - 0.5) * 0.03,
            eccentricity: 0.14 + Math.random() * 0.10,
            rotation: (Math.random() - 0.5) * 0.25,
            speed: (Math.random() > 0.5 ? 1 : -1) * (0.0010 + Math.random() * 0.0012),
            startAngle: (i / n) * 6.28 + Math.random()
        };
        const orb = document.createElement('div');
        orb.className = 'sm-orb';
        orb.innerHTML = `<div class="sm-orb-core"></div>`;
        orb.addEventListener('mouseenter', () => st.hover = true);
        orb.addEventListener('mouseleave', () => st.hover = false);
        orb.addEventListener('click', () => openPlayer(mem));
        layer.appendChild(orb);
        const st = { el: orb, orbit, angle: orbit.startAngle, hover: false };
        smOrbs.push(st);
    });
}

function updateStarmapOrbs() {
    if (!starmapOpen) return;
    const cx = smW / 2, cy = smH / 2;
    const base = Math.min(smW, smH);
    const t = Math.min(1, (performance.now() - smBornAt) / 1100);
    const ease = 1 - Math.pow(1 - t, 3);
    smOrbs.forEach(st => {
        const o = st.orbit;
        if (!st.hover) st.angle += o.speed;
        const rX = base * o.radiusXFactor * ease;
        const rY = rX * o.eccentricity;
        const sinA = Math.sin(st.angle), cosA = Math.cos(st.angle);
        const rot = o.rotation;
        const rx = cosA * rX * Math.cos(rot) - sinA * rY * Math.sin(rot);
        const ry = cosA * rX * Math.sin(rot) + sinA * rY * Math.cos(rot);
        st.el.style.transform = `translate(${cx + rx}px, ${cy + ry}px)`;
        st.el.style.opacity = ease;
    });
    requestAnimationFrame(updateStarmapOrbs);
}

function openStarmap(planetIndex) {
    starmapPlanet = planetIndex;
    starmapOpen = true;
    const page = document.getElementById('starmap');
    smCanvas = document.getElementById('sm-canvas');
    smCtx = smCanvas.getContext('2d');
    sizeStarmapCanvas();
    buildStarmapParticles();
    buildStarmapOrbs();
    document.getElementById('sm-planet-name').textContent = PLANETS[planetIndex].name;
    page.classList.add('show');
    if (smRAF) cancelAnimationFrame(smRAF);
    drawStarmap();
    updateStarmapOrbs();
}

function closeStarmap() {
    starmapOpen = false;
    document.getElementById('starmap').classList.remove('show');
    if (smRAF) { cancelAnimationFrame(smRAF); smRAF = null; }
}
document.getElementById('sm-back').addEventListener('click', closeStarmap);


