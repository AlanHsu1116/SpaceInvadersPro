// =================================
//          WORD BANK
// =================================
const wordBank = {
    easy: [
        "code", "data", "byte", "node", "java", "ruby", "perl", "bash", "hack", "wifi",
        "link", "host", "port", "root", "user", "pass", "file", "disk", "load", "save",
        "edit", "copy", "void", "null", "true", "echo", "ping", "scan", "type", "grid",
        "chip", "core", "bios", "cmos", "boot", "exec", "kill", "nice", "cron", "grep"
    ],
    medium: [
        "python", "script", "server", "client", "socket", "router", "switch", "access", "denied", "system",
        "kernel", "memory", "driver", "buffer", "stream", "filter", "search", "config", "deploy", "update",
        "upgrade", "install", "remove", "delete", "format", "backup", "restore", "module", "object", "string",
        "number", "vector", "matrix", "vertex", "pixel", "shader", "render", "engine", "visual", "studio"
    ],
    hard: [
        "javascript", "typescript", "algorithm", "encryption", "decryption", "mainframe", "database", "firewall", "security", "protocol",
        "interface", "namespace", "recursive", "iteration", "exception", "debugging", "compiling", "assembly", "binarytree", "linkedlist",
        "polymorph", "inheritance", "constructor", "destructor", "framework", "middleware", "fullstack", "developer", "engineer", "architect",
        "blockchain", "crypto", "ethereum", "bitcoin", "cyberpunk", "futuristic", "simulation", "processor", "bandwidth", "throughput"
    ]
};


// =================================
//          GAME STATE
// =================================
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

let gameState = {
    activeWords: [], // Objects: { text: "word", x: 100, y: 0, speed: 1, matchedIndex: 0, color: '#0f0' }
    particles: [],
    score: 0,
    level: 1,
    timeRemaining: 60,
    wordsCleared: 0,
    startTime: 0,
    isPlaying: false,
    isGameOver: false,
    lastFrameTime: 0,
    spawnTimer: 0,
    spawnInterval: 2000, // ms
    difficultyMultiplier: 1.0,
    targetWordIndex: -1 // Index of the word currently being typed (-1 if none)
};

// =================================
//          SETUP & RESIZE
// =================================
function resizeCanvas() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
}
window.addEventListener('resize', resizeCanvas);
resizeCanvas();


// =================================
//          LOGIC
// =================================
function getRandomWord() {
    let pool;
    if (gameState.level === 1) pool = wordBank.easy;
    else if (gameState.level <= 3) pool = [...wordBank.easy, ...wordBank.medium];
    else pool = [...wordBank.medium, ...wordBank.hard];
    
    return pool[Math.floor(Math.random() * pool.length)];
}

function spawnWord() {
    const text = getRandomWord();
    const margin = 100;
    const x = Math.random() * (canvas.width - margin * 2) + margin;
    
    // Base speed + level scaling
    const speed = (1 + (gameState.level * 0.2)) * (Math.random() * 0.5 + 0.8);
    
    gameState.activeWords.push({
        text: text,
        x: x,
        y: -30,
        speed: speed,
        matchedIndex: 0, // How many chars have been typed correctly
        totalLength: text.length,
        isTargeted: false
    });
}

function updateGame(deltaTime) {
    // Timer
    gameState.timeRemaining -= deltaTime;
    if (gameState.timeRemaining <= 0) {
        endGame();
        return;
    }
    
    // Difficulty Scaling
    // Every 5 words cleared, increase difficulty slightly
    gameState.level = 1 + Math.floor(gameState.wordsCleared / 5);
    gameState.spawnInterval = Math.max(500, 2000 - (gameState.level * 100));

    // Spawning
    gameState.spawnTimer += deltaTime * 1000;
    if (gameState.spawnTimer > gameState.spawnInterval) {
        spawnWord();
        gameState.spawnTimer = 0;
    }

    // Move Words
    for (let i = gameState.activeWords.length - 1; i >= 0; i--) {
        let word = gameState.activeWords[i];
        word.y += word.speed;

        // Check bounds (reached bottom)
        if (word.y > canvas.height) {
            // Penalty: huge time loss
            gameState.timeRemaining -= 5;
            createExplosion(word.x, canvas.height, '#f00');
            gameState.activeWords.splice(i, 1);
            
            // Reset target if it was the target
            if (i === gameState.targetWordIndex) {
                gameState.targetWordIndex = -1;
            } else if (i < gameState.targetWordIndex) {
                // If a word before the target was removed, shift index
                gameState.targetWordIndex--;
            }
            
            triggerScreenShake();
        }
    }

    updateParticles();
}

