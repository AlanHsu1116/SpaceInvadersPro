/**
 * TETRIS PRO - Robust Game Logic
 */

// --- Configuration ---
const COLS = 20;
const ROWS = 40;
const BLOCK_SIZE = 22;

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
let isCascading = false;
let fallingBlocks = []; // { x, y, targetY, type, currentYOffset }

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
    document.getElementById('leaderboardBtn').addEventListener('click', () => showLeaderboard());
    document.getElementById('closeLeaderboardBtn').addEventListener('click', () => {
        document.getElementById('leaderboardScreen').classList.add('hidden');
    });
    document.getElementById('saveScoreBtn').addEventListener('click', saveScore);
    
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
    
    // Start the game loop once
    lastTime = performance.now();
    requestAnimationFrame(update);
}

function startGame() {
    grid = Array.from({ length: ROWS }, () => Array(COLS).fill(0));
    score = 0; level = 1; lines = 0;
    dropInterval = 1000;
    gameOver = false; paused = false; gameStarted = true;
    fallingBlocks = [];
    isCascading = false;

    document.getElementById('startScreen').classList.add('hidden');
    document.getElementById('gameOverScreen').classList.add('hidden');
    document.getElementById('pauseScreen').classList.add('hidden');

    playerReset();
    updateStats();
}

function playerReset(generateNewNext = true) {
    const types = 'IJLOSTZ';
    
    // Use the already shown 'next' piece as the current piece
    player.type = player.next || types[Math.floor(Math.random() * types.length)];
    
    // Only generate a NEW 'next' piece if specifically requested
    if (generateNewNext) {
        player.next = types[Math.floor(Math.random() * types.length)];
    }
    
    // Deep copy the shape to avoid mutating SHAPES constant
    player.shape = SHAPES[player.type].map(row => [...row]);
    
    player.pos.y = 0;
    player.pos.x = Math.floor(COLS / 2) - Math.floor(player.shape[0].length / 2);

    if (collide(grid, player)) {
        gameOver = true;
        gameStarted = false;
        document.getElementById('finalScore').textContent = score;
        document.getElementById('finalLevel').textContent = level;
        document.getElementById('finalLines').textContent = lines;
        document.getElementById('gameOverScreen').classList.remove('hidden');
        checkHighScore();
    }
    drawNext();
}

// --- Leaderboard Logic ---
function checkHighScore() {
    const scores = JSON.parse(localStorage.getItem('tetris_scores') || '[]');
    const isHighScore = scores.length < 5 || score > scores[scores.length - 1].score;
    
    if (isHighScore && score > 0) {
        document.getElementById('highScoreInput').classList.remove('hidden');
    } else {
        document.getElementById('highScoreInput').classList.add('hidden');
    }
}

function saveScore() {
    const nameInput = document.getElementById('playerNameInput');
    const name = nameInput.value.trim() || 'ANONYMOUS';
    let scores = JSON.parse(localStorage.getItem('tetris_scores') || '[]');
    
    scores.push({ name, score, date: new Date().toLocaleDateString() });
    scores.sort((a, b) => b.score - a.score);
    scores = scores.slice(0, 5); // Keep top 5
    
    localStorage.setItem('tetris_scores', JSON.stringify(scores));
    document.getElementById('highScoreInput').classList.add('hidden');
    showLeaderboard();
}

function showLeaderboard() {
    const scores = JSON.parse(localStorage.getItem('tetris_scores') || '[]');
    const list = document.getElementById('leaderboardList');
    list.innerHTML = '';
    
    if (scores.length === 0) {
        list.innerHTML = '<div class="score-row">NO RECORDS YET</div>';
    } else {
        scores.forEach((s, i) => {
            const row = document.createElement('div');
            row.className = 'score-row';
            row.innerHTML = `<span>${i + 1}. ${s.name}</span> <span>${s.score}</span>`;
            list.appendChild(row);
        });
    }
    
    document.getElementById('leaderboardScreen').classList.remove('hidden');
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
        gridSweep();
        if (!isCascading) {
            playerReset(true); // Piece landed, no cascade: New Next piece
        }
        updateStats();
    }
    dropCounter = 0;
}

