"use strict";

/*
=========================================================
ELEMENTY HTML
=========================================================
*/

const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d", { alpha: true, desynchronized: true });

const scoreDisplay = document.getElementById("scoreDisplay");
const bestScoreDisplay = document.getElementById("bestScoreDisplay");
const boosterStatus = document.getElementById("boosterStatus");

const startScreen = document.getElementById("startScreen");
const gameOverScreen = document.getElementById("gameOverScreen");
const finalScore = document.getElementById("finalScore");
const restartButton = document.getElementById("restartButton");
const pauseButton = document.getElementById("pauseButton");
const soundButton = document.getElementById("soundButton");


const pauseScreen = document.getElementById("pauseScreen");
const comboDisplay = document.getElementById("comboDisplay");
const difficultyDisplay = document.getElementById("difficultyDisplay");
const finalBest = document.getElementById("finalBest");
const finalCombo = document.getElementById("finalCombo");

const feverFill = document.getElementById("feverFill");
const feverLabel = document.querySelector(".fever-meter > span");
const lifeBadge = document.getElementById("lifeBadge");
const magnetBadge = document.getElementById("magnetBadge");
const doubleBadge = document.getElementById("doubleBadge");
const speedPowerCard = document.getElementById("speedPowerCard");
const slowPowerCard = document.getElementById("slowPowerCard");
const shieldPowerCard = document.getElementById("shieldPowerCard");
const speedPowerTime = speedPowerCard?.querySelector(".power-time") || null;
const slowPowerTime = slowPowerCard?.querySelector(".power-time") || null;
const shieldPowerTime = shieldPowerCard?.querySelector(".power-time") || null;

let lastEnhancementHudAt = 0;
let lastEnhancementHudKey = "";
let lastBoosterHudAt = 0;


const cameraFeed = document.getElementById("cameraFeed");
const cameraButton = document.getElementById("cameraButton");
const cameraMessage = document.getElementById("cameraMessage");
const cameraStatus = document.getElementById("cameraStatus");
const trackingAlert = document.getElementById("trackingAlert");
const motionHud = document.getElementById("motionHud");
const motionLevel = document.getElementById("motionLevel");
const squatFloat = document.getElementById("squatFloat");
const squatMeterFill = document.getElementById("squatMeterFill");
const squatFloatValue = document.getElementById("squatFloatValue");
const squatPowerText = document.getElementById("squatPowerText");
let squatFloatDisplay = 0;
let squatFloatTarget = 0;
const squatPhaseLabel = document.getElementById("squatPhaseLabel");
const squatQualityLabel = document.getElementById("squatQualityLabel");
const trackingDot = document.getElementById("trackingDot");
const calibrationBadge = null;
const calibrationConfirm = document.getElementById("calibrationConfirm");
const calibrationStartButton = document.getElementById("calibrationStartButton");
const rewardToast = document.getElementById("rewardToast");
let gameArmed = false;
let bgAnchor = null;
const positionGuide = document.getElementById("positionGuide");
const orientationScreen = null;
const fullscreenScreen = null;
const fullscreenButton = null;

const GAME_WIDTH = canvas.width;
const GAME_HEIGHT = canvas.height;

/*
Natywne renderowanie pełnoekranowe.

Canvas ma dokładnie tyle fizycznych pikseli, ile aktualnie potrzebuje ekran.
Świat gry nadal używa wygodnego układu 960 × 540, ale jest skalowany metodą
"cover" bez rozciągania proporcji. Nadmiar obrazu po bokach albo u góry jest
symetrycznie przycinany, dzięki czemu wszystkie grafiki pozostają ostre.
*/
const MOBILE_PERFORMANCE_MODE = window.matchMedia("(pointer: coarse)").matches;
let pixelRatio = 1;
let viewportWidth = GAME_WIDTH;
let viewportHeight = GAME_HEIGHT;
let renderScale = 1;
let renderOffsetX = 0;
let renderOffsetY = 0;

function applyGameTransform() {
    ctx.setTransform(
        pixelRatio * renderScale,
        0,
        0,
        pixelRatio * renderScale,
        pixelRatio * renderOffsetX,
        pixelRatio * renderOffsetY
    );
}

function configureCanvasQuality() {
    const rect = canvas.getBoundingClientRect();
    viewportWidth = Math.max(1, Math.round(rect.width || window.innerWidth));
    viewportHeight = Math.max(1, Math.round(rect.height || window.innerHeight));

    // Ograniczenie pamięci tylko na ekstremalnie gęstych ekranach.
    // Typowe Full HD, 2K, 4K i Retina nadal renderują się bardzo ostro.
    const nativeRatio = Math.max(1, window.devicePixelRatio || 1);
    // v79: GPU fill-rate był jednym z głównych bottlenecków na telefonie.
    // Canvas nadal ma ten sam rozmiar CSS, ale jego wewnętrzny bufor jest lżejszy.
    const maxBackingPixels = MOBILE_PERFORMANCE_MODE ? 2_200_000 : 8_000_000;
    const safeRatio = Math.sqrt(
        maxBackingPixels / Math.max(1, viewportWidth * viewportHeight)
    );

    // v89: na telefonie priorytetem jest stabilne 60 Hz, nie supersampling.
    // 1.0 oznacza nawet ~31% mniej pikseli niż 1.20 i wielokrotnie mniej niż DPR 2-3.
    const targetRatio = MOBILE_PERFORMANCE_MODE ? 1.20 : 2;
    pixelRatio = Math.max(1, Math.min(nativeRatio, targetRatio, safeRatio));

    canvas.width = Math.max(1, Math.round(viewportWidth * pixelRatio));
    canvas.height = Math.max(1, Math.round(viewportHeight * pixelRatio));

    renderScale = Math.max(
        viewportWidth / GAME_WIDTH,
        viewportHeight / GAME_HEIGHT
    );
    renderOffsetX = (viewportWidth - GAME_WIDTH * renderScale) / 2;
    renderOffsetY = (viewportHeight - GAME_HEIGHT * renderScale) / 2;

    applyGameTransform();
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = MOBILE_PERFORMANCE_MODE ? "medium" : "high";
}

configureCanvasQuality();

/*
Ustaw na true, jeśli chcesz zobaczyć hitboxy.
*/

const DEBUG_HITBOXES = false;

/*
=========================================================
WCZYTYWANIE GRAFIK
=========================================================
*/

function loadImage(path) {
    const image = new Image();
    image.src = path;
    return image;
}

const images = {
    background: loadImage("assets/background.png"),
    player: loadImage("assets/player.png"),
    playerCoin: loadImage("assets/player_coin.png"),
    playerBooster: loadImage("assets/player_booster.png"),

    obstacleTop: loadImage("assets/obstacle_top.png"),
    obstacleBottom: loadImage("assets/obstacle_bottom.png"),

    coin: loadImage("assets/coin.png"),
    booster: loadImage("assets/booster.png"),
    slotPickup: loadImage("assets/slot_pickup.png")
};

let gameplayAssetsWarmPromise = null;
let gameplayAssetsWarmed = false;

async function warmGameplayAssets() {
    if (gameplayAssetsWarmed) {
        return true;
    }

    if (gameplayAssetsWarmPromise) {
        return gameplayAssetsWarmPromise;
    }

    gameplayAssetsWarmPromise =
        (async () => {
            const criticalImages = [
                images.player,
                images.playerCoin,
                images.playerBooster,
                images.coin,
                images.booster,
                images.slotPickup
            ];

            // Wymuś pełne dekodowanie bitmap jeszcze przed właściwą grą.
            await Promise.all(
                criticalImages.map(
                    async image => {
                        if (!image) return;

                        try {
                            if (
                                typeof image.decode ===
                                "function"
                            ) {
                                await image.decode();
                                return;
                            }
                        } catch (_) {}

                        if (!image.complete) {
                            await new Promise(resolve => {
                                const done = () => resolve();
                                image.addEventListener(
                                    "load",
                                    done,
                                    { once:true }
                                );
                                image.addEventListener(
                                    "error",
                                    done,
                                    { once:true }
                                );
                            });
                        }
                    }
                )
            );

            // Pierwsza moneta zmienia sprite gracza na playerCoin.
            // Rysujemy krytyczne tekstury raz poza ekranem na TYM SAMYM canvasie,
            // aby przeglądarka przygotowała upload/teksturę zanim zacznie się gameplay.
            try {
                ctx.save();
                ctx.globalAlpha = 0.001;

                const warmImages = [
                    images.playerCoin,
                    images.playerBooster,
                    images.coin
                ];

                for (
                    let i = 0;
                    i < warmImages.length;
                    i++
                ) {
                    const image =
                        warmImages[i];

                    if (!imageReady(image)) {
                        continue;
                    }

                    ctx.drawImage(
                        image,
                        -300 - i * 140,
                        -300,
                        120,
                        120
                    );
                }

                ctx.restore();
            } catch (_) {}

            gameplayAssetsWarmed = true;
            return true;
        })()
        .catch(() => {
            // Warmup jest optymalizacją, nigdy nie blokuje gry.
            gameplayAssetsWarmPromise = null;
            return false;
        });

    return gameplayAssetsWarmPromise;
}

function imageReady(image) {
    return Boolean(
        image &&
        image.complete &&
        image.naturalWidth > 0 &&
        image.naturalHeight > 0
    );
}

/*
=========================================================
USTAWIENIA GRY
=========================================================
*/

let cachedBackgroundVeil = null;

function getBackgroundVeil() {
    if (cachedBackgroundVeil) {
        return cachedBackgroundVeil;
    }

    const gradient =
        ctx.createLinearGradient(
            0, 0, 0, GAME_HEIGHT
        );

    gradient.addColorStop(
        0,
        "rgba(4,10,20,.10)"
    );
    gradient.addColorStop(
        .55,
        "rgba(4,10,20,.02)"
    );
    gradient.addColorStop(
        1,
        "rgba(4,10,20,.16)"
    );

    cachedBackgroundVeil = gradient;
    return gradient;
}

const settings = {
    /*
    Fizyka gracza.
    */

    // Fizyka pod pompki: każda zaakceptowana pompka daje pełne wybicie.
    gravity: 0.095,
    jumpStrength: -5.35,
    jumpImpulse: 2.35, // pozostawione dla innych mechanik gry; pompka używa jumpStrength bezpośrednio
    maxFallSpeed: 3.2,

    /*
    Prędkość świata.
    */

    worldSpeed: 2.8,

    /*
    Booster.
    */

    boosterSpeedMultiplier: 1.32,
    boosterDuration: 5000,

    boosterIntervalMin: 70,
    boosterIntervalMax: 95,

    /*
    Punkty.
    */

    obstaclePoints: 1,
    coinPoints: 3,
    boostedCoinPoints: 6,

    /*
    =====================================================
    ROZMIAR PRZESZKÓD
    =====================================================

    obstacleWidth:
    szerokość grafiki przeszkody.

    obstacleDrawHeight:
    wysokość całej grafiki przeszkody.

    Te dwie wartości możesz swobodnie edytować.
    */

    obstacleWidth: 172,
    obstacleDrawHeight: 520,

    /*
    =====================================================
    MAKSYMALNE PRZESUNIĘCIE PRZESZKODY
    =====================================================

    obstacleMaxHide: 250 oznacza:

    - górna przeszkoda może zostać przesunięta
      maksymalnie 250 px ponad ekran,

    - dolna przeszkoda może zostać przesunięta
      maksymalnie 250 px pod ekran.
    */

    obstacleMaxHide: 175,

    /*
    Minimalne schowanie przeszkody.

    Ustaw 0, jeśli przeszkoda może być całkowicie
    wysunięta na planszę.
    */

    obstacleMinHide: 0,

    /*
    Minimalna widoczna część przeszkody.

    Jest to dodatkowe zabezpieczenie na wypadek,
    gdyby wysokość grafiki była mniejsza.
    */

    obstacleMinVisible: 175,

    /*
    Przejścia między podwójnymi przeszkodami.
    */

    normalGapMin: 145,
    normalGapMax: 170,

    narrowGapMin: 126,
    narrowGapMax: 145,

    veryNarrowGapMin: 112,
    veryNarrowGapMax: 128,

    /*
    Odległości pomiędzy przeszkodami.
    */

    obstacleSpacingMin: 215,
    obstacleSpacingMax: 335,
    minimumLateGameSpacing: 185,

    /*
    Monety i booster.
    */

    coinSize: 40,
    boosterSize: 54,

    coinFaceDuration: 250,

    /*
    Zmiana koloru tła.
    */

    glowEveryPoints: 50,
    glowTransitionDuration: 1200,
    glowOverlayOpacity: 0.36,

    /* Lekkie efekty wizualne. */
    particlesEnabled: !window.matchMedia("(prefers-reduced-motion: reduce)").matches && !window.matchMedia("(pointer: coarse)").matches
};

/*
=========================================================
STAN GRY
=========================================================
*/

const GAME_STATE = {
    READY: "ready",
    RUNNING: "running",
    GAME_OVER: "gameOver",
    PAUSED: "paused"
};

let gameState = GAME_STATE.READY;

let score = 0;

let bestScore = Number(
    localStorage.getItem("flappyBestScore") || 0
);

let obstacles = [];
let coins = [];
let boosters = [];
let mysteryItems = [];
let rareItems = [];
let particles = [];
let weatherParticles = [];
let ambientEventParticles = [];
let activeEvent = null;
let eventEndTime = 0;
let nextLightningTime = 0;
let lightningFlash = 0;
let windGust = 0;
let nextEventScore = 18;
let fever = 0;
let feverEndTime = 0;
let magnetEndTime = 0;
let doubleCoinEndTime = 0;
let extraLives = 0;
let screenShake = 0;
let combo = 0;
let maxCombo = 0;
let shieldCharges = 0;
let slowEndTime = 0;
let soundEnabled = localStorage.getItem("flappySound") !== "off";
let audioContext = null;
let audioUnlocked = false;
const AUDIO_FILES = {
    jumpSoft: "assets/sfx_jump_soft.wav",
    jumpHard: "assets/sfx_jump_hard.wav",
    coin: "assets/sfx_coin.wav"
};

const AudioManager = {
    pools: new Map(),
    ready: false,

    init() {
        if (this.ready) return;
        const config = { jumpSoft: 2, jumpHard: 2, coin: 2 };
        for (const [name, count] of Object.entries(config)) {
            const voices = [];
            for (let i = 0; i < count; i += 1) {
                const audio = new Audio(AUDIO_FILES[name]);
                audio.preload = "auto";
                audio.playsInline = true;
                audio.load();
                voices.push(audio);
            }
            this.pools.set(name, { voices, index: 0 });
        }
        this.ready = true;
    },

    async prime() {
        if (!soundEnabled) return false;

        this.init();

        const warmups = [];

        // Rozgrzewamy każdy kanał jeszcze w geście użytkownika.
        for (const entry of this.pools.values()) {
            for (const audio of entry.voices) {
                try {
                    audio.muted = false;
                    audio.volume = 0.001;
                    audio.currentTime = 0;

                    const result =
                        audio.play();

                    if (
                        result &&
                        typeof result.then ===
                            "function"
                    ) {
                        warmups.push(
                            result
                                .then(() => {
                                    audio.pause();
                                    audio.currentTime = 0;
                                    audio.volume = 1;
                                })
                                .catch(() => {
                                    audio.volume = 1;
                                })
                        );
                    } else {
                        audio.pause();
                        audio.currentTime = 0;
                        audio.volume = 1;
                    }
                } catch (_) {
                    audio.volume = 1;
                }
            }
        }

        if (warmups.length) {
            await Promise.allSettled(
                warmups
            );
        }

        audioUnlocked = true;
        return true;
    },

    async play(name, volume = 0.65) {
        if (!soundEnabled) return false;
        this.init();
        const entry = this.pools.get(name);
        if (!entry) return false;
        const audio = entry.voices[entry.index];
        entry.index = (entry.index + 1) % entry.voices.length;
        try {
            audio.pause();
            audio.currentTime = 0;
            audio.muted = false;
            audio.volume = Math.max(0, Math.min(1, volume));
            const result = audio.play();
            if (result && typeof result.then === "function") await result;
            return true;
        } catch (_) {
            return false;
        }
    },

    playSquat(multiplier) {
        return this.play(multiplier >= 0.68 ? "jumpHard" : "jumpSoft",
            multiplier >= 0.68 ? .72 : .54);
    }
};

AudioManager.init();

async function unlockAudio() {
    if (!soundEnabled) return false;
    await AudioManager.prime();
    return true;
}

let boosterEndTime = 0;
let coinFaceEndTime = 0;

let pendingBooster = false;
let nextBoosterScore = 0;

let lastFrameTime = performance.now();

let previousObstaclePattern = "";
let repeatedPatternCount = 0;

/*
=========================================================
GRACZ
=========================================================
*/

const player = {
    x: 105,
    y: GAME_HEIGHT / 2 - 32,

    width: 64,
    height: 64,

    velocityY: 0,

    collisionPaddingX: 14,
    collisionPaddingY: 13
};

/*
=========================================================
KOLORY TŁA
=========================================================
*/

const glowColors = [
    { r: 0, g: 0, b: 0 },
    { r: 25, g: 115, b: 255 },
    { r: 170, g: 40, b: 255 },
    { r: 255, g: 80, b: 20 },
    { r: 255, g: 25, b: 70 },
    { r: 0, g: 220, b: 175 },
    { r: 245, g: 185, b: 15 }
];

let currentGlowStage = 0;

let previousGlowColor = {
    r: 0,
    g: 0,
    b: 0
};

let targetGlowColor = {
    r: 0,
    g: 0,
    b: 0
};

let glowTransitionStart = performance.now();

/*
=========================================================
FUNKCJE POMOCNICZE
=========================================================
*/

function clamp(value, minimum, maximum) {
    return Math.max(
        minimum,
        Math.min(maximum, value)
    );
}

function randomBetween(minimum, maximum) {
    return minimum + Math.random() * (maximum - minimum);
}

function randomInteger(minimum, maximum) {
    return Math.floor(
        randomBetween(minimum, maximum + 1)
    );
}

function chooseRandom(array) {
    return array[
        randomInteger(0, array.length - 1)
    ];
}