// =================================
//          INPUT HANDLING
// =================================
window.addEventListener('keydown', (e) => {
    if (!gameState.isPlaying || gameState.isGameOver) return;

    // Ignore non-character keys (Shift, Ctrl, etc.)
    if (e.key.length !== 1) return;

    const char = e.key.toLowerCase();

    // If no word is currently targeted
    if (gameState.targetWordIndex === -1) {
        // Find a word that starts with this char
        // Prioritize words closer to the bottom (higher y)
        let bestIndex = -1;
        let maxY = -1000;

        gameState.activeWords.forEach((word, index) => {
            if (word.text[0] === char) {
                if (word.y > maxY) {
                    maxY = word.y;
                    bestIndex = index;
                }
            }
        });

        if (bestIndex !== -1) {
            gameState.targetWordIndex = bestIndex;
            processInputForWord(bestIndex, char);
        } else {
            // Typo / No match penalty? Maybe play a sound
        }
    } else {
        // We have a target
        processInputForWord(gameState.targetWordIndex, char);
    }
});

function processInputForWord(index, char) {
    const word = gameState.activeWords[index];
    const expectedChar = word.text[word.matchedIndex];

    if (char === expectedChar) {
        // Match!
        word.matchedIndex++;
        createParticles(word.x + (word.matchedIndex * 15), word.y, '#0f0', 2);

        // Word Complete?
        if (word.matchedIndex === word.totalLength) {
            completeWord(index);
        }
    } else {
        // Mistake!
        // Optional: Reset progress on word? or simple penalty?
        // Let's just visual shake or sound
    }
}

function completeWord(index) {
    const word = gameState.activeWords[index];
    createExplosion(word.x, word.y, '#0f0');
    
    // Reward
    gameState.score += word.totalLength * 10;
    gameState.wordsCleared++;
    gameState.timeRemaining += 2; // Time bonus
    
    // Remove word
    gameState.activeWords.splice(index, 1);
    gameState.targetWordIndex = -1;
}

// =================================
//          RENDERING
// =================================
function draw() {
    // Clear
    ctx.fillStyle = 'rgba(0, 0, 0, 0.3)'; // Trail effect
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.font = 'bold 24px "Share Tech Mono"';
    ctx.textBaseline = 'middle';
    
    // Draw Words
    gameState.activeWords.forEach((word, index) => {
        // Targeted visual
        const isTarget = (index === gameState.targetWordIndex);
        
        ctx.textAlign = 'left';
        const width = ctx.measureText(word.text).width;
        const startX = word.x - width / 2;

        // Draw Line connection to target
        if (isTarget) {
            ctx.strokeStyle = 'rgba(0, 255, 0, 0.3)';
            ctx.beginPath();
            ctx.moveTo(canvas.width / 2, canvas.height);
            ctx.lineTo(word.x, word.y + 10);
            ctx.stroke();
            
            // Highlight Box
            ctx.strokeStyle = '#0f0';
            ctx.lineWidth = 2;
            ctx.strokeRect(startX - 5, word.y - 15, width + 10, 30);
        }

        // Draw text characters
        let currentX = startX;
        for (let i = 0; i < word.totalLength; i++) {
            const char = word.text[i];
            
            if (i < word.matchedIndex) {
                // Already typed: Bright Green
                ctx.fillStyle = '#0f0'; 
                ctx.shadowBlur = 10;
                ctx.shadowColor = '#0f0';
            } else if (i === word.matchedIndex && isTarget) {
                // Next to type: White/Yellow
                ctx.fillStyle = '#fff';
                ctx.shadowBlur = 5;
                ctx.shadowColor = '#fff';
            } else {
                // Remaining: Dark Green / Gray
                ctx.fillStyle = '#005500';
                ctx.shadowBlur = 0;
            }

            ctx.fillText(char, currentX, word.y);
            currentX += ctx.measureText(char).width;
        }
        ctx.shadowBlur = 0; // Reset
    });

    drawParticles();
    updateUI();
}

