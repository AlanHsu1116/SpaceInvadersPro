/**
 * TETRIS PRO - Game Logic
 * Retro-Futuristic Aesthetic with Emoji Sprites
 */

// --- Configuration & Constants ---
const COLS = 10;
const ROWS = 20;
const BLOCK_SIZE = 30;

const COLORS = {
    I: '#00f2ff', // Cyan
    J: '#0077ff', // Blue
    L: '#ffaa00', // Orange
    O: '#ffff00', // Yellow
    S: '#00ff00', // Green
    T: '#bf00ff', // Purple
    Z: '#ff0000'  // Red
};

const EMOJIS = {
    I: '💎',
    J: '🔵',
    L: '🟠',
    O: '🟡',
    S: '🟢',
    T: '🟣',
    Z: '🔴'
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
let score = 0;
let level = 1;
let lines = 0;
let gameOver = false;
let paused = false;
let gameStarted = false;
let dropCounter = 0;
let dropInterval = 1000;
let lastTime = 0;

let player = {
    pos: { x: 0, y: 0 },
    shape: null,
    type: null,
    next: null
};

// --- Audio ---
const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
const bgm = document.getElementById('bgm');
let isBGMMuted = true;

function toggleBGM() {
    isBGMMuted = !isBGMMuted;
    const btn = document.getElementById('bgmBtn');
    btn.textContent = isBGMMuted ? "🔇 音樂: 關" : "🎵 音樂: 開";
    
    if (isBGMMuted) {
        bgm.pause();
    } else if (gameStarted && !gameOver && !paused) {
        bgm.play();
    }
}

function playSound(type) {
    if (audioCtx.state === 'suspended') audioCtx.resume();
    const now = audioCtx.currentTime;
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    
    if (type === 'move') {
        osc.type = 'sine';
        osc.frequency.setValueAtTime(440, now);
        osc.frequency.exponentialRampToValueAtTime(220, now + 0.05);
        gain.gain.setValueAtTime(0.05, now);
    } else if (type === 'rotate') {
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(660, now);
        osc.frequency.exponentialRampToValueAtTime(880, now + 0.05);
        gain.gain.setValueAtTime(0.05, now);
    } else if (type === 'drop') {
        osc.type = 'square';
        osc.frequency.setValueAtTime(110, now);
        osc.frequency.exponentialRampToValueAtTime(55, now + 0.1);
        gain.gain.setValueAtTime(0.1, now);
    } else if (type === 'clear') {
        osc.type = 'sine';
        osc.frequency.setValueAtTime(880, now);
        osc.frequency.exponentialRampToValueAtTime(1760, now + 0.2);
        gain.gain.setValueAtTime(0.1, now);
    }

    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.start();
    osc.stop(now + 0.2);
}

// --- Initialization ---
function init() {
    canvas = document.getElementById('gameCanvas');
    ctx = canvas.getContext('2d');
    nextCanvas = document.getElementById('nextCanvas');
    nextCtx = nextCanvas.getContext('2d');

    document.getElementById('startBtn').addEventListener('click', startGame);
    document.getElementById('restartBtn').addEventListener('click', startGame);
    document.getElementById('resumeBtn').addEventListener('click', resumeGame);
    document.getElementById('bgmBtn').addEventListener('click', toggleBGM);

    document.addEventListener('keydown', handleKeyPress);

    // Initial draw
    draw();
}

function startGame() {
    grid = Array.from({ length: ROWS }, () => Array(COLS).fill(0));
    score = 0;
    level = 1;
    lines = 0;
    dropInterval = 1000;
    gameOver = false;
    paused = false;
    gameStarted = true;

    document.getElementById('startScreen').classList.add('hidden');
    document.getElementById('gameOverScreen').classList.add('hidden');
    document.getElementById('pauseScreen').classList.add('hidden');

    playerReset();
    updateStats();
    
    if (!isBGMMuted) bgm.play();
    
    requestAnimationFrame(update);
}

function resumeGame() {
    paused = false;
    document.getElementById('pauseScreen').classList.add('hidden');
    if (!isBGMMuted) bgm.play();
}

function playerReset() {
    const types = 'IJLOSTZ';
    if (!player.next) {
        player.type = types[Math.floor(Math.random() * types.length)];
        player.shape = SHAPES[player.type];
    } else {
        player.type = player.next;
        player.shape = SHAPES[player.type];
    }
    
    player.next = types[Math.floor(Math.random() * types.length)];
    player.pos.y = 0;
    player.pos.x = Math.floor(COLS / 2) - Math.floor(player.shape[0].length / 2);

    if (collide(grid, player)) {
        endGame();
    }
    
    drawNext();
}

function endGame() {
    gameOver = true;
    gameStarted = false;
    bgm.pause();
    bgm.currentTime = 0;
    document.getElementById('finalScore').textContent = score;
    document.getElementById('finalLevel').textContent = level;
    document.getElementById('finalLines').textContent = lines;
    document.getElementById('gameOverScreen').classList.remove('hidden');
}

// --- Logic ---
function collide(grid, player) {
    const [m, o] = [player.shape, player.pos];
    for (let y = 0; y < m.length; ++y) {
        for (let x = 0; x < m[y].length; ++x) {
            if (m[y][x] !== 0 &&
               (grid[y + o.y] && grid[y + o.y][x + o.x]) !== 0) {
                return true;
            }
        }
    }
    return false;
}

function merge(grid, player) {
    player.shape.forEach((row, y) => {
        row.forEach((value, x) => {
            if (value !== 0) {
                grid[y + player.pos.y][x + player.pos.x] = player.type;
            }
        });
    });
}

function rotate(matrix, dir) {
    for (let y = 0; y < matrix.length; ++y) {
        for (let x = 0; x < y; ++x) {
            [
                matrix[x][y],
                matrix[y][x],
            ] = [
                matrix[y][x],
                matrix[x][y],
            ];
        }
    }
    if (dir > 0) {
        matrix.forEach(row => row.reverse());
    } else {
        matrix.reverse();
    }
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
    while (!collide(grid, player)) {
        player.pos.y++;
        score += 2; // Extra points for hard drop
    }
    player.pos.y--;
    merge(grid, player);
    playerReset();
    gridSweep();
    updateStats();
    playSound('drop');
}

function playerMove(dir) {
    player.pos.x += dir;
    if (collide(grid, player)) {
        player.pos.x -= dir;
    } else {
        playSound('move');
    }
}

function playerRotate(dir) {
    const pos = player.pos.x;
    let offset = 1;
    rotate(player.shape, dir);
    while (collide(grid, player)) {
        player.pos.x += offset;
        offset = -(offset + (offset > 0 ? 1 : -1));
        if (offset > player.shape[0].length) {
            rotate(player.shape, -dir);
            player.pos.x = pos;
            return;
        }
    }
    playSound('rotate');
}

function gridSweep() {
    let rowCount = 1;
    outer: for (let y = ROWS - 1; y > 0; --y) {
        for (let x = 0; x < COLS; ++x) {
            if (grid[y][x] === 0) {
                continue outer;
            }
        }
        const row = grid.splice(y, 1)[0].fill(0);
        grid.unshift(row);
        ++y;

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

function updateStats() {
    document.getElementById('scoreDisplay').textContent = score;
    document.getElementById('levelDisplay').textContent = level;
    document.getElementById('linesDisplay').textContent = lines;
}

function handleKeyPress(e) {
    if (!gameStarted || gameOver) return;

    if (audioCtx.state === 'suspended') audioCtx.resume();

    if (e.code === 'KeyP') { // P
        paused = !paused;
        if (paused) {
            document.getElementById('pauseScreen').classList.remove('hidden');
            bgm.pause();
        } else {
            resumeGame();
        }
    }

    if (paused) return;

    if (e.code === 'ArrowLeft') { // Left
        playerMove(-1);
    } else if (e.code === 'ArrowRight') { // Right
        playerMove(1);
    } else if (e.code === 'ArrowDown') { // Down
        playerDrop();
    } else if (e.code === 'ArrowUp') { // Up
        playerRotate(1);
    } else if (e.code === 'Space') { // Space
        playerHardDrop();
    }
}

// --- Drawing ---
function draw() {
    // Clear Canvas
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Draw Grid (Subtle)
    ctx.strokeStyle = 'rgba(0, 242, 255, 0.1)';
    ctx.lineWidth = 1;
    for (let x = 0; x <= COLS; x++) {
        ctx.beginPath();
        ctx.moveTo(x * BLOCK_SIZE, 0);
        ctx.lineTo(x * BLOCK_SIZE, canvas.height);
        ctx.stroke();
    }
    for (let y = 0; y <= ROWS; y++) {
        ctx.beginPath();
        ctx.moveTo(0, y * BLOCK_SIZE);
        ctx.lineTo(canvas.width, y * BLOCK_SIZE);
        ctx.stroke();
    }

    drawMatrix(grid, { x: 0, y: 0 });
    if (gameStarted) {
        drawMatrix(player.shape, player.pos);
        drawGhost();
    }
}

function drawMatrix(matrix, offset) {
    matrix.forEach((row, y) => {
        row.forEach((value, x) => {
            if (value !== 0) {
                const type = value.length > 1 ? value : value; // value is type string or 0
                const char = EMOJIS[value] || '🧱';
                
                ctx.font = `${BLOCK_SIZE - 4}px "Exo 2"`;
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.fillText(char, (x + offset.x) * BLOCK_SIZE + BLOCK_SIZE/2, (y + offset.y) * BLOCK_SIZE + BLOCK_SIZE/2);
                
                // Neon glow
                ctx.shadowBlur = 10;
                ctx.shadowColor = COLORS[value];
            }
        });
    });
    ctx.shadowBlur = 0;
}

function drawGhost() {
    const ghost = {
        pos: { x: player.pos.x, y: player.pos.y },
        shape: player.shape
    };
    
    while (!collide(grid, ghost)) {
        ghost.pos.y++;
    }
    ghost.pos.y--;
    
    ctx.globalAlpha = 0.2;
    drawMatrix(ghost.shape, ghost.pos);
    ctx.globalAlpha = 1.0;
}

function drawNext() {
    nextCtx.fillStyle = '#000';
    nextCtx.fillRect(0, 0, nextCanvas.width, nextCanvas.height);
    
    if (player.next) {
        const shape = SHAPES[player.next];
        const char = EMOJIS[player.next];
        const offset = {
            x: (nextCanvas.width / BLOCK_SIZE - shape[0].length) / 2,
            y: (nextCanvas.height / BLOCK_SIZE - shape.length) / 2
        };
        
        shape.forEach((row, y) => {
            row.forEach((value, x) => {
                if (value !== 0) {
                    nextCtx.font = `${BLOCK_SIZE - 4}px "Exo 2"`;
                    nextCtx.textAlign = 'center';
                    nextCtx.textBaseline = 'middle';
                    nextCtx.fillText(char, (x + offset.x) * BLOCK_SIZE + BLOCK_SIZE/2, (y + offset.y) * BLOCK_SIZE + BLOCK_SIZE/2);
                }
            });
        });
    }
}

function update(time = 0) {
    if (!gameStarted || paused || gameOver) return;

    const deltaTime = time - lastTime;
    lastTime = time;

    dropCounter += deltaTime;
    if (dropCounter > dropInterval) {
        playerDrop();
    }

    draw();
    requestAnimationFrame(update);
}

// --- Mobile Controls ---
function initMobileControls() {
    const isTouchDevice = ('ontouchstart' in window) || (navigator.maxTouchPoints > 0);
    
    // Always show if it's a touch device
    if (isTouchDevice) {
        const controls = document.getElementById('mobileControls');
        if (controls) {
            controls.classList.remove('hidden');
            controls.style.display = 'flex'; // Force display flex to override any CSS issues
        }
    } else {
        return;
    }

    const handleBtn = (id, action) => {
        const btn = document.getElementById(id);
        if (!btn) return;
        btn.addEventListener('touchstart', (e) => {
            e.preventDefault();
            if (!gameStarted || paused || gameOver) return;
            action();
        }, { passive: false });
        
        // Add click listener for testing on desktop with mouse if needed
        btn.addEventListener('click', (e) => {
             e.preventDefault();
             if (!gameStarted || paused || gameOver) return;
             action();
        });
    };

    handleBtn('moveLeftBtn', () => playerMove(-1));
    handleBtn('moveRightBtn', () => playerMove(1));
    handleBtn('rotateBtn', () => playerRotate(1));
    handleBtn('hardDropBtn', () => playerHardDrop());
}

// --- Start ---
init();
initMobileControls();