function rectanglesOverlap(first, second) {
    return (
        first.x < second.x + second.width &&
        first.x + first.width > second.x &&
        first.y < second.y + second.height &&
        first.y + first.height > second.y
    );
}

function isBoosterActive(now = performance.now()) {
    return now < boosterEndTime;
}

function isFeverActive(now = performance.now()) { return now < feverEndTime; }
function isMagnetActive(now = performance.now()) { return now < magnetEndTime; }
function isDoubleCoinActive(now = performance.now()) { return now < doubleCoinEndTime; }

function getDifficultyLevel() {
    return Math.min(8, 1 + Math.floor(score / 20));
}

function getCurrentWorldSpeed(now = performance.now()) {
    // Poziomy przyspieszają bardzo łagodnie: maksymalnie o 28%.
    const difficultyMultiplier = 1 + Math.min(0.28, score * 0.0025);
    const feverMultiplier = isFeverActive(now) ? 1.10 : 1;
    const normalSpeed = settings.worldSpeed * difficultyMultiplier * feverMultiplier;

    // Przyspieszenie ma pierwszeństwo przed spowolnieniem, więc zawsze jest
    // wyraźnie szybsze od aktualnej prędkości poziomu.
    if (isBoosterActive(now)) {
        return normalSpeed * settings.boosterSpeedMultiplier;
    }

    if (now < slowEndTime) {
        return normalSpeed * 0.72;
    }

    return normalSpeed;
}

function tone(frequency, duration = 0.08, type = "sine", volume = 0.05) {
    if (!soundEnabled) return;
    try {
        audioContext ||= new (window.AudioContext || window.webkitAudioContext)();
        if (audioContext.state === "suspended") audioContext.resume();
        audioUnlocked = true;
        const oscillator = audioContext.createOscillator();
        const gain = audioContext.createGain();
        oscillator.type = type;
        oscillator.frequency.setValueAtTime(frequency, audioContext.currentTime);
        gain.gain.setValueAtTime(volume, audioContext.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.0001, audioContext.currentTime + duration);
        oscillator.connect(gain).connect(audioContext.destination);
        oscillator.start(); oscillator.stop(audioContext.currentTime + duration);
    } catch (_) {}
}
function squatSound(multiplier = 0.6) {
    if (!soundEnabled) return;
    AudioManager.playSquat(multiplier).then(ok => {
        if (!ok) tone(610 - multiplier * 95, 0.06, "sine", 0.045);
    });
}
function weatherSound(kind) {
    if (!soundEnabled) return;
    if (kind === "storm") tone(105, .18, "sawtooth", .018);
    else if (kind === "rain") tone(185, .08, "triangle", .012);
    else if (kind === "snow") tone(880, .05, "sine", .012);
    else if (kind === "wind") tone(145, .09, "sine", .012);
}

function vibrate(pattern) {
    if (navigator.vibrate) navigator.vibrate(pattern);
}

/*
Zwraca bezpieczny zakres przesunięcia przeszkody.

Przeszkoda nigdy nie zostanie schowana bardziej
niż obstacleMaxHide, czyli domyślnie 250 px.
*/

function getObstacleHideRange() {
    const maximumAllowedByImage = Math.max(
        0,
        settings.obstacleDrawHeight -
        settings.obstacleMinVisible
    );

    const maximumHide = clamp(
        settings.obstacleMaxHide,
        0,
        maximumAllowedByImage
    );

    const minimumHide = clamp(
        settings.obstacleMinHide,
        0,
        maximumHide
    );

    return {
        minimumHide,
        maximumHide
    };
}

/*
=========================================================
CZĄSTECZKI I EFEKTY
=========================================================
*/

function emitParticles(x, y, count, options = {}) {
    if (!settings.particlesEnabled) return;

    for (let i = 0; i < count; i += 1) {
        const angle = randomBetween(0, Math.PI * 2);
        const speed = randomBetween(options.speedMin || 0.7, options.speedMax || 2.6);
        const life = randomBetween(options.lifeMin || 260, options.lifeMax || 620);

        particles.push({
            x, y,
            vx: Math.cos(angle) * speed + (options.driftX || 0),
            vy: Math.sin(angle) * speed + (options.driftY || 0),
            size: randomBetween(options.sizeMin || 2, options.sizeMax || 6),
            life,
            maxLife: life,
            color: options.color || "255,255,255",
            gravity: options.gravity ?? 0.025
        });
    }
}

function updateParticles(frameScale, deltaTime) {
    for (const particle of particles) {
        particle.x += particle.vx * frameScale;
        particle.y += particle.vy * frameScale;
        particle.vy += particle.gravity * frameScale;
        particle.life -= deltaTime;
    }

    particles = particles.filter(particle => particle.life > 0);
}

function drawParticles() {
    ctx.save();
    for (const particle of particles) {
        const alpha = clamp(particle.life / particle.maxLife, 0, 1);
        ctx.fillStyle = `rgba(${particle.color},${alpha})`;
        ctx.beginPath();
        ctx.arc(particle.x, particle.y, particle.size * alpha, 0, Math.PI * 2);
        ctx.fill();
    }
    ctx.restore();
}

/*
=========================================================
RESET GRY
=========================================================
*/

function resetGame() {
    disableSnapshotBackground();
    document.body.classList.remove("game-running");
    score = 0;
    combo = 0;
    maxCombo = 0;
    shieldCharges = 0;
    slowEndTime = 0;

    player.x = 180;
    player.y =
        GAME_HEIGHT / 2 -
        player.height / 2;

    player.velocityY = 0;

    obstacles = [];
    coins = [];
    boosters = [];
    mysteryItems = [];
    rareItems = [];
    weatherParticles = [];
    particles = [];
    activeEvent = null;
    eventEndTime = 0;
    nextLightningTime = 0;
    lightningFlash = 0;
    windGust = 0;
    nextEventScore = randomInteger(16, 25);
    fever = 0;
    feverEndTime = 0;

    lastEnhancementHudKey = "";
    lastEnhancementHudAt = 0;

    if (feverFill) {
        feverFill.style.setProperty(
            "--fever-scale",
            "0"
        );
    }

    if (feverLabel) {
        feverLabel.textContent =
            "🔥 FEVER";
    }
    magnetEndTime = 0;
    doubleCoinEndTime = 0;
    extraLives = 0;
    screenShake = 0;

    boosterEndTime = 0;
    coinFaceEndTime = 0;

    pendingBooster = false;

    nextBoosterScore = randomInteger(
        settings.boosterIntervalMin,
        settings.boosterIntervalMax
    );

    previousObstaclePattern = "";
    repeatedPatternCount = 0;

    currentGlowStage = 0;

    previousGlowColor = {
        r: 0,
        g: 0,
        b: 0
    };

    targetGlowColor = {
        r: 0,
        g: 0,
        b: 0
    };

    glowTransitionStart = performance.now();

    spawnObstacle(GAME_WIDTH + 250);

    updateScoreDisplays();
    updateBoosterDisplay();

    if (finalScore) {
        finalScore.textContent = "0";
    }

    if (gameOverScreen) gameOverScreen.classList.add("hidden");
    if (pauseScreen) pauseScreen.classList.add("hidden");
    updateEnhancementHud(performance.now(), true);
}

/*
=========================================================
START, SKOK I KONIEC GRY
=========================================================
*/

function startGame() {
    if (!applyDeviceGate()) return;
    requestGameFullscreen();

    simAccumulatorMs = 0;
    simLastFrameAt = performance.now();

    if (gameState === GAME_STATE.GAME_OVER) {
        return;
    }

    if (gameState === GAME_STATE.READY) {
        gameState = GAME_STATE.RUNNING;

        if (startScreen) {
            startScreen.classList.add("hidden");
        }

        player.velocityY = settings.jumpStrength;
        return;
    }

    flap();
}

function flap(strengthMultiplier = 1) {
    if (gameState !== GAME_STATE.RUNNING) return;
    tone(520, 0.055, "sine", 0.035);
    vibrate(8);

    // Kluczowe dla sterowania pompkami: flap nie może tylko zmniejszać opadania.
    // Każda poprawnie wykryta pompka natychmiast odwraca ruch i nadaje
    // postaci pełną prędkość w górę. Dzięki temu działa nawet przy maxFallSpeed.
    const eventJumpMultiplier = activeEvent === "snow" ? 0.90 : activeEvent === "rain" ? 1.04 : 1;
    player.velocityY = settings.jumpStrength * eventJumpMultiplier * strengthMultiplier;

    // Mały natychmiastowy przesuw daje czytelny feedback jeszcze w tej samej klatce.
    player.y = Math.max(0, player.y - 2.5);

    emitParticles(
        player.x + 10,
        player.y + player.height * 0.65,
        5,
        { color: "220,245,255", driftX: -1.2, sizeMax: 4, lifeMax: 360 }
    );
}

function endGame() {
    if (gameState !== GAME_STATE.RUNNING) return;
    if (extraLives > 0) {
        extraLives -= 1;
        player.y = GAME_HEIGHT / 2 - player.height / 2;
        player.velocityY = settings.jumpStrength * 0.55;
        obstacles = obstacles.filter(o => o.x > player.x + 170 || o.x + o.width < player.x - 60);
        screenShake = 7;
        tone(620, .25, "triangle", .06);
        vibrate([30,25,50]);
        showEventBanner("❤️ DRUGA SZANSA", "Wracasz do gry!");
        emitParticles(player.x+32, player.y+32, 36, {color:"255,90,130", speedMax:5.5, sizeMax:8});
        updateEnhancementHud(performance.now(), true);
        return;
    }
    if (shieldCharges > 0) {
        shieldCharges -= 1;
        player.velocityY = settings.jumpStrength * 0.65;
        player.y = clamp(player.y, 18, GAME_HEIGHT - player.height - 18);
        screenShake = 5;
        tone(240, 0.18, "square", 0.045);
        vibrate([25, 25, 35]);
        emitParticles(player.x + 32, player.y + 32, 28, {color:"90,220,255", speedMax:5, sizeMax:7});
        updateEnhancementHud(performance.now(), true);
        return;
    }

    gameState = GAME_STATE.GAME_OVER;
    document.body.classList.remove("game-running");
    tone(120, 0.35, "sawtooth", 0.06);
    vibrate([40, 30, 80]);
    screenShake = 10;
    emitParticles(
        player.x + player.width / 2,
        player.y + player.height / 2,
        24,
        { color: "255,125,70", speedMax: 4.8, sizeMax: 8, lifeMax: 850, gravity: 0.06 }
    );

    if (score > bestScore) {
        bestScore = score;

        localStorage.setItem(
            "flappyBestScore",
            String(bestScore)
        );
    }

    if (finalScore) finalScore.textContent = String(score);
    if (finalBest) finalBest.textContent = String(bestScore);
    if (finalCombo) finalCombo.textContent = String(maxCombo);

    updateScoreDisplays();

    if (gameOverScreen) {
        gameOverScreen.classList.remove("hidden");
    }
}

function restartGame() {
    disableSnapshotBackground();
    resetGame();
    gameState = GAME_STATE.READY;
    document.body.classList.remove("game-running");
    player.velocityY = 0;
    gameArmed = false;

    resetRepController();
    resetPoseCalibration();

    hideCalibrationBadge();
    calibrationConfirm?.classList.add("hidden");
    positionGuide?.classList.remove("hidden");
    setTrackingDot("warn");

    if (motionEnabled && cameraStream) {
        startScreen?.classList.add("hidden");
        setCameraUi("🔄 Ponowna kalibracja. Stań prosto i pokaż oba barki",{active:true});
        startPoseScheduler();
    } else {
        startScreen?.classList.remove("hidden");
        setCameraUi("📷 Uruchom kamerę i wykonaj kalibrację",{active:false});
    }
}

/*
=========================================================
LOSOWANIE RODZAJU PRZESZKODY
=========================================================
*/

function chooseObstaclePattern() {
    let availablePatterns;

    if (score < 15) {
        availablePatterns = [
            "top",
            "bottom",
            "pairNormal",
            "pairNormal",
            "pairNarrow"
        ];
    } else if (score < 40) {
        availablePatterns = [
            "top",
            "bottom",
            "pairNormal",
            "pairNarrow",
            "pairNarrow",
            "pairVeryNarrow"
        ];
    } else if (score < 80) {
        availablePatterns = [
            "top",
            "bottom",
            "pairNormal",
            "pairNarrow",
            "pairNarrow",
            "pairVeryNarrow"
        ];
    } else {
        availablePatterns = [
            "top",
            "bottom",
            "pairNormal",
            "pairNarrow",
            "pairNarrow",
            "pairVeryNarrow",
            "pairVeryNarrow"
        ];
    }

    let pattern = chooseRandom(availablePatterns);

    if (
        pattern === previousObstaclePattern &&
        repeatedPatternCount >= 2
    ) {
        const alternatives = availablePatterns.filter(
            item => item !== previousObstaclePattern
        );

        pattern = chooseRandom(alternatives);
    }

    if (pattern === previousObstaclePattern) {
        repeatedPatternCount += 1;
    } else {
        previousObstaclePattern = pattern;
        repeatedPatternCount = 1;
    }

    return pattern;
}

function getRandomObstacleSpacing() {
    const difficultyReduction = Math.min(
        130,
        Math.floor(score / 10) * 10
    );

    const minimum = Math.max(
        settings.minimumLateGameSpacing,
        settings.obstacleSpacingMin -
        difficultyReduction
    );

    const maximum = Math.max(
        minimum + 70,
        settings.obstacleSpacingMax -
        difficultyReduction
    );

    return randomBetween(minimum, maximum);
}

/*
=========================================================
TWORZENIE PRZESZKÓD
=========================================================
*/

function spawnObstacle(startX) {
    const pattern = chooseObstaclePattern();

    let obstacle;

    if (pattern === "top") {
        obstacle = createSingleTopObstacle(startX);
    } else if (pattern === "bottom") {
        obstacle = createSingleBottomObstacle(startX);
    } else if (pattern === "pairNarrow") {
        obstacle = createPairObstacle(
            startX,
            "narrow"
        );
    } else if (pattern === "pairVeryNarrow") {
        obstacle = createPairObstacle(
            startX,
            "veryNarrow"
        );
    } else {
        obstacle = createPairObstacle(
            startX,
            "normal"
        );
    }

    obstacle.spacingAfter = getRandomObstacleSpacing();
    const specialRoll = Math.random();
    obstacle.special = specialRoll < 0.065 ? "gold" : specialRoll < 0.11 ? "pulse" : null;
    obstacle.pulsePhase = Math.random() * Math.PI * 2;

    const previousObstacle =
    obstacles.length > 0
        ? obstacles[obstacles.length - 1]
        : null;

obstacles.push(obstacle);

const safeY =
    getObstacleSafeY(obstacle);

// v68: jeden odcinek między przeszkodami ma jeden typ znajdźki.
// Dzięki temu Żetony, Automat, Pizza Bandita i rzadkie przedmioty
// nie mogą powstać dokładnie w tej samej strefie.
const collectibleRoll = Math.random();

if (pendingBooster) {
    spawnBooster(obstacle, safeY);
    pendingBooster = false;
} else if (score > 10 && collectibleRoll < 0.035) {
    spawnRareItem(obstacle, safeY);
} else if (score > 5 && collectibleRoll < 0.110) {
    spawnMysteryItem(obstacle, safeY);
} else {
    spawnCoinPattern(
        previousObstacle,
        obstacle
    );
}
}

/*
Górna pojedyncza przeszkoda.

hideOffset nie przekroczy 250 px.
*/

function createSingleTopObstacle(startX) {
    const hideRange = getObstacleHideRange();

    const hideOffset = randomBetween(
        hideRange.minimumHide,
        hideRange.maximumHide
    );

    const visibleHeight = clamp(
        settings.obstacleDrawHeight - hideOffset,
        settings.obstacleMinVisible,
        GAME_HEIGHT - 60
    );

    return {
        x: startX,
        width: settings.obstacleWidth,

        pattern: "top",

        topVisible: visibleHeight,
        bottomVisible: 0,

        topHideOffset: hideOffset,
        bottomHideOffset: 0,

        passed: false,
        spacingAfter: 500
    };
}

/*
Dolna pojedyncza przeszkoda.

hideOffset nie przekroczy 250 px.
*/

