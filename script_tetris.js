/**
 * TETRIS PRO - Robust Game Logic
 */

// --- Configuration ---
const COLS = 10;
const ROWS = 24;
const BLOCK_SIZE = 32;

const COLORS = {
    I: '#00f2ff', J: '#0077ff', L: '#ffaa00',
    O: '#ffff00', S: '#00ff00', T: '#bf00ff', Z: '#ff0000',
    GHOST: '#aaaaaa'
};

const EMOJIS = {
    I: '💎', J: '🔵', L: '🟠', O: '🟡', S: '🟢', T: '🟣', Z: '🔴'
};

const SHAPES = {
    I: [[0,0,0,0],[1,1,1,1],[0,0,0,0],[0,0,0,0]],
    J: [[1,0,0],[1,1,1],[0,0,0]],
    L: [[0,0,1],[1,1,1],[0,0,0]],
    O: [[1,1],[1,1]],
    S: [[0,1,1],[1,1,0],[0,0,0]],
    T: [[0,1,0],[1,1,1],[0,0,0]],
    Z: [[1,1,0],[0,1,1],[0,0,0]]
};

// --- Game State ---
let canvas, ctx, nextCanvas, nextCtx;
let grid = Array.from({ length: ROWS }, () => Array(COLS).fill(0));
let score = 0, level = 1, lines = 0;
let gameOver = false, paused = false, gameStarted = false;
let dropCounter = 0, dropInterval = 1000, lastTime = 0;
let particles = [];
let screenShake = 0;

let player = {
    pos: { x: 0, y: 0 },
    shape: null,
    type: null,
    next: null
};

// --- Audio ---
const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
let isBGMMuted = true;

function playSound(type) {
    if (audioCtx.state === 'suspended') audioCtx.resume();
    const now = audioCtx.currentTime;
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    
    if (type === 'move') { osc.type = 'sine'; osc.frequency.setValueAtTime(440, now); gain.gain.setValueAtTime(0.02, now); }
    else if (type === 'rotate') { osc.type = 'triangle'; osc.frequency.setValueAtTime(660, now); gain.gain.setValueAtTime(0.02, now); }
    else if (type === 'drop') { osc.type = 'square'; osc.frequency.setValueAtTime(110, now); gain.gain.setValueAtTime(0.05, now); }
    else if (type === 'clear') { osc.type = 'sine'; osc.frequency.setValueAtTime(880, now); gain.gain.setValueAtTime(0.05, now); }

    osc.start();
    osc.stop(now + 0.1);
}

function togglePause() {
    if (!gameStarted || gameOver) return;
    paused = !paused;
    const pauseScreen = document.getElementById('pauseScreen');
    
    if (paused) {
        pauseScreen.classList.remove('hidden');
    } else {
        pauseScreen.classList.add('hidden');
    }
}

// --- Initialization ---
function init() {
    canvas = document.getElementById('gameCanvas');
    ctx = canvas.getContext('2d');
    nextCanvas = document.getElementById('nextCanvas');
    nextCtx = nextCanvas.getContext('2d');

    document.getElementById('startBtn').addEventListener('click', startGame);
    document.getElementById('restartBtn').addEventListener('click', startGame);
    document.getElementById('resumeBtn').addEventListener('click', togglePause);
    
    // Toggle pause on canvas click
    canvas.addEventListener('click', togglePause);

    document.getElementById('bgmBtn').addEventListener('click', () => {
        // Simple toggle for placeholder BGM
        const btn = document.getElementById('bgmBtn');
        isBGMMuted = !isBGMMuted;
        btn.textContent = isBGMMuted ? "🔇 音樂: 關" : "🎵 音樂: 開";
    });

    document.addEventListener('keydown', handleKeyPress);
    initMobileControls();
    draw(); // Draw initial empty grid
}

function startGame() {
    grid = Array.from({ length: ROWS }, () => Array(COLS).fill(0));
    score = 0; level = 1; lines = 0;
    dropInterval = 1000;
    gameOver = false; paused = false; gameStarted = true;

    document.getElementById('startScreen').classList.add('hidden');
    document.getElementById('gameOverScreen').classList.add('hidden');
    document.getElementById('pauseScreen').classList.add('hidden');

    playerReset();
    updateStats();
    requestAnimationFrame(update);
}

