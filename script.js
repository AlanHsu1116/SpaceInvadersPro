// =================================
//          GAME SETUP
// =================================
let isInMenu = true;
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
ctx.font = '24px "Exo 2"';


// =================================
//          AUDIO SYSTEM
// =================================
const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
const soundManager = {
    bgmOscillators: [],
    isPlaying: false,
    isBGMMuted: true,
    isSFXMuted: true,
    bgmAudio: new Audio('Aura-Long-Version.mp3'),
    bossBgmAudio: new Audio('Run-Amok.mp3'),
    finalBossBgmAudio: new Audio('Film.mp3'),
    currentBgm: null,

    init() {
        this.bgmAudio.loop = true;
        this.bgmAudio.volume = 0.3;
        this.bossBgmAudio.loop = true;
        this.bossBgmAudio.volume = 0.3;
        this.finalBossBgmAudio.loop = true;
        this.finalBossBgmAudio.volume = 0.3;
        this.currentBgm = this.bgmAudio;
        
        // Update button text to reflect muted state
        document.getElementById('bgmBtn').textContent = "🔇 音樂: 關";
        document.getElementById('sfxBtn').textContent = "🔇 音效: 關";
        
        // Fallback if mp3 fails or is missing
        const handleErr = (target) => {
            console.log("MP3 not found or failed to load, using procedural fallback.");
            if (target === 'bgm') this.bgmAudio = null;
            if (target === 'boss') this.bossBgmAudio = null;
            if (target === 'final') this.finalBossBgmAudio = null;
            
            if (this.isPlaying && !this.isBGMMuted && !this.currentBgm) {
                this.startProceduralSuspense();
            }
        };
        this.bgmAudio.onerror = () => handleErr('bgm');
        this.bossBgmAudio.onerror = () => handleErr('boss');
        this.finalBossBgmAudio.onerror = () => handleErr('final');

        // Add event listeners
        document.getElementById('bgmBtn').addEventListener('click', () => this.toggleBGM());
        document.getElementById('sfxBtn').addEventListener('click', () => this.toggleSFX());
    },

    toggleBGM() {
        this.isBGMMuted = !this.isBGMMuted;
        const btn = document.getElementById('bgmBtn');
        btn.textContent = this.isBGMMuted ? "🔇 音樂: 關" : "🎵 音樂: 開";
        btn.blur(); // Force remove focus
        
        if (this.isBGMMuted) {
            this.stopBGM();
        } else {
            if (gameState.gameStarted && !gameState.isGameOver) {
                this.playBGM(gameState.level);
            }
        }
    },

    toggleSFX() {
        this.isSFXMuted = !this.isSFXMuted;
        const btn = document.getElementById('sfxBtn');
        btn.textContent = this.isSFXMuted ? "🔇 音效: 關" : "🔊 音效: 開";
        btn.blur(); // Force remove focus
    },

    playBGM(level) {
        if (this.isBGMMuted) return;
        if (audioCtx.state === 'suspended') audioCtx.resume();
        
        let targetBgm = this.bgmAudio;
        if (level === 10) {
            targetBgm = this.finalBossBgmAudio;
        } else if (levelConfig[level] && levelConfig[level].isBoss) {
            targetBgm = this.bossBgmAudio;
        }
        
        // If target is missing (null), and we are already playing procedural, just return
        if (this.isPlaying && this.currentBgm === targetBgm) return;
        
        this.stopBGM();
        this.currentBgm = targetBgm;
        this.isPlaying = true;
        
        if (this.currentBgm && this.currentBgm.play) {
            this.currentBgm.play().catch(e => {
                console.log("Autoplay prevented or file missing, trying procedural.");
                this.startProceduralSuspense();
            });
        } else {
            this.startProceduralSuspense();
        }
    },

    startProceduralSuspense() {
        // Procedural Suspense: Dissonant, slow, atmospheric
        const freqs = [110, 116.5, 164.8]; // A2, Bb2 (dissonant), E3
        freqs.forEach((freq, i) => {
            const osc = audioCtx.createOscillator();
            const gain = audioCtx.createGain();
            osc.type = i === 1 ? 'sawtooth' : 'sine';
            osc.frequency.value = freq;
            
            // Slow amplitude modulation (breathing effect)
            const lfo = audioCtx.createOscillator();
            lfo.type = 'sine';
            lfo.frequency.value = 0.2 + (i * 0.1); 
            const lfoGain = audioCtx.createGain();
            lfoGain.gain.value = 0.1;
            lfo.connect(lfoGain);
            lfoGain.connect(gain.gain);

            osc.connect(gain);
            gain.connect(audioCtx.destination);
            
            gain.gain.value = 0.05; // Base volume
            
            osc.start();
            lfo.start();
            this.bgmOscillators.push({osc, gain, lfo, lfoGain});
        });
    },

    stopBGM() {
        if (this.bgmAudio) {
            this.bgmAudio.pause();
            this.bgmAudio.currentTime = 0;
        }
        if (this.bossBgmAudio) {
            this.bossBgmAudio.pause();
            this.bossBgmAudio.currentTime = 0;
        }
        if (this.finalBossBgmAudio) {
            this.finalBossBgmAudio.pause();
            this.finalBossBgmAudio.currentTime = 0;
        }
        this.bgmOscillators.forEach(o => {
            o.osc.stop();
            o.lfo.stop();
            o.osc.disconnect();
        });
        this.bgmOscillators = [];
        this.isPlaying = false;
    },

    playShoot() {
        if (this.isSFXMuted) return;
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.type = 'square';
        osc.frequency.setValueAtTime(880, audioCtx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(110, audioCtx.currentTime + 0.1);
        gain.gain.setValueAtTime(0.1, audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.1);
        osc.connect(gain);
        gain.connect(audioCtx.destination);
        osc.start();
        osc.stop(audioCtx.currentTime + 0.1);
    },
    
    playExplosion() {
        if (this.isSFXMuted) return;
        const now = audioCtx.currentTime;
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(100, now);
        osc.frequency.exponentialRampToValueAtTime(10, now + 0.3);
        gain.gain.setValueAtTime(0.2, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.3);
        osc.connect(gain);
        gain.connect(audioCtx.destination);
        osc.start();
        osc.stop(now + 0.3);
    },

    playScoreTick() {
        if (this.isSFXMuted) return;
        const now = audioCtx.currentTime;
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(1200, now);
        gain.gain.setValueAtTime(0.05, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.05);
        osc.connect(gain);
        gain.connect(audioCtx.destination);
        osc.start();
        osc.stop(now + 0.05);
    },

    playVictoryFanfare() {
        if (this.isBGMMuted) return;
        this.stopBGM();
        const now = audioCtx.currentTime;
        const notes = [523.25, 659.25, 783.99, 1046.50]; // C5, E5, G5, C6
        notes.forEach((freq, i) => {
            const osc = audioCtx.createOscillator();
            const gain = audioCtx.createGain();
            osc.type = 'triangle';
            osc.frequency.setValueAtTime(freq, now + i * 0.15);
            gain.gain.setValueAtTime(0.1, now + i * 0.15);
            gain.gain.exponentialRampToValueAtTime(0.01, now + i * 0.15 + 0.5);
            osc.connect(gain);
            gain.connect(audioCtx.destination);
            osc.start(now + i * 0.15);
            osc.stop(now + i * 0.15 + 0.5);
        });
    },

    playAchievement() {
        if (this.isSFXMuted) return;
        const now = audioCtx.currentTime;
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(880, now);
        osc.frequency.exponentialRampToValueAtTime(1760, now + 0.1);
        gain.gain.setValueAtTime(0.1, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.2);
        osc.connect(gain);
        gain.connect(audioCtx.destination);
        osc.start();
        osc.stop(now + 0.2);
    }
};


// =================================
//          GAME STATE
// =================================
let gameState = {
    player: {
        x: canvas.width / 2 - 25,
        y: canvas.height - 70,
        width: 50,
        height: 50,
        speed: 8,
        char: '🚀',
        fontSize: 40,
        color: '#00f2ff',
        invulnerableUntil: 0,
        lastShotTime: 0,
        shotDelay: 120 // Reduced from 200ms
    },
    bullets: [],
    enemies: [],
    enemyBullets: [],
    level: 1,
    score: 0,
    visualScore: 0,
    floatingTexts: [],
    particles: [],
    continuesLeft: 3,
    isCalculatingBonus: false,
    bonusTimeLeft: 0,
    lastTimeBonus: 0,
    isGameOver: false,
    gameWon: false,
    levelComplete: false,
    gameStarted: false,
    isPaused: false,
    boss: null,
    bootProgress: 0,
    timeRemaining: 180,
    lastFrameTime: Date.now(),
    leaderboard: (() => {
        try {
            return JSON.parse(localStorage.getItem('spaceInvadersLeaderboardV2')) || [];
        } catch (e) {
            console.error("Failed to load leaderboard:", e);
            return [];
        }
    })(),
    stars: []
};

const movement = {
    left: false,
    right: false,
};

// =================================
//      PERSISTENCE FUNCTIONS
// =================================
function saveGameState() {
    // Save everything except leaderboard (which is global)
    const stateToSave = { ...gameState, leaderboard: undefined };
    localStorage.setItem('spaceInvadersSave', JSON.stringify(stateToSave));
}

function loadGameState() {
    const saved = localStorage.getItem('spaceInvadersSave');
    if (saved) {
        const parsed = JSON.parse(saved);
        // Merge saved state but keep current leaderboard
        gameState = { 
            ...gameState, 
            ...parsed, 
            leaderboard: JSON.parse(localStorage.getItem('spaceInvadersLeaderboardV2')) || [] 
        };
        // Ensure leaderboard is sorted correctly after loading
        sortLeaderboard();
    }
}

function sortLeaderboard() {
    gameState.leaderboard.sort((a, b) => {
        const scoreA = (a && typeof a === 'object') ? a.score : a;
        const scoreB = (b && typeof b === 'object') ? b.score : b;
        return (scoreB || 0) - (scoreA || 0);
    });
}

function clearSavedGame() {
    localStorage.removeItem('spaceInvadersSave');
}

const levelConfig = {
    1: { rows: 3, cols: 6, speed: 2, fireRate: 0.0005 },
    2: { rows: 3, cols: 7, speed: 2, fireRate: 0.0006 },
    3: { rows: 4, cols: 7, speed: 2.5, fireRate: 0.0007 },
    4: { rows: 4, cols: 8, speed: 2.5, fireRate: 0.0008 },
    5: { isBoss: true, hp: 40, speed: 3.2, fireRate: 0.008 }, // Mid-game Boss
    6: { rows: 5, cols: 9, speed: 2.8, fireRate: 0.0012 },
    7: { rows: 5, cols: 10, speed: 3.0, fireRate: 0.0015 },
    8: { rows: 6, cols: 10, speed: 3.2, fireRate: 0.0018 },
    9: { rows: 6, cols: 11, speed: 3.5, fireRate: 0.002 },
    10: { isBoss: true, hp: 80, speed: 3.6, fireRate: 0.012 }, // Final Boss (Reduced strength by 20%)
};


// =================================
//        ENTITY MANAGEMENT
// =================================
function initStars() {
    gameState.stars = [];
    for (let i = 0; i < 100; i++) {
        gameState.stars.push({
            x: Math.random() * canvas.width,
            y: Math.random() * canvas.height,
            size: Math.random() * 2,
            speed: Math.random() * 1 + 0.5
        });
    }
}

function updateStars() {
    gameState.stars.forEach(star => {
        star.y += star.speed;
        if (star.y > canvas.height) {
            star.y = 0;
            star.x = Math.random() * canvas.width;
        }
    });
}

function drawStars() {
    ctx.fillStyle = '#ffffff';
    gameState.stars.forEach(star => {
        ctx.beginPath();
        ctx.arc(star.x, star.y, star.size, 0, Math.PI * 2);
        ctx.fill();
    });
}

function createEnemies() {
    gameState.enemies = [];
    gameState.boss = null;
    const config = levelConfig[gameState.level];

    if (config.isBoss) {
        createBoss(config);
        return;
    }

    const enemyWidth = 45;
    const enemyHeight = 45;
    const enemyPadding = 5;
    const enemyOffsetTop = 60;
    const enemyChars = ['👾', '👽', '💀', '🤖', '👺'];
    const enemyColors = ['#ff00ff', '#00ff00', '#ffff00', '#00f2ff', '#ff3366'];
    
    // Choose formation based on level
    if (gameState.level <= 2) {
        // Classic Grid
        createGridFormation(config, enemyWidth, enemyHeight, enemyPadding, enemyOffsetTop, enemyChars, enemyColors);
    } else if (gameState.level <= 4) {
        // Triangle / V-Shape
        createTriangleFormation(config, enemyWidth, enemyHeight, enemyPadding, enemyOffsetTop, enemyChars, enemyColors);
    } else if (gameState.level <= 6) {
        // Sine Wave
        createSineFormation(config, enemyWidth, enemyHeight, enemyPadding, enemyOffsetTop, enemyChars, enemyColors);
    } else {
        // Double Circle / Split
        createDoubleCircleFormation(config, enemyWidth, enemyHeight, enemyPadding, enemyOffsetTop, enemyChars, enemyColors);
    }
}

function createBoss(config) {
    const isFinal = gameState.level === 10;
    gameState.boss = {
        x: canvas.width / 2 - 75,
        y: 80,
        width: 150,
        height: 120,
        char: isFinal ? '👹' : '🛸',
        fontSize: 100,
        color: isFinal ? '#ff00ff' : '#ff0000',
        hp: config.hp,
        maxHp: config.hp,
        phase: 1,
        direction: 1,
        speed: config.speed,
        movePhase: 0,
        lastShootTime: 0,
        fireRate: config.fireRate,
        isFinal: isFinal,
        isBoss: true,
        shieldActive: false,
        shieldCooldown: 0,
        summonCooldown: 0
    };
}

function createGridFormation(config, w, h, p, top, chars, colors) {
    const totalW = config.cols * (w + p) - p;
    const startX = (canvas.width - totalW) / 2;
    for (let c = 0; c < config.cols; c++) {
        for (let r = 0; r < config.rows; r++) {
            addEnemy(startX + c * (w + p), top + r * (h + p), r, c, w, h, chars, colors);
        }
    }
}

function createTriangleFormation(config, w, h, p, top, chars, colors) {
    const rows = config.rows + 2; // Taller
    const cols = config.cols;
    const startX = (canvas.width - (cols * (w + p))) / 2;
    
    for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
            // Only add if it forms a V shape (approx)
            if (c >= Math.abs(cols/2 - r) && c <= cols - Math.abs(cols/2 - r) - 1) { 
                 addEnemy(startX + c * (w + p), top + r * (h + p), r, c, w, h, chars, colors);
            } else if (r < 3) { // Fill top few rows to ensure enough enemies
                 addEnemy(startX + c * (w + p), top + r * (h + p), r, c, w, h, chars, colors);
            }
        }
    }
}