function createSingleBottomObstacle(startX) {
    const hideRange = getObstacleHideRange();

    const hideOffset = randomBetween(
        hideRange.minimumHide,
        hideRange.maximumHide
    );

    const visibleHeight = clamp(
        settings.obstacleDrawHeight - hideOffset,
        settings.obstacleMinVisible,
        GAME_HEIGHT - 60
    );

    return {
        x: startX,
        width: settings.obstacleWidth,

        pattern: "bottom",

        topVisible: 0,
        bottomVisible: visibleHeight,

        topHideOffset: 0,
        bottomHideOffset: hideOffset,

        passed: false,
        spacingAfter: 500
    };
}
function createPairObstacle(startX, gapType) {
    let requestedGap;

    if (gapType === "veryNarrow") {
        requestedGap = randomBetween(
            settings.veryNarrowGapMin,
            settings.veryNarrowGapMax
        );
    } else if (gapType === "narrow") {
        requestedGap = randomBetween(
            settings.narrowGapMin,
            settings.narrowGapMax
        );
    } else {
        requestedGap = randomBetween(
            settings.normalGapMin,
            settings.normalGapMax
        );
    }

    const hideRange = getObstacleHideRange();

    /*
    Minimalna widoczna wysokość wynika z maksymalnego
    schowania grafiki.

    Przykład:
    obstacleDrawHeight = 430
    obstacleMaxHide = 250

    Minimalnie widoczne pozostaje 180 px.
    */

    const minimumVisible = Math.max(
        settings.obstacleMinVisible,
        settings.obstacleDrawHeight -
        hideRange.maximumHide
    );

    const maximumVisible = Math.min(
        GAME_HEIGHT - 60,
        settings.obstacleDrawHeight -
        hideRange.minimumHide
    );

    /*
    Przejście musi zmieścić się pomiędzy przeszkodami.
    */

    const maximumPossibleGap = Math.max(
        100,
        GAME_HEIGHT - minimumVisible * 2
    );

    const gap = clamp(
        requestedGap,
        100,
        maximumPossibleGap
    );

    /*
    Losowanie położenia środka przejścia.

    Zakres pilnuje, aby żadna grafika nie została
    przesunięta bardziej niż obstacleMaxHide.
    */

    const minimumGapCenter =
        minimumVisible +
        gap / 2;

    const maximumGapCenter =
        GAME_HEIGHT -
        minimumVisible -
        gap / 2;

    let gapCenter;

    if (minimumGapCenter <= maximumGapCenter) {
        gapCenter = randomBetween(
            minimumGapCenter,
            maximumGapCenter
        );
    } else {
        gapCenter = GAME_HEIGHT / 2;
    }

    let topVisible =
        gapCenter -
        gap / 2;

    let bottomVisible =
        GAME_HEIGHT -
        (
            gapCenter +
            gap / 2
        );

    topVisible = clamp(
        topVisible,
        minimumVisible,
        maximumVisible
    );

    bottomVisible = clamp(
        bottomVisible,
        minimumVisible,
        maximumVisible
    );

    /*
    Zabezpieczenie, aby przeszkody nie nachodziły
    na przejście po ograniczeniu wartości.
    */

    const currentGap =
        GAME_HEIGHT -
        topVisible -
        bottomVisible;

    if (currentGap < gap) {
        const missingSpace =
            gap - currentGap;

        const topCanHideMore =
            topVisible - minimumVisible;

        const bottomCanHideMore =
            bottomVisible - minimumVisible;

        const totalAvailable =
            topCanHideMore +
            bottomCanHideMore;

        if (totalAvailable > 0) {
            const topReduction =
                Math.min(
                    topCanHideMore,
                    missingSpace *
                    (
                        topCanHideMore /
                        totalAvailable
                    )
                );

            const bottomReduction =
                Math.min(
                    bottomCanHideMore,
                    missingSpace -
                    topReduction
                );

            topVisible -= topReduction;
            bottomVisible -= bottomReduction;
        }
    }

    return {
        x: startX,
        width: settings.obstacleWidth,

        pattern:
            gapType === "veryNarrow"
                ? "pairVeryNarrow"
                : gapType === "narrow"
                    ? "pairNarrow"
                    : "pairNormal",

        topVisible,
        bottomVisible,

        topHideOffset:
            settings.obstacleDrawHeight -
            topVisible,

        bottomHideOffset:
            settings.obstacleDrawHeight -
            bottomVisible,

        passed: false,
        spacingAfter: 500
    };
}

/*
=========================================================
BEZPIECZNE MIEJSCE NA MONETY I BOOSTER
=========================================================
*/

function getObstacleSafeY(obstacle) {
    if (
        obstacle.topVisible > 0 &&
        obstacle.bottomVisible > 0
    ) {
        const gapTop = obstacle.topVisible;
        const gapBottom =
            GAME_HEIGHT - obstacle.bottomVisible;

        return (gapTop + gapBottom) / 2;
    }

    if (obstacle.topVisible > 0) {
        return clamp(
            obstacle.topVisible + 140,
            80,
            GAME_HEIGHT - 80
        );
    }

    return clamp(
        GAME_HEIGHT -
            obstacle.bottomVisible -
            140,
        80,
        GAME_HEIGHT - 80
    );
}

/*
=========================================================
TWORZENIE MONET
=========================================================
*/

function coinTouchesObstacle(coin, obstacle) {
    const obstacleBoxes = getObstacleCollisionBoxes(obstacle);

    return obstacleBoxes.some(box => {
        return rectanglesOverlap(coin, box);
    });
}

function coinTouchesAnyObstacle(coin) {
    return obstacles.some(obstacle => {
        const obstacleBoxes = getObstacleCollisionBoxes(obstacle);

        return obstacleBoxes.some(box => {
            return rectanglesOverlap(coin, box);
        });
    });
}

function getObstacleCoinSafeRange(obstacle) {
    const verticalMargin = 45;
    const coinHalf = settings.coinSize / 2;

    let safeTop = verticalMargin + coinHalf;
    let safeBottom =
        GAME_HEIGHT -
        verticalMargin -
        coinHalf;

    if (obstacle) {
        if (obstacle.topVisible > 0) {
            safeTop =
                obstacle.topVisible +
                verticalMargin +
                coinHalf;
        }

        if (obstacle.bottomVisible > 0) {
            safeBottom =
                GAME_HEIGHT -
                obstacle.bottomVisible -
                verticalMargin -
                coinHalf;
        }
    }

    return {
        top: clamp(
            safeTop,
            coinHalf + 15,
            GAME_HEIGHT - coinHalf - 15
        ),

        bottom: clamp(
            safeBottom,
            coinHalf + 15,
            GAME_HEIGHT - coinHalf - 15
        )
    };
}

function coinTouchesAnyObstacle(coin) {
    return obstacles.some(obstacle => {
        const hitboxes =
            getObstacleCollisionBoxes(obstacle);

        return hitboxes.some(hitbox =>
            rectanglesOverlap(coin, hitbox)
        );
    });
}

function coinTouchesAnotherCoin(coin) {
    return coins.some(existingCoin =>
        rectanglesOverlap(coin, existingCoin)
    );
}

function spawnCoinPattern(previousObstacle, obstacle) {
    const coinSize = settings.coinSize;
    const horizontalMargin = 28;
    const preferredSpacing = 52;

    const obstacleWidth =
        obstacle.width ||
        settings.obstacleWidth;

    let zoneStart;

    if (previousObstacle) {
        const previousWidth =
            previousObstacle.width ||
            settings.obstacleWidth;

        zoneStart =
            previousObstacle.x +
            previousWidth +
            horizontalMargin;
    } else {
        zoneStart =
            obstacle.x - 330;
    }

    const zoneEnd =
        obstacle.x -
        horizontalMargin;

    const availableWidth =
        zoneEnd - zoneStart;

    /*
    Nawet przy małej przestrzeni próbujemy
    wygenerować przynajmniej jedną monetę.
    */

    if (availableWidth < coinSize) {
        return;
    }

    let amount = Math.floor(
        availableWidth / preferredSpacing
    );

    amount = clamp(amount, 2, 6);

    /*
    Jeżeli przestrzeń jest bardzo mała,
    pozwalamy również na jedną monetę.
    */

    if (availableWidth < preferredSpacing * 1.4) {
        amount = 1;
    }

    const actualSpacing =
        amount > 1
            ? Math.min(
                preferredSpacing,
                (availableWidth - coinSize) /
                    (amount - 1)
            )
            : 0;

    const totalWidth =
        amount > 1
            ? (amount - 1) * actualSpacing
            : 0;

    const startX =
        zoneStart +
        (availableWidth - totalWidth) / 2 -
        coinSize / 2;

    /*
    Monety tworzą płynną trasę od poprzedniego
    przejścia do aktualnego przejścia.
    */

    const currentSafeY =
        getObstacleSafeY(obstacle);

    const previousSafeY =
        previousObstacle
            ? getObstacleSafeY(previousObstacle)
            : currentSafeY;

    for (let index = 0; index < amount; index += 1) {
        const progress =
            amount === 1
                ? 0.5
                : index / (amount - 1);

        const routeY =
            previousSafeY +
            (currentSafeY - previousSafeY) *
                progress;

        /*
        Delikatny łuk, bez losowego chaosu.
        */

        const arc =
            Math.sin(progress * Math.PI) *
            randomBetween(-18, 18);

        const coin = {
            x:
                startX +
                index * actualSpacing,

            y:
                clamp(
                    routeY + arc - coinSize / 2,
                    20,
                    GAME_HEIGHT - coinSize - 20
                ),

            width: coinSize,
            height: coinSize,
            collected: false,

            animationOffset:
                Math.random() *
                Math.PI *
                2
        };

        /*
        Najpierw próbujemy pozycję na trasie.
        */

        if (!coinTouchesAnyObstacle(coin)) {
            coins.push(coin);
            continue;
        }

        /*
        Jeżeli łuk spowodował kolizję,
        próbujemy bez łuku.
        */

        coin.y = clamp(
            routeY - coinSize / 2,
            20,
            GAME_HEIGHT - coinSize - 20
        );

        if (!coinTouchesAnyObstacle(coin)) {
            coins.push(coin);
        }
    }
}


/*
=========================================================
ZBIERANIE MONETY
=========================================================
*/

function collectCoin(coin, now) {
    if (coin.collected) {
        return;
    }

    coin.collected = true;
    addFever(2, now);


    let points = isBoosterActive(now) ? settings.boostedCoinPoints : settings.coinPoints;
    if (isDoubleCoinActive(now) || isFeverActive(now)) points *= 2;

    combo += 1;
    maxCombo = Math.max(maxCombo, combo);
    const comboBonus = combo >= 10 ? 2 : combo >= 5 ? 1 : 0;
    AudioManager.play("coin", .34);
    addScore(points + comboBonus);
    emitParticles(
        coin.x + coin.width/2,
        coin.y + coin.height/2,
        MOBILE_PERFORMANCE_MODE ? 7 : 12,
        {
            color:"255,220,70",
            speedMax:4
        }
    );

    if (!isBoosterActive(now)) {
        coinFaceEndTime =
            now +
            settings.coinFaceDuration;
    }
}

/*
=========================================================
BOOSTER
=========================================================
*/

function spawnBooster(obstacle, safeY) {
    const typeRoll = Math.random();
    const type = typeRoll < 0.34 ? "speed" : typeRoll < 0.67 ? "shield" : "slow";
    boosters.push({
        type,
        x: obstacle.x - 185,

        y:
            clamp(
                safeY,
                settings.boosterSize / 2 + 20,
                GAME_HEIGHT -
                settings.boosterSize / 2 -
                20
            ) -
            settings.boosterSize / 2,

        width: settings.boosterSize,
        height: settings.boosterSize,

        collected: false,

        animationOffset:
            Math.random() *
            Math.PI *
            2
    });
}

function collectBooster(booster, now) {
    if (booster.collected) {
        return;
    }

    booster.collected = true;
    tone(900, 0.16, "square", 0.045);
    vibrate([15, 15, 20]);

    if (booster.type === "shield") {
        shieldCharges = Math.min(2, shieldCharges + 1);
        emitParticles(booster.x+30, booster.y+30, 24, {color:"80,220,255", speedMax:4.5});
        updateEnhancementHud(performance.now(), true);
        return;
    }
    if (booster.type === "slow") {
        slowEndTime = Math.max(now, slowEndTime) + 5000;
        emitParticles(booster.x+30, booster.y+30, 24, {color:"170,130,255", speedMax:4.5});
        updateEnhancementHud(performance.now(), true);
        return;
    }

    // Przyspieszenie anuluje aktywne spowolnienie, aby efekty się nie gryzły.
    slowEndTime = 0;

    if (isBoosterActive(now)) {
        boosterEndTime +=
            settings.boosterDuration;
    } else {
        boosterEndTime =
            now +
            settings.boosterDuration;
    }

    updateBoosterDisplay(now);
    updateEnhancementHud(now);
}

/*
=========================================================
PUNKTACJA
=========================================================
*/

function addScore(points) {
    score += points;
    tone(points > 1 ? 760 : 660, 0.07, "triangle", 0.04);

    checkBoosterThreshold();
    checkGlowStage();
    checkRandomEvent();
    updateScoreDisplays();
    updateEnhancementHud(performance.now(), true);
}

function checkBoosterThreshold() {
    if (score < nextBoosterScore) {
        return;
    }

    pendingBooster = true;

    nextBoosterScore += randomInteger(
        settings.boosterIntervalMin,
        settings.boosterIntervalMax
    );
}

function updateScoreDisplays() {
    if (scoreDisplay) {
        scoreDisplay.textContent =
            String(score);
    }

    if (bestScoreDisplay) {
        bestScoreDisplay.textContent =
            String(bestScore);
    }
}


/* =========================================================
   LOSOWE PRZEDMIOTY, WYDARZENIA I FEVER
========================================================= */
function showEventBanner(title, subtitle = "") {
    const banner = document.getElementById("eventBanner");
    if (!banner) return;
    banner.querySelector("strong").textContent = title;
    banner.querySelector("span").textContent = subtitle;
    banner.classList.remove("show");
    void banner.offsetWidth;
    banner.classList.add("show");
}

let rewardToastTimer = 0;
function showRewardToast(title, subtitle = "") {
    if (!rewardToast) return;
    const titleEl = rewardToast.querySelector("strong");
    const subtitleEl = rewardToast.querySelector("small");
    if (titleEl) titleEl.textContent = title;
    if (subtitleEl) subtitleEl.textContent = subtitle;

    rewardToast.classList.remove("show");
    void rewardToast.offsetWidth;
    rewardToast.classList.add("show");

    clearTimeout(rewardToastTimer);
    rewardToastTimer = setTimeout(() => {
        rewardToast.classList.remove("show");
    }, 950);
}

function spawnMysteryItem(obstacle, safeY) {
    mysteryItems.push({
        x: obstacle.x - 145,
        y: clamp(safeY - 36, 48, GAME_HEIGHT - 120),
        width:72,
        height:72,
        collected:false,
        phase:Math.random()*6.28
    });
}
function spawnRareItem(obstacle, safeY) {
    const type = Math.random() < .72 ? "diamond" : "heart";
    rareItems.push({type, x: obstacle.x - 225, y: clamp(safeY-28, 48, GAME_HEIGHT-105), width:56, height:56, collected:false, phase:Math.random()*6.28});
}
function applyMysteryReward(now, item) {
    const rewards = ["shield","slow","speed","magnet","double","life","jackpot"];
    const reward = chooseRandom(rewards);
    const names = {shield:"🛡️ TARCZA",slow:"❄️ SPOWOLNIENIE",speed:"⚡ TURBO",magnet:"🧲 MAGNES",double:"🪙 MONETY ×2",life:"❤️ DRUGA SZANSA",jackpot:"💎 JACKPOT +15"};
    if (reward === "shield") shieldCharges = Math.min(2, shieldCharges + 1);
    if (reward === "slow") slowEndTime = now + 5000;
    if (reward === "speed") { slowEndTime = 0; boosterEndTime = now + settings.boosterDuration; }
    if (reward === "magnet") magnetEndTime = now + 7000;
    if (reward === "double") doubleCoinEndTime = now + 8000;
    if (reward === "life") extraLives = Math.min(1, extraLives + 1);
    if (reward === "jackpot") addScore(15);
    const rewardHints = {
        shield:"Chroni przed kolizją",
        slow:"Świat zwalnia na chwilę",
        speed:"Przyspieszenie lotu",
        magnet:"Przyciąga Żetony",
        double:"Podwójne punkty za Żetony",
        life:"Jedna dodatkowa szansa",
        jackpot:"Natychmiastowy bonus punktów"
    };
    showRewardToast(names[reward], rewardHints[reward] || "Bonus aktywny");
    tone(1120,.22,"triangle",.055); vibrate([18,18,28]);
    emitParticles(item.x+26,item.y+26,30,{color:"255,215,70",speedMax:5.5,sizeMax:8});
}
function updateSpecialItems(frameScale, now) {
    const speed = getCurrentWorldSpeed(now)*frameScale;
    const box = getPlayerCollisionBox();
    for (const item of mysteryItems) {
        item.x -= speed;
        if (!item.collected && rectanglesOverlap(box,item)) { item.collected=true; applyMysteryReward(now,item); }
    }
    for (const item of rareItems) {
        item.x -= speed;
        if (!item.collected && rectanglesOverlap(box,item)) {
            item.collected=true;
            if(item.type==="diamond"){ addScore(10); showEventBanner("💎 DIAMENT +10","Rzadkie znalezisko"); }
            else { extraLives=Math.min(1,extraLives+1); showEventBanner("❤️ DRUGA SZANSA","Chroni przed przegraną"); }
            tone(1040,.2,"sine",.055); emitParticles(item.x+22,item.y+22,26,{color:item.type==="diamond"?"80,230,255":"255,80,130",speedMax:5});
        }
    }
    if (isMagnetActive(now)) {
        for (const coin of coins) {
            const dx=(player.x+32)-(coin.x+coin.width/2), dy=(player.y+32)-(coin.y+coin.height/2), d=Math.hypot(dx,dy);
            if(d<250 && d>1){ coin.x += dx/d*5*frameScale; coin.y += dy/d*5*frameScale; }
        }
    }
    mysteryItems=mysteryItems.filter(i=>!i.collected&&i.x+i.width>-80);
    rareItems=rareItems.filter(i=>!i.collected&&i.x+i.width>-80);
}
function drawDiamond(item, now, alpha = 1) {
    const itemRenderX =
        renderWorldX(
            item,
            alpha,
            renderWorldLead
        );

    const itemRenderY =
        renderY(item, alpha);

    const bob = Math.sin(now / 190 + item.phase) * 6;
    const pulse = 1 + Math.sin(now / 130 + item.phase) * 0.055;
    ctx.save();
    ctx.translate(itemRenderX + item.width / 2, itemRenderY + item.height / 2 + bob);
    ctx.scale(pulse, pulse);
    ctx.rotate(Math.sin(now / 520 + item.phase) * 0.08);

    if (!MOBILE_PERFORMANCE_MODE) {
        const aura = ctx.createRadialGradient(0, 0, 4, 0, 0, 38);
        aura.addColorStop(0, "rgba(255,255,255,.9)");
        aura.addColorStop(.25, "rgba(80,235,255,.42)");
        aura.addColorStop(1, "rgba(40,130,255,0)");
        ctx.fillStyle = aura;
        ctx.beginPath();
        ctx.arc(0, 0, 38, 0, Math.PI * 2);
        ctx.fill();

        ctx.shadowColor = "#50eaff";
        ctx.shadowBlur = 25;
    }
    ctx.beginPath();
    ctx.moveTo(0, -27); ctx.lineTo(23, -9); ctx.lineTo(16, 18);
    ctx.lineTo(0, 30); ctx.lineTo(-16, 18); ctx.lineTo(-23, -9); ctx.closePath();
    const gem = ctx.createLinearGradient(-18, -24, 18, 28);
    gem.addColorStop(0, "#f8ffff"); gem.addColorStop(.22, "#6ff7ff");
    gem.addColorStop(.58, "#159ee8"); gem.addColorStop(1, "#2749c7");
    ctx.fillStyle = gem; ctx.fill();
    ctx.shadowBlur = 0;
    ctx.strokeStyle = "rgba(235,255,255,.95)"; ctx.lineWidth = 2; ctx.stroke();

    ctx.strokeStyle = "rgba(255,255,255,.68)"; ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.moveTo(0,-27); ctx.lineTo(0,30);
    ctx.moveTo(-23,-9); ctx.lineTo(23,-9);
    ctx.moveTo(-23,-9); ctx.lineTo(0,8); ctx.lineTo(23,-9);
    ctx.moveTo(-16,18); ctx.lineTo(0,8); ctx.lineTo(16,18);
    ctx.stroke();

    for (let i=0;i<4;i++) {
        const a = now/420 + item.phase + i*Math.PI/2;
        const r = 34 + 3*Math.sin(now/180+i);
        const x = Math.cos(a)*r, y = Math.sin(a)*r;
        ctx.fillStyle = `rgba(255,255,255,${.45+.35*Math.sin(now/110+i)})`;
        ctx.beginPath(); ctx.arc(x,y,1.6,0,Math.PI*2); ctx.fill();
    }
    ctx.restore();
}