function playerReset() {
    const types = 'IJLOSTZ';
    player.type = player.next || types[Math.floor(Math.random() * types.length)];
    player.next = types[Math.floor(Math.random() * types.length)];
    
    // Deep copy the shape to avoid mutating SHAPES constant
    player.shape = SHAPES[player.type].map(row => [...row]);
    
    player.pos.y = 0;
    player.pos.x = Math.floor(COLS / 2) - Math.floor(player.shape[0].length / 2);

    if (collide(grid, player)) {
        gameOver = true;
        gameStarted = false;
        document.getElementById('finalScore').textContent = score;
        document.getElementById('gameOverScreen').classList.remove('hidden');
    }
    drawNext();
}

function collide(grid, player) {
    const [m, o] = [player.shape, player.pos];
    for (let y = 0; y < m.length; ++y) {
        for (let x = 0; x < m[y].length; ++x) {
            if (m[y][x] !== 0) {
                const gridY = y + o.y;
                const gridX = x + o.x;
                // Wall and Floor collision
                if (gridX < 0 || gridX >= COLS || gridY >= ROWS) return true;
                // Pieces collision (only if gridY is within bounds)
                if (gridY >= 0 && grid[gridY][gridX] !== 0) return true;
            }
        }
    }
    return false;
}

function merge(grid, player) {
    player.shape.forEach((row, y) => {
        row.forEach((value, x) => {
            if (value !== 0) {
                const targetY = y + player.pos.y;
                if (targetY >= 0) grid[targetY][x + player.pos.x] = player.type;
            }
        });
    });
}

function rotateMatrix(matrix) {
    // Transpose and reverse rows for 90deg rotation
    for (let y = 0; y < matrix.length; ++y) {
        for (let x = 0; x < y; ++x) {
            [matrix[x][y], matrix[y][x]] = [matrix[y][x], matrix[x][y]];
        }
    }
    matrix.forEach(row => row.reverse());
}

function playerRotate() {
    const pos = player.pos.x;
    let offset = 1;
    const oldShape = player.shape.map(row => [...row]);
    rotateMatrix(player.shape);
    
    // Wall kick
    while (collide(grid, player)) {
        player.pos.x += offset;
        offset = -(offset + (offset > 0 ? 1 : -1));
        if (offset > player.shape[0].length) {
            player.shape = oldShape;
            player.pos.x = pos;
            return;
        }
    }
    playSound('rotate');
}

function playerDrop() {
    player.pos.y++;
    if (collide(grid, player)) {
        player.pos.y--;
        merge(grid, player);
        playerReset();
        gridSweep();
        updateStats();
    }
    dropCounter = 0;
}

function playerHardDrop() {
    if (!gameStarted || paused || gameOver) return;
    while (!collide(grid, player)) {
        player.pos.y++;
        score += 2;
    }
    player.pos.y--;
    merge(grid, player);
    playerReset();
    gridSweep();
    updateStats();
    playSound('drop');
}

// --- Effects ---
function createParticles(x, y, color) {
    for (let i = 0; i < 8; i++) {
        particles.push({
            x: x + BLOCK_SIZE / 2,
            y: y + BLOCK_SIZE / 2,
            vx: (Math.random() - 0.5) * 10,
            vy: (Math.random() - 0.5) * 10,
            size: Math.random() * 4 + 2,
            color: color,
            alpha: 1,
            life: 0.95 + Math.random() * 0.05
        });
    }
}

function updateParticles() {
    for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        p.x += p.vx;
        p.y += p.vy;
        p.alpha *= p.life;
        if (p.alpha < 0.01) particles.splice(i, 1);
    }
}

function drawParticles() {
    particles.forEach(p => {
        ctx.save();
        ctx.globalAlpha = p.alpha;
        ctx.fillStyle = p.color;
        ctx.shadowBlur = 5;
        ctx.shadowColor = p.color;
        ctx.fillRect(p.x, p.y, p.size, p.size);
        ctx.restore();
    });
}

function triggerShake(intensity = 10) {
    screenShake = intensity;
}

function gridSweep() {
    let rowCount = 1;
    let clearedAny = false;
    let clearedLinesCount = 0;

    // First pass: identify and remove full rows
    for (let y = ROWS - 1; y >= 0; --y) {
        if (grid[y].every(value => value !== 0)) {
            // Create particles
            grid[y].forEach((type, x) => {
                const color = COLORS[type] || '#fff';
                createParticles(x * BLOCK_SIZE, y * BLOCK_SIZE, color);
            });

            grid.splice(y, 1);
            grid.unshift(Array(COLS).fill(0));
            y++; // Check the new row at this position
            
            clearedLinesCount++;
            clearedAny = true;
            score += rowCount * 100;
            rowCount *= 2;
            lines++;
            
            if (lines % 10 === 0) {
                level++;
                dropInterval = Math.max(100, 1000 - (level - 1) * 100);
            }
            playSound('clear');
        }
    }

    // Second pass: CASCADE GRAVITY (Avalanche)
    // If lines were cleared, we let blocks fall independently into gaps
    if (clearedAny) {
        for (let x = 0; x < COLS; x++) {
            let columnBlocks = [];
            // Extract all blocks from this column
            for (let y = 0; y < ROWS; y++) {
                if (grid[y][x] !== 0) {
                    columnBlocks.push(grid[y][x]);
                    grid[y][x] = 0; // Clear it
                }
            }
            // Put them back from the bottom up
            for (let i = 0; i < columnBlocks.length; i++) {
                grid[ROWS - 1 - i][x] = columnBlocks[columnBlocks.length - 1 - i];
            }
        }
        triggerShake(15);
    }
}

function updateStats() {
    const scoreEl = document.getElementById('scoreDisplay');
    const levelEl = document.getElementById('levelDisplay');
    const linesEl = document.getElementById('linesDisplay');
    
    if (scoreEl) scoreEl.textContent = score;
    if (levelEl) levelEl.textContent = level;
    if (linesEl) linesEl.textContent = lines;
}

function handleKeyPress(e) {
    if (!gameStarted || gameOver) {
        if (e.code === 'Enter') startGame();
        return;
    }
    if (e.code === 'KeyP') togglePause();
    if (paused) return;

    if (e.code === 'ArrowLeft') player.pos.x--, collide(grid, player) && player.pos.x++, playSound('move');
    if (e.code === 'ArrowRight') player.pos.x++, collide(grid, player) && player.pos.x--, playSound('move');
    if (e.code === 'ArrowDown') playerDrop();
    if (e.code === 'ArrowUp') playerRotate();
    if (e.code === 'Space') playerHardDrop();
}

// --- Drawing ---
function draw() {
    ctx.save();
    if (screenShake > 0) {
        const sx = (Math.random() - 0.5) * screenShake;
        const sy = (Math.random() - 0.5) * screenShake;
        ctx.translate(sx, sy);
        screenShake *= 0.9;
        if (screenShake < 0.5) screenShake = 0;
    }

    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Draw grid lines
    ctx.strokeStyle = 'rgba(0, 242, 255, 0.1)';
    for(let x=0; x<=COLS; x++) { ctx.beginPath(); ctx.moveTo(x*BLOCK_SIZE,0); ctx.lineTo(x*BLOCK_SIZE,canvas.height); ctx.stroke(); }
    for(let y=0; y<=ROWS; y++) { ctx.beginPath(); ctx.moveTo(0,y*BLOCK_SIZE); ctx.lineTo(canvas.width,y*BLOCK_SIZE); ctx.stroke(); }

    drawMatrix(grid, { x: 0, y: 0 });
    if (gameStarted && player.shape) {
        drawGhost();
        drawMatrix(player.shape, player.pos, player.type);
    }
    
    drawParticles();
    ctx.restore();
}

function drawMatrix(matrix, offset, forcedType = null) {
    matrix.forEach((row, y) => {
        row.forEach((value, x) => {
            if (value !== 0) {
                const type = forcedType || value;
                const baseColor = COLORS[type] || '#fff';
                const drawX = (x + offset.x) * BLOCK_SIZE;
                const drawY = (y + offset.y) * BLOCK_SIZE;
                
                ctx.save();
                
                // 1. Neon Shadow Glow
                ctx.shadowBlur = 12;
                ctx.shadowColor = baseColor;
                
                // 2. Metallic Gradient Background
                const gradient = ctx.createLinearGradient(drawX, drawY, drawX + BLOCK_SIZE, drawY + BLOCK_SIZE);
                gradient.addColorStop(0, '#fff'); // Light highlight
                gradient.addColorStop(0.2, baseColor);
                gradient.addColorStop(0.5, baseColor);
                gradient.addColorStop(0.8, '#000'); // Shadow
                gradient.addColorStop(1, baseColor);
                
                ctx.fillStyle = gradient;
                ctx.fillRect(drawX + 1, drawY + 1, BLOCK_SIZE - 2, BLOCK_SIZE - 2);
                
                // 3. Bevel Effect (Inner Border)
                ctx.lineWidth = 2;
                ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
                ctx.strokeRect(drawX + 2, drawY + 2, BLOCK_SIZE - 4, BLOCK_SIZE - 4);
                
                ctx.strokeStyle = 'rgba(0, 0, 0, 0.3)';
                ctx.strokeRect(drawX + 4, drawY + 4, BLOCK_SIZE - 8, BLOCK_SIZE - 8);

                ctx.restore();
            }
        });
    });
}

function drawGhost() {
    if (!player.shape) return;
    const ghost = { pos: { x: player.pos.x, y: player.pos.y }, shape: player.shape };
    while (!collide(grid, ghost)) ghost.pos.y++;
    ghost.pos.y--;
    ctx.save();
    ctx.globalAlpha = 0.15; // Decreased for very faint hint
    drawMatrix(ghost.shape, ghost.pos, 'GHOST');
    ctx.restore();
}

function drawNext() {
    if (!nextCtx) return;
    nextCtx.fillStyle = '#000';
    nextCtx.fillRect(0, 0, nextCanvas.width, nextCanvas.height);
    if (player.next) {
        const shape = SHAPES[player.next];
        const bSize = 14; // Smaller preview size
        const offX = (nextCanvas.width - shape[0].length * bSize) / 2;
        const offY = (nextCanvas.height - shape.length * bSize) / 2;
        shape.forEach((row, y) => {
            row.forEach((value, x) => {
                if (value !== 0) {
                    const type = player.next;
                    const baseColor = COLORS[type] || '#fff';
                    const dx = offX + x * bSize;
                    const dy = offY + y * bSize;
                    
                    nextCtx.save();
                    
                    // Metallic Gradient
                    const gradient = nextCtx.createLinearGradient(dx, dy, dx + bSize, dy + bSize);
                    gradient.addColorStop(0, '#fff'); // Light highlight
                    gradient.addColorStop(0.2, baseColor);
                    gradient.addColorStop(0.5, baseColor);
                    gradient.addColorStop(0.8, '#000'); // Shadow
                    gradient.addColorStop(1, baseColor);
                    
                    nextCtx.fillStyle = gradient;
                    nextCtx.shadowBlur = 5;
                    nextCtx.shadowColor = baseColor;
                    nextCtx.fillRect(dx + 1, dy + 1, bSize - 2, bSize - 2);
                    
                    // Bevel Effect (Inner Border)
                    nextCtx.lineWidth = 1;
                    nextCtx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
                    nextCtx.strokeRect(dx + 1, dy + 1, bSize - 2, bSize - 2);
                    
                    nextCtx.restore();
                }
            });
        });
    }
}

function update(time = 0) {
    const deltaTime = time - lastTime;
    lastTime = time;

    updateParticles();

    if (gameStarted && !paused && !gameOver) {
        dropCounter += deltaTime;
        if (dropCounter > dropInterval) playerDrop();
        draw();
    } else {
        // Still need to draw if paused to show pause screen overlay or stationary grid
        draw();
    }
    requestAnimationFrame(update);
}

// --- Mobile Controls ---
function initMobileControls() {
    const isTouch = ('ontouchstart' in window) || (navigator.maxTouchPoints > 0);
    
    // Always show controls on touch devices
    const controls = document.getElementById('mobileControls');
    if (isTouch && controls) {
        controls.classList.remove('hidden');
    } else if (!isTouch) {
        return;
    }

    const bind = (id, fn) => {
        const el = document.getElementById(id);
        if (!el) return;
        el.addEventListener('touchstart', (e) => {
            e.preventDefault();
            if (gameStarted && !paused && !gameOver) fn();
        }, { passive: false });
    };

    bind('moveLeftBtn', () => { player.pos.x--; if(collide(grid, player)) player.pos.x++; playSound('move'); });
    bind('moveRightBtn', () => { player.pos.x++; if(collide(grid, player)) player.pos.x--; playSound('move'); });
    bind('rotateBtn', playerRotate);
    bind('hardDropBtn', playerHardDrop);
}

init();