function createSineFormation(config, w, h, p, top, chars, colors) {
    const startX = 50;
    const availableWidth = canvas.width - 100;
    const step = availableWidth / config.cols;
    
    for (let c = 0; c < config.cols; c++) {
        for (let r = 0; r < config.rows; r++) {
            const x = startX + c * step;
            const yOffset = Math.sin(c * 0.5) * 50;
            const y = top + r * (h + p) + yOffset; // Removed extra +50
            addEnemy(x, y, r, c, w, h, chars, colors);
        }
    }
}

function createDoubleCircleFormation(config, w, h, p, top, chars, colors) {
    const cx = canvas.width / 2;
    const cy = top + 150;
    const radius = 100;
    const count = config.cols * 2;
    
    for (let i = 0; i < count; i++) {
        const angle = (Math.PI * 2 / count) * i;
        const x = cx + Math.cos(angle) * radius - w/2;
        const y = cy + Math.sin(angle) * radius - h/2;
        addEnemy(x, y, 0, i, w, h, chars, colors);
        
        // Inner circle
        if (i % 2 === 0) {
            const x2 = cx + Math.cos(angle) * (radius * 0.6) - w/2;
            const y2 = cy + Math.sin(angle) * (radius * 0.6) - h/2;
            addEnemy(x2, y2, 1, i, w, h, chars, colors);
        }
    }
}