function drawSpecialItems(now, alpha = 1) {
    for (const item of mysteryItems) {
        const itemRenderX =
            renderWorldX(
            item,
            alpha,
            renderWorldLead
        );

        const itemRenderY =
            renderY(item, alpha);

        const bob = Math.sin(now / 210 + item.phase) * 6;
        const pulse = 1 + Math.sin(now / 150 + item.phase) * .035;
        ctx.save();
        ctx.translate(itemRenderX + item.width/2, itemRenderY + item.height/2 + bob);
        ctx.scale(pulse,pulse);
        ctx.rotate(Math.sin(now / 420 + item.phase) * .055);
        if (!MOBILE_PERFORMANCE_MODE) {
            ctx.shadowColor = "#ffb31a";
            ctx.shadowBlur = 24;
        }
        if (imageReady(images.slotPickup)) {
            ctx.drawImage(images.slotPickup, -item.width/2, -item.height/2, item.width, item.height);
        } else {
            ctx.fillStyle="#ff9b19"; ctx.fillRect(-32,-32,64,64);
        }
        ctx.restore();
    }
    for (const item of rareItems) {
        if (item.type === "diamond") {
            drawDiamond(item, now, alpha);
        } else {
            const itemRenderX =
                renderWorldX(
            item,
            alpha,
            renderWorldLead
        );

            const itemRenderY =
                renderY(item, alpha);

            const bob=Math.sin(now/180+item.phase)*6;
            ctx.save();ctx.translate(itemRenderX+item.width/2,itemRenderY+item.height/2+bob);
            if (!MOBILE_PERFORMANCE_MODE) {
                ctx.shadowBlur=24;
                ctx.shadowColor="#ff4f85";
            }
            ctx.font="46px system-ui";
            ctx.textAlign="center";ctx.textBaseline="middle";ctx.fillText("❤️",0,0);ctx.restore();
        }
    }
}
function addFever(amount, now = performance.now()) {
    if (isFeverActive(now)) return;

    fever = clamp(
        fever + amount,
        0,
        100
    );

    if (fever >= 100) {
        activateFever(now);
    }

    updateEnhancementHud(now, true);
}

function activateFever(now){
    fever=0;
    feverEndTime=now+9000;
    doubleCoinEndTime=Math.max(doubleCoinEndTime,feverEndTime);
    showEventBanner("🔥 FEVER MODE","MONETY ×2 · SZYBSZA GRA");
    tone(1280,.3,"sawtooth",.05);
    emitParticles(player.x+32,player.y+32,24,{color:"255,110,40",speedMax:6,sizeMax:7});
}
function checkRandomEvent(){
    if(score < nextEventScore || activeEvent) return;
    nextEventScore = score + randomInteger(22,34);
    activeEvent = chooseRandom(["rain","snow","wind","night","storm"]);
    eventEndTime = performance.now() + randomInteger(9000,14000);
    nextLightningTime = performance.now() + randomInteger(1200,2400);
    windGust = 0;
    const labels={
        rain:["🌧️ ULEWA","Cięższe opadanie. skacz odrobinę wcześniej"],
        snow:["❄️ ZAMIEĆ","Świat zwalnia, ale sterowanie jest bardziej miękkie"],
        wind:["🌬️ SILNY WIATR","Podmuchy zmieniają tor lotu"],
        night:["🌙 NOC","Widoczność jest mniejsza, monety świecą mocniej"],
        storm:["⛈️ BURZA","Błyskawice wywołują krótkie wstrząsy"]
    };
    showEventBanner(...labels[activeEvent]);
    weatherSound(activeEvent);
}

function updateWorldEvent(frameScale,now){
    if(activeEvent && now>=eventEndTime){
        activeEvent=null; weatherParticles=[]; ambientEventParticles=[];
        lightningFlash=0; windGust=0;
        showEventBanner("☀️ POGODA MIJA","Warunki wróciły do normy");
    }
    lightningFlash = Math.max(0, lightningFlash - .055*frameScale);
    if(!activeEvent) return;

    if(activeEvent==="wind"){
        windGust = Math.sin(now/520) * .055 + Math.sin(now/1730) * .03;
        player.velocityY += windGust * frameScale;
    }
    if(activeEvent==="storm" && now >= nextLightningTime){
        nextLightningTime = now + randomInteger(1600,3100);
        lightningFlash = 1;
        screenShake = Math.max(screenShake, 2.8);
        player.velocityY += randomBetween(-.28,.34);
        tone(90,.12,"sawtooth",.025);
    }

    const baseCount =
        activeEvent==="storm" ? 5 :
        activeEvent==="rain" ? 7 :
        activeEvent==="snow" ? 1 :
        activeEvent==="wind" ? 2 : 1;

    const count =
        activeEvent === "snow"
            ? 1
            : (
                MOBILE_PERFORMANCE_MODE
                    ? Math.max(1, Math.ceil(baseCount * 0.24))
                    : Math.max(1, Math.ceil(baseCount * 0.65))
            );
    for(let i=0;i<count;i++){
        const particleCap =
            activeEvent === "snow"
                ? (MOBILE_PERFORMANCE_MODE ? 8 : 14)
                : (MOBILE_PERFORMANCE_MODE ? 34 : 110);

        if(weatherParticles.length >= particleCap) break;

        if(activeEvent==="snow") weatherParticles.push({
            x:Math.random()*GAME_WIDTH,
            y:-20,
            vx:randomBetween(-.45,.12),
            vy:randomBetween(.65,1.15),
            size:randomBetween(1.5,3.2),
            phase:Math.random()*6.28
        });
        else if(activeEvent==="wind") weatherParticles.push({x:GAME_WIDTH+20,y:Math.random()*GAME_HEIGHT,vx:randomBetween(-8,-4),vy:randomBetween(-.35,.35),size:randomBetween(18,55),phase:0});
        else if(activeEvent!=="night") weatherParticles.push({x:Math.random()*(GAME_WIDTH+120),y:-20,vx:activeEvent==="storm"?randomBetween(-2.7,-1.7):randomBetween(-1.8,-1),vy:activeEvent==="storm"?randomBetween(10,15):randomBetween(8,12),size:randomBetween(1,2.4),phase:0});
    }
    for(const p of weatherParticles){
        if(activeEvent==="snow") p.x += (p.vx + Math.sin(now/400+p.phase)*.45)*frameScale;
        else p.x += p.vx*frameScale;
        p.y += p.vy*frameScale;
    }
    weatherParticles=weatherParticles.filter(p=>p.y<GAME_HEIGHT+45&&p.x>-90&&p.x<GAME_WIDTH+90);
}

function drawWorldEvent(now){
    ctx.save();
    if(activeEvent==="night"){
        const night=ctx.createLinearGradient(0,0,0,GAME_HEIGHT);
        night.addColorStop(0,"rgba(4,8,35,.72)"); night.addColorStop(1,"rgba(10,25,60,.46)");
        ctx.fillStyle=night;ctx.fillRect(0,0,GAME_WIDTH,GAME_HEIGHT);
        for(let i=0;i<(MOBILE_PERFORMANCE_MODE?18:34);i++){
            const tw=.35+.45*Math.sin(now/520+i*1.7);
            ctx.fillStyle=`rgba(235,245,255,${tw})`;
            ctx.beginPath();ctx.arc((i*137)%GAME_WIDTH,(i*73)%310,1+(i%3)*.35,0,Math.PI*2);ctx.fill();
        }
        const moon=ctx.createRadialGradient(820,90,4,820,90,48);
        moon.addColorStop(0,"rgba(255,255,230,.95)");moon.addColorStop(.35,"rgba(210,230,255,.36)");moon.addColorStop(1,"rgba(130,170,255,0)");
        ctx.fillStyle=moon;ctx.beginPath();ctx.arc(820,90,48,0,Math.PI*2);ctx.fill();
    }
    if(activeEvent==="rain" || activeEvent==="storm"){
        const haze=ctx.createLinearGradient(0,0,0,GAME_HEIGHT);
        haze.addColorStop(0,activeEvent==="storm"?"rgba(20,30,60,.30)":"rgba(60,100,135,.14)");
        haze.addColorStop(1,"rgba(20,45,70,.12)");ctx.fillStyle=haze;ctx.fillRect(0,0,GAME_WIDTH,GAME_HEIGHT);
    }
    if(activeEvent==="snow"){
        ctx.fillStyle="rgba(220,245,255,.065)";ctx.fillRect(0,0,GAME_WIDTH,GAME_HEIGHT);
    }

    for(const p of weatherParticles){
        if(activeEvent==="snow"){
            // Lekki śnieg: bez arc(), shadowBlur i gradientów.
            ctx.fillStyle="rgba(245,252,255,.72)";
            const s = Math.max(1, p.size);
            ctx.fillRect(p.x, p.y, s, s);
        } else if(activeEvent==="wind"){
            ctx.strokeStyle="rgba(235,250,255,.30)";
            ctx.lineWidth=1;
            ctx.beginPath();
            ctx.moveTo(p.x,p.y);
            ctx.lineTo(p.x+p.size,p.y-2);
            ctx.stroke();
        } else {
            ctx.strokeStyle=activeEvent==="storm"?"rgba(195,220,255,.72)":"rgba(220,245,255,.58)";
            ctx.lineWidth=p.size;ctx.beginPath();ctx.moveTo(p.x,p.y);ctx.lineTo(p.x-7,p.y-24);ctx.stroke();
        }
    }
    ctx.shadowBlur=0;
    if(activeEvent==="storm" && lightningFlash>0){
        ctx.fillStyle=`rgba(235,245,255,${lightningFlash*.42})`;ctx.fillRect(0,0,GAME_WIDTH,GAME_HEIGHT);
        ctx.strokeStyle=`rgba(255,255,255,${lightningFlash})`;ctx.lineWidth=3;
        const x=690;ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x-28,86);ctx.lineTo(x+4,82);ctx.lineTo(x-38,170);ctx.stroke();
    }
    if(activeEvent==="wind"){
        const side=ctx.createLinearGradient(0,0,210,0);side.addColorStop(0,"rgba(160,225,255,.13)");side.addColorStop(1,"rgba(160,225,255,0)");ctx.fillStyle=side;ctx.fillRect(0,0,230,GAME_HEIGHT);
    }
    if(isFeverActive(now)){ctx.fillStyle=`rgba(255,70,15,${.08+.04*Math.sin(now/100)})`;ctx.fillRect(0,0,GAME_WIDTH,GAME_HEIGHT);}
    ctx.restore();
}

/*
=========================================================
HITBOX GRACZA
=========================================================
*/

function getPlayerCollisionBox() {
    return {
        x:
            player.x +
            player.collisionPaddingX,

        y:
            player.y +
            player.collisionPaddingY,

        width:
            player.width -
            player.collisionPaddingX * 2,

        height:
            player.height -
            player.collisionPaddingY * 2
    };
}

/*
=========================================================
HITBOXY PRZESZKÓD
=========================================================
*/

/*
Hitboxy są zapisane jako wartości procentowe.

Dzięki temu automatycznie reagują na zmianę:

obstacleWidth
obstacleDrawHeight
*/

const bottomObstacleHitboxes = [
    /*
    Grafika dolnej przeszkody ma duży przezroczysty
    fragment u góry. Poprzednie hitboxy wchodziły w ten
    niewidoczny obszar, przez co gracz przegrywał jeszcze
    przed dotknięciem puszki.

    Poniższe pasy obejmują wyłącznie faktycznie widoczną
    część grafiki (z małym marginesem bezpieczeństwa).
    */
    { x: 0.095, y: 0.3875, width: 0.810, height: 0.1025 },
    { x: 0.095, y: 0.4900, width: 0.810, height: 0.1017 },
    { x: 0.095, y: 0.5917, width: 0.810, height: 0.1017 },
    { x: 0.095, y: 0.6933, width: 0.810, height: 0.1025 },
    { x: 0.095, y: 0.7958, width: 0.810, height: 0.1025 },
    { x: 0.095, y: 0.8983, width: 0.810, height: 0.1017 }
];

/*
Górna przeszkoda korzysta z osobnej grafiki i podczas
rysowania jest odwracana pionowo. Dlatego ma własne,
odwrócone hitboxy zamiast kopii hitboxów dolnej puszki.
*/
const topObstacleHitboxes = [
    { x: 0.120, y: 0.5091, width: 0.7500, height: 0.1017 },
    { x: 0.120, y: 0.4075, width: 0.7500, height: 0.1017 },
    { x: 0.120, y: 0.3058, width: 0.7500, height: 0.1025 },
    { x: 0.120, y: 0.2033, width: 0.7500, height: 0.1017 },
    { x: 0.120, y: 0.1016, width: 0.7500, height: 0.1017 },
    { x: 0.120, y: 0.0000, width: 0.7475, height: 0.1017 }
];

function createScaledHitboxes(
    obstacle,
    templates,
    drawY,
    drawHeight
) {
    return templates.map(template => ({
        x:
            obstacle.x +
            template.x *
            obstacle.width,

        y:
            drawY +
            template.y *
            drawHeight,

        width:
            template.width *
            obstacle.width,

        height:
            template.height *
            drawHeight
    }));
}

function getObstacleCollisionBoxes(obstacle) {
    const boxes = [];

    /*
    Górna grafika kończy się na pozycji topVisible.
    */

    if (obstacle.topVisible > 0) {
        const topDrawY =
            obstacle.topVisible -
            settings.obstacleDrawHeight;

        boxes.push(
            ...createScaledHitboxes(
                obstacle,
                topObstacleHitboxes,
                topDrawY,
                settings.obstacleDrawHeight
            )
        );
    }

    /*
    Dolna grafika zaczyna się na pozycji:
    GAME_HEIGHT - bottomVisible.
    */

    if (obstacle.bottomVisible > 0) {
        const bottomDrawY =
            GAME_HEIGHT -
            obstacle.bottomVisible;

        boxes.push(
            ...createScaledHitboxes(
                obstacle,
                bottomObstacleHitboxes,
                bottomDrawY,
                settings.obstacleDrawHeight
            )
        );
    }

    /*
    Przycinanie hitboxów do obszaru canvas.
    */

    return boxes
        .filter(box => {
            return (
                box.y < GAME_HEIGHT &&
                box.y + box.height > 0
            );
        })
        .map(box => {
            const clippedTop =
                Math.max(0, box.y);

            const clippedBottom =
                Math.min(
                    GAME_HEIGHT,
                    box.y + box.height
                );

            return {
                x: box.x,
                y: clippedTop,
                width: box.width,
                height:
                    clippedBottom -
                    clippedTop
            };
        })
        .filter(box => {
            return (
                box.width > 0 &&
                box.height > 0
            );
        });
}

function checkObstacleCollisions() {
    const playerBox =
        getPlayerCollisionBox();

    for (const obstacle of obstacles) {
        const boxes =
            getObstacleCollisionBoxes(
                obstacle
            );

        for (const box of boxes) {
            if (
                rectanglesOverlap(
                    playerBox,
                    box
                )
            ) {
                endGame();
                return;
            }
        }
    }
}
/*
=========================================================
AKTUALIZACJA GRACZA
=========================================================
*/

function updatePlayer(frameScale) {
    let gravityMultiplier = 1;
    if (activeEvent === "rain") gravityMultiplier = 1.16;
    if (activeEvent === "snow") gravityMultiplier = 0.88;
    player.velocityY +=
        settings.gravity * gravityMultiplier *
        frameScale;

    if (
        player.velocityY >
        settings.maxFallSpeed
    ) {
        player.velocityY =
            settings.maxFallSpeed;
    }

    player.y +=
        player.velocityY *
        frameScale;

    if (player.y < 0) {
        player.y = 0;
        player.velocityY = 0;
    }

    if (
        player.y +
        player.height >=
        GAME_HEIGHT
    ) {
        player.y =
            GAME_HEIGHT -
            player.height;

        endGame();
    }
}

/*
=========================================================
AKTUALIZACJA PRZESZKÓD
=========================================================
*/

function updateObstacles(frameScale, now) {
    const speed =
        getCurrentWorldSpeed(now) *
        frameScale;

    for (const obstacle of obstacles) {
        obstacle.x -= speed;

        if (
            !obstacle.passed &&
            obstacle.x +
            obstacle.width <
            player.x
        ) {
            obstacle.passed = true;
            const gapTop = obstacle.topVisible || 0;
            const gapBottom = obstacle.bottomVisible ? GAME_HEIGHT - obstacle.bottomVisible : GAME_HEIGHT;
            const gapCenter = (gapTop + gapBottom) / 2;
            const playerCenter = player.y + player.height / 2;
            const perfect = Math.abs(playerCenter - gapCenter) < 34;
            if (perfect) {
                combo += 1;
                addFever(10, now);
                maxCombo = Math.max(maxCombo, combo);
                addScore(settings.obstaclePoints + (combo >= 6 ? 1 : 0) + (obstacle.special === "gold" ? 2 : 0));
                tone(980, .08, "triangle", .045);
                emitParticles(player.x+50, playerCenter, 12, {color:"255,255,255", driftX:-1.5});
            } else {
                combo = Math.max(0, combo - 1);

                // Fever ma być czytelnie budowany podczas normalnej gry.
                // Perfect daje więcej, zwykłe przejście daje mały postęp.
                addFever(4, now);

                addScore(settings.obstaclePoints + (obstacle.special === "gold" ? 2 : 0));
            }
            updateEnhancementHud(performance.now(), true);
        }
    }

    obstacles = obstacles.filter(
        obstacle =>
            obstacle.x +
            obstacle.width >
            -100
    );

    const lastObstacle =
        obstacles[
            obstacles.length - 1
        ];

    if (!lastObstacle) {
        spawnObstacle(
            GAME_WIDTH + 100
        );

        return;
    }

    if (
        lastObstacle.x <
        GAME_WIDTH -
        lastObstacle.spacingAfter
    ) {
        spawnObstacle(
            GAME_WIDTH + 100
        );
    }
}

/*
=========================================================
AKTUALIZACJA MONET
=========================================================
*/

function updateCoins(frameScale, now) {
    const speed =
        getCurrentWorldSpeed(now) *
        frameScale;

    const playerBox =
        getPlayerCollisionBox();

    for (const coin of coins) {
        coin.x -= speed;

        if (
            !coin.collected &&
            rectanglesOverlap(
                playerBox,
                coin
            )
        ) {
            collectCoin(
                coin,
                now
            );
        }
    }

    coins = coins.filter(
        coin =>
            !coin.collected &&
            coin.x +
            coin.width >
            -60
    );
}

/*
=========================================================
AKTUALIZACJA BOOSTERÓW
=========================================================
*/

function updateBoosters(frameScale, now) {
    const speed =
        getCurrentWorldSpeed(now) *
        frameScale;

    const playerBox =
        getPlayerCollisionBox();

    for (const booster of boosters) {
        booster.x -= speed;

        if (
            !booster.collected &&
            rectanglesOverlap(
                playerBox,
                booster
            )
        ) {
            collectBooster(
                booster,
                now
            );
        }
    }

    boosters = boosters.filter(
        booster =>
            !booster.collected &&
            booster.x +
            booster.width >
            -80
    );
}

/*
=========================================================
ZMIANA KOLORU TŁA
=========================================================
*/

function checkGlowStage() {
    const newStage = Math.floor(
        score /
        settings.glowEveryPoints
    );

    if (newStage === currentGlowStage) {
        return;
    }

    previousGlowColor =
        getInterpolatedGlowColor(
            performance.now()
        );

    currentGlowStage = newStage;

    targetGlowColor =
        glowColors[
            newStage %
            glowColors.length
        ];

    glowTransitionStart =
        performance.now();
}

function getInterpolatedGlowColor(now) {
    const progress = clamp(
        (
            now -
            glowTransitionStart
        ) /
        settings.glowTransitionDuration,
        0,
        1
    );

    const smoothProgress =
        progress *
        progress *
        (3 - 2 * progress);

    return {
        r:
            previousGlowColor.r +
            (
                targetGlowColor.r -
                previousGlowColor.r
            ) *
            smoothProgress,

        g:
            previousGlowColor.g +
            (
                targetGlowColor.g -
                previousGlowColor.g
            ) *
            smoothProgress,

        b:
            previousGlowColor.b +
            (
                targetGlowColor.b -
                previousGlowColor.b
            ) *
            smoothProgress
    };
}

/*
=========================================================
RYSOWANIE TŁA
=========================================================
*/

function drawBackground(now) {
    // Na telefonie statyczne tło jest osobną warstwą CSS. Nie przerysowujemy
    // pełnoekranowej bitmapy w każdej klatce. canvas zajmuje się tylko grą.
    if (MOBILE_PERFORMANCE_MODE && motionEnabled) return;
    ctx.save();

    if (imageReady(images.background)) {
        ctx.globalAlpha = motionEnabled ? 0.76 : 1;
        ctx.drawImage(images.background, 0, 0, GAME_WIDTH, GAME_HEIGHT);
        ctx.globalAlpha = 1;
    } else {
        ctx.fillStyle = motionEnabled ? "rgba(70,165,215,.78)" : "#72c7e8";
        ctx.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
    }

    // Delikatny kontrast pod przeszkody i HUD. To dużo tańsze niż filtry CSS.
    if (motionEnabled) {
        ctx.fillStyle = getBackgroundVeil();
        ctx.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
    }

    if (currentGlowStage > 0) {
        const glow = getInterpolatedGlowColor(now);
        const pulse = settings.glowOverlayOpacity * 0.55 + Math.sin(now / 500) * 0.02;
        ctx.fillStyle = `rgba(${Math.round(glow.r)},${Math.round(glow.g)},${Math.round(glow.b)},${pulse})`;
        ctx.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
    }

    ctx.restore();
}

/*
=========================================================
RYSOWANIE PRZESZKÓD
=========================================================
*/

function drawObstacles(alpha = 1) {
    for (const obstacle of obstacles) {
        const renderObstacleX =
            renderWorldX(
                obstacle,
                alpha,
                renderWorldLead
            );

        ctx.save();
        if (obstacle.special === "gold" && !MOBILE_PERFORMANCE_MODE) {
            ctx.filter = "sepia(1) saturate(2.5) hue-rotate(345deg) brightness(1.12)";
            ctx.shadowColor = "#ffd43b";
            ctx.shadowBlur = 12;
        }

        if (obstacle.special === "pulse") {
            ctx.globalAlpha =
                .82 + .18 * Math.sin(performance.now()/160 + obstacle.pulsePhase);

            if (!MOBILE_PERFORMANCE_MODE) {
                ctx.shadowColor = "#65e7ff";
                ctx.shadowBlur = 18;
            }
        }
        /*
        GÓRNA PRZESZKODA

        Dolna krawędź grafiki kończy się dokładnie
        na obstacle.topVisible.

        Reszta grafiki znajduje się ponad ekranem.
        */

        if (
            obstacle.topVisible > 0 &&
            imageReady(images.obstacleTop)
        ) {
            ctx.save();

            ctx.translate(
                renderObstacleX,
                obstacle.topVisible
            );

            ctx.scale(1, -1);

            ctx.drawImage(
                images.obstacleTop,
                0,
                0,
                obstacle.width,
                settings.obstacleDrawHeight
            );

            ctx.restore();
        }

        /*
        DOLNA PRZESZKODA

        Górna krawędź grafiki zaczyna się na pozycji:
        GAME_HEIGHT - obstacle.bottomVisible.

        Pozostała część grafiki znajduje się pod ekranem.
        */

        if (
            obstacle.bottomVisible > 0 &&
            imageReady(images.obstacleBottom)
        ) {
            const bottomDrawY =
                GAME_HEIGHT -
                obstacle.bottomVisible;

            ctx.drawImage(
                images.obstacleBottom,
                renderObstacleX,
                bottomDrawY,
                obstacle.width,
                settings.obstacleDrawHeight
            );
        }
        ctx.restore();
    }
}

/*
=========================================================
RYSOWANIE MONET
=========================================================
*/

function drawCoins(now, alpha = 1) {
    for (const coin of coins) {
        const coinRenderX =
            renderWorldX(
                coin,
                alpha,
                renderWorldLead
            );

        const coinRenderY =
            renderY(coin, alpha);

        const floatingOffset =
            Math.sin(
                now / 280 +
                coin.animationOffset
            ) *
            4;

        const rotationScale =
            0.78 +
            Math.abs(
                Math.sin(
                    now / 320 +
                    coin.animationOffset
                )
            ) *
            0.22;

        const visualScale = 1.82;
        const drawWidth =
            coin.width *
            rotationScale *
            visualScale;

        const drawHeight =
            coin.height *
            visualScale;

        const drawX =
            coinRenderX +
            (
                coin.width -
                drawWidth
            ) /
            2;

        const drawY =
            coinRenderY +
            floatingOffset -
            (drawHeight - coin.height) / 2;

        ctx.save();

        if (!MOBILE_PERFORMANCE_MODE) {
            ctx.shadowBlur = 17;
            ctx.shadowColor =
                "rgba(255, 211, 61, 0.9)";
        }

        if (imageReady(images.coin)) {
            ctx.drawImage(
                images.coin,
                drawX,
                drawY,
                drawWidth,
                drawHeight
            );
        }

        ctx.restore();
    }
}

/*
=========================================================
RYSOWANIE BOOSTERÓW
=========================================================
*/

function drawBoosters(now, alpha = 1) {
    for (const booster of boosters) {
        const boosterRenderX =
            renderWorldX(
                booster,
                alpha,
                renderWorldLead
            );

        const boosterRenderY =
            renderY(booster, alpha);

        const pulse =
            1 +
            Math.sin(
                now / 170 +
                booster.animationOffset
            ) *
            0.09;

        const width =
            booster.width *
            pulse;

        const height =
            booster.height *
            pulse;

        const drawX =
            boosterRenderX +
            (
                booster.width -
                width
            ) /
            2;

        const drawY =
            boosterRenderY +
            (
                booster.height -
                height
            ) /
            2;

        ctx.save();

        if (!MOBILE_PERFORMANCE_MODE) {
            ctx.shadowBlur = 26;
            ctx.shadowColor =
                "rgba(255, 45, 45, 0.95)";
        }

        if (imageReady(images.booster)) {
            ctx.drawImage(
                images.booster,
                drawX,
                drawY,
                width,
                height
            );
        }

        ctx.restore();
    }
}

/*
=========================================================
WYBÓR GRAFIKI GRACZA
=========================================================
*/

function getCurrentPlayerImage(now) {
    if (isBoosterActive(now)) {
        return images.playerBooster;
    }

    if (now < coinFaceEndTime) {
        return images.playerCoin;
    }

    return images.player;
}

/*
=========================================================
RYSOWANIE GRACZA
=========================================================
*/

function drawPlayer(now, alpha = 1) {
    const image =
        getCurrentPlayerImage(now);

    if (!imageReady(image)) {
        return;
    }

    const playerRenderX =
        renderX(player, alpha);

    const playerRenderY =
        renderY(player, alpha);

    const centerX =
        playerRenderX +
        player.width / 2;

    const centerY =
        playerRenderY +
        player.height / 2;

    const rotation = clamp(
        player.velocityY * 0.1,
        -0.25,
        0.35
    );

    ctx.save();

    ctx.translate(
        centerX,
        centerY
    );

    ctx.rotate(rotation);

    if (isBoosterActive(now)) {
        const boosterPulse =
            1 +
            Math.sin(now / 100) *
            0.025;

        ctx.scale(
            boosterPulse,
            boosterPulse
        );

        ctx.shadowBlur = 28;
        ctx.shadowColor =
            "rgba(255, 35, 35, 0.95)";
    }

    const visualScale = 1.82;
    const visualWidth = player.width * visualScale;
    const visualHeight = player.height * visualScale;

    ctx.drawImage(
        image,
        -visualWidth / 2,
        -visualHeight / 2,
        visualWidth,
        visualHeight
    );

    ctx.restore();
}

/*
=========================================================
RYSOWANIE WYNIKU
=========================================================
*/

function drawGameScore() {
    const x = GAME_WIDTH - 28;
    const y = 22;

    ctx.save();

    ctx.textAlign = "right";
    ctx.textBaseline = "top";

    ctx.font = "bold 42px Arial";
    ctx.lineWidth = 7;

    ctx.strokeStyle =
        "rgba(0, 0, 0, 0.72)";

    ctx.strokeText(
        String(score),
        x,
        y
    );

    ctx.fillStyle = "#ffffff";

    ctx.fillText(
        String(score),
        x,
        y
    );

    ctx.restore();
}
/*
=========================================================
HUD AKTYWNEGO BOOSTERA
=========================================================
*/

function drawActiveBoosterHud(now) {
    if (!isBoosterActive(now)) {
        return;
    }

    const remaining =
        Math.max(
            0,
            boosterEndTime - now
        );

    const seconds =
        remaining / 1000;

    const barWidth = 190;
    const barHeight = 18;

    const x =
        GAME_WIDTH / 2 -
        barWidth / 2;

    const y = 24;

    const progress = clamp(
        remaining /
        settings.boosterDuration,
        0,
        1
    );

    ctx.save();

    ctx.fillStyle =
        "rgba(0, 0, 0, 0.58)";

    ctx.fillRect(
        x - 10,
        y - 10,
        barWidth + 20,
        58
    );

    ctx.fillStyle =
        "rgba(255, 255, 255, 0.22)";

    ctx.fillRect(
        x,
        y + 24,
        barWidth,
        barHeight
    );

    ctx.fillStyle =
        "rgba(255, 48, 48, 0.95)";

    ctx.fillRect(
        x,
        y + 24,
        barWidth * progress,
        barHeight
    );

    ctx.strokeStyle =
        "rgba(255, 255, 255, 0.9)";

    ctx.lineWidth = 2;

    ctx.strokeRect(
        x,
        y + 24,
        barWidth,
        barHeight
    );

    ctx.fillStyle = "#ffffff";

    ctx.font =
        "bold 18px Arial";

    ctx.textAlign = "center";
    ctx.textBaseline = "top";

    ctx.fillText(
        `BOOSTER ${seconds.toFixed(1)} s`,
        GAME_WIDTH / 2,
        y
    );

    ctx.restore();
}

/*
=========================================================
AKTUALIZACJA NAPISU BOOSTERA W HTML
=========================================================
*/

function updateBoosterDisplay(
    now = performance.now()
) {
    if (!boosterStatus) {
        return;
    }

    const timeElement = boosterStatus.querySelector(".booster-time");

    if (!isBoosterActive(now)) {
        if (timeElement) {
            timeElement.textContent = "nieaktywny";
        }

        boosterStatus.style.setProperty(
            "--booster-progress",
            "0%"
        );

        boosterStatus.classList.remove(
            "active"
        );

        return;
    }

    const remaining =
        Math.max(
            0,
            boosterEndTime - now
        );

    const progress = clamp(
        remaining / settings.boosterDuration,
        0,
        1
    );

    if (timeElement) {
        timeElement.textContent =
            `${(remaining / 1000).toFixed(1)} s`;
    }

    boosterStatus.style.setProperty(
        "--booster-progress",
        `${progress * 100}%`
    );

    boosterStatus.classList.add(
        "active"
    );
}

/*
=========================================================
TRYB DEBUGOWANIA HITBOXÓW
=========================================================
*/

function drawDebugHitboxes() {
    if (!DEBUG_HITBOXES) {
        return;
    }

    ctx.save();

    const playerBox =
        getPlayerCollisionBox();

    ctx.strokeStyle =
        "rgba(0, 255, 0, 0.95)";

    ctx.lineWidth = 2;

    ctx.strokeRect(
        playerBox.x,
        playerBox.y,
        playerBox.width,
        playerBox.height
    );

    ctx.strokeStyle =
        "rgba(255, 0, 0, 0.95)";

    for (const obstacle of obstacles) {
        const boxes =
            getObstacleCollisionBoxes(
                obstacle
            );

        for (const box of boxes) {
            ctx.strokeRect(
                box.x,
                box.y,
                box.width,
                box.height
            );
        }
    }

    ctx.restore();
}

/*
=========================================================
AKTUALIZACJA GRY
=========================================================
*/

function updateGame(
    frameScale,
    now,
    deltaTime
) {
    updateParticles(frameScale, deltaTime);
    screenShake = Math.max(0, screenShake - 0.7 * frameScale);

    if (
        gameState !==
        GAME_STATE.RUNNING
    ) {
        if (now - lastBoosterHudAt >= 100) {
            lastBoosterHudAt = now;
            updateBoosterDisplay(now);
        }
        updateEnhancementHud(now);
        return;
    }

    updatePlayer(frameScale);
    updateObstacles(
        frameScale,
        now
    );

    updateCoins(
        frameScale,
        now
    );

    updateBoosters(
        frameScale,
        now
    );
    updateSpecialItems(frameScale, now);
    updateWorldEvent(frameScale, now);

    checkObstacleCollisions();

    if (now - lastBoosterHudAt >= 100) {
        lastBoosterHudAt = now;
        updateBoosterDisplay(now);
    }

    updateEnhancementHud(now);
}

/*
=========================================================
RYSOWANIE CAŁEJ GRY
=========================================================
*/






function rememberPreviousWorldState() {
    player.prevX = player.x;
    player.prevY = player.y;

    const remember = obj => {
        obj.prevX = obj.x;
        obj.prevY = obj.y;
    };

    obstacles.forEach(remember);
    coins.forEach(remember);
    boosters.forEach(remember);
    mysteryItems.forEach(remember);
    rareItems.forEach(remember);
}


function renderWorldX(obj, alpha, worldLead = 0) {
    const prev =
        Number.isFinite(obj.prevX)
            ? obj.prevX
            : obj.x;

    const interpolated =
        prev +
        (obj.x - prev) * alpha;

    // worldLead jest tylko renderowym, ułamkowym fragmentem kolejnego kroku.
    // Nie dotyka prawdziwego obj.x ani kolizji.
    return interpolated - worldLead;
}

function renderX(obj, alpha) {
    const prev =
        Number.isFinite(obj.prevX)
            ? obj.prevX
            : obj.x;

    return prev +
        (obj.x - prev) * alpha;
}

function renderY(obj, alpha) {
    const prev =
        Number.isFinite(obj.prevY)
            ? obj.prevY
            : obj.y;

    return prev +
        (obj.y - prev) * alpha;
}







function drawGame(now, alpha = 1) {
    // Czyścimy cały fizyczny bufor bez transformacji, a następnie wracamy
    // do układu współrzędnych świata gry.
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    applyGameTransform();

    ctx.save();
    if (screenShake > 0 && settings.particlesEnabled) {
        ctx.translate(
            randomBetween(-screenShake, screenShake),
            randomBetween(-screenShake, screenShake)
        );
    }

    drawBackground(now);

    // Niezależny wzorzec frame pacing. Jeśli on też szarpie,
    // problem jest poza fizyką świata.

    if (!MOBILE_PERFORMANCE_MODE) drawAtmosphere(now);
    drawWorldEvent(now);
    drawObstacles(alpha);
    drawCoins(now, alpha);
    drawBoosters(now, alpha);
    drawSpecialItems(now, alpha);
    drawParticles();
    drawPlayer(now, alpha);
    drawDebugHitboxes();
    ctx.restore();
}

/*
=========================================================
PĘTLA GRY
=========================================================
*/

function updateSmoothMotionVisual(now) {
    if (!squatMeterFill) return;

    const dt = Math.max(
        0,
        Math.min(50, now - meterVisualLastNow)
    );
    meterVisualLastNow = now;

    const tau =
        meterTargetPct < meterVisualPct
            ? 28
            : 38;

    const alpha =
        1 - Math.exp(-dt / tau);

    meterVisualPct +=
        (meterTargetPct - meterVisualPct) * alpha;

    if (
        Math.abs(
            meterTargetPct - meterVisualPct
        ) < 0.08
    ) {
        meterVisualPct = meterTargetPct;
    }

    squatMeterFill.style.height =
        `${Math.round(meterVisualPct * 10) / 10}%`;
}

function gameLoop(now) {
    // Rezerwujemy następny repaint od razu, zanim wykonamy pracę tej klatki.
    requestAnimationFrame(
        gameLoop
    );

    let frameTime =
        now - simLastFrameAt;

    simLastFrameAt = now;

    if (
        !Number.isFinite(frameTime) ||
        frameTime < 0
    ) {
        frameTime = 0;
    }

    // Nie próbujemy nadrabiać długiego zatrzymania dziesiątkami update'ów.
    frameTime =
        Math.min(
            frameTime,
            FIXED_STEP_MS * MAX_SIM_STEPS
        );

    simAccumulatorMs +=
        frameTime;

    renderFrameEma =
        renderFrameEma * 0.94 +
        frameTime * 0.06;

    updateSmoothMotionVisual(now);

    let steps = 0;

    while (
        simAccumulatorMs >=
            FIXED_STEP_MS &&
        steps < MAX_SIM_STEPS
    ) {
        // Zapisujemy poprzedni stan dokładnie przed krokiem 60 Hz.
        rememberPreviousWorldState();

        // 1 oznacza dokładnie jeden krok 60 Hz.
        updateGame(
            1,
            now,
            FIXED_STEP_MS
        );

        simAccumulatorMs -=
            FIXED_STEP_MS;

        steps++;
    }

    // Jeśli urządzenie miało duży stall, odrzucamy nadmiar zamiast
    // wpadać w spiralę nadrabiania.
    if (
        steps >= MAX_SIM_STEPS &&
        simAccumulatorMs >=
            FIXED_STEP_MS
    ) {
        simAccumulatorMs =
            simAccumulatorMs %
            FIXED_STEP_MS;
    }

    const alpha =
        Math.max(
            0,
            Math.min(
                1,
                simAccumulatorMs /
                FIXED_STEP_MS
            )
        );

    // Dodatkowy render-only fragment scrollu.
    // Przy 60 Hz symulacji i nierównym rAF świat nie czeka na kolejny tick,
    // tylko płynie dalej o część brakującego kroku.
    const currentWorldSpeed =
        gameState === GAME_STATE.RUNNING
            ? getCurrentWorldSpeed(now)
            : 0;

    renderWorldLead =
        currentWorldSpeed * alpha;

    drawGame(
        now,
        alpha
    );
}

function updateEnhancementHud(now = performance.now(), force = false) {
    // Timery w HUD nie wymagają 60 aktualizacji na sekundę.
    // 10 Hz jest wizualnie płynne i nie powoduje ciągłego layout/repaint.
    if (!force && now - lastEnhancementHudAt < 100) return;
    lastEnhancementHudAt = now;

    const feverActive = isFeverActive(now);
    const magnetActive = isMagnetActive(now);
    const doubleActive = isDoubleCoinActive(now);

    const speedRemaining = Math.max(0, boosterEndTime - now);
    const slowRemaining = Math.max(0, slowEndTime - now);

    const key = [
        combo,
        feverActive ? 1 : 0,
        Math.round(fever),
        getDifficultyLevel(),
        extraLives,
        magnetActive ? Math.ceil((magnetEndTime-now)/100) : 0,
        doubleActive ? Math.ceil((doubleCoinEndTime-now)/100) : 0,
        Math.ceil(speedRemaining/100),
        Math.ceil(slowRemaining/100),
        shieldCharges
    ].join("|");

    if (!force && key === lastEnhancementHudKey) return;
    lastEnhancementHudKey = key;

    if (comboDisplay) {
        comboDisplay.textContent = `Combo x${combo}`;
    }

    if (difficultyDisplay) {
        difficultyDisplay.textContent =
            feverActive
                ? "🔥 FEVER"
                : `Poziom ${getDifficultyLevel()}`;
    }

    const feverScale =
        clamp(
            feverActive ? 1 : fever / 100,
            0,
            1
        );

    if (feverFill) {
        // Jedno źródło prawdy dla wizualnego fill.
        // CSS legacy może mieć width:100%!important, więc sterujemy wyłącznie scaleX.
        feverFill.style.setProperty(
            "--fever-scale",
            feverScale.toFixed(3)
        );
    }

    if (feverLabel) {
        feverLabel.textContent =
            feverActive
                ? "🔥 FEVER!"
                : "🔥 FEVER";
    }

    if (lifeBadge) {
        const active = extraLives > 0;
        lifeBadge.classList.toggle("active", active);
        lifeBadge.textContent = active ? "❤️ Drugie życie" : "";
    }

    if (magnetBadge) {
        magnetBadge.classList.toggle("active", magnetActive);
        magnetBadge.textContent = magnetActive
            ? `🧲 ${(Math.max(0, magnetEndTime-now)/1000).toFixed(1)}s`
            : "";
    }

    if (doubleBadge) {
        doubleBadge.classList.toggle("active", doubleActive);
        doubleBadge.textContent = doubleActive
            ? `🪙×2 ${(Math.max(0, doubleCoinEndTime-now)/1000).toFixed(1)}s`
            : "";
    }

    const updateTimedCard = (card, timeEl, remaining, duration) => {
        if (!card) return;

        const active = remaining > 0;
        card.classList.toggle("active", active);

        card.style.setProperty(
            "--power-progress",
            `${clamp(remaining / duration, 0, 1) * 100}%`
        );

        if (timeEl) {
            timeEl.textContent =
                active
                    ? `${(remaining / 1000).toFixed(1)} s`
                    : "";
        }
    };

    updateTimedCard(
        speedPowerCard,
        speedPowerTime,
        speedRemaining,
        settings.boosterDuration
    );

    updateTimedCard(
        slowPowerCard,
        slowPowerTime,
        slowRemaining,
        5000
    );

    if (shieldPowerCard) {
        const active = shieldCharges > 0;
        shieldPowerCard.classList.toggle("active", active);

        if (shieldPowerTime) {
            shieldPowerTime.textContent =
                active
                    ? `x${shieldCharges}`
                    : "";
        }

        shieldPowerCard.style.setProperty(
            "--power-progress",
            active ? "100%" : "0%"
        );
    }
}
function togglePause(forcePause = null) {
    if (![GAME_STATE.RUNNING, GAME_STATE.PAUSED].includes(gameState)) return;
    const shouldPause = forcePause === null ? gameState === GAME_STATE.RUNNING : forcePause;
    gameState = shouldPause ? GAME_STATE.PAUSED : GAME_STATE.RUNNING;
    if (pauseScreen) pauseScreen.classList.toggle("hidden", !shouldPause);
    if (pauseButton) pauseButton.textContent = shouldPause ? "▶" : "Ⅱ";
    lastFrameTime = performance.now();
    tone(shouldPause ? 260 : 520, .07, "sine", .035);
}

if (pauseButton) pauseButton.addEventListener("click", e => { e.stopPropagation(); togglePause(); });



if (soundButton) {
    soundButton.textContent = soundEnabled ? "🔊" : "🔇";
    soundButton.addEventListener("click", e => {
        e.stopPropagation(); soundEnabled = !soundEnabled;
        localStorage.setItem("flappySound", soundEnabled ? "on" : "off");
        soundButton.textContent = soundEnabled ? "🔊" : "🔇";
        if (soundEnabled) { unlockAudio(); setTimeout(() => tone(620, .08, "sine", .04), 30); }
    });
}

/*
=========================================================
KAMERA + MEDIAPIPE POSE. MOBILE SQUAT v21
=========================================================
Jedyny tryb sterowania: przysiad / bob.
- całe pole kamery jest aktywne; brak sztucznej ramki,
- kalibracja zapamiętuje pozycję barków/bioder,
- jeden cykl zejścia = jeden flap,
- siła flap zależy od faktycznej głębokości zejścia,
- Pose jest próbkowany wolniej niż render gry, aby zachować 60 FPS UI/fizyki.
*/

const guideTitle = document.getElementById("guideTitle");
const guideText = document.getElementById("guideText");
const guidePhase = document.getElementById("guidePhase");
const poseCanvas = document.getElementById("poseCanvas");

const poseSettings = {
    // MediaPipe służy przede wszystkim do jednorazowego ustawienia barków.
    calibrationIntervalMs: 60,
    minVisibility: 0.38,
    calibrationFrames: 8,
    calibrationJitter: 0.028,
    minShoulderWidth: 0.16,
    maxShoulderWidth: 0.43,
    phoneMoveRatio: 0.065,
    lostPoseMs: 900,

    // Fast tracker pracuje na małym ROI i reaguje na mikro-przysiady.
    // Tracker jest synchronizowany z realnymi klatkami kamery (requestVideoFrameCallback).
    // Interval jest tylko zabezpieczeniem/fallbackiem dla starszych przeglądarek.
    fastIntervalMs: 18,
    minFastDepthPx: 0.68,
    fullFastDepthPx: 7.6,
    rearmFastDepthPx: 1.15,
    minJumpMultiplier: 0.22,
    maxJumpMultiplier: 1.12
};
let cameraStream = null;
let motionEnabled = false;
let poseLandmarker = null; // compatibility placeholder; inference lives in worker
let poseLoadingPromise = null;
let moveNetReady = false;

let moveNetWorker = null;
let moveNetWorkerReady = false;
let moveNetWorkerBusy = false;
let moveNetWorkerInitPromise = null;
let moveNetLastBitmapAt = 0;

// v95 isolation test: stops ONLY pose inference.
// Camera stream stays alive so re-enabling is immediate.
let lastMotionSample = 0;
let lastVideoTime = -1;
let lastPoseSeenAt = 0;
let dynamicPoseIntervalMs = poseSettings.calibrationIntervalMs;
let renderFrameEma = 16.7;

// v94 render architecture test
const FIXED_STEP_MS = 1000 / 60;
const MAX_SIM_STEPS = 3;
let simAccumulatorMs = 0;
let simLastFrameAt = performance.now();

let smoothTestX = 0;
let smoothTestPrevX = 0;
let smoothTestCurrentX = 0;
let smoothTestEnabled = true;

// v97: poziomy ruch świata jest renderowany ciągle pomiędzy krokami symulacji.
// Logika/kolizje nadal używają fixed 60 Hz.
let renderWorldLead = 0;
let poseInferenceBusy = false;


// Kamera może być wyświetlana w naturalnej rozdzielczości/FOV, ale Pose analizuje
// małą kopię klatki. To ogranicza koszt MediaPipe bez cyfrowego zoomu w podglądzie.
const poseInputCanvas = document.createElement("canvas");
const poseInputCtx = poseInputCanvas.getContext("2d", { alpha: false, desynchronized: true });
let poseInputReady = false;



function enableSnapshotBackground() {
    document.body.classList.add(
        "camera-tracking-hidden"
    );
}
function disableSnapshotBackground() {
    document.body.classList.remove(
        "camera-tracking-hidden"
    );
}

function preparePoseInput() {
    const vw = cameraFeed?.videoWidth || 0;
    const vh = cameraFeed?.videoHeight || 0;
    if (!vw || !vh || !poseInputCtx) return null;

    // Około 30–35 tys. pikseli niezależnie od orientacji, z zachowaniem proporcji.
    const longSide = 96;
    let w, h;
    if (vw >= vh) {
        w = longSide;
        h = Math.max(96, Math.round(longSide * vh / vw));
    } else {
        h = longSide;
        w = Math.max(96, Math.round(longSide * vw / vh));
    }
    if (poseInputCanvas.width !== w || poseInputCanvas.height !== h) {
        poseInputCanvas.width = w;
        poseInputCanvas.height = h;
    }
    poseInputCtx.drawImage(cameraFeed, 0, 0, w, h);
    poseInputReady = true;
    return poseInputCanvas;
}

let calibrationReady = false;
let calibrationSamples = [];
let baselineCenterY = null;
let baselineTorso = null;
let filteredCenterY = null;
let filteredTorso = null;
let lastDepth = 0;
let filteredDepthVelocity = 0;
let squatState = "READY"; // READY -> DESCENDING -> RETURNING -> READY
let maxSquatDepth = 0;
let turnaroundCount = 0;
let lastStrength = 0;
let lastCalibrationShoulderWidth = null;
let cameraMotionWarningUntil = 0;
let phoneMotionLevel = 0;
let motionSensorAvailable = false;


function isSupportedPhone() {
    const ua = navigator.userAgent || "";
    const uaPhone =
        /Android.*Mobile|iPhone|iPod|Windows Phone|webOS|BlackBerry|Opera Mini|IEMobile/i.test(ua);

    const touch =
        navigator.maxTouchPoints > 0 ||
        "ontouchstart" in window;

    const coarse =
        window.matchMedia?.("(pointer: coarse)")?.matches ?? false;

    const shortSide =
        Math.min(
            window.screen?.width || innerWidth,
            window.screen?.height || innerHeight
        );

    // Tabletów i desktopów nie wpuszczamy.
    return (
        uaPhone &&
        touch &&
        coarse &&
        shortSide <= 600
    );
}

async function requestGameFullscreen() {
    const root =
        document.documentElement;

    try {
        if (
            !document.fullscreenElement &&
            root.requestFullscreen
        ) {
            await root.requestFullscreen({
                navigationUI:"hide"
            });
        }
    } catch (_) {
        // Fullscreen jest ulepszeniem, nie warunkiem działania gry.
    }

    try {
        if (
            screen.orientation?.lock &&
            document.fullscreenElement
        ) {
            await screen.orientation.lock(
                "portrait"
            );
        }
    } catch (_) {}
}

function applyDeviceGate() {
    const gate =
        document.getElementById(
            "deviceGate"
        );

    const supported =
        isSupportedPhone();

    gate?.classList.toggle(
        "hidden",
        supported
    );

    document.body.classList.toggle(
        "unsupported-device",
        !supported
    );

    return supported;
}

// =========================================================
// v77 CLEAN REP CONTROLLER STATE
// =========================================================
let repControlEnabled = false;
let repZeroCollecting = false;
let repZeroSamples = [];
let repZeroY = null;
let repZeroShoulderWidth = null;
let repZeroCenterX = null;
let trackingSuspended = false;
let postureWarningUntil = 0;
let repDepth = 0;
let repDepthHistory = [];
let repState = "UP";
let repDownFrames = 0;
let repUpFrames = 0;
let repPeak = 0;
let repNoise = 0.004;
let repDownThreshold = 0.10;
let repUpThreshold = 0.035;
let repFullDepth = 0.26;
let repLastAppliedMultiplier = 0;
let repLastPoseAt = 0;
let lastRepMeterPct = -1;
let lastSquatPhaseText = "";
let lastSquatPhaseProgress = -1;

let meterVisualPct = 0;
let meterTargetPct = 0;
let meterVisualLastNow = performance.now();
function handleDeviceMotion(e) {
    // Czujnik telefonu ma sens wyłącznie podczas realnej rozgrywki.
    // Podnoszenie telefonu, ustawianie go i kalibracja są całkowicie ignorowane.
    if (gameState !== GAME_STATE.RUNNING || !calibrationReady) return;
    const a = e.acceleration || e.accelerationIncludingGravity;
    if (!a) return;
    motionSensorAvailable = true;
    const x = Number(a.x || 0), y = Number(a.y || 0), z = Number(a.z || 0);
    const mag = Math.sqrt(x*x + y*y + z*z);
    phoneMotionLevel = phoneMotionLevel * 0.72 + Math.abs(mag - 9.81) * 0.28;
    if (phoneMotionLevel > 1.35) cameraMotionWarningUntil = performance.now() + 700;
}
window.addEventListener("devicemotion", handleDeviceMotion, { passive: true });

function showCalibrationBadge(text = "KALIBRACJA OK") {
    if (!calibrationBadge) return;
    const label = calibrationBadge.querySelector("span");
    if (label) label.textContent = text;
    calibrationBadge.classList.remove("hidden");
}

function hideCalibrationBadge() {
    calibrationBadge?.classList.add("hidden");
}


function showTrackingAlert(text, mode = "warn") {
    if (!trackingAlert) return;
    trackingAlert.textContent = text;
    trackingAlert.classList.remove("hidden","warn","bad");
    trackingAlert.classList.add(mode);
}
function hideTrackingAlert() {
    trackingAlert?.classList.add("hidden");
}

function setTrackingDot(state) {
    if (!trackingDot) return;
    trackingDot.classList.remove("tracking-ok","tracking-bad","tracking-warn","tracking-wait");
    trackingDot.classList.add(`tracking-${state}`);
}

function setCameraUi(message, { active = false, error = false } = {}) {
    if (cameraStatus) cameraStatus.textContent = message;
    if (cameraMessage) {
        cameraMessage.textContent = message;
        cameraMessage.classList.toggle("error", error);
    }
    if (cameraButton) {
        cameraButton.classList.toggle("active", active);
        cameraButton.textContent = active ? "✅ Kamera + przysiady aktywne" : "📷 Kamera + kalibracja";
    }
}

function setGuideState(mode, title, text, phaseText) {
    if (!positionGuide) return;
    positionGuide.classList.remove("calibrating", "phase-down", "phase-up", "position-ok", "pose-missing");
    positionGuide.classList.add(mode);
    if (guideTitle) guideTitle.textContent = title;
    if (guideText) guideText.textContent = text;
    if (guidePhase) guidePhase.textContent = phaseText;
}

