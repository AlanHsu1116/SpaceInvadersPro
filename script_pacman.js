const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const scoreElement = document.getElementById('score');
const levelElement = document.getElementById('level');
const livesElement = document.getElementById('lives');
const overlay = document.getElementById('overlay');
const overlayTitle = document.getElementById('overlay-title');
const overlayText = document.getElementById('overlay-text');
const startBtn = document.getElementById('start-btn');

// 遊戲配置
const TILE_SIZE = 20;
const ROWS = 21;
const COLS = 19;
canvas.width = COLS * TILE_SIZE;
canvas.height = ROWS * TILE_SIZE;

let score = 0;
let level = 1;
let lives = 3;
let gameActive = false;
let pelletsLeft = 0;
let powerMode = false;
let powerTimer = null;

const originalMap = [
    [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1],
    [1,0,0,0,0,0,0,0,0,1,0,0,0,0,0,0,0,0,1],
    [1,3,1,1,0,1,1,1,0,1,0,1,1,1,0,1,1,3,1],
    [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
    [1,0,1,1,0,1,0,1,1,1,1,1,0,1,0,1,1,0,1],
    [1,0,0,0,0,1,0,0,0,1,0,0,0,1,0,0,0,0,1],
    [1,1,1,1,0,1,1,1,2,1,2,1,1,1,0,1,1,1,1],
    [2,2,2,1,0,1,2,2,2,2,2,2,2,1,0,1,2,2,2],
    [1,1,1,1,0,1,2,1,1,2,1,1,2,1,0,1,1,1,1],
    [2,2,2,2,0,2,2,1,2,2,2,1,2,2,0,2,2,2,2],
    [1,1,1,1,0,1,2,1,1,1,1,1,2,1,0,1,1,1,1],
    [2,2,2,1,0,1,2,2,2,2,2,2,2,1,0,1,2,2,2],
    [1,1,1,1,0,1,2,1,1,1,1,1,2,1,0,1,1,1,1],
    [1,0,0,0,0,0,0,0,0,1,0,0,0,0,0,0,0,0,1],
    [1,0,1,1,0,1,1,1,0,1,0,1,1,1,0,1,1,0,1],
    [1,3,0,1,0,0,0,0,0,2,0,0,0,0,0,1,0,3,1],
    [1,1,0,1,0,1,0,1,1,1,1,1,0,1,0,1,0,1,1],
    [1,0,0,0,0,1,0,0,0,1,0,0,0,1,0,0,0,0,1],
    [1,0,1,1,1,1,1,1,0,1,0,1,1,1,1,1,1,0,1],
    [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
    [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1]
];

let map = [];

class Entity {
    constructor(x, y, speed) {
        this.startX = x;
        this.startY = y;
        this.speed = speed;
        this.radius = TILE_SIZE / 2 - 2;
        this.reset();
    }

    reset() {
        this.x = this.startX * TILE_SIZE + TILE_SIZE / 2;
        this.y = this.startY * TILE_SIZE + TILE_SIZE / 2;
        this.dir = { x: 0, y: 0 };
        this.nextDir = { x: 0, y: 0 };
    }

    canMove(dx, dy) {
        if (dx === 0 && dy === 0) return true;
        const col = Math.floor((this.x + dx * (TILE_SIZE / 2 + 1)) / TILE_SIZE);
        const row = Math.floor((this.y + dy * (TILE_SIZE / 2 + 1)) / TILE_SIZE);
        if (col < 0 || col >= COLS) return true; // 傳送門區域
        if (row < 0 || row >= ROWS) return false;
        return map[row][col] !== 1;
    }

    move() {
        const centerX = Math.floor(this.x / TILE_SIZE) * TILE_SIZE + TILE_SIZE / 2;
        const centerY = Math.floor(this.y / TILE_SIZE) * TILE_SIZE + TILE_SIZE / 2;

        // 轉向邏輯
        if (this.nextDir.x !== 0 || this.nextDir.y !== 0) {
            const isReverse = (this.nextDir.x === -this.dir.x && this.nextDir.x !== 0) || 
                             (this.nextDir.y === -this.dir.y && this.nextDir.y !== 0);
            
            // 隨時允許回頭，否則需接近中心點且「方向不同」才執行吸附轉向
            const isDifferentDir = this.nextDir.x !== this.dir.x || this.nextDir.y !== this.dir.y;
            const nearCenter = Math.abs(this.x - centerX) <= this.speed && Math.abs(this.y - centerY) <= this.speed;

            if (isReverse || (isDifferentDir && nearCenter)) {
                if (this.canMove(this.nextDir.x, this.nextDir.y)) {
                    this.dir = { ...this.nextDir };
                    if (!isReverse) {
                        this.x = centerX;
                        this.y = centerY;
                    }
                }
            }
        }

        if (this.canMove(this.dir.x, this.dir.y)) {
            this.x += this.dir.x * this.speed;
            this.y += this.dir.y * this.speed;
            
            if (this.x < 0) this.x = canvas.width;
            if (this.x > canvas.width) this.x = 0;
        } else {
            // 撞牆才吸附到中心點
            this.x = centerX;
            this.y = centerY;
        }
    }
}

class Pacman extends Entity {
    constructor(x, y) {
        super(x, y, 1); // 速度設為 1，這是最穩定且節奏適中的數值
        this.mouthOpen = 0;
        this.mouthSpeed = 0.1;
    }

    draw() {
        this.mouthOpen += this.mouthSpeed;
        if (this.mouthOpen > 0.2 || this.mouthOpen < 0) this.mouthSpeed *= -1;
        ctx.save();
        ctx.translate(this.x, this.y);
        let angle = 0;
        if (this.dir.x === 1) angle = 0;
        else if (this.dir.x === -1) angle = Math.PI;
        else if (this.dir.y === 1) angle = Math.PI / 2;
        else if (this.dir.y === -1) angle = -Math.PI / 2;
        ctx.rotate(angle);
        ctx.beginPath();
        ctx.fillStyle = "#ffff00";
        ctx.shadowBlur = 10;
        ctx.shadowColor = "#ffff00";
        ctx.moveTo(0, 0);
        ctx.arc(0, 0, this.radius, this.mouthOpen * Math.PI, (2 - this.mouthOpen) * Math.PI);
        ctx.fill();
        ctx.restore();
    }
}

class Ghost extends Entity {
    constructor(x, y, color) {
        super(x, y, 0.8); // 鬼魂稍微慢一點
        this.color = color;
        this.scared = false;
    }

    pickNewDirection() {
        const dirs = [{x:1,y:0}, {x:-1,y:0}, {x:0,y:1}, {x:0,y:-1}];
        const available = dirs.filter(d => this.canMove(d.x, d.y) && (d.x !== -this.dir.x || d.y !== -this.dir.y));
        if (available.length > 0) {
            this.dir = available[Math.floor(Math.random() * available.length)];
        } else {
            this.dir = dirs.find(d => this.canMove(d.x, d.y)) || {x:0, y:0};
        }
    }

    update() {
        const centerX = Math.floor(this.x / TILE_SIZE) * TILE_SIZE + TILE_SIZE / 2;
        const centerY = Math.floor(this.y / TILE_SIZE) * TILE_SIZE + TILE_SIZE / 2;
        
        if (Math.abs(this.x - centerX) < this.speed && Math.abs(this.y - centerY) < this.speed) {
            if (!this.canMove(this.dir.x, this.dir.y) || Math.random() < 0.2) {
                this.pickNewDirection();
            }
        }
        this.move();
    }

    draw() {
        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.beginPath();
        ctx.fillStyle = this.scared ? "#0000ff" : this.color;
        ctx.shadowBlur = 10;
        ctx.shadowColor = this.scared ? "#0000ff" : this.color;
        ctx.arc(0, -2, this.radius, Math.PI, 0);
        ctx.lineTo(this.radius, this.radius);
        ctx.lineTo(-this.radius, this.radius);
        ctx.fill();
        ctx.fillStyle = "#fff";
        ctx.beginPath();
        ctx.arc(-3, -3, 2, 0, Math.PI * 2);
        ctx.arc(3, -3, 2, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
    }
}

let pacman = new Pacman(9, 15);
let ghosts = [];

function initGame() {
    map = originalMap.map(row => [...row]);
    pelletsLeft = 0;
    score = 0;
    level = 1;
    lives = 3;
    scoreElement.textContent = score;
    levelElement.textContent = level;
    livesElement.textContent = lives;
    for(let r=0; r<ROWS; r++) {
        for(let c=0; c<COLS; c++) {
            if(map[r][c] === 0 || map[r][c] === 3) pelletsLeft++;
        }
    }
    resetEntities();
}

function resetEntities() {
    pacman.reset();
    ghosts = [
        new Ghost(9, 8, "#ff0000"),
        new Ghost(8, 9, "#ffb8ff"),
        new Ghost(9, 9, "#00ffff"),
        new Ghost(10, 9, "#ffb852")
    ];
    ghosts.forEach(g => g.pickNewDirection());
}

function update() {
    if (!gameActive) return;
    pacman.move();
    
    const col = Math.floor(pacman.x / TILE_SIZE);
    const row = Math.floor(pacman.y / TILE_SIZE);
    
    if (row >= 0 && row < ROWS && col >= 0 && col < COLS) {
        if (map[row][col] === 0) {
            map[row][col] = 2;
            score += 10;
            pelletsLeft--;
            scoreElement.textContent = score;
        } else if (map[row][col] === 3) {
            map[row][col] = 2;
            score += 50;
            pelletsLeft--;
            scoreElement.textContent = score;
            activatePowerMode();
        }
    }

    ghosts.forEach(ghost => {
        ghost.update();
        const dx = pacman.x - ghost.x;
        const dy = pacman.y - ghost.y;
        if (Math.sqrt(dx*dx + dy*dy) < TILE_SIZE * 0.75) {
            if (ghost.scared) {
                score += 200;
                scoreElement.textContent = score;
                ghost.reset();
                ghost.scared = false;
                ghost.pickNewDirection();
            } else {
                handleDeath();
            }
        }
    });
    if (pelletsLeft === 0) handleWin();
}

function activatePowerMode() {
    powerMode = true;
    ghosts.forEach(g => g.scared = true);
    if (powerTimer) clearTimeout(powerTimer);
    powerTimer = setTimeout(() => {
        powerMode = false;
        ghosts.forEach(g => g.scared = false);
    }, 8000);
}

function handleDeath() {
    lives--;
    livesElement.textContent = lives;
    gameActive = false;
    if (lives <= 0) {
        showOverlay("遊戲結束", `最終得分: ${score}`);
    } else {
        setTimeout(() => {
            resetEntities();
            gameActive = true;
        }, 1000);
    }
}

function handleWin() {
    gameActive = false;
    level++;
    levelElement.textContent = level;
    showOverlay("下一關", "準備好迎接下一關嗎？");
}

function draw() {
    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    for (let r = 0; r < ROWS; r++) {
        for (let c = 0; c < COLS; c++) {
            const x = c * TILE_SIZE;
            const y = r * TILE_SIZE;
            if (map[r][c] === 1) {
                ctx.fillStyle = "#1a1a3a";
                ctx.strokeStyle = "#4d4dff";
                ctx.lineWidth = 2;
                ctx.strokeRect(x+2, y+2, TILE_SIZE-4, TILE_SIZE-4);
            } else if (map[r][c] === 0) {
                ctx.fillStyle = "#ffb8ae";
                ctx.beginPath();
                ctx.arc(x + TILE_SIZE/2, y + TILE_SIZE/2, 2, 0, Math.PI * 2);
                ctx.fill();
            } else if (map[r][c] === 3) {
                ctx.fillStyle = "#ffb8ae";
                ctx.shadowBlur = 10;
                ctx.shadowColor = "#fff";
                ctx.beginPath();
                ctx.arc(x + TILE_SIZE/2, y + TILE_SIZE/2, 5, 0, Math.PI * 2);
                ctx.fill();
                ctx.shadowBlur = 0;
            }
        }
    }
    pacman.draw();
    ghosts.forEach(g => g.draw());
}

function gameLoop() {
    update();
    draw();
    requestAnimationFrame(gameLoop);
}

function showOverlay(title, text) {
    overlayTitle.textContent = title;
    overlayText.textContent = text;
    overlay.style.display = "flex";
}

startBtn.addEventListener('click', () => {
    if (lives <= 0 || pelletsLeft === 0) initGame();
    overlay.style.display = "none";
    gameActive = true;
});

window.addEventListener('keydown', (e) => {
    switch(e.key) {
        case 'ArrowUp': pacman.nextDir = { x: 0, y: -1 }; break;
        case 'ArrowDown': pacman.nextDir = { x: 0, y: 1 }; break;
        case 'ArrowLeft': pacman.nextDir = { x: -1, y: 0 }; break;
        case 'ArrowRight': pacman.nextDir = { x: 1, y: 0 }; break;
        case ' ': if (!gameActive) startBtn.click(); break;
    }
});

initGame();
gameLoop();