function addEnemy(x, y, r, c, w, h, chars, colors) {
    const isElite = Math.random() < 0.1 + (gameState.level * 0.02); // Increase chance with level
    let type = 'normal';
    let hp = 1;
    let char = chars[r % chars.length];
    let color = colors[r % colors.length];
    let fontSize = 35;
    let scoreValue = 10;

    if (isElite) {
        const eliteType = Math.floor(Math.random() * 3);
        if (eliteType === 0) {
            type = 'tank';
            char = '🛸';
            hp = 3;
            scoreValue = 50;
            color = '#ff00ff';
        } else if (eliteType === 1) {
            type = 'fast';
            char = '⚡';
            hp = 1;
            scoreValue = 30;
            color = '#ffff00';
        } else {
            type = 'shooter';
            char = '🔫';
            hp = 2;
            scoreValue = 40;
            color = '#ff3366';
        }
    }

    gameState.enemies.push({
        x: x,
        y: y,
        width: w,
        height: h,
        char: char,
        fontSize: fontSize,
        color: color,
        direction: 1,
        type: type,
        hp: hp,
        maxHp: hp,
        scoreValue: scoreValue,
        lastX: x, // For movement patterns
        movePhase: Math.random() * Math.PI * 2
    });
}


function shoot() {
    const now = Date.now();
    if (now - gameState.player.lastShotTime < gameState.player.shotDelay) return;

    if (!gameState.isGameOver && gameState.gameStarted && !gameState.levelComplete && !gameState.isCalculatingBonus && !gameState.isPaused) {
        soundManager.playShoot();
        gameState.player.lastShotTime = now;
        gameState.bullets.push({
            x: gameState.player.x + gameState.player.width / 2 - 5,
            y: gameState.player.y,
            width: 10,
            height: 20,
            char: '💥',
            fontSize: 15,
            color: '#ffff00',
        });
    }
}

function enemyShoot(enemy) {
    let fireRate = levelConfig[gameState.level].fireRate;
    if (enemy.type === 'shooter') fireRate *= 3;
    if (enemy.type === 'tank') fireRate *= 0.5;

    if (Math.random() < fireRate) {
        gameState.enemyBullets.push({
            x: enemy.x + enemy.width / 2 - 10,
            y: enemy.y + enemy.height,
            width: 20,
            height: 30,
            char: enemy.type === 'shooter' ? '⚡' : '💣',
            fontSize: 25,
            color: enemy.type === 'shooter' ? '#00f2ff' : '#ff0000',
        });
    }
}


// =================================
//        DRAWING FUNCTIONS
// =================================
function drawEntity(entity) {
    if (entity === gameState.player && isInvulnerable()) {
        if (Math.floor(Date.now() / 200) % 2 === 0) return;
    }
    
    let color = entity.color || '#e0e0e0';
    let drawX = entity.x + entity.width / 2;
    let drawY = entity.y + entity.height / 2;
    let char = entity.char;

    // Boss Specific Effects
    if (entity.isBoss) {
        ctx.save();
        ctx.shadowBlur = 20;
        
        if (entity.phase === 1) {
            ctx.shadowColor = entity.isFinal ? '#ff00ff' : '#ff0000';
        } else if (entity.phase === 2) {
            ctx.shadowColor = '#bf00ff'; // Purple Glow
            char = entity.isFinal ? '💀' : '👾'; // Phase 2 Emojis
        } else if (entity.phase === 3) {
            // Rainbow Glow
            ctx.shadowColor = `hsl(${(Date.now() / 5) % 360}, 100%, 50%)`;
            char = '💥'; // Frenzy Phase Emoji
            // Intense Shaking
            drawX += (Math.random() - 0.5) * 12;
            drawY += (Math.random() - 0.5) * 12;
        }
    }

    // Hit flash effect
    if (entity.isHit) {
        ctx.fillStyle = '#ffffff';
        drawX += (Math.random() - 0.5) * 5;
    } else {
        ctx.fillStyle = color;
    }

    ctx.font = `${entity.fontSize}px "Exo 2"`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(char, drawX, drawY);

    if (entity.isBoss) ctx.restore(); // Clean up shadow effects

    // Draw Shield for Final Boss
    if (entity.shieldActive) {
        ctx.strokeStyle = '#00f2ff';
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.arc(drawX, drawY, entity.width / 1.5, 0, Math.PI * 2);
        ctx.stroke();
        
        ctx.font = '30px "Exo 2"';
        ctx.fillText('🛡️', drawX, entity.y - 20);
    }

    // Draw HP bar for Elites/Boss
    if (entity.hp > 1 || (entity.maxHp && entity.maxHp > 1)) {
        const barW = entity.width * 0.8;
        const barH = 6; // Thicker bar
        const barX = entity.x + (entity.width - barW) / 2;
        const barY = entity.y - 15;
        
        ctx.fillStyle = '#333';
        ctx.fillRect(barX, barY, barW, barH);
        
        // Dynamic HP color
        const hpPerc = entity.hp / entity.maxHp;
        ctx.fillStyle = hpPerc > 0.6 ? '#00ff00' : (hpPerc > 0.3 ? '#ffff00' : '#ff0000');
        ctx.fillRect(barX, barY, barW * hpPerc, barH);
    }
}

function drawMessage(line1, line2, line3 = '') {
    ctx.textAlign = 'center';
    ctx.fillStyle = '#00f2ff';
    ctx.font = '50px "Exo 2"';
    ctx.fillText(line1, canvas.width / 2, canvas.height / 2 - 60);
    ctx.font = '30px "Exo 2"';
    ctx.fillText(line2, canvas.width / 2, canvas.height / 2 + 20);
    if (line3) {
        ctx.font = '24px "Exo 2"';
        ctx.fillStyle = '#ff3366';
        ctx.fillText(line3, canvas.width / 2, canvas.height / 2 + 70);
    }
}

function drawAll() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    drawStars();

    if (!gameState.gameStarted) {
        drawStartScreen();
        return;
    }
    
    if (gameState.isGameOver || gameState.gameWon) {
        if (gameState.gameWon) {
            drawVictory();
        } else {
            drawGameOver();
        }
        return;
    }
    
    drawEntity(gameState.player);
    gameState.bullets.forEach(drawEntity);
    gameState.enemies.forEach(drawEntity);
    if (gameState.boss) drawEntity(gameState.boss);
    gameState.enemyBullets.forEach(drawEntity);
    
    drawParticles(); // Draw effects
    drawFloatingTexts();
    drawUI();

    if (gameState.levelComplete) {
        drawLevelComplete();
    } else if (gameState.isPaused) {
        drawPauseScreen();
    }
}

function drawPauseScreen() {
    ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    ctx.textAlign = 'center';
    ctx.fillStyle = '#00f2ff';
    ctx.font = '60px "Exo 2"';
    ctx.fillText("暫停中", canvas.width / 2, canvas.height / 2);
    
    ctx.font = '24px "Exo 2"';
    ctx.fillStyle = '#ffffff';
    ctx.fillText("按 'P' 鍵繼續遊戲", canvas.width / 2, canvas.height / 2 + 50);
}


// =================================
//        UPDATE FUNCTIONS
// =================================
function updatePlayer() {
    if (gameState.levelComplete || gameState.isCalculatingBonus || gameState.isPaused) return;

    if (movement.left && gameState.player.x > 0) {
        gameState.player.x -= gameState.player.speed;
    }
    if (movement.right && gameState.player.x < canvas.width - gameState.player.width) {
        gameState.player.x += gameState.player.speed;
    }
}

function updateBullets() {
    for (let i = gameState.bullets.length - 1; i >= 0; i--) {
        gameState.bullets[i].y -= 10;
        if (gameState.bullets[i].y < 0) {
            gameState.bullets.splice(i, 1);
        }
    }

    for (let i = gameState.enemyBullets.length - 1; i >= 0; i--) {
        const bullet = gameState.enemyBullets[i];
        bullet.x += bullet.vx || 0;
        bullet.y += bullet.vy || 5;
        if (bullet.y > canvas.height || bullet.x < 0 || bullet.x > canvas.width) {
            gameState.enemyBullets.splice(i, 1);
        }
    }
}

function updateEnemies() {
    if (gameState.boss) {
        updateBoss();
        return;
    }

    const config = levelConfig[gameState.level];
    let moveDown = false;

    gameState.enemies.forEach(enemy => {
        let speedMult = 1;
        if (enemy.type === 'fast') speedMult = 1.8; // Lowered from 2.5
        if (enemy.type === 'tank') speedMult = 0.6; // Slightly adjusted from 0.5

        enemy.x += config.speed * enemy.direction * speedMult;
        
        // Special vertical oscillation for shooters
        if (enemy.type === 'shooter') {
            enemy.movePhase += 0.05;
            enemy.y += Math.sin(enemy.movePhase) * 1.5;
        }

        // Detect if any enemy hits the wall
        if (enemy.x + enemy.width >= canvas.width || enemy.x <= 0) {
            moveDown = true;
        }
        enemyShoot(enemy);
    });

    if (moveDown) {
        gameState.enemies.forEach(enemy => {
            enemy.direction *= -1;
            enemy.y += 20;
            
            // Push away from edge immediately to prevent re-triggering
            if (enemy.x <= 0) enemy.x = 1;
            if (enemy.x + enemy.width >= canvas.width) enemy.x = canvas.width - enemy.width - 1;
        });
    }
}

function updateBoss() {
    const boss = gameState.boss;
    const hpPercent = boss.hp / boss.maxHp;
    
    // Phase calculation
    if (hpPercent > 0.66) boss.phase = 1;
    else if (hpPercent > 0.33) boss.phase = 2;
    else boss.phase = 3;

    // Level 10 Unique: Shield Logic
    if (boss.isFinal && boss.phase === 2) {
        boss.shieldCooldown--;
        if (boss.shieldCooldown <= 0) {
            boss.shieldActive = !boss.shieldActive;
            boss.shieldCooldown = boss.shieldActive ? 180 : 120; // 3s on, 2s off
        }
    } else {
        boss.shieldActive = false;
    }

    // Level 10 Unique: Summoning Logic
    if (boss.isFinal && gameState.enemies.length < 3) {
        boss.summonCooldown--;
        if (boss.summonCooldown <= 0) {
            spawnBossMinion();
            boss.summonCooldown = 300; // Every 5 seconds
        }
    }

    // Movement
    if (boss.phase === 1) {
        boss.x += boss.speed * boss.direction;
        if (boss.x + boss.width > canvas.width || boss.x < 0) boss.direction *= -1;
    } else if (boss.phase === 2) {
        boss.movePhase += boss.isFinal ? 0.032 : 0.015; // Mid Boss is slower
        boss.x = (canvas.width / 2 - boss.width / 2) + Math.sin(boss.movePhase) * (canvas.width / 3);
        boss.y = 80 + Math.cos(boss.movePhase * 2) * 30;
    } else if (boss.phase === 3) {
        boss.movePhase += boss.isFinal ? 0.064 : 0.03; // Mid Boss is slower
        boss.x = (canvas.width / 2 - boss.width / 2) + Math.sin(boss.movePhase) * (canvas.width / 2.5);
        boss.y = 100 + Math.sin(boss.movePhase * 3) * 50;
    }

    // Attacks
    if (Math.random() < boss.fireRate * (1 + (boss.phase - 1) * 0.5)) {
        bossShoot();
    }
}

function spawnBossMinion() {
    const x = Math.random() * (canvas.width - 50);
    const y = 200;
    // Add as a 'fast' elite minion
    gameState.enemies.push({
        x: x,
        y: y,
        width: 40,
        height: 40,
        char: '🛸',
        fontSize: 30,
        color: '#ff00ff',
        direction: Math.random() > 0.5 ? 1 : -1,
        type: 'fast',
        hp: 1,
        maxHp: 1,
        scoreValue: 20,
        movePhase: Math.random() * Math.PI * 2
    });
}

function bossShoot() {
    const boss = gameState.boss;
    const isFinal = boss.isFinal;
    
    if (boss.phase === 1) {
        // Standard Triple/Penta Shot
        const count = isFinal ? 5 : 3;
        const spread = isFinal ? 40 : 30;
        for(let i = -(Math.floor(count/2)); i <= Math.floor(count/2); i++) {
            spawnEnemyBullet(boss.x + boss.width/2 + (i*spread), boss.y + boss.height, i * (isFinal ? 3 : 2), 5);
        }
    } else if (boss.phase === 2) {
        // Spread Shot
        const count = isFinal ? 6 : 5; // Reduced from 7
        for(let i = -(Math.floor(count/2)); i <= Math.floor(count/2); i++) {
            spawnEnemyBullet(boss.x + boss.width/2, boss.y + boss.height, i * (isFinal ? 3.2 : 3), isFinal ? 4.8 : 4);
        }
    } else if (boss.phase === 3) {
        // Barrage (Circular)
        const count = isFinal ? 10 : 8; // Reduced from 12
        for(let i = 0; i < count; i++) {
            const angle = (Math.PI / (count - 1)) * i;
            spawnEnemyBullet(boss.x + boss.width/2, boss.y + boss.height, Math.cos(angle) * (isFinal ? 5.6 : 5), Math.sin(angle) * (isFinal ? 5.6 : 5) + 2);
        }
        
        // Final Boss special: Random fast snipe
        if (isFinal && Math.random() < 0.24) { // Reduced from 0.3
            spawnEnemyBullet(boss.x + boss.width/2, boss.y + boss.height, (gameState.player.x - boss.x) / 100, 6.4);
        }
    }
}

function spawnEnemyBullet(x, y, vx, vy) {
    gameState.enemyBullets.push({
        x: x,
        y: y,
        width: 15,
        height: 15,
        vx: vx,
        vy: vy,
        char: '🔴',
        fontSize: 20,
        color: '#ff0000'
    });
}


// =================================
//       COLLISION DETECTION
// =================================
function checkCollisions() {
    // Player bullets vs enemies/boss
    for (let bIndex = gameState.bullets.length - 1; bIndex >= 0; bIndex--) {
        const bullet = gameState.bullets[bIndex];
        
        // vs Boss
        if (gameState.boss && isColliding(bullet, gameState.boss)) {
            gameState.bullets.splice(bIndex, 1);
            
            if (gameState.boss.shieldActive) {
                createParticles(bullet.x, bullet.y, '#00f2ff', 3);
                return;
            }

            gameState.boss.hp--;
            gameState.boss.isHit = true;
            createParticles(bullet.x, bullet.y, '#ffaa00', 8); // Boss hit particles
            setTimeout(() => { if(gameState.boss) gameState.boss.isHit = false; }, 100);
            
            if (gameState.boss.hp <= 0) {
                const reward = 1000 * gameState.level;
                gameState.score += reward;
                addFloatingText(gameState.boss.x + gameState.boss.width / 2, gameState.boss.y + gameState.boss.height / 2, reward);
                createParticles(gameState.boss.x + gameState.boss.width / 2, gameState.boss.y + gameState.boss.height / 2, '#ff0000', 50); // Explosion
                gameState.boss = null;
                soundManager.playExplosion();
                soundManager.playAchievement();
            }
            continue;
        }

        for (let eIndex = gameState.enemies.length - 1; eIndex >= 0; eIndex--) {
            const enemy = gameState.enemies[eIndex];
            if (isColliding(bullet, enemy)) {
                gameState.bullets.splice(bIndex, 1);
                enemy.hp--;
                
                if (enemy.hp <= 0) {
                    gameState.enemies.splice(eIndex, 1);
                    const reward = enemy.scoreValue || 10;
                    gameState.score += reward;
                    addFloatingText(enemy.x + enemy.width / 2, enemy.y + enemy.height / 2, reward);
                    soundManager.playExplosion();
                } else {
                    enemy.isHit = true;
                    setTimeout(() => enemy.isHit = false, 100);
                }
                break; // Stop checking enemies for this bullet
            }
        }
    }

    // Enemy bullets vs player
    for (let i = gameState.enemyBullets.length - 1; i >= 0; i--) {
        const bullet = gameState.enemyBullets[i];
        if (isColliding(bullet, gameState.player)) {
            if (!isInvulnerable()) {
                gameState.enemyBullets.splice(i, 1);
                endGame("KILLED");
            }
        }
    }

    // Boss vs player
    if (gameState.boss && isColliding(gameState.boss, gameState.player)) {
        if (!isInvulnerable()) {
            endGame("COLLISION");
        }
    }

    // Enemies vs player
    for (let i = gameState.enemies.length - 1; i >= 0; i--) {
        const enemy = gameState.enemies[i];
        if (isColliding(enemy, gameState.player)) {
            if (!isInvulnerable()) {
                endGame("COLLISION");
            }
        } else if (enemy.y + enemy.height > canvas.height) {
            endGame("INVADED");
        }
    }
}

function isInvulnerable() {
    return gameState.player.invulnerableUntil && Date.now() < gameState.player.invulnerableUntil;
}

function isColliding(rect1, rect2) {
    return rect1.x < rect2.x + rect2.width &&
           rect1.x + rect1.width > rect2.x &&
           rect1.y < rect2.y + rect2.height &&
           rect1.y + rect1.height > rect2.y;
}


// =================================
//           UI & MESSAGES
// =================================
function drawUI() {
    ctx.textAlign = 'left';
    ctx.fillStyle = '#00f2ff';
    ctx.font = '24px "Exo 2"';
    ctx.fillText(`分數: ${Math.floor(gameState.visualScore)}`, 20, 40);
    
    // Timer display
    const minutes = Math.floor(gameState.timeRemaining / 60);
    const seconds = Math.floor(gameState.timeRemaining % 60);
    const timeStr = `${minutes}:${seconds.toString().padStart(2, '0')}`;
    
    ctx.textAlign = 'center';
    ctx.fillStyle = gameState.timeRemaining < 30 ? '#ff0000' : '#ffffff';
    ctx.fillText(`時間: ${timeStr}`, canvas.width / 2 - 100, 40);
    
    ctx.fillStyle = '#00f2ff';
    ctx.fillText(`接關: ${gameState.continuesLeft}`, canvas.width / 2 + 100, 40);

    ctx.textAlign = 'right';
    ctx.fillText(`關卡: ${gameState.level}`, canvas.width - 20, 40);
}

function drawStartScreen() {
    const time = Date.now();
    
    // 1. Decorative Grid Background (Subtle)
    ctx.strokeStyle = 'rgba(0, 242, 255, 0.05)';
    ctx.lineWidth = 1;
    for (let i = 0; i < canvas.width; i += 50) {
        ctx.beginPath();
        ctx.moveTo(i, 0);
        ctx.lineTo(i, canvas.height);
        ctx.stroke();
    }
    for (let i = 0; i < canvas.height; i += 50) {
        ctx.beginPath();
        ctx.moveTo(0, i);
        ctx.lineTo(canvas.width, i);
        ctx.stroke();
    }

    // 2. Title Animation (Pulse & Float)
    const yOffset = Math.sin(time / 500) * 15;
    const pulse = Math.abs(Math.sin(time / 1000));
    
    ctx.textAlign = 'center';
    ctx.font = 'bold 80px "Exo 2"';
    ctx.shadowBlur = 10 + pulse * 20;
    ctx.shadowColor = '#00f2ff';
    ctx.fillStyle = '#ffffff';
    ctx.fillText("小蜜蜂 PRO", canvas.width / 2, canvas.height / 2 - 80 + yOffset);
    ctx.shadowBlur = 0;

    // 3. Jet Fly-Through and Return Animation
    const boot = gameState.bootProgress;
    let currentX, currentY, rotation = 0, thruster = true;
    const baseY = canvas.height / 2 + 200;

    if (boot <= 50) {
        // Phase 1: Zoom through from right to left (0% -> 50%)
        const p = boot / 50; // Local progress 0 to 1
        const startX = canvas.width + 200;
        const endX = -200;
        currentX = startX + (endX - startX) * p;
        currentY = baseY - Math.sin(p * Math.PI) * 100; // Slight curve
        rotation = Math.PI; // Face left
    } else {
        // Phase 2: Return from left to center (50% -> 100%)
        const p = (boot - 50) / 50; // Local progress 0 to 1
        const startX = -200;
        const endX = canvas.width / 2;
        // Ease out to stop in the middle
        currentX = startX + (endX - startX) * (1 - Math.pow(1 - p, 2));
        currentY = baseY;
        rotation = 0; // Face right/forward
        if (p > 0.9) thruster = false; // Turn off engine when arriving
    }

    const jetPulse = Math.sin(time / 100) * 2; 

    ctx.save();
    ctx.translate(currentX, currentY + jetPulse);
    ctx.rotate(rotation);
    ctx.font = '60px "Exo 2"';
    ctx.shadowBlur = 15;
    ctx.shadowColor = '#00f2ff';
    ctx.fillText('🚀', 0, 0);
    
    // Thruster effect
    if (thruster) {
        ctx.font = '30px "Exo 2"';
        // Position thruster behind the jet based on direction
        const tx = rotation === 0 ? 50 : -50;
        const ty = 5;
        ctx.fillText('🔥', tx, ty);
    }
    ctx.restore();

    // 4. Simulated Loading Bar
    const barWidth = 400;
    const barHeight = 10;
    const barX = canvas.width / 2 - barWidth / 2;
    const barY = canvas.height / 2 + 100;
    const progress = gameState.bootProgress / 100;

    // Bar Container
    ctx.strokeStyle = '#00f2ff';
    ctx.lineWidth = 2;
    ctx.strokeRect(barX, barY, barWidth, barHeight);
    
    // Progress Fill
    ctx.fillStyle = '#00f2ff';
    ctx.fillRect(barX + 4, barY + 3, Math.max(0, (barWidth - 8) * progress), barHeight - 6);
    
    // Loading Text
    ctx.font = '14px "Exo 2"';
    ctx.fillStyle = progress < 1 ? '#00f2ff' : '#00ff00';
    const statusText = progress < 1 ? `SYSTEM INITIALIZING... ${Math.floor(progress * 100)}%` : "SYSTEM READY - STANDBY FOR COMMAND";
    ctx.fillText(statusText, canvas.width / 2, barY - 10);

    // 5. Start Instruction (Blinking) - Only show if ready
    if (progress >= 1 && Math.floor(time / 600) % 2 === 0) {
        ctx.font = '24px "Exo 2"';
        ctx.fillStyle = '#ffff00';
        ctx.fillText("點擊或按 Enter 開始遊戲", canvas.width / 2, canvas.height / 2 + 40);
    }

    // 6. Subtle CRT Scanline Effect
    ctx.fillStyle = 'rgba(0, 242, 255, 0.02)';
    const scanlinePos = (time / 10) % canvas.height;
    ctx.fillRect(0, scanlinePos, canvas.width, 2);
}

function drawGameOver() {
    ctx.textAlign = 'center';
    ctx.fillStyle = '#ff0000';
    ctx.font = 'bold 100px "Exo 2"'; // Larger and Bold
    ctx.shadowBlur = 20;
    ctx.shadowColor = '#ff0000';
    ctx.fillText("GAME OVER", canvas.width / 2, 150); // Moved down slightly
    ctx.shadowBlur = 0;
    
    // Show Reason - Moved down to 220
    ctx.font = '24px "Exo 2"';
    ctx.fillStyle = '#ffff00';
    let reasonText = "任務失敗";
    if (gameState.gameOverReason === "TIMEOUT") reasonText = "⌛ 時間耗盡 - 速度太慢了！";
    if (gameState.gameOverReason === "INVADED") reasonText = "👾 敵機入侵 - 防線崩潰！";
    if (gameState.gameOverReason === "KILLED") reasonText = "💥 戰機被毀 - 注意閃避子彈！";
    if (gameState.gameOverReason === "COLLISION") reasonText = "🔥 撞機意外 - 保持安全距離！";
    ctx.fillText(reasonText, canvas.width / 2, 220);
    
    // Score - Moved down to 270
    ctx.fillStyle = '#00f2ff';
    ctx.font = '30px "Exo 2"';
    ctx.fillText(`最終分數: ${gameState.score}`, canvas.width / 2, 270);

    if (gameState.continuesLeft > 0) {
        ctx.fillStyle = '#ff3366';
        ctx.font = '40px "Exo 2"';
        ctx.fillText(`按 'Enter' 鍵接關 (剩餘: ${gameState.continuesLeft})`, canvas.width / 2, 360); // Moved down
        
        ctx.fillStyle = '#e0e0e0';
        ctx.font = '20px "Exo 2"';
        ctx.fillText("按 'R' 鍵重新開始", canvas.width / 2, 410); // Moved down
    } else {
        // Highscore title - Moved down
        ctx.fillStyle = '#ffff00';
        ctx.font = '28px "Exo 2"';
        ctx.fillText("🏆 排行榜 🏆", canvas.width / 2, 330);
        
        ctx.fillStyle = '#e0e0e0';
        ctx.font = '20px "Exo 2"';
        ctx.textAlign = 'left';
        
        const startX = canvas.width / 2 - 100;
        let startY = 370; // Adjusted starting Y for leaderboard
        
        gameState.leaderboard.forEach((entry, index) => {
            const name = entry.name || '---';
            const score = entry.score || entry; // Backward compatibility
            ctx.fillText(`${index + 1}. ${name}`, startX, startY + (index * 25));
            ctx.textAlign = 'right';
            ctx.fillText(`${score}`, startX + 200, startY + (index * 25));
            ctx.textAlign = 'left';
        });

        // Fixed position for restart prompt at the bottom
        ctx.textAlign = 'center';
        ctx.fillStyle = '#ff3366';
        ctx.font = 'bold 24px "Exo 2"';
        ctx.fillText("點擊或按 Enter 重新開始", canvas.width / 2, canvas.height - 60);
    }
}

function drawVictory() {
    ctx.textAlign = 'center';
    
    // Animated Rainbow Title
    const hue = (Date.now() / 10) % 360;
    ctx.fillStyle = `hsl(${hue}, 100%, 50%)`;
    ctx.font = '70px "Exo 2"';
    ctx.shadowBlur = 20;
    ctx.shadowColor = `hsl(${hue}, 100%, 50%)`;
    ctx.fillText("🎉 傳奇通關 🎉", canvas.width / 2, 150);
    ctx.shadowBlur = 0;

    // Emotional message
    ctx.fillStyle = '#ffffff';
    ctx.font = '24px "Exo 2"';
    ctx.fillText("你是宇宙的守護者！地球因你而安全。", canvas.width / 2, 210);

    // Score Summary
    ctx.fillStyle = '#ffff00';
    ctx.font = '36px "Exo 2"';
    ctx.fillText(`最終得分: ${gameState.score}`, canvas.width / 2, 270);
    
    ctx.fillStyle = '#00ff00';
    ctx.font = '24px "Exo 2"';
    ctx.fillText(`(包含最後一關時間獎勵: +${gameState.lastTimeBonus})`, canvas.width / 2, 305);

    // High Score Info
    const highScore = gameState.leaderboard.length > 0 ? gameState.leaderboard[0].score : gameState.score;
    ctx.fillStyle = '#00f2ff';
    ctx.font = '20px "Exo 2"';
    ctx.fillText(`世界最高紀錄: ${highScore}`, canvas.width / 2, 320);

    // Confetti Effect
    drawConfetti();

    // Restart Instruction
    const blink = Math.floor(Date.now() / 500) % 2 === 0;
    if (blink) {
        ctx.fillStyle = '#ff3366';
        ctx.font = '28px "Exo 2"';
        ctx.fillText("點擊畫面重新開始傳奇之旅", canvas.width / 2, canvas.height - 100);
    }
}