function resetPoseCalibration() {
    disableSnapshotBackground();
    positionGuide?.classList.remove("hidden");
    calibrationReady = false;
    calibrationSamples = [];
    baselineCenterY = null;
    baselineTorso = null;
    filteredCenterY = null;
    filteredTorso = null;
    lastDepth = 0;
    filteredDepthVelocity = 0;
    squatState = "READY";
    maxSquatDepth = 0;
    turnaroundCount = 0;
    lastStrength = 0;
    if (motionLevel) motionLevel.style.width = "0%";
    setGuideState(
        "calibrating",
        "KALIBRACJA",
        "Stań przed telefonem. Kamera musi stabilnie widzieć oba barki.",
        "Stań prosto około 0,4–0,8 m od telefonu"
    );
}

function normalizeMediaPipeError(error) {
    if (!error) return "Nieznany błąd MediaPipe";
    if (error instanceof Error && error.message) return error.message;
    if (typeof error === "string") return error;
    if (typeof Event !== "undefined" && error instanceof Event) {
        const target = error.target;
        const src = target?.src || target?.href || target?.currentSrc || "zewnętrzny zasób";
        return `Nie udało się załadować zasobu: ${src}`;
    }
    try {
        const json = JSON.stringify(error);
        if (json && json !== "{}") return json;
    } catch (_) {}
    return String(error?.message || error?.type || error?.name || "Nieznany błąd MediaPipe");
}

async function importWithTimeout(url, timeoutMs = 12000) {
    let timer;
    try {
        return await Promise.race([
            import(url),
            new Promise((_, reject) => {
                timer = setTimeout(() => reject(new Error(`Timeout ładowania modułu: ${url}`)), timeoutMs);
            })
        ]);
    } finally {
        clearTimeout(timer);
    }
}

async function ensurePoseLandmarker() {
    if (
        moveNetWorker &&
        moveNetWorkerReady
    ) {
        return moveNetWorker;
    }

    if (moveNetWorkerInitPromise) {
        return moveNetWorkerInitPromise;
    }

    moveNetWorkerInitPromise =
        new Promise((resolve, reject) => {
            setCameraUi(
                "🧠 Ładowanie trackera w tle…",
                { active:true }
            );

            try {
                // Klasyczny worker celowo:
                // TensorFlow.js UMD ładuje się przez importScripts.
                moveNetWorker =
                    new Worker(
                        "movenet-worker.js?v=110"
                    );
            } catch (error) {
                moveNetWorkerInitPromise = null;
                reject(error);
                return;
            }

            const timeout =
                setTimeout(() => {
                    reject(
                        new Error(
                            "Timeout uruchamiania MoveNet Worker"
                        )
                    );
                }, 30000);

            moveNetWorker.onmessage =
                event => {
                    const data =
                        event.data || {};

                    if (
                        data.type ===
                        "ready"
                    ) {
                        clearTimeout(
                            timeout
                        );

                        moveNetWorkerReady =
                            true;

                        moveNetWorkerBusy =
                            false;

                        moveNetReady = true;

                        poseLandmarker =
                            moveNetWorker;

                        setCameraUi(
                            "✅ Tracker gotowy",
                            { active:true }
                        );

                        resolve(
                            moveNetWorker
                        );

                        return;
                    }

                    if (
                        data.type ===
                        "result"
                    ) {
                        moveNetWorkerBusy =
                            false;

                        const m =
                            data.metric;

                        if (!m) {
                            processPose(
                                null,
                                data.timestamp ||
                                    performance.now()
                            );

                            return;
                        }

                        // Adapter Worker -> istniejący processPose().
                        const landmarks =
                            Array(33)
                                .fill(null)
                                .map(
                                    () => ({
                                        x:0,
                                        y:0,
                                        visibility:0
                                    })
                                );

                        landmarks[11] = {
                            x:m.leftX,
                            y:m.leftY,
                            visibility:
                                m.leftScore
                        };

                        landmarks[12] = {
                            x:m.rightX,
                            y:m.rightY,
                            visibility:
                                m.rightScore
                        };

                        processPose(
                            landmarks,
                            data.timestamp ||
                                performance.now()
                        );

                        return;
                    }

                    if (
                        data.type ===
                        "frame-error"
                    ) {
                        moveNetWorkerBusy =
                            false;

                        console.warn(
                            "MoveNet Worker frame",
                            data.message
                        );

                        return;
                    }

                    if (
                        data.type ===
                        "init-error"
                    ) {
                        clearTimeout(
                            timeout
                        );

                        moveNetWorkerReady =
                            false;

                        moveNetWorkerBusy =
                            false;

                        reject(
                            new Error(
                                data.message ||
                                "MoveNet Worker init failed"
                            )
                        );
                    }
                };

            moveNetWorker.onerror =
                error => {
                    clearTimeout(
                        timeout
                    );

                    moveNetWorkerReady =
                        false;

                    moveNetWorkerBusy =
                        false;

                    reject(
                        new Error(
                            error?.message ||
                            "MoveNet Worker error"
                        )
                    );
                };

            moveNetWorker.postMessage({
                type:"init"
            });
        })
        .catch(error => {
            moveNetWorkerInitPromise =
                null;

            if (moveNetWorker) {
                try {
                    moveNetWorker.terminate();
                } catch (_) {}
            }

            moveNetWorker = null;
            moveNetWorkerReady = false;
            moveNetWorkerBusy = false;
            moveNetReady = false;
            poseLandmarker = null;

            throw error;
        });

    return moveNetWorkerInitPromise;
}

async function enableCameraMotion() {
    document.body.classList.add("camera-mode");

    if (!navigator.mediaDevices?.getUserMedia) {
        setCameraUi("Ta przeglądarka nie udostępnia kamery.", { error: true });
        return false;
    }
    if (!window.isSecureContext && location.hostname !== "localhost") {
        setCameraUi("Kamera wymaga HTTPS. użyj GitHub Pages.", { error: true });
        return false;
    }
    try {
        if (!cameraStream) {
            setCameraUi("📷 Uruchamianie przedniej kamery…", { active: true });
            // Niska rozdzielczość wejścia wystarcza dla barków/bioder i mocno zmniejsza koszt Pose.
            cameraStream = await navigator.mediaDevices.getUserMedia({
                video: {
                    facingMode: { ideal: "user" },
                    // Nie wymuszamy wąskiego pionowego trybu. iOS potrafi wtedy wybrać
                    // mocno wykadrowany strumień. 640x480 daje zwykle szersze pole widzenia.
                    width: { ideal: 640 },
                    height: { ideal: 480 },
                    // Worker analizuje ~14 Hz; 30 FPS kamery wystarcza.
                    frameRate: { ideal: 30, max: 30 }
                },
                audio: false
            });
            cameraFeed.srcObject = cameraStream;
            await cameraFeed.play();
            console.info("Camera stream", cameraFeed.videoWidth, cameraFeed.videoHeight);
        }
        await ensurePoseLandmarker();
        motionEnabled = true;
        startPoseScheduler();
        lastVideoTime = -1;
        resetPoseCalibration();
        setCameraUi(soundEnabled ? "🔊 Dźwięk aktywny • ustaw się do kalibracji" : "🔇 Dźwięk wyłączony • ustaw się do kalibracji", { active: true });
        return true;
    } catch (error) {
        console.error("Camera/Pose error", error);
        const detail = normalizeMediaPipeError(error).replace(/\s+/g, " ").slice(0, 320);
        setCameraUi(`❌ MediaPipe: ${detail}`, { error: true });
        if (cameraButton) cameraButton.textContent = "🔄 Spróbuj ponownie";
        return false;
    }
}

function visible(lm) {
    return lm && (lm.visibility ?? 1) >= poseSettings.minVisibility;
}
function mid(a, b) {
    return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
}
function dist(a, b) {
    return Math.hypot(a.x - b.x, a.y - b.y);
}

function poseMetrics(lm) {
    const ls = lm[11], rs = lm[12];
    if (![ls, rs].every(visible)) return null;

    const shoulders = mid(ls, rs);
    const shoulderWidth = Math.max(0.075, dist(ls, rs));

    return {
        centerX: shoulders.x,
        centerY: shoulders.y,
        shoulderWidth,
        torso: shoulderWidth
    };
}

function distanceState(m) {
    if (!m) return "missing";
    if (m.shoulderWidth < poseSettings.minShoulderWidth) return "far";
    if (m.shoulderWidth > poseSettings.maxShoulderWidth) return "close";
    return "ok";
}
function showDistanceFeedback(state) {
    positionGuide?.classList.remove("distance-ok", "distance-bad");
    if (state === "ok") {
        positionGuide?.classList.add("distance-ok");
        setGuideState("position-ok", "ODLEGŁOŚĆ OK ✓", "Telefon stabilnie. Oba barki są dobrze widoczne.", "Stój prosto. kalibracja ruszy automatycznie");
        setCameraUi("🟢 Odległość OK. Nie ruszaj telefonem", { active: true });
        setTrackingDot("ok");
    } else if (state === "far") {
        positionGuide?.classList.add("distance-bad");
        setGuideState("calibrating", "ZA DALEKO", "Podejdź bliżej. Oba barki powinny być wyraźnie widoczne.", "🔴 Podejdź bliżej telefonu");
        setCameraUi("🔴 Za daleko • podejdź bliżej", { active: true });
        setTrackingDot("bad");
    } else if (state === "close") {
        positionGuide?.classList.add("distance-bad");
        setGuideState("calibrating", "ZA BLISKO", "Odsuń się tak, aby oba barki miały zapas po bokach.", "🔴 Odsuń się trochę");
        setCameraUi("🔴 Za blisko • odsuń się", { active: true });
        setTrackingDot("bad");
    }
}
// Cały ekran jest aktywny. Do sterowania potrzebujemy wyłącznie obu barków.
function poseIsUsable(m) {
    return !!m && m.torso >= 0.075;
}

function depthToJumpMultiplier(depth) {
    const t = Math.max(0, Math.min(1,
        (depth - poseSettings.minSquatDepth) /
        (poseSettings.fullSquatDepth - poseSettings.minSquatDepth)
    ));
    // Smoothstep: małe przysiady są łagodne, głębsze dostają wyraźnie więcej mocy.
    const smooth = t * t * (3 - 2 * t);
    return poseSettings.minJumpMultiplier +
        (poseSettings.maxJumpMultiplier - poseSettings.minJumpMultiplier) * smooth;
}

function triggerSquatFlap(depth) {
    const multiplier = depthToJumpMultiplier(depth);
    lastStrength = multiplier;

    if (gameState === GAME_STATE.READY) {
        // Start gry i pierwszy skok pochodzą z tego samego przysiadu.
        gameState = GAME_STATE.RUNNING;
        startScreen?.classList.add("hidden");
        player.velocityY = settings.jumpStrength * multiplier;
        player.y = Math.max(0, player.y - 2.5);
        squatSound(multiplier);
        vibrate(8);
    } else if (gameState === GAME_STATE.RUNNING) {
        flap(multiplier);
    }

    motionHud?.classList.add("detected");
    setTimeout(() => motionHud?.classList.remove("detected"), 100);
    setCameraUi(`🦵 Przysiad → skok ${Math.round(multiplier * 100)}%`, { active: true });
}


// =========================================================
// MOTION UI HELPERS — v77 CLEAN
function setSquatPhase(phase, progress = 0) {
    const p = Math.max(0, Math.min(1, progress));
    const rounded = Math.round(p * 50) / 50;

    if (squatPhaseLabel && phase !== lastSquatPhaseText) {
        squatPhaseLabel.textContent = phase;
        lastSquatPhaseText = phase;
    }

    if (
        motionLevel &&
        Math.abs(rounded - lastSquatPhaseProgress) >= 0.02
    ) {
        motionLevel.style.width = `${Math.round(rounded * 100)}%`;
        motionLevel.style.setProperty("--squat-progress", String(rounded));
        lastSquatPhaseProgress = rounded;
    }
}

function resetSquatMeterVisual() {
    if (squatMeterFill) {
        squatMeterFill.style.top = "0%";
        squatMeterFill.style.height = "0%";
    }

    lastRepMeterPct = 0;
    meterVisualPct = 0;
    meterTargetPct = 0;
    meterVisualLastNow = performance.now();
    lastSquatPhaseProgress = -1;

    motionHud?.classList.remove(
        "meter-triggered",
        "meter-returning",
        "detected"
    );
}

function fireRepJump(multiplier) {
    const m = Math.max(0.55, Math.min(1.20, multiplier));
    lastStrength = m;

    if (gameState === GAME_STATE.READY) {
        gameState = GAME_STATE.RUNNING;
        document.body.classList.add("game-running");
        startScreen?.classList.add("hidden");

        enableSnapshotBackground();

        player.velocityY = settings.jumpStrength * m;
        player.y = Math.max(0, player.y - 2.5);
        squatSound(m);
        vibrate(6);
    } else if (gameState === GAME_STATE.RUNNING) {
        flap(m);
    }

    motionHud?.classList.add("detected");
    setTimeout(()=>motionHud?.classList.remove("detected"),80);
}

function medianNumber(values) {
    if (!values?.length) return 0;
    const a = [...values].sort((x,y)=>x-y);
    const m = Math.floor(a.length / 2);
    return a.length % 2 ? a[m] : (a[m-1] + a[m]) / 2;
}

function resetRepController() {
    repControlEnabled = false;
    repZeroCollecting = false;
    repZeroSamples = [];
    repZeroY = null;
    repZeroShoulderWidth = null;
    repZeroCenterX = null;
    trackingSuspended = false;
    hideTrackingAlert();
    repDepth = 0;
    repDepthHistory = [];
    repState = "UP";
    repDownFrames = 0;
    repUpFrames = 0;
    repPeak = 0;
    repLastAppliedMultiplier = 0;
    resetSquatMeterVisual();
}

function startRepZeroCalibration() {
    resetRepController();
    repZeroCollecting = true;
    gameArmed = false;
    calibrationConfirm?.classList.add("hidden");
    positionGuide?.classList.remove("hidden");
    hideCalibrationBadge();

    setGuideState(
        "calibrating",
        "ZAPISUJĘ POZYCJĘ 0",
        "Stań prosto i nieruchomo. Kamera musi widzieć oba barki.",
        "NIE RÓB JESZCZE PRZYSIADU"
    );
    setCameraUi("🎯 Zapisuję pozycję stojącą",{active:true});
    setTrackingDot("warn");
}

function finishRepZeroCalibration() {
    const ys = repZeroSamples.map(s=>s.y);
    const xs = repZeroSamples.map(s=>s.centerX);
    const widths = repZeroSamples.map(s=>s.shoulderWidth);

    repZeroY = medianNumber(ys);
    repZeroCenterX = medianNumber(xs);
    repZeroShoulderWidth = Math.max(0.075, medianNumber(widths));

    const normalizedNoise = ys.map(
        y => Math.abs((y-repZeroY)/repZeroShoulderWidth)
    );
    repNoise = Math.max(0.003, medianNumber(normalizedNoise));

    repDownThreshold = Math.max(0.085, repNoise * 8.0);
    repUpThreshold = Math.max(0.024, repDownThreshold * 0.34);
    repFullDepth = Math.max(0.235, repDownThreshold * 2.45);

    repDepth = 0;
    repDepthHistory = [];
    repState = "UP";
    repDownFrames = 0;
    repUpFrames = 0;
    repPeak = 0;
    repLastAppliedMultiplier = 0;

    repZeroCollecting = false;
    repControlEnabled = true;
    gameArmed = true;

    resetSquatMeterVisual();
    positionGuide?.classList.add("hidden");
    calibrationConfirm?.classList.add("hidden");
    
    setTrackingDot("ok");
    setCameraUi("✅ Gotowe. Zrób przysiad",{active:true});

}

function repDepthToMeter(depth) {
    const d = Math.max(0, depth);

    // Do progu skoku pasek dochodzi do 40%.
    if (d <= repDownThreshold) {
        return Math.max(
            0,
            Math.min(
                40,
                d / Math.max(0.001, repDownThreshold) * 40
            )
        );
    }

    const t =
        (d - repDownThreshold) /
        Math.max(
            0.001,
            repFullDepth - repDownThreshold
        );

    return 40 + Math.max(0, Math.min(1, t)) * 60;
}

function updateRepMeter(depth) {
    if (!squatMeterFill) return;

    const pct = Math.max(
        0,
        Math.min(100, repDepthToMeter(depth))
    );

    meterTargetPct = pct;
    lastRepMeterPct = pct;

    motionHud?.classList.toggle(
        "meter-triggered",
        depth >= repDownThreshold
    );
}

function updateCurrentJumpStrength(depth) {
    if (gameState !== GAME_STATE.RUNNING) return;

    const meter =
        repDepthToMeter(depth);

    let desiredMultiplier;

    if (meter < 70) {
        // LEKKI: 40–70%
        const t =
            Math.max(0, Math.min(1, (meter - 40) / 30));
        desiredMultiplier =
            0.72 + (0.84 - 0.72) * t;
    } else if (meter < 90) {
        // ŚREDNI: 70–90%
        const t =
            Math.max(0, Math.min(1, (meter - 70) / 20));
        desiredMultiplier =
            0.84 + (1.00 - 0.84) * t;
    } else {
        // MOCNY: dopiero 90–100%
        const t =
            Math.max(0, Math.min(1, (meter - 90) / 10));
        desiredMultiplier =
            1.00 + (1.18 - 1.00) * t;
    }

    if (
        desiredMultiplier >
        repLastAppliedMultiplier + 0.025
    ) {
        const weatherMultiplier =
            activeEvent === "snow" ? 0.90 :
            activeEvent === "rain" ? 1.04 : 1;

        const desiredVelocity =
            settings.jumpStrength *
            weatherMultiplier *
            desiredMultiplier;

        player.velocityY =
            Math.min(
                player.velocityY,
                desiredVelocity
            );

        repLastAppliedMultiplier =
            desiredMultiplier;
    }
}

function processRepPose(m, now) {
    if (!m) return;
    repLastPoseAt = now;

    if (repZeroCollecting) {
        repZeroSamples.push({
            y:m.centerY,
            centerX:m.centerX,
            shoulderWidth:m.shoulderWidth
        });

        // Ruchome okno: kalibracja nie może utknąć po jednej gorszej próbce.
        if (repZeroSamples.length > 14) {
            repZeroSamples.shift();
        }

        const ys =
            repZeroSamples.map(s=>s.y);

        const spread =
            ys.length
                ? Math.max(...ys)-Math.min(...ys)
                : 1;

        const progress =
            Math.min(
                1,
                repZeroSamples.length/9
            );

        const stableZero =
            spread < 0.024;

        resetSquatMeterVisual();

        setGuideState(
            "calibrating",
            "ZAPISUJĘ POZYCJĘ 0",
            stableZero
                ? "Dobrze. Jeszcze moment nieruchomo."
                : "Stań prosto i nie ruszaj telefonem.",
            `ZERO ${Math.round(progress*100)}%`
        );

        if (
            repZeroSamples.length >= 9 &&
            stableZero
        ) {
            finishRepZeroCalibration();
        }
        return;
    }

    if (!repControlEnabled || repZeroY === null || repZeroShoulderWidth === null) return;

    // Zabezpieczenie przed pochyleniem, podejściem do kamery i zejściem z osi.
    const widthRatio =
        m.shoulderWidth /
        Math.max(0.075, repZeroShoulderWidth);

    const horizontalDrift =
        Math.abs(
            m.centerX -
            (repZeroCenterX ?? m.centerX)
        );

    const postureInvalid =
        widthRatio < 0.78 ||
        widthRatio > 1.24 ||
        horizontalDrift > 0.14;

    if (postureInvalid) {
        trackingSuspended = true;
        postureWarningUntil = now + 320;
        repDownFrames = 0;
        repUpFrames = 0;
        meterTargetPct = 0;
        setTrackingDot("warn");
        showTrackingAlert(
            "STAŃ PROSTO PRZODEM · NIE POCHYLAJ SIĘ",
            "warn"
        );
        return;
    }

    if (now > postureWarningUntil) {
        trackingSuspended = false;
        hideTrackingAlert();
    }

    const rawDepth = (m.centerY-repZeroY)/repZeroShoulderWidth;
    const deadZone = Math.max(0.012,repNoise*2.6);

    let cleanDepth = rawDepth > deadZone ? rawDepth-deadZone*0.55 : 0;
    cleanDepth = Math.max(0,Math.min(0.60,cleanDepth));

    repDepthHistory.push(cleanDepth);
    if (repDepthHistory.length > 3) repDepthHistory.shift();

    const med = medianNumber(repDepthHistory);
    repDepth += (med-repDepth)*0.68;
    if (repDepth < 0.006) repDepth = 0;

    updateRepMeter(repDepth);

    if (performance.now() < cameraMotionWarningUntil) {
        trackingSuspended = true;
        repDownFrames = 0;
        repUpFrames = 0;
        meterTargetPct = 0;
        setTrackingDot("bad");
        setSquatPhase("TELEFON SIĘ RUSZA",0);
        showTrackingAlert(
            "NIE RUSZAJ TELEFONEM · STEROWANIE WSTRZYMANE",
            "bad"
        );
        return;
    }

    if (!postureInvalid && performance.now() >= cameraMotionWarningUntil) {
        trackingSuspended = false;
        hideTrackingAlert();
    }

    setTrackingDot("ok");
    if (!gameArmed) return;

    if (repState === "UP") {
        repPeak = 0;
        repLastAppliedMultiplier = 0;

        if (repDepth >= repDownThreshold) repDownFrames++;
        else repDownFrames = 0;

        setSquatPhase(
            repDepth > 0 ? "SCHODZISZ ↓" : "GOTOWY",
            Math.min(1,repDepth/repFullDepth)
        );

        if (repDownFrames >= 1) {
            repState = "DOWN";
            repPeak = repDepth;
            repDownFrames = 0;
            repUpFrames = 0;

            fireRepJump(0.72);
            repLastAppliedMultiplier = 0.72;

            setSquatPhase("SKOK ✓",Math.min(1,repDepth/repFullDepth));
        }
        return;
    }

    repPeak = Math.max(repPeak,repDepth);
    updateCurrentJumpStrength(repPeak);

    if (repDepth <= repUpThreshold) repUpFrames++;
    else repUpFrames = 0;

    setSquatPhase("WRÓĆ DO GÓRY ↑",Math.min(1,repPeak/repFullDepth));

    if (repUpFrames >= 2) {
        repState = "UP";
        repPeak = 0;
        repDownFrames = 0;
        repUpFrames = 0;
        repLastAppliedMultiplier = 0;
        repDepth = 0;
        repDepthHistory = [];

        const zeroError = m.centerY-repZeroY;
        const maxCorrection = repZeroShoulderWidth*0.008;
        const correction = Math.max(
            -maxCorrection,
            Math.min(maxCorrection,zeroError*0.06)
        );
        repZeroY += correction;

        resetSquatMeterVisual();
        setCameraUi("✅ Gotowy na kolejny przysiad",{active:true});
    }
}

function finishCalibration() {
    const centers = calibrationSamples.map(s=>s.centerY);
    const widths = calibrationSamples.map(s=>s.shoulderWidth);

    baselineCenterY = centers.reduce((a,b)=>a+b,0)/centers.length;
    baselineTorso = widths.reduce((a,b)=>a+b,0)/widths.length;
    lastCalibrationShoulderWidth = baselineTorso;

    calibrationReady = true;
    gameArmed = false;
    resetRepController();

    positionGuide?.classList.remove("hidden");
    setGuideState(
        "position-ok",
        "ODLEGŁOŚĆ OK",
        "Stań prosto. Teraz zapiszemy Twoją pozycję stojącą jako punkt 0.",
        "JEDNA KRÓTKA KALIBRACJA"
    );

    hideCalibrationBadge();

    if (calibrationConfirm) {
        const title = calibrationConfirm.querySelector("strong");
        const text = calibrationConfirm.querySelector("small");
        if (title) title.textContent = "Zapisz pozycję stojącą";
        if (text) text.textContent = "Stań prosto i kliknij. Potem możesz od razu grać.";
        calibrationConfirm.classList.remove("hidden");
    }

    if (calibrationStartButton) calibrationStartButton.textContent = "ZAPISZ PUNKT 0";

    setTrackingDot("ok");
    setCameraUi("✅ Pozycja OK. Zapisz punkt 0",{active:true});
    startPoseScheduler();
}
function processPose(lm, now) {
    const m = poseMetrics(lm);
    if (!poseIsUsable(m)) {
        trackingSuspended = true;
        meterTargetPct = 0;
        setTrackingDot("bad");
        showTrackingAlert("NIE WIDZĘ BARKÓW · STEROWANIE WSTRZYMANE", "bad");

        if (!calibrationReady) {
            positionGuide?.classList.remove("hidden");
            setGuideState(
                "pose-missing",
                "NIE WIDZĘ BARKÓW",
                "Stań przodem do telefonu i pokaż oba barki.",
                "Sterowanie wstrzymane"
            );
        }

        setCameraUi("⚠️ Pokaż oba barki", { active: true });
        return;
    }

    trackingSuspended = false;
    hideTrackingAlert();
    lastPoseSeenAt = now;

    if (calibrationReady) {
        processRepPose(m, now);
        return;
    }

    if (!calibrationReady) {
        const dState = distanceState(m);
        showDistanceFeedback(dState);
        if (dState !== "ok") {
            calibrationSamples = [];
            if (motionLevel) motionLevel.style.width = "0%";
            return;
        }
        calibrationSamples.push({ centerX: m.centerX, centerY: m.centerY, torso: m.torso, shoulderWidth: m.shoulderWidth });
        if (calibrationSamples.length > poseSettings.calibrationFrames) calibrationSamples.shift();
        const centers = calibrationSamples.map(s => s.centerY);
        const spread = Math.max(...centers) - Math.min(...centers);
        const progress = Math.min(1, calibrationSamples.length / poseSettings.calibrationFrames);
        if (motionLevel) motionLevel.style.width = `${Math.round(progress * 100)}%`;
        setCameraUi(`✅ Kalibracja ${Math.round(progress * 100)}% • stój prosto`, { active: true });
        if (calibrationSamples.length >= poseSettings.calibrationFrames && spread <= poseSettings.calibrationJitter) {
            finishCalibration();
        }
        return;
    }

    // Responsywne EMA. Szerokość barków z kalibracji pozostaje skalą odniesienia. bieżąca zmiana perspektywy
    // nie może sztucznie zwiększać/zmniejszać głębokości przysiadu.
    filteredCenterY += (m.centerY - filteredCenterY) * 0.86;
    filteredTorso += (m.torso - filteredTorso) * 0.18;

    let depth = (filteredCenterY - baselineCenterY) / Math.max(0.045, baselineTorso);
    depth = Math.max(-0.10, Math.min(0.65, depth));
    const rawVelocity = depth - lastDepth;
    filteredDepthVelocity = filteredDepthVelocity * 0.16 + rawVelocity * 0.84;
    lastDepth = depth;

    // Gdy użytkownik stoi u góry, bardzo wolno korygujemy dryf aparatu/postawy.
    if (squatState === "READY" && Math.abs(depth) < 0.035) {
        baselineCenterY += (filteredCenterY - baselineCenterY) * 0.012;
        baselineTorso += (filteredTorso - baselineTorso) * 0.006;
    }

    const depthProgress = Math.max(0, Math.min(1, depth / poseSettings.fullSquatDepth));

    if (squatState === "READY") {
        maxSquatDepth = Math.max(0, depth);
        if (motionLevel) motionLevel.style.width = `${Math.round(depthProgress * 100)}%`;
        if (cameraStatus) cameraStatus.textContent = `↓ PRZYSIAD • ${Math.round(depthProgress * 100)}%`;

        if (depth >= poseSettings.minSquatDepth && filteredDepthVelocity >= poseSettings.descentVelocity) {
            squatState = "DESCENDING";
            maxSquatDepth = depth;
            turnaroundCount = 0;
        }
    } else if (squatState === "DESCENDING") {
        maxSquatDepth = Math.max(maxSquatDepth, depth);
        const maxProgress = Math.max(0, Math.min(1, maxSquatDepth / poseSettings.fullSquatDepth));
        if (motionLevel) motionLevel.style.width = `${Math.round(maxProgress * 100)}%`;
        if (cameraStatus) cameraStatus.textContent = `↓ GŁĘBOKOŚĆ • ${Math.round(maxProgress * 100)}%`;

        if (filteredDepthVelocity <= poseSettings.turnaroundVelocity) turnaroundCount += 1;
        else turnaroundCount = 0;

        // Flap dopiero przy zmianie kierunku na górę. W tym momencie znamy maksymalną głębokość.
        if (turnaroundCount >= poseSettings.turnaroundFrames && maxSquatDepth >= poseSettings.minSquatDepth) {
            triggerSquatFlap(maxSquatDepth);
            squatState = "RETURNING";
            turnaroundCount = 0;
            if (motionLevel) motionLevel.style.width = "0%";
            setGuideState("phase-up", "SKOK", `Moc: ${Math.round(lastStrength * 100)}%`, "Wróć do pozycji stojącej");
        }
    } else {
        // RETURNING. żadnych kolejnych flapów. Uzbrojenie dopiero blisko pozycji startowej.
        const returnProgress = Math.max(0, Math.min(1, depth / poseSettings.fullSquatDepth));
        if (motionLevel) motionLevel.style.width = `${Math.round(returnProgress * 100)}%`;
        if (cameraStatus) cameraStatus.textContent = "↑ WRÓĆ DO GÓRY";

        if (depth <= poseSettings.rearmDepth) {
            squatState = "READY";
            maxSquatDepth = 0;
            filteredDepthVelocity = 0;
            lastDepth = depth;
            if (motionLevel) motionLevel.style.width = "0%";
            positionGuide?.classList.add("hidden");
            setCameraUi("✅ Gotowe • następny przysiad", { active: true });
        }
    }
}

async function updateMotionDetection(now) {
    if (
        !motionEnabled ||
        !cameraFeed ||
        cameraFeed.readyState < 2 ||
        !moveNetWorkerReady ||
        !moveNetWorker ||
        moveNetWorkerBusy
    ) {
        return;
    }

    // v100: niższe opóźnienie sterowania.
    // Worker nadal przepuszcza maksymalnie jedną analizę naraz,
    // więc nie tworzymy kolejki starych klatek.
    const interval =
        calibrationReady
            ? 50
            : poseSettings.calibrationIntervalMs;

    if (
        now - lastMotionSample <
            interval ||
        cameraFeed.currentTime ===
            lastVideoTime
    ) {
        return;
    }

    lastMotionSample = now;
    lastVideoTime =
        cameraFeed.currentTime;

    const poseInput =
        preparePoseInput();

    if (!poseInput) return;

    moveNetWorkerBusy = true;

    try {
        // ImageBitmap jest transferable:
        // po postMessage główny wątek nie kopiuje całego bufora do workera.
        const bitmap =
            await createImageBitmap(
                poseInput
            );

        if (
            !moveNetWorkerReady ||
            !moveNetWorker
        ) {
            bitmap.close?.();
            moveNetWorkerBusy = false;
            return;
        }

        moveNetWorker.postMessage(
            {
                type:"frame",
                bitmap,
                timestamp:now
            },
            [bitmap]
        );
    } catch (error) {
        moveNetWorkerBusy = false;

        console.warn(
            "MoveNet frame transfer",
            error
        );
    }
}

let poseTimer = null;



function startPoseScheduler() {
    if (poseTimer) return;

    const tick = () => {
        if (!motionEnabled) {
            poseTimer = null;
            return;
        }

        updateMotionDetection(performance.now());

        poseTimer = setTimeout(
            tick,
            calibrationReady
                ? 42
                : poseSettings.calibrationIntervalMs
        );
    };

    poseTimer = setTimeout(tick,poseSettings.calibrationIntervalMs);
}

if (poseCanvas) {
    // v13 celowo nie rysuje szkieletu/siatki. mniej pracy GPU i czystszy ekran.
    poseCanvas.style.display = "none";
}

if (cameraButton) {
    cameraButton.addEventListener("click", async event => {
        event.preventDefault();
        event.stopPropagation();
        // Jednorazowe koszty audio i grafik wykonujemy przed właściwą grą.
        // Dzięki temu pierwszy coin nie musi inicjalizować audio ani player_coin.png.
        await Promise.allSettled([
            unlockAudio(),
            warmGameplayAssets()
        ]);

        gameArmed = false;
        document.body.classList.remove("game-running");
        resetRepController();
        hideCalibrationBadge();
        calibrationConfirm?.classList.add("hidden");

        // Od tego momentu pokazujemy również wskaźnik ruchu podczas kalibracji.
        document.body.classList.add("camera-active");

        // Ekran startowy znika, a kamera uruchamia kalibrację.
        startScreen?.classList.add("hidden");
        const ready = await enableCameraMotion();
        scheduleCanvasResize();
        if (!ready) {
            document.body.classList.remove("camera-active");
            startScreen?.classList.remove("hidden");
        }
    });
}

if (calibrationStartButton) {
    calibrationStartButton.addEventListener("click", event => {
        event.preventDefault();
        event.stopPropagation();
        if (!calibrationReady) return;
        startRepZeroCalibration();
    });
}

/*
=========================================================
UKŁAD PIONOWY
=========================================================

Gra jest zaprojektowana natywnie dla telefonu w pionie (540 × 960).
Nie wymusza już obrotu ani Fullscreen API, dzięki czemu mobilna przeglądarka
nie przełącza układu przy zmianie orientacji.
*/

function updateOrientationLock() {
    lastFrameTime = performance.now();
    return true;
}

/*
=========================================================
STEROWANIE
=========================================================
*/

function handlePrimaryInput(event) {
    // v17: lot jest sterowany wyłącznie przysiadem.
    // Kliknięcia/tapnięcia na canvasie nie wpływają na postać.
    if (event && typeof event.preventDefault === "function") event.preventDefault();
}

canvas.addEventListener("pointerdown", handlePrimaryInput, { passive: false });

document.addEventListener("keydown", event => {
    if (event.code === "Escape" || event.code === "KeyP") {
        event.preventDefault();
        togglePause();
    }
});

if (restartButton) {
    restartButton.addEventListener(
        "click",
        event => {
            event.stopPropagation();
            restartGame();
        }
    );
}

/*
=========================================================
OBSŁUGA UTRATY FOKUSU
=========================================================
*/

document.addEventListener(
    "visibilitychange",
    () => {
        if (document.hidden) {
            if (gameState === GAME_STATE.RUNNING) togglePause(true);
            lastFrameTime = performance.now();
        }
    }
);

window.addEventListener(
    "blur",
    () => {
        lastFrameTime =
            performance.now();
    }
);

let resizeFrame = 0;

function scheduleCanvasResize() {
    cancelAnimationFrame(resizeFrame);
    resizeFrame = requestAnimationFrame(() => {
        configureCanvasQuality();
        updateOrientationLock();
    });
}

window.addEventListener("resize", scheduleCanvasResize, { passive: true });
window.addEventListener("orientationchange", scheduleCanvasResize, { passive: true });

if (window.visualViewport) {
    window.visualViewport.addEventListener("resize", scheduleCanvasResize, { passive: true });
}

/*
=========================================================
URUCHOMIENIE
=========================================================
*/

bestScoreDisplay &&
    (
        bestScoreDisplay.textContent =
        String(bestScore)
    );

resetGame();
updateOrientationLock();

requestAnimationFrame(
    now => {
        lastFrameTime = now;
        gameLoop(now);
    }
);

window.addEventListener("DOMContentLoaded", () => {
    applyDeviceGate();
});

window.addEventListener("resize", () => {
    applyDeviceGate();
}, { passive:true });

window.addEventListener("orientationchange", () => {
    setTimeout(applyDeviceGate, 120);
}, { passive:true });

window.addEventListener("DOMContentLoaded", () => {
    if (
        startScreen &&
        !startScreen.classList.contains("hidden")
    ) {
        document.body.classList.remove("camera-mode");
    }
});
