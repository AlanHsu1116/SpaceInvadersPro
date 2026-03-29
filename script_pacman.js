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

// 地圖定義: 1=牆, 0=豆子, 2=空地, 3=能量豆, 4=鬼魂起點, 5=玩家起點
const originalMap = [
    [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1],
    [1,0,0,0,0,0,0,0,0,1,0,0,0,0,0,0,0,0,1],
    [1,3,1,1,0,1,1,1,0,1,0,1,1,1,0,1,1,3,1],
    [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
    [1,0,1,1,0,1,0,1,1,1,1,1,0,1,0,1,1,0,1],
    [1,0,0,0,0,1,0,0,0,1,0,0,0,1,0,0,0,0,1],
    [1,1,1,1,0,1,1,1,2,1,2,1,1,1,0,1,1,1,1],
    [2,2,2,1,0,1,2,2,2,2,2,2,2,1,0,1,2,2,2],
    [1,1,1,1,0,1,2,1,1,4,1,1,2,1,0,1,1,1,1],
    [2,2,2,2,0,2,2,1,2,2,2,1,2,2,0,2,2,2,2],
    [1,1,1,1,0,1,2,1,1,1,1,1,2,1,0,1,1,1,1],
    [2,2,2,1,0,1,2,2,2,2,2,2,2,1,0,1,2,2,2],
    [1,1,1,1,0,1,2,1,1,1,1,1,2,1,0,1,1,1,1],
    [1,0,0,0,0,0,0,0,0,1,0,0,0,0,0,0,0,0,1],
    [1,0,1,1,0,1,1,1,0,1,0,1,1,1,0,1,1,0,1],
    [1,3,0,1,0,0,0,0,0,5,0,0,0,0,0,1,0,3,1],
    [1,1,0,1,0,1,0,1,1,1,1,1,0,1,0,1,0,1,1],
    [1,0,0,0,0,1,0,0,0,1,0,0,0,1,0,0,0,0,1],
    [1,0,1,1,1,1,1,1,0,1,0,1,1,1,1,1,1,0,1],
    [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
    [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1]
];

let map = [];

// 角色對象
class Entity {
    constructor(x, y, speed) {
        this.startX = x;
        this.startY = y;
        this.reset();
        this.baseSpeed = speed;
        this.speed = speed;
        this.radius = TILE_SIZE / 2 - 2;
    }

    reset() {
        this.x = this.startX * TILE_SIZE + TILE_SIZE / 2;
        this.y = this.startY * TILE_SIZE + TILE_SIZE / 2;
        this.dir = { x: 0, y: 0 };
        this.nextDir = { x: 0, y: 0 };
    }

    getMapPos() {
        return {
            col: Math.floor(this.x / TILE_SIZE),
            row: Math.floor(this.y / TILE_SIZE)
        };
    }

    canMove(dx, dy) {
        // 預測移動後的中心點是否會撞牆
        const margin = 2;
        const nextX = this.x + dx * (TILE_SIZE / 2 + margin);
        const nextY = this.y + dy * (TILE_SIZE / 2 + margin);
        
        const nextCol = Math.floor(nextX / TILE_SIZE);
        const nextRow = Math.floor(nextY / TILE_SIZE);
        
        // 邊界檢查
        if (nextCol < 0 || nextCol >= COLS) return true;
        if (nextRow < 0 || nextRow >= ROWS) return false;

        const tile = map[nextRow][nextCol];
        return tile !== 1;
    }

    move() {
        // 容錯判定中心點 (更寬鬆的 4 像素範圍)
        const centerX = Math.floor(this.x / TILE_SIZE) * TILE_SIZE + TILE_SIZE / 2;
        const centerY = Math.floor(this.y / TILE_SIZE) * TILE_SIZE + TILE_SIZE / 2;
        const onCenter = Math.abs(this.x - centerX) <= this.speed && Math.abs(this.y - centerY) <= this.speed;

        // 嘗試轉向
        if (this.nextDir.x !== 0 || this.nextDir.y !== 0) {
            // 如果是 180 度大轉彎，隨時可以轉
            const isReverse = (this.nextDir.x === -this.dir.x && this.nextDir.x !== 0) || 
                             (this.nextDir.y === -this.dir.y && this.nextDir.y !== 0);
            
            if (isReverse || onCenter) {
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

            // 邊界傳送
            if (this.x < -TILE_SIZE/2) this.x = canvas.width + TILE_SIZE/2;
            if (this.x > canvas.width + TILE_SIZE/2) this.x = -TILE_SIZE/2;
        } else {
            // 撞牆時對齊中心
            this.x = centerX;
            this.y = centerY;
        }
    }
}

class Pacman extends Entity {
    constructor(x, y) {
        super(x, y, 2);
        this.mouthOpen = 0;
        this.mouthSpeed = 0.15;
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
        super(x, y, 1.5);
        this.color = color;
        this.scared = false;
        this.randomDir();
    }

    randomDir() {
        const dirs = [{x:1,y:0}, {x:-1,y:0}, {x:0,y:1}, {x:0,y:-1}];
        // 過濾掉反方向，除非沒路走
        const available = dirs.filter(d => 
            (d.x !== -this.dir.x || d.y !== -this.dir.y) && this.canMove(d.x, d.y)
        );
        
        if (available.length > 0) {
            this.nextDir = available[Math.floor(Math.random() * available.length)];
        } else {
            this.nextDir = dirs[Math.floor(Math.random() * dirs.length)];
        }
    }

    update() {
        const centerX = Math.floor(this.x / TILE_SIZE) * TILE_SIZE + TILE_SIZE / 2;
        const centerY = Math.floor(this.y / TILE_SIZE) * TILE_SIZE + TILE_SIZE / 2;
        const onCenter = Math.abs(this.x - centerX) <= this.speed && Math.abs(this.y - centerY) <= this.speed;

        if (onCenter) {
            // 在十字路口或撞牆時換方向
            if (!this.canMove(this.dir.x, this.dir.y) || Math.random() < 0.3) {
                this.randomDir();
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

let pacman;
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
    
    resetEntities();
}

function resetEntities() {
    ghosts = [];
    const colors = ["#ff0000", "#ffb8ff", "#00ffff", "#ffb852"];
    let ghostIdx = 0;

    for (let r = 0; r < ROWS; r++) {
        for (let c = 0; c < COLS; c++) {
            if (map[r][c] === 5) {
                if (!pacman) pacman = new Pacman(c, r);
                else pacman.reset();
            }
            if (map[r][c] === 4) {
                ghosts.push(new Ghost(c, r, colors[ghostIdx++ % colors.length]));
            }
            if (map[r][c] === 0 || map[r][c] === 3) pelletsLeft++;
        }
    }
}

function update() {
    if (!gameActive) return;

    pacman.move();
    
    const pos = pacman.getMapPos();
    if (map[pos.row][pos.col] === 0) {
        map[pos.row][pos.col] = 2;
        score += 10;
        pelletsLeft--;
        scoreElement.textContent = score;
    } else if (map[pos.row][pos.col] === 3) {
        map[pos.row][pos.col] = 2;
        score += 50;
        pelletsLeft--;
        scoreElement.textContent = score;
        activatePowerMode();
    }

    ghosts.forEach(ghost => {
        ghost.update();
        
        const dx = pacman.x - ghost.x;
        const dy = pacman.y - ghost.y;
        const dist = Math.sqrt(dx*dx + dy*dy);
        
        if (dist < TILE_SIZE * 0.8) {
            if (ghost.scared) {
                score += 200;
                scoreElement.textContent = score;
                ghost.reset();
                ghost.scared = false;
            } else {
                handleDeath();
            }
        }
    });

    if (pelletsLeft === 0) {
        handleWin();
    }
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
            pacman.reset();
            ghosts.forEach(g => g.reset());
            gameActive = true;
        }, 1000);
    }
}

function handleWin() {
    gameActive = false;
    level++;
    levelElement.textContent = level;
    showOverlay("下一關", "準備好迎接更快的挑戰了嗎？");
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
    if (lives <= 0 || pelletsLeft === 0) {
        initGame();
    }
    overlay.style.display = "none";
    gameActive = true;
});

window.addEventListener('keydown', (e) => {
    switch(e.key) {
        case 'ArrowUp': pacman.nextDir = { x: 0, y: -1 }; break;
        case 'ArrowDown': pacman.nextDir = { x: 0, y: 1 }; break;
        case 'ArrowLeft': pacman.nextDir = { x: -1, y: 0 }; break;
        case 'ArrowRight': pacman.nextDir = { x: 1, y: 0 }; break;
        case ' ': 
            if (!gameActive) startBtn.click();
            break;
    }
});

initGame();
gameLoop();