let confetti = [];
function drawConfetti() {
    if (confetti.length === 0) {
        for (let i = 0; i < 100; i++) {
            confetti.push({
                x: Math.random() * canvas.width,
                y: Math.random() * canvas.height - canvas.height,
                size: Math.random() * 8 + 4,
                color: `hsl(${Math.random() * 360}, 100%, 50%)`,
                speed: Math.random() * 3 + 2,
                angle: Math.random() * 6.28
            });
        }
    }

    confetti.forEach(p => {
        ctx.fillStyle = p.color;
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.angle);
        ctx.fillRect(-p.size/2, -p.size/2, p.size, p.size);
        ctx.restore();
        
        p.y += p.speed;
        p.angle += 0.1;
        if (p.y > canvas.height) p.y = -20;
    });
}

function drawLevelComplete() {
    const timeText = gameState.bonusTimeLeft > 0 ? `剩餘時間結算中... ${gameState.bonusTimeLeft}s` : "結算完成!";
    drawMessage(`關卡 ${gameState.level} 完成!`, `${timeText}\n時間獎勵: +${gameState.lastTimeBonus}`, gameState.bonusTimeLeft > 0 ? "" : "按 'Enter' 進入下一關");
}

function updateFloatingTexts() {
    for (let i = gameState.floatingTexts.length - 1; i >= 0; i--) {
        const ft = gameState.floatingTexts[i];
        ft.y -= 1; // Move up
        ft.life--; // Decay life
        if (ft.life <= 0) {
            gameState.floatingTexts.splice(i, 1);
        }
    }
}

function drawFloatingTexts() {
    gameState.floatingTexts.forEach(ft => {
        ctx.fillStyle = `rgba(255, 255, 0, ${ft.life / 60})`;
        ctx.font = 'bold 24px "Exo 2"';
        ctx.textAlign = 'center';
        ctx.fillText(`+${ft.value}`, ft.x, ft.y);
    });
}

function updateParticles() {
    for (let i = gameState.particles.length - 1; i >= 0; i--) {
        const p = gameState.particles[i];
        p.x += p.vx;
        p.y += p.vy;
        p.alpha -= 0.02;
        p.life--;
        if (p.alpha <= 0 || p.life <= 0) {
            gameState.particles.splice(i, 1);
        }
    }
}

function drawParticles() {
    gameState.particles.forEach(p => {
        ctx.globalAlpha = p.alpha;
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();
    });
    ctx.globalAlpha = 1.0;
}

function createParticles(x, y, color, count = 5) {
    for (let i = 0; i < count; i++) {
        const angle = Math.random() * Math.PI * 2;
        const speed = Math.random() * 3 + 1;
        gameState.particles.push({
            x: x,
            y: y,
            vx: Math.cos(angle) * speed,
            vy: Math.sin(angle) * speed,
            size: Math.random() * 3 + 1,
            color: color,
            alpha: 1.0,
            life: 30 + Math.random() * 20
        });
    }
}


// =================================
//        GAME FLOW & LOOP
// =================================
function addFloatingText(x, y, value) {
    gameState.floatingTexts.push({
        x: x,
        y: y,
        value: value,
        life: 60 // 1 second at 60fps
    });
}

function gameLoop() {
    const now = Date.now();
    let deltaTime = (now - gameState.lastFrameTime) / 1000;
    
    // Cap deltaTime to 100ms (0.1s) to prevent jumps from tab switching/lag
    if (deltaTime > 0.1) deltaTime = 0.016; 
    
    gameState.lastFrameTime = now;

    updateStars();
    updateFloatingTexts();
    updateParticles(); 
    
    if (!gameState.gameStarted) {
        if (gameState.bootProgress < 100) {
            gameState.bootProgress += 0.8; // Takes about 2 seconds
            if (gameState.bootProgress > 100) gameState.bootProgress = 100;
        }
        drawAll();
        requestAnimationFrame(gameLoop);
        return;
    }
    
    // Score easing (run even when levelComplete is true)
    if (gameState.visualScore < gameState.score) {
        const diff = gameState.score - gameState.visualScore;
        gameState.visualScore += Math.max(1, Math.ceil(diff * 0.1));
    }

    // Bonus Calculation Animation
    if (gameState.isCalculatingBonus && gameState.bonusTimeLeft > 0) {
        // Process up to 2 seconds of bonus time per frame for speed
        const amount = Math.min(gameState.bonusTimeLeft, 2); 
        
        // Tiered Bonus Calculation (Dynamic Rate)
        let rate = 1;
        if (gameState.bonusTimeLeft > 120) rate = 5;
        else if (gameState.bonusTimeLeft > 60) rate = 3;
        else rate = 1;

        gameState.bonusTimeLeft -= amount;
        const bonusAmount = amount * rate;
        gameState.score += bonusAmount;
        gameState.lastTimeBonus += bonusAmount;
        
        if (Math.floor(Date.now() / 50) % 2 === 0) { // Throttle sound
            soundManager.playScoreTick();
        }

        if (gameState.bonusTimeLeft <= 0) {
            gameState.isCalculatingBonus = false;
            addFloatingText(canvas.width / 2, canvas.height / 2, gameState.lastTimeBonus);
        }
    }

    if (!gameState.isGameOver && !gameState.levelComplete && !gameState.isPaused) {
        gameState.timeRemaining -= deltaTime;
        if (gameState.timeRemaining <= 0) {
            gameState.timeRemaining = 0;
            endGame("TIMEOUT");
        }

        updatePlayer();
        updateBullets();
        updateEnemies();
        checkCollisions();
    }
    
    drawAll();
    
    // Level up condition: no enemies AND no boss
    if (gameState.enemies.length === 0 && !gameState.boss && !gameState.isGameOver && !gameState.levelComplete) {
        levelUp();
    }
    
    requestAnimationFrame(gameLoop);
}

function startGame() {
    clearSavedGame();
    gameState.gameStarted = true;
    gameState.isGameOver = false;
    gameState.gameWon = false;
    gameState.levelComplete = false;
    confetti = [];
    gameState.score = 0;
    gameState.visualScore = 0;
    gameState.floatingTexts = [];
    gameState.level = 1;
    gameState.continuesLeft = 3;
    gameState.timeRemaining = 180;
    gameState.lastFrameTime = Date.now();
    resetPlayer();
    createEnemies();
    soundManager.playBGM(gameState.level);
}