function updateUI() {
    document.getElementById('scoreDisplay').textContent = gameState.score;
    document.getElementById('levelDisplay').textContent = gameState.level;
    
    const timeEl = document.getElementById('timeDisplay');
    timeEl.textContent = Math.ceil(gameState.timeRemaining);
    if (gameState.timeRemaining <= 10) timeEl.classList.add('warning');
    else timeEl.classList.remove('warning');

    // Calc WPM
    const elapsedMin = (Date.now() - gameState.startTime) / 60000;
    const wpm = elapsedMin > 0 ? Math.floor(gameState.wordsCleared / elapsedMin) : 0;
    document.getElementById('wpmDisplay').textContent = wpm;
}

// =================================
//          PARTICLES
// =================================
function createParticles(x, y, color, count) {
    for (let i = 0; i < count; i++) {
        gameState.particles.push({
            x: x,
            y: y,
            vx: (Math.random() - 0.5) * 5,
            vy: (Math.random() - 0.5) * 5,
            life: 1.0,
            color: color
        });
    }
}

function createExplosion(x, y, color) {
    createParticles(x, y, color, 20);
}

function updateParticles() {
    for (let i = gameState.particles.length - 1; i >= 0; i--) {
        let p = gameState.particles[i];
        p.x += p.vx;
        p.y += p.vy;
        p.life -= 0.05;
        if (p.life <= 0) gameState.particles.splice(i, 1);
    }
}

function drawParticles() {
    gameState.particles.forEach(p => {
        ctx.globalAlpha = p.life;
        ctx.fillStyle = p.color;
        ctx.fillRect(p.x, p.y, 3, 3);
    });
    ctx.globalAlpha = 1.0;
}

function triggerScreenShake() {
    canvas.style.transform = `translate(${(Math.random()-0.5)*10}px, ${(Math.random()-0.5)*10}px)`;
    setTimeout(() => {
        canvas.style.transform = 'none';
    }, 100);
}

// =================================
//          GAME CONTROL
// =================================
function startGame() {
    gameState = {
        activeWords: [],
        particles: [],
        score: 0,
        level: 1,
        timeRemaining: 60,
        wordsCleared: 0,
        startTime: Date.now(),
        isPlaying: true,
        isGameOver: false,
        lastFrameTime: Date.now(),
        spawnTimer: 0,
        spawnInterval: 2000,
        difficultyMultiplier: 1.0,
        targetWordIndex: -1
    };
    
    document.getElementById('startScreen').classList.add('hidden');
    document.getElementById('gameOverScreen').classList.add('hidden');
    
    requestAnimationFrame(gameLoop);
}

function endGame() {
    gameState.isPlaying = false;
    gameState.isGameOver = true;
    
    document.getElementById('gameOverScreen').classList.remove('hidden');
    document.getElementById('finalScore').textContent = gameState.score;
    document.getElementById('finalWords').textContent = gameState.wordsCleared;
    
    const elapsedMin = (Date.now() - gameState.startTime) / 60000;
    const wpm = elapsedMin > 0 ? Math.floor(gameState.wordsCleared / elapsedMin) : 0;
    document.getElementById('finalWpm').textContent = wpm;
}

function gameLoop() {
    if (!gameState.isPlaying) return;
    
    const now = Date.now();
    const deltaTime = (now - gameState.lastFrameTime) / 1000;
    gameState.lastFrameTime = now;
    
    updateGame(deltaTime);
    draw();
    
    requestAnimationFrame(gameLoop);
}

// Initial
document.getElementById('startBtn').addEventListener('click', startGame);
document.getElementById('restartBtn').addEventListener('click', startGame);
draw(); // Initial draw (blank)