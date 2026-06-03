// ====== 全局参数（已按你在处理器里调好的效果设为默认值）======
// 运镜：近景弧线摇摄(7) · camMin 1.10 · camMax 12.0 · camSpeed 0.70
// 消散特效：神经元突触电击(43) · Y轴扫描(0)
export const AppState = {
    mode: 43,            // 消散特效：神经元突触电击
    progress: 1.0,       // 1.0 = 模型完整显现
    animSpeed: 8.0,
    speedCurve: 1.5,

    rotSpeed: 1.0,
    camSpeed: 0.70,      // 运镜流速
    camMin: 1.10,        // 镜头最近限制
    camMax: 12.0,        // 镜头最远边界

    curve: [0.42, 0.0, 0.58, 1.0],

    scanAxis: 0,         // Y 轴(上下扫)
    scanMin: -2.0,
    scanMax: 2.0,

    noiseScale: 1.2,
    noiseEdge: 0.4,

    persistence: 0.0,
    fadePower: 1.2,

    pointSize: 1.0,
    bloomStrength: 1.7,
    exposure: 1.00,
    damp: 0.80,

    brightness: 1.0,
    contrast: 1.0,
    saturation: 1.0
};

export const SysState = {
    isAutoAnimating: false,
    simulationTime: 0,
    pixelRatio: Math.min(window.devicePixelRatio, 2)
};

// ====== 默认运镜（成品自动播放，无需面板）======
export const DEFAULT_CAMERA_MOVE = 7;   // 近景弧线摇摄

// ============================================================
//  内容数据：以后加短片 / 改文字，只动这一块即可
// ============================================================

// 网站名 & 开场语
export const SITE = {
    name: "星 际 信 笺",
    kicker: "",
    opening: "宇宙很大，时光漫长；相遇的此刻，就是生命的奇迹。",
    openingEn: "Space and time being infinite, the moment we are together unfolds the miracle of life."
};

// 密码（注意：这是前端密码，能挡随手转发，但懂技术的人查看源码能看到。
// 若要真正安全，需后端校验——见对话里的说明）
export const SITE_PASSWORD = "20230825";
export const PASSWORD_HINT_WRONG = "好像还不是那把钥匙。";

// 点云相机开局距离（越小越"贴近"、点云越充满屏幕）。
export const CLOUD_CAMERA_Z = 1.25;

// 点云整体放大系数（越大点云越充满屏幕，1.0=默认）。
export const CLOUD_SCALE = 2.0;

// 背景银河图亮度（0~1，越小越暗。太亮会盖过点云）。
export const BG_BRIGHTNESS = 0.18;

// ============================================================
//  ★★ 内容数据：行星分类 + 记忆条目（以后加内容、改文字只动这一块）
// ============================================================
//
//  结构（三层，对应网站的浏览动线）：
//
//    底部行星(分类)  →  点行星，点云周围转出 9 颗公转星(1大8小)
//          →  点任意一颗公转星，进入「记忆星图页」(一片炸开的银河)
//                →  点里面带日期的发光小球，看到具体的短片 / 照片
//
//  · PLANETS 数组：每个 {...} = 底部一颗行星 = 一个分类。
//      name      行星名（显示在底部，如「冥王星」）。先占位，查到两人星盘后换真名。
//      color     这颗行星 / 这片星图的主题色调。
//      meaning   一句话主题（悬停底部行星时显示，可留空 ""）。
//      memories  这个分类下的所有内容条目 = 记忆星图页里那些「带日期的发光小球」。
//          每条 memory：
//            date        小球上显示的日期，如 "2.14"（也用来在月历上点亮当天的月相）
//            type        'video' 短片 / 'photo' 照片
//            title       打开后标题
//            description 打开后一句话
//            videoUrl    短片链接（Vimeo，如 https://player.vimeo.com/video/数字）；photo 留空
//            photoUrl    照片地址或相对路径（如 ./assets/xxx.jpg）；video 留空
//
//  说明：点云页那 9 颗公转星会从本分类的 memories 自动生成（不够 9 个就用柔光占位补满），
//        所以你只管往 memories 里加条目即可，不用手动配公转星。
//
//  现在全是占位，先看布局和交互；之后把 name / 内容换成真的。
//
export const PLANETS = [
    {
        name: "IC1848", color: "#d8c2ff", meaning: "",
        memories: [
            { date: "6.3", type: "video", title: "", description: "", videoUrl: "./assets/video1.mp4", photoUrl: "" },
            { date: "6.3", type: "video", title: "", description: "", videoUrl: "./assets/video2.mp4", photoUrl: "" }
        ]
    },
    {
        name: "IC1805", color: "#bfe3ff", meaning: "",
        memories: [
            { date: "", type: "photo", title: "", description: "", videoUrl: "", photoUrl: "" }
        ]
    }
];

// 进入网站后，默认选中底部哪一颗行星（0 = 第一颗）。
export const DEFAULT_PLANET = 0;

// 「写给你的话」页面内容。每个字符串是一段。
export const NOTES = {
    title: "每一个 pluto 都有它的 charon",
    paragraphs: [
        "在太阳系的边缘，冥王星孤独地游荡在寒冷的柯伊伯带，是一颗孤独的、不被重视的行星，孤独地在黑暗中徘徊。",
        "直到有一天，冥王星遇见了卡戎。卡戎是冥王星最大的卫星，它的出现为冥王星带来了温暖和陪伴。卡戎虽然比冥王星小，但它的存在让冥王星感到不再孤单。",
        "冥王星和卡戎的自转和公转周期均为 6.387 天，彼此始终以同一面相对。这种锁定是由于它们之间的引力相互作用和能量耗散所致。",
        "然而卡戎并不完全属于冥王星，是它们之间的距离和引力相互作用逐渐改变了彼此的命运。它们的固定视角注定了冥王星上永远只能看到卡戎的一面，反之亦然。",
        "可随着时间的推移，冥王星和卡戎之间的引力作用越来越强。它们开始相互影响，逐渐减慢彼此的自转速度。最终，冥王星和卡戎达到了潮汐锁定状态。它们的自转周期和公转周期同步，彼此始终以同一面相对。",
        "冥王星和卡戎的潮汐锁定象征着它们之间深厚的情感。无论宇宙如何变化，它们始终相互凝视，永不分离。"
    ],
    sign: ""
};