function continueGame() {
    gameState.continuesLeft--;
    gameState.isGameOver = false;
    soundManager.playBGM(gameState.level);
    
    // Grant temporary invulnerability (5 seconds)
    gameState.player.invulnerableUntil = Date.now() + 5000;
    
    if (gameState.gameOverReason === "TIMEOUT") {
        gameState.timeRemaining = 60;
    } else {
        gameState.timeRemaining = gameState.savedTimeRemaining || 60;
    }
    
    gameState.lastFrameTime = Date.now();
    
    // Reset enemy positions to top
    if (gameState.boss) {
        gameState.boss.y = 80;
    }
    
    // Calculate vertical offset to move them back
    if (gameState.enemies.length > 0) {
        let minY = Math.min(...gameState.enemies.map(e => e.y));
        let offset = minY - 60; // Standard top offset
        gameState.enemies.forEach(enemy => {
            enemy.y -= offset;
        });
    }
    
    // Clear bullets
    gameState.bullets = [];
    gameState.enemyBullets = [];
    
    saveGameState();
}

function endGame(reason = "KILLED") {
    gameState.isGameOver = true;
    gameState.gameOverReason = reason;
    gameState.savedTimeRemaining = gameState.timeRemaining; // Save time for continue
    soundManager.stopBGM();
    soundManager.playExplosion();
    saveGameState();
    
    if (gameState.continuesLeft === 0) {
        clearSavedGame();
        checkHighscore();
    }
}

function checkHighscore() {
    // Only prompt for highscore if score > 0
    if (gameState.score <= 0) return;

    const leaderboard = gameState.leaderboard;
    const isFull = leaderboard.length >= 10;
    
    let minScore = 0;
    if (isFull) {
        const lastEntry = leaderboard[leaderboard.length - 1];
        minScore = (lastEntry && typeof lastEntry === 'object') ? lastEntry.score : lastEntry;
    }

    if (!isFull || gameState.score >= minScore) {
        // Show Input
        const inputContainer = document.getElementById('nameInputContainer');
        const inputField = document.getElementById('playerNameInput');
        if (inputContainer && inputField) {
            inputContainer.classList.remove('hidden');
            inputField.value = '';
            inputField.focus();
        }
    }
}

function submitScore() {
    const inputContainer = document.getElementById('nameInputContainer');
    const inputField = document.getElementById('playerNameInput');
    const name = inputField.value.trim() || 'ANON';
    
    gameState.leaderboard.push({ name: name, score: gameState.score });
    sortLeaderboard();
    gameState.leaderboard = gameState.leaderboard.slice(0, 10);
    localStorage.setItem('spaceInvadersLeaderboardV2', JSON.stringify(gameState.leaderboard));
    
    inputContainer.classList.add('hidden');
    drawAll();
}

function saveScore(score) {
    // Deprecated
}

function levelUp() {
    // 實體與狀態清除 (Entity and State Clear)
    gameState.bullets = [];
    gameState.enemyBullets = [];
    gameState.floatingTexts = [];
    movement.left = false;
    movement.right = false;

    gameState.isCalculatingBonus = true;
    gameState.bonusTimeLeft = Math.floor(gameState.timeRemaining);
    gameState.lastTimeBonus = 0; // Reset for calculation

    if (gameState.level < Object.keys(levelConfig).length) {
        gameState.levelComplete = true;
    } else {
        gameState.isGameOver = true;
        gameState.gameWon = true;
        soundManager.playVictoryFanfare();
        soundManager.playAchievement();
        checkHighscore();
    }
}

function nextLevel() {
    gameState.level++;
    gameState.levelComplete = false;
    gameState.timeRemaining = 180;
    gameState.lastFrameTime = Date.now();
    resetPlayer();
    createEnemies();
    soundManager.playBGM(gameState.level);
}

function resetPlayer() {
    gameState.player.x = canvas.width / 2 - 25;
    gameState.player.y = canvas.height - 70;
    gameState.bullets = [];
    gameState.enemyBullets = [];
}


// =================================
//        EVENT LISTENERS
// =================================
document.addEventListener('keydown', (e) => {
    if (isInMenu) return;

    // If the player is typing their name, ignore game controls
    const inputContainer = document.getElementById('nameInputContainer');
    const isInputActive = inputContainer && !inputContainer.classList.contains('hidden');
    
    if (isInputActive) {
        if (e.code === 'Enter') {
            submitScore();
        }
        return; // Don't process game controls
    }

    if (audioCtx.state === 'suspended') audioCtx.resume();
    
    // Prevent default browser behavior for game keys
    const gameKeys = ['ArrowLeft', 'ArrowRight', 'Space', 'Enter', 'KeyP', 'KeyC', 'KeyR'];
    if (gameKeys.includes(e.code)) {
        e.preventDefault();
    }

    if (e.code === 'ArrowLeft') movement.left = true;
    if (e.code === 'ArrowRight') movement.right = true;
    if (e.code === 'Space') shoot();
    if (e.code === 'Enter') {
        if (!gameState.gameStarted) {
            startGame();
        } else if (gameState.levelComplete) {
            nextLevel();
        } else if (gameState.isGameOver && gameState.continuesLeft > 0 && !gameState.gameWon) {
            continueGame();
        } else if (gameState.gameWon || (gameState.isGameOver && gameState.continuesLeft === 0)) {
            startGame();
        }
    }
    if (e.code === 'KeyP' && gameState.gameStarted && !gameState.isGameOver && !gameState.levelComplete && !gameState.isCalculatingBonus) {
        gameState.isPaused = !gameState.isPaused;
        if (gameState.isPaused) {
            soundManager.stopBGM();
        } else {
            soundManager.playBGM(gameState.level);
        }
    }
    if (e.code === 'KeyR' && gameState.isGameOver && gameState.continuesLeft > 0) {
        startGame();
    }
});

document.addEventListener('keyup', (e) => {
    if (e.code === 'ArrowLeft') movement.left = false;
    if (e.code === 'ArrowRight') movement.right = false;
});

canvas.addEventListener('click', () => {
    if (isInMenu) return;
    const inputContainer = document.getElementById('nameInputContainer');
    if (inputContainer && !inputContainer.classList.contains('hidden')) return;

    if (audioCtx.state === 'suspended') audioCtx.resume();
    if (!gameState.gameStarted) {
        startGame();
    } else if (gameState.gameWon) {
        startGame();
    } else if (gameState.isGameOver && gameState.continuesLeft === 0) {
        startGame();
    }
});

document.getElementById('submitScoreBtn').addEventListener('click', submitScore);


// =================================
//        INITIALIZE GAME
// =================================
sortLeaderboard();
soundManager.init();
initStars();
gameLoop();

// =================================
//        MENU SYSTEM
// =================================
window.selectGame = function(gameId) {
    if (gameId === 'space-invaders') {
        document.getElementById('mainMenu').classList.add('hidden');
        document.getElementById('gameWrapper').classList.remove('hidden');
        isInMenu = false;
        // Ensure game is in start screen mode
        gameState.gameStarted = false;
    }
};

window.backToMenu = function() {
    document.getElementById('mainMenu').classList.remove('hidden');
    document.getElementById('gameWrapper').classList.add('hidden');
    isInMenu = true;
    soundManager.stopBGM();
    gameState.gameStarted = false;
    gameState.isGameOver = false;
    // Reset player position for next time
    resetPlayer();
};