function playerHardDrop() {
    if (!gameStarted || paused || gameOver || isCascading) return;
    while (!collide(grid, player)) {
        player.pos.y++;
        score += 2;
    }
    player.pos.y--;
    merge(grid, player);
    gridSweep();
    if (!isCascading) {
        playerReset(true); // Piece landed, no cascade: New Next piece
    }
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
    let lowestClearedY = -1;

    // First pass: identify and remove full rows
    for (let y = ROWS - 1; y >= 0; --y) {
        if (grid[y].every(value => value !== 0)) {
            // Create particles
            grid[y].forEach((type, x) => {
                const color = COLORS[type] || '#fff';
                createParticles(x * BLOCK_SIZE, y * BLOCK_SIZE, color);
            });

            lowestClearedY = Math.max(lowestClearedY, y);
            grid.splice(y, 1);
            grid.unshift(Array(COLS).fill(0));
            y++; // Check the new row at this position
            
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

    // CASCADE ANIMATION PREP
    if (clearedAny) {
        fallingBlocks = [];
        // Scan grid from bottom up
        for (let x = 0; x < COLS; x++) {
            let emptySpacesBelow = 0;
            for (let y = ROWS - 1; y >= 0; y--) {
                if (grid[y][x] === 0) {
                    emptySpacesBelow++;
                } else if (emptySpacesBelow > 0 && y <= lowestClearedY) {
                    // Staggered delay based on column (x)
                    fallingBlocks.push({
                        x: x,
                        y: y,
                        targetY: y + emptySpacesBelow,
                        type: grid[y][x],
                        currentYOffset: 0,
                        delay: x * 80 // 80ms delay per column for a clear "wave" effect
                    });
                    grid[y][x] = 0; // Temporarily remove from grid
                }
            }
        }
        
        if (fallingBlocks.length > 0) {
            isCascading = true;
        } else {
            triggerShake(15);
            // No cascade but lines cleared, do a recursive check just in case
            gridSweep();
            if (!isCascading) playerReset(false); // Finished clearing/cascading: Use the piece that was ALREADY 'Next'
        }
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

    drawMatrix(grid, { x: 0, y: 0 }, null, ctx);
    
    // Draw animated falling blocks during cascade
    if (isCascading) {
        fallingBlocks.forEach(b => {
            const matrix = [[b.type]];
            drawMatrix(matrix, { x: b.x, y: b.y + b.currentYOffset }, null, ctx);
        });
    }

    if (gameStarted && player.shape && !isCascading) {
        drawGhost();
        drawMatrix(player.shape, player.pos, player.type, ctx);
    }
    
    drawParticles();
    ctx.restore();

    // Always draw next piece to ensure its canvas is clear and updated
    drawNext();
}

function drawMatrix(matrix, offset, forcedType = null, targetCtx = ctx) {
    matrix.forEach((row, y) => {
        row.forEach((value, x) => {
            if (value !== 0) {
                const type = forcedType || value;
                const baseColor = COLORS[type] || '#fff';
                const drawX = (x + offset.x) * (targetCtx === nextCtx ? 14 : BLOCK_SIZE);
                const drawY = (y + offset.y) * (targetCtx === nextCtx ? 14 : BLOCK_SIZE);
                const size = (targetCtx === nextCtx ? 14 : BLOCK_SIZE);
                
                targetCtx.save();
                
                // 1. Neon Shadow Glow
                targetCtx.shadowBlur = targetCtx === nextCtx ? 5 : 12;
                targetCtx.shadowColor = baseColor;
                
                // 2. Metallic Gradient Background
                const gradient = targetCtx.createLinearGradient(drawX, drawY, drawX + size, drawY + size);
                gradient.addColorStop(0, '#fff'); // Light highlight
                gradient.addColorStop(0.2, baseColor);
                gradient.addColorStop(0.5, baseColor);
                gradient.addColorStop(0.8, '#000'); // Shadow
                gradient.addColorStop(1, baseColor);
                
                targetCtx.fillStyle = gradient;
                targetCtx.fillRect(drawX + 1, drawY + 1, size - 2, size - 2);
                
                // 3. Bevel Effect (Inner Border)
                targetCtx.lineWidth = targetCtx === nextCtx ? 1 : 2;
                targetCtx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
                targetCtx.strokeRect(drawX + (targetCtx === nextCtx ? 1 : 2), drawY + (targetCtx === nextCtx ? 1 : 2), size - (targetCtx === nextCtx ? 2 : 4), size - (targetCtx === nextCtx ? 2 : 4));

                targetCtx.restore();
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
    drawMatrix(ghost.shape, ghost.pos, 'GHOST', ctx);
    ctx.restore();
}

function drawNext() {
    if (!nextCtx) return;
    nextCtx.fillStyle = '#000';
    nextCtx.fillRect(0, 0, nextCanvas.width, nextCanvas.height);
    if (player.next) {
        const shape = SHAPES[player.next];
        const bSize = 14; // Smaller preview size
        const offX = (nextCanvas.width - shape[0].length * bSize) / 2 / bSize;
        const offY = (nextCanvas.height - shape.length * bSize) / 2 / bSize;
        drawMatrix(shape, { x: offX, y: offY }, player.next, nextCtx);
    }
}


function update(time = 0) {
    const deltaTime = time - lastTime;
    lastTime = time;

    updateParticles();

    if (gameStarted && !paused && !gameOver) {
        if (isCascading) {
            let allFinished = true;
            fallingBlocks.forEach(b => {
                if (b.delay > 0) {
                    b.delay -= deltaTime;
                    allFinished = false;
                } else {
                    const speed = 0.15; // Slower, more obvious fall
                    if (b.y + b.currentYOffset < b.targetY) {
                        b.currentYOffset += speed;
                        allFinished = false;
                        if (b.y + b.currentYOffset > b.targetY) {
                            b.currentYOffset = b.targetY - b.y;
                        }
                    }
                }
            });

            if (allFinished) {
                // Merge falling blocks back into actual grid
                fallingBlocks.forEach(b => {
                    grid[b.targetY][b.x] = b.type;
                });
                fallingBlocks = [];
                isCascading = false;
                triggerShake(20); // Stronger shake
                playSound('drop');
                
                // RECURSIVE CHECK: If dropping formed new lines, clear them immediately
                gridSweep();
                // If the new check didn't start a cascade, board is stable
                if (!isCascading) {
                    playerReset(false); // Cascade finished, new piece spawns using the ALREADY shown Next piece
                }
            }
        } else {
            dropCounter += deltaTime;
            if (dropCounter > dropInterval) playerDrop();
        }
        draw();
    } else {
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
