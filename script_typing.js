// =================================
//          AUDIO SYSTEM (Basic)
// =================================
const audioCtx = new (window.AudioContext || window.webkitAudioContext)();

function playSound(type) {
    if (audioCtx.state === 'suspended') audioCtx.resume();
    
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    
    if (type === 'hit') {
        osc.type = 'sine';
        osc.frequency.setValueAtTime(800, audioCtx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(1200, audioCtx.currentTime + 0.1);
        gain.gain.setValueAtTime(0.1, audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.1);
        osc.start();
        osc.stop(audioCtx.currentTime + 0.1);
    } else if (type === 'error') {
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(150, audioCtx.currentTime);
        osc.frequency.linearRampToValueAtTime(100, audioCtx.currentTime + 0.1);
        gain.gain.setValueAtTime(0.1, audioCtx.currentTime);
        gain.gain.linearRampToValueAtTime(0.01, audioCtx.currentTime + 0.1);
        osc.start();
        osc.stop(audioCtx.currentTime + 0.1);
    } else if (type === 'explode') {
        osc.type = 'square';
        osc.frequency.setValueAtTime(100, audioCtx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(10, audioCtx.currentTime + 0.3);
        gain.gain.setValueAtTime(0.1, audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.3);
        osc.start();
        osc.stop(audioCtx.currentTime + 0.3);
    }
}

// =================================
//          WORD BANK
// =================================
const wordBank = {
    letters: [
        "a", "b", "c", "d", "e", "f", "g", "h", "i", "j", "k", "l", "m", 
        "n", "o", "p", "q", "r", "s", "t", "u", "v", "w", "x", "y", "z"
    ],
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
//          LEADERBOARD SYSTEM
// =================================
const MAX_HIGH_SCORES = 10;
const LEADERBOARD_KEY = 'typingGameLeaderboard';

function getLeaderboard() {
    const stored = localStorage.getItem(LEADERBOARD_KEY);
    return stored ? JSON.parse(stored) : [];
}

function saveScore(name, score, wpm) {
    const leaderboard = getLeaderboard();
    const newEntry = {
        name: name,
        score: score,
        wpm: wpm,
        date: new Date().toLocaleDateString()
    };
    
    leaderboard.push(newEntry);
    
    // Sort by score (descending)
    leaderboard.sort((a, b) => b.score - a.score);
    
    // Keep top N
    if (leaderboard.length > MAX_HIGH_SCORES) {
        leaderboard.length = MAX_HIGH_SCORES;
    }
    
    localStorage.setItem(LEADERBOARD_KEY, JSON.stringify(leaderboard));
}

function isHighScore(score) {
    const leaderboard = getLeaderboard();
    if (leaderboard.length < MAX_HIGH_SCORES) return true;
    return score > leaderboard[leaderboard.length - 1].score;
}

function renderLeaderboard() {
    const list = document.getElementById('leaderboardList');
    const leaderboard = getLeaderboard();
    
    list.innerHTML = '';
    
    if (leaderboard.length === 0) {
        list.innerHTML = '<tr><td colspan="5" style="text-align:center">NO RECORDS FOUND</td></tr>';
        return;
    }
    
    leaderboard.forEach((entry, index) => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>#${index + 1}</td>
            <td>${entry.name}</td>
            <td>${entry.score}</td>
            <td>${entry.wpm}</td>
            <td>${entry.date}</td>
        `;
        list.appendChild(tr);
    });
}

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
    targetWordIndex: -1, // Index of the word currently being typed (-1 if none)
    levelScore: 0,      // Score earned in current level
    levelTarget: 0,      // Score needed to pass current level
    gameMode: 'arcade',  // 'arcade' or 'practice'
    practiceDifficulty: 'easy' // 'easy', 'medium', 'hard'
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
    if (gameState.gameMode === 'practice') {
        let pool;
        switch (gameState.practiceDifficulty) {
            case 'easy':
                // Mix letters and easy words
                pool = [...wordBank.letters, ...wordBank.easy];
                break;
            case 'medium':
                pool = [...wordBank.easy, ...wordBank.medium];
                break;
            case 'hard':
                pool = [...wordBank.medium, ...wordBank.hard];
                break;
            default:
                pool = wordBank.easy;
        }
        return pool[Math.floor(Math.random() * pool.length)];
    }

    // Arcade Mode Logic
    let pool;
    if (gameState.level <= 2) pool = wordBank.letters; // Level 1-2: Single letters
    else if (gameState.level === 3) pool = wordBank.easy;
    else if (gameState.level <= 5) pool = [...wordBank.easy, ...wordBank.medium];
    else pool = [...wordBank.medium, ...wordBank.hard];
    
    return pool[Math.floor(Math.random() * pool.length)];
}

function calculateLevelTarget(level) {
    // Base words needed: 10 + (level * 2)
    // Points per word: level
    // Target = Words * Points
    const wordsNeeded = 10 + (level * 2);
    return wordsNeeded * level;
}

function spawnWord() {
    const text = getRandomWord();
    const margin = 100;
    const x = Math.random() * (canvas.width - margin * 2) + margin;
    
    // Base speed + level scaling
    // Slower base speed, scales slightly with level
    let speedBase = 0.4;
    if (gameState.level <= 2) speedBase = 0.3 + (gameState.level * 0.1); 
    else speedBase = 0.5 + (gameState.level * 0.1);

    const speed = speedBase * (Math.random() * 0.5 + 0.8);
    
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
    // Timer Logic
    gameState.timeRemaining -= deltaTime;
    
    // Check Level End
    if (gameState.timeRemaining <= 0) {
        if (gameState.levelScore >= gameState.levelTarget) {
            // Level Passed
            advanceLevel();
        } else {
            // Failed
            gameState.timeRemaining = 0;
            endGame();
        }
        return;
    }
    
    // Adjust spawn interval based on level (slightly faster as level increases)
    if (gameState.level === 1) gameState.spawnInterval = 2000;
    else if (gameState.level === 2) gameState.spawnInterval = 1800;
    else gameState.spawnInterval = Math.max(600, 1800 - (gameState.level * 120));

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
            // Penalty: Time loss
            gameState.timeRemaining -= 3;
            createExplosion(word.x, canvas.height, '#f00');
            playSound('error');
            gameState.activeWords.splice(i, 1);
            
            // Reset target if it was the target
            if (i === gameState.targetWordIndex) {
                gameState.targetWordIndex = -1;
            } else if (i < gameState.targetWordIndex) {
                gameState.targetWordIndex--;
            }
            
            triggerScreenShake();
            triggerErrorFlash();
        }
    }

    updateParticles();
}

function advanceLevel() {
    gameState.level++;
    gameState.timeRemaining = 60; // Reset timer
    gameState.levelScore = 0;     // Reset level score
    gameState.levelTarget = calculateLevelTarget(gameState.level);
    gameState.activeWords = [];   // Clear screen
    gameState.targetWordIndex = -1;
    
    triggerLevelUpEffect(gameState.level);
    playSound('hit');
}

// =================================
//          INPUT HANDLING
// =================================
window.addEventListener('keydown', (e) => {
    // If inputting name, ignore game controls
    if (document.activeElement === document.getElementById('playerNameInput')) return;
    
    if (!gameState.isPlaying || gameState.isGameOver) return;

    // Ignore non-character keys (Shift, Ctrl, etc.)
    if (e.key.length !== 1) return;

    const char = e.key.toLowerCase();
    
    // Level 1-2: Single Letter Mode (No locking required)
    if (gameState.level <= 2) {
        // Find closest word matching this char
        let bestIndex = -1;
        let maxY = -1000;

        gameState.activeWords.forEach((word, index) => {
            if (word.text === char) { // Exact match for single letter
                if (word.y > maxY) {
                    maxY = word.y;
                    bestIndex = index;
                }
            }
        });

        if (bestIndex !== -1) {
            // Hit!
            playSound('hit');
            completeWord(bestIndex);
        } else {
            // Miss
            playSound('error');
            triggerErrorFlash();
        }
        return;
    }

    // Level 3+: Word Mode (Target Locking)
    // If no word is currently targeted
    if (gameState.targetWordIndex === -1) {
        // Find a word that starts with this char
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
            playSound('error');
            triggerErrorFlash();
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
        playSound('hit');
        createParticles(word.x + (word.matchedIndex * 15), word.y, '#0f0', 2);

        // Word Complete?
        if (word.matchedIndex === word.totalLength) {
            completeWord(index);
        }
    } else {
        // Mistake!
        playSound('error');
        triggerErrorFlash();
    }
}

function completeWord(index) {
    const word = gameState.activeWords[index];
    createExplosion(word.x, word.y, '#0f0');
    playSound('explode');
    
    // Reward
    // Scoring: Level 1 = 1 point, Level 2 = 2 points...
    const points = gameState.level;
    gameState.score += points;
    gameState.levelScore += points;
    
    gameState.wordsCleared++;
    gameState.timeRemaining += 0.5; // Small Time bonus
    
    // Remove word
    gameState.activeWords.splice(index, 1);
    gameState.targetWordIndex = -1;
}

function triggerLevelUpEffect(newLevel) {
    const overlay = document.createElement('div');
    overlay.style.position = 'absolute';
    overlay.style.top = '50%';
    overlay.style.left = '50%';
    overlay.style.transform = 'translate(-50%, -50%)';
    overlay.style.color = '#0f0';
    overlay.style.fontSize = '80px';
    overlay.style.fontWeight = 'bold';
    overlay.style.textShadow = '0 0 20px #0f0, 0 0 40px #fff';
    overlay.style.pointerEvents = 'none';
    overlay.style.zIndex = '200';
    overlay.style.fontFamily = '"Share Tech Mono", monospace';
    overlay.innerText = `LEVEL ${newLevel}`;
    overlay.style.opacity = '0';
    overlay.style.transition = 'opacity 0.5s, transform 0.5s';
    
    document.body.appendChild(overlay);

    // Animate in
    requestAnimationFrame(() => {
        overlay.style.opacity = '1';
        overlay.style.transform = 'translate(-50%, -50%) scale(1.2)';
    });
    
    playSound('hit'); // Use positive sound

    // Animate out
    setTimeout(() => {
        overlay.style.opacity = '0';
        overlay.style.transform = 'translate(-50%, -50%) scale(1.5)';
        setTimeout(() => {
            document.body.removeChild(overlay);
        }, 500);
    }, 1500);
}

function triggerErrorFlash() {
    const flash = document.createElement('div');
    flash.style.position = 'absolute';
    flash.style.top = '0';
    flash.style.left = '0';
    flash.style.width = '100%';
    flash.style.height = '100%';
    flash.style.backgroundColor = 'rgba(255, 0, 0, 0.2)';
    flash.style.pointerEvents = 'none';
    flash.style.zIndex = '100';
    document.body.appendChild(flash);
    
    setTimeout(() => {
        document.body.removeChild(flash);
    }, 100);
}

// =================================
//          RENDERING
// =================================
function draw() {
    // Clear
    ctx.fillStyle = 'rgba(0, 0, 0, 0.3)'; // Trail effect
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.font = 'bold 32px "Share Tech Mono"';
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
    
    // Update Goal Display
    const goalEl = document.getElementById('goalDisplay');
    if (goalEl) {
        goalEl.textContent = `${gameState.levelScore} / ${gameState.levelTarget}`;
        // Color indication
        if (gameState.levelScore >= gameState.levelTarget) {
            goalEl.style.color = '#0f0';
            goalEl.style.textShadow = '0 0 10px #0f0';
        } else {
            goalEl.style.color = '#fff';
            goalEl.style.textShadow = 'none';
        }
    }
    
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
        targetWordIndex: -1,
        levelScore: 0,
        levelTarget: calculateLevelTarget(1) // Initial target
    };
    
    document.getElementById('startScreen').classList.add('hidden');
    document.getElementById('gameOverScreen').classList.add('hidden');
    document.getElementById('leaderboardScreen').classList.add('hidden');
    
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
    
    // Check High Score
    const inputContainer = document.getElementById('inputContainer');
    if (isHighScore(gameState.score) && gameState.score > 0) {
        inputContainer.classList.remove('hidden');
        document.getElementById('playerNameInput').value = '';
        document.getElementById('playerNameInput').focus();
    } else {
        inputContainer.classList.add('hidden');
    }
}

function showLeaderboard() {
    document.getElementById('startScreen').classList.add('hidden');
    document.getElementById('gameOverScreen').classList.add('hidden');
    document.getElementById('leaderboardScreen').classList.remove('hidden');
    renderLeaderboard();
}

function hideLeaderboard() {
    document.getElementById('leaderboardScreen').classList.add('hidden');
    if (gameState.isGameOver) {
        document.getElementById('gameOverScreen').classList.remove('hidden');
    } else {
        document.getElementById('startScreen').classList.remove('hidden');
    }
}

function submitScore() {
    const nameInput = document.getElementById('playerNameInput');
    const name = nameInput.value.trim().toUpperCase() || "UNK";
    
    const elapsedMin = (Date.now() - gameState.startTime) / 60000;
    const wpm = elapsedMin > 0 ? Math.floor(gameState.wordsCleared / elapsedMin) : 0;

    saveScore(name, gameState.score, wpm);
    
    document.getElementById('inputContainer').classList.add('hidden');
    showLeaderboard();
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

// Leaderboard Buttons
document.getElementById('leaderboardBtn').addEventListener('click', showLeaderboard);
document.getElementById('gameoverLeaderboardBtn').addEventListener('click', showLeaderboard);
document.getElementById('closeLeaderboardBtn').addEventListener('click', hideLeaderboard);
document.getElementById('submitScoreBtn').addEventListener('click', submitScore);

// Allow Enter key to submit score
document.getElementById('playerNameInput').addEventListener('keypress', (e) => {
    if (e.key === 'Enter') submitScore();
});

draw(); // Initial draw (blank)