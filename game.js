let gameState = 'menu';
let score = 0;
let coins = 100;
let level = 1;
let playerHealth = 100;
let maxHealth = 100;
let playerStamina = 100;
let maxStamina = 100;
let inventory = [];
let equipped = { weapon: null, armor: null };

let canvas, ctx;
let gameRunning = false;
let gamePaused = false;
let enemies = [];
let projectiles = [];
let particles = [];
let cameraX = 0;
let mapWidth = 10000;
let currentTheme = 'forest';

let playerX = 100;
let playerY = 300;
let playerSpeed = 1.5;
let lastSpawnDistance = 0;
const spawnInterval = 1000;

let keys = { a: false, d: false };

let joystickActive = false;
let joystickAngle = 0;
let joystickDistance = 0;

let previousPage = 'menu';

let luckyBlocksSpawned = 0;
const maxLuckyBlocks = 5;
let enemiesDefeated = 0;
const blocksPerEnemyCount = 3;

let backgroundLayers = {
    space: { sky: null, mountains: null, foreground: null },
    forest: { sky: null, mountains: null, foreground: null, background: null },
    dungeon: { sky: null, mountains: null, foreground: null }
};
let backgroundsLoaded = false;
let canvasWidth = 800;
let canvasHeight = 400;

const themes = {
    space: {
        bgColor: '#0a0a1a',
        groundColor: '#1a1a3a',
        decoration: '#2a2a5a',
        parallaxSpeed: { sky: 0.1, mountains: 0.3, foreground: 0.7, ground: 1.0 }
    },
    forest: {
        bgColor: '#0d1a0d',
        groundColor: '#1a2a1a',
        decoration: '#2a4a2a',
        parallaxSpeed: { sky: 0.1, mountains: 0.3, foreground: 0.7, ground: 1.0 }
    },
    dungeon: {
        bgColor: '#1a1010',
        groundColor: '#2a1a1a',
        decoration: '#3a2a2a',
        parallaxSpeed: { sky: 0.1, mountains: 0.3, foreground: 0.7, ground: 1.0 }
    }
};

const enemyTypes = {
    forest: [
        { emoji: '🟢', hp: 20, attack: 5, speed: 0.8 },
        { emoji: '👹', hp: 30, attack: 8, speed: 0.6 },
        { emoji: '🧌', hp: 40, attack: 10, speed: 0.5 }
    ],
    space: [
        { emoji: '👾', hp: 25, attack: 6, speed: 1.0 },
        { emoji: '👽', hp: 35, attack: 9, speed: 0.8 },
        { emoji: '🛸', hp: 50, attack: 12, speed: 0.7 }
    ],
    dungeon: [
        { emoji: '💀', hp: 30, attack: 7, speed: 0.7 },
        { emoji: '👻', hp: 40, attack: 10, speed: 0.9 },
        { emoji: '😈', hp: 60, attack: 15, speed: 0.6 }
    ]
};

const items = [
    { id: 'potion_hp', name: '生命药水', emoji: '🧪', type: 'consumable', effect: { hp: 50 }, price: 20 },
    { id: 'potion_sp', name: '体力药水', emoji: '⚡', type: 'consumable', effect: { sp: 20 }, price: 15 },
    { id: 'sword', name: '铁剑', emoji: '⚔️', type: 'weapon', attack: 10, price: 100 },
    { id: 'axe', name: '战斧', emoji: '🪓', type: 'weapon', attack: 15, price: 150 },
    { id: 'bow', name: '弓箭', emoji: '🏹', type: 'weapon', attack: 8, range: true, price: 80 },
    { id: 'armor_iron', name: '铁甲', emoji: '🛡️', type: 'armor', defense: 5, price: 120 },
    { id: 'armor_gold', name: '金甲', emoji: '⚜️', type: 'armor', defense: 10, price: 200 }
];

// ---- 属性 / 体力平衡数值：集中在这里，方便调整 ----
const baseAttack = 15;                 // 空手攻击力
const staminaRegenPerFrame = 0.06;     // 体力恢复速度，约 3.6 点/秒（60fps）
const skillCost = 30;                  // 技能消耗体力
const skillDamage = 40;                // 技能伤害（贯穿弹）
const defensePerPoint = 0.05;          // 每 1 点防御减伤 5%
const maxDamageReduction = 0.8;        // 减伤上限 80%


// 图片是否真的可以安全绘制：complete === true 并不代表解码成功，
// 加载失败（404）的图片同样是 complete === true，但尺寸为 0
function isImageReady(img) {
    return !!img && img.complete === true && (img.naturalWidth || img.width) > 0;
}

function loadBackgroundImages() {
    const themes = ['space', 'forest', 'dungeon'];
    const layers = ['sky', 'mountains', 'foreground'];
    
    let loadedCount = 0;
    let totalImages = themes.length * layers.length + 1;
    
    themes.forEach(theme => {
        layers.forEach(layer => {
            const img = new Image();
            img.onload = () => {
                loadedCount++;
                checkLoaded();
            };
            img.onerror = () => {
                console.warn(`背景图片加载失败: ${img.src}（检查 assets/backgrounds/ 下是否真的有这张图）`);
                loadedCount++;
                checkLoaded();
            };
            // 使用相对路径：GitHub Pages 部署在 /GAME-challenge-hh-hh/ 子目录下，
            // 绝对路径 /assets/... 会指向域名根目录导致 404
            img.src = `assets/backgrounds/${theme}/${layer}.png`;
            backgroundLayers[theme][layer] = img;
        });
    });
    
    const forestBg = new Image();
    forestBg.onload = () => {
        loadedCount++;
        checkLoaded();
    };
    forestBg.onerror = () => {
        console.warn(`背景图片加载失败: ${forestBg.src}（检查 assets/backgrounds/forest/background.png）`);
        loadedCount++;
        checkLoaded();
    };
    forestBg.src = 'assets/backgrounds/forest/background.png';
    backgroundLayers.forest.background = forestBg;
    
    function checkLoaded() {
        if (loadedCount >= totalImages) {
            backgroundsLoaded = true;
            console.log('所有背景图片加载完成！');
        }
    }
}

function initGame() {
    canvas = document.getElementById('gameCanvas');
    
    if (!canvas) {
        console.error('Canvas元素未找到！');
        return;
    }
    
    ctx = canvas.getContext('2d');
    if (!ctx) {
        console.error('无法获取Canvas上下文！');
        return;
    }
    
    ctx.imageSmoothingEnabled = false;
    ctx.imageSmoothingQuality = 'low';
    
    loadBackgroundImages();
    
    inventory = [items[0], items[0], items[1]];
    
    initKeyboard();
    initJoystick();
    
    window.addEventListener('resize', () => {
        if (gameRunning) {
            resizeCanvas();
            playerY = canvasHeight - 100;
        }
    });
    
    // 点击画布关闭快速背包
    canvas.addEventListener('click', () => {
        closeQuickInventory();
    });
    
    console.log('游戏初始化完成');
}

function updateUI() {
    setText('score', score);
    setText('coins', coins);
    setText('level', level);
    
    const healthPercent = (playerHealth / maxHealth) * 100;
    setWidth('healthBar', healthPercent + '%');
    setText('healthText', Math.ceil(playerHealth) + '/' + maxHealth);
    
    const staminaPercent = (playerStamina / maxStamina) * 100;
    setWidth('staminaBar', staminaPercent + '%');
    setText('staminaText', Math.floor(playerStamina) + '/' + maxStamina);
    
    setText('attack', getAttackPower());
    setText('defense', getDefense());
}

// 元素缺失时不要抛异常：浏览器缓存了旧版 index.html 时，
// 新 game.js 会因为拿不到新元素而崩在开局，画面就是一片空白
function setText(id, value) {
    const el = document.getElementById(id);
    if (el) el.textContent = value;
}

function setWidth(id, value) {
    const el = document.getElementById(id);
    if (el) el.style.width = value;
}

function startGameFromMenu(levelNum) {
    level = levelNum;
    score = 0;
    playerHealth = maxHealth;
    playerStamina = maxStamina;
    
    const themeOrder = ['forest', 'space', 'dungeon'];
    currentTheme = themeOrder[level - 1];
    
    document.getElementById('menuScreen').classList.add('hidden');
    document.getElementById('levelSelect').classList.add('hidden');
    document.getElementById('gameScreen').classList.remove('hidden');
    
    setTimeout(() => {
        startGame();
    }, 100);
}

function startGame() {
    gameRunning = true;
    gamePaused = false;
    enemies = [];
    projectiles = [];
    particles = [];
    luckyBlocks = [];
    luckyBlocksSpawned = 0;
    enemiesDefeated = 0;
    cameraX = 0;
    lastSpawnDistance = 0;
    frameErrorReported = false;
    updateUI();
    
    resizeCanvas();
    
    playerY = canvasHeight - 100;
    spawnEnemy();
    gameLoop();
}

function resizeCanvas() {
    if (!canvas || !ctx) return;
    
    const container = canvas.parentElement;
    if (container) {
        const rect = container.getBoundingClientRect();
        const dpr = window.devicePixelRatio || 1;
        
        canvasWidth = rect.width;
        canvasHeight = rect.height;
        
        canvas.width = rect.width * dpr;
        canvas.height = rect.height * dpr;
        
        canvas.style.width = rect.width + 'px';
        canvas.style.height = rect.height + 'px';
        
        // 重置变换并应用DPR缩放
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.scale(dpr, dpr);
        
        ctx.imageSmoothingEnabled = false;
        ctx.imageSmoothingQuality = 'low';
    }
}

let frameErrorReported = false;

function gameLoop() {
    if (!gameRunning) return;
    if (gamePaused) {
        requestAnimationFrame(gameLoop);
        return;
    }
    
    try {
        update();
        render();
    } catch (err) {
        // 单帧异常绝不能让循环停摆：一旦停摆，玩家看到的就是
        // "没有背景也没有人物、地图进不去"，而且没有任何提示，极难排查
        if (!frameErrorReported) {
            frameErrorReported = true;
            console.error('游戏循环出错：', err);
            showGameError(err);
        }
    }
    
    requestAnimationFrame(gameLoop);
}

// 把错误直接画在画布上，比一片空白更容易定位问题
function showGameError(err) {
    if (!ctx || !canvas) return;
    
    const message = String((err && err.message) || err);
    ctx.fillStyle = 'rgba(0, 0, 0, 0.88)';
    ctx.fillRect(0, 0, canvasWidth, canvasHeight);
    ctx.fillStyle = '#ff5252';
    ctx.font = '18px monospace';
    ctx.fillText('⚠️ 游戏运行出错', 20, 40);
    ctx.fillStyle = '#fff';
    ctx.font = '14px monospace';
    ctx.fillText(message.slice(0, 70), 20, 70);
    ctx.fillText('按 F12 打开 Console 查看完整堆栈', 20, 94);
}

function update() {
    let moveDistance = 0;
    
    if (keys.d) {
        moveDistance = playerSpeed;
    } else if (keys.a) {
        moveDistance = -playerSpeed * 0.5;
    }
    
    if (joystickActive && joystickDistance > 10) {
        const speed = playerSpeed * (joystickDistance / 35);
        if (joystickAngle > -Math.PI/2 && joystickAngle < Math.PI/2) {
            moveDistance += speed;
        } else {
            moveDistance -= speed;
        }
    }
    
    cameraX += moveDistance;
    
    if (cameraX < 0) cameraX = 0;
    if (cameraX > mapWidth - canvasWidth) cameraX = mapWidth - canvasWidth;
    
    if (cameraX - lastSpawnDistance >= spawnInterval) {
        spawnEnemy();
        lastSpawnDistance = cameraX;
    }
    
    checkLuckyBlockCollision();
    
    enemies.forEach(enemy => {
        const screenX = enemy.x - cameraX;
        
        if (!enemy.active && screenX < 300 && screenX > -50) {
            enemy.active = true;
        }
        
        if (enemy.active) {
            const playerScreenX = playerX;
            
            if (screenX > playerScreenX) {
                enemy.x -= enemy.speed * 0.6;
            }
            
            if (screenX <= playerScreenX + 60 && screenX > playerScreenX - 20) {
                // 护甲按比例减伤（每点 5%，上限 80%）
                playerHealth -= enemy.attack * 0.03 * (1 - getDamageReduction());
                updateUI();
            }
        }
    });
    
    enemies = enemies.filter(e => e.x > cameraX - 100 && e.x < cameraX + canvasWidth + 200);
    
    projectiles.forEach(p => {
        p.x += p.speed;
        
        for (const enemy of enemies) {
            const screenX = enemy.x - cameraX;
            if (Math.abs(p.x - screenX) >= 20 || Math.abs(p.y - enemy.y) >= 20) continue;
            
            // 贯穿弹（技能）可以打穿多个敌人，但同一个敌人只结算一次
            if (p.pierce) {
                if (!p.hits) p.hits = [];
                if (p.hits.includes(enemy)) continue;
                p.hits.push(enemy);
            } else {
                p.active = false;
            }
            
            enemy.hp -= p.damage;
            createParticles(enemy.x, enemy.y, '#ff0');
            
            if (enemy.hp <= 0) {
                enemies = enemies.filter(e => e !== enemy);
                score += enemy.scoreValue;
                coins += Math.floor(Math.random() * 20) + 10;
                updateUI();
                createParticles(enemy.x, enemy.y, '#0f0');
                
                enemiesDefeated++;
                checkLuckyBlockSpawn();
            }
            
            if (!p.active) break;
        }
    });
    
    projectiles = projectiles.filter(p => p.active && p.x < canvasWidth + 100);
    
    particles.forEach(p => {
        p.x += p.vx;
        p.y += p.vy;
        p.life--;
    });
    particles = particles.filter(p => p.life > 0);
    
    // 体力随时间自动恢复
    if (playerStamina < maxStamina) {
        playerStamina = Math.min(maxStamina, playerStamina + staminaRegenPerFrame);
        updateUI();
    }
    
    if (cameraX >= mapWidth - canvasWidth - 100) {
        levelComplete();
    }
    
    if (playerHealth <= 0) {
        gameOver();
    }
}

function render() {
    if (!ctx || !canvas) {
        console.error('渲染失败：Canvas或上下文不存在');
        return;
    }
    
    const theme = themes[currentTheme];
    const groundHeight = 80;
    const groundY = canvasHeight - groundHeight;
    
    ctx.fillStyle = theme.bgColor;
    ctx.fillRect(0, 0, canvasWidth, canvasHeight);
    
    // 背景图只有真正解码成功才能画。用 404/损坏的图片去 drawImage，
    // 在部分浏览器会抛 IndexSizeError，异常会把整个渲染循环打死 ——
    // 表现就是"没有背景图也没有人物、地图进不去"，所以这里必须严格判断。
    const layers = backgroundLayers[currentTheme];
    const forestBg = backgroundLayers.forest.background;
    let backgroundDrawn = false;
    
    if (currentTheme === 'forest' && isImageReady(forestBg)) {
        // 整张背景图直接填满整个画布，随画布尺寸缩放
        ctx.drawImage(forestBg, 0, 0, forestBg.naturalWidth, forestBg.naturalHeight, 0, 0, canvasWidth, canvasHeight);
        backgroundDrawn = true;
    } else if (backgroundsLoaded) {
        if (isImageReady(layers.sky)) {
            ctx.drawImage(layers.sky, -cameraX * theme.parallaxSpeed.sky % 1920, 0, 1920, 720, 0, 0, canvasWidth, canvasHeight);
            ctx.drawImage(layers.sky, (1920 - cameraX * theme.parallaxSpeed.sky % 1920) % 1920, 0, 1920, 720, canvasWidth - (cameraX * theme.parallaxSpeed.sky % canvasWidth), 0, canvasWidth, canvasHeight);
            backgroundDrawn = true;
        }
        
        if (isImageReady(layers.mountains)) {
            ctx.drawImage(layers.mountains, -cameraX * theme.parallaxSpeed.mountains % 1920, 0, 1920, 720, 0, 0, canvasWidth, canvasHeight);
            ctx.drawImage(layers.mountains, (1920 - cameraX * theme.parallaxSpeed.mountains % 1920) % 1920, 0, 1920, 720, canvasWidth - (cameraX * theme.parallaxSpeed.mountains % canvasWidth), 0, canvasWidth, canvasHeight);
            backgroundDrawn = true;
        }
        
        if (isImageReady(layers.foreground)) {
            ctx.drawImage(layers.foreground, -cameraX * theme.parallaxSpeed.foreground % 1920, 0, 1920, 720, 0, 0, canvasWidth, canvasHeight);
            ctx.drawImage(layers.foreground, (1920 - cameraX * theme.parallaxSpeed.foreground % 1920) % 1920, 0, 1920, 720, canvasWidth - (cameraX * theme.parallaxSpeed.foreground % canvasWidth), 0, canvasWidth, canvasHeight);
            backgroundDrawn = true;
        }
    }
    
    // 一张背景都没画出来（图片缺失或加载失败）时，用程序生成的星空兜底
    if (!backgroundDrawn) {
        for (let i = 0; i < 100; i++) {
            const x = (i * 50 - cameraX * 0.5) % canvasWidth;
            const y = (i * 30) % (canvasHeight - 100);
            ctx.fillStyle = '#fff';
            ctx.globalAlpha = 0.3 + Math.random() * 0.3;
            ctx.fillRect(x, y, 2, 2);
        }
        ctx.globalAlpha = 1;
    }
    
    drawGround(theme, groundY, groundHeight);
    
    ctx.fillStyle = '#00ff88';
    ctx.font = '32px Arial';
    ctx.fillText('🧙', playerX, playerY);
    
    luckyBlocks.forEach(block => {
        if (block.opened) return;
        
        const screenX = block.x - cameraX;
        const blockEmojis = {
            wooden: '📦',
            iron: '📦',
            gold: '📦',
            diamond: '💎',
            legendary: '✨'
        };
        
        ctx.font = '32px Arial';
        ctx.fillText(blockEmojis[block.type] || '📦', screenX, block.y);
    });
    
    enemies.forEach(enemy => {
        const screenX = enemy.x - cameraX;
        ctx.font = '32px Arial';
        ctx.fillText(enemy.emoji, screenX, enemy.y);
        
        ctx.fillStyle = '#333';
        ctx.fillRect(screenX - 15, enemy.y - 45, 40, 8);
        ctx.fillStyle = '#f00';
        ctx.fillRect(screenX - 15, enemy.y - 45, 40 * (enemy.hp / enemy.maxHp), 8);
    });
    
    projectiles.forEach(p => {
        ctx.fillStyle = p.skill ? '#b388ff' : '#ff6600';
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.skill ? 8 : 5, 0, Math.PI * 2);
        ctx.fill();
    });
    
    particles.forEach(p => {
        ctx.fillStyle = p.color;
        ctx.globalAlpha = p.life / 30;
        ctx.fillRect(p.x, p.y, 4, 4);
    });
    ctx.globalAlpha = 1;
}

function drawGround(theme, y, height) {
    ctx.fillStyle = theme.groundColor;
    ctx.fillRect(0, y, canvasWidth, height);
    
    const stripeWidth = 40;
    const gapWidth = 20;
    const patternWidth = stripeWidth + gapWidth;
    const offset = patternWidth - (cameraX % patternWidth);
    
    ctx.fillStyle = '#2a4a2a';
    
    for (let stripeX = -patternWidth + offset; stripeX < canvasWidth + patternWidth; stripeX += patternWidth) {
        ctx.fillRect(stripeX, y + 5, stripeWidth, height - 10);
    }
    
    ctx.fillStyle = '#333';
    ctx.fillRect(0, y + height - 3, canvasWidth, 3);
}

function spawnEnemy() {
    const availableEnemies = enemyTypes[currentTheme];
    const enemyType = availableEnemies[Math.floor(Math.random() * availableEnemies.length)];
    
    enemies.push({
        // 生成点必须落在 update() 的剔除线（cameraX + canvasWidth + 200）以内，
        // 否则约一半敌人刚生成就被下一帧过滤掉
        x: cameraX + canvasWidth + 50 + Math.random() * 100,
        y: canvasHeight - 120,
        emoji: enemyType.emoji,
        hp: enemyType.hp + level * 10,
        maxHp: enemyType.hp + level * 10,
        attack: enemyType.attack + level * 2,
        speed: enemyType.speed,
        scoreValue: enemyType.hp * 2,
        active: false
    });
}

function playerAttack() {
    projectiles.push({
        x: playerX + 20,
        y: playerY - 10,
        speed: 8,
        damage: getAttackPower(),
        active: true
    });
}

// ---- 属性计算 ----

// 攻击力 = 基础攻击 + 已装备武器攻击
function getAttackPower() {
    return baseAttack + (equipped.weapon && equipped.weapon.attack ? equipped.weapon.attack : 0);
}

// 防御力 = 已装备护甲防御
function getDefense() {
    return equipped.armor && equipped.armor.defense ? equipped.armor.defense : 0;
}

// 减伤比例：每点防御 5%，上限 80%（铁甲 25%、金甲 50%）
function getDamageReduction() {
    return Math.min(maxDamageReduction, getDefense() * defensePerPoint);
}

// ---- 技能：消耗体力发射贯穿弹 ----

function playerSkill() {
    if (!gameRunning || gamePaused) return;
    
    if (playerStamina < skillCost) {
        showInventoryMessage(`体力不足！技能需要 ${skillCost} 点体力`);
        return;
    }
    
    playerStamina -= skillCost;
    updateUI();
    
    projectiles.push({
        x: playerX + 20,
        y: playerY - 10,
        speed: 10,
        damage: skillDamage,
        pierce: true,
        skill: true,
        hits: [],
        active: true
    });
    
    createParticles(playerX + 20, playerY - 10, '#b388ff');
}

function createParticles(x, y, color) {
    for (let i = 0; i < 10; i++) {
        particles.push({
            x: x,
            y: y,
            vx: (Math.random() - 0.5) * 6,
            vy: (Math.random() - 0.5) * 6,
            life: 30,
            color: color
        });
    }
}

function pauseGame() {
    gamePaused = true;
    document.getElementById('pauseModal').classList.remove('hidden');
}

function resumeGame() {
    gamePaused = false;
    document.getElementById('pauseModal').classList.add('hidden');
}

function restartCurrentLevel() {
    document.getElementById('pauseModal').classList.add('hidden');
    startGameFromMenu(level);
}

function backToMenu() {
    gameRunning = false;
    document.getElementById('pauseModal').classList.add('hidden');
    document.getElementById('levelCompleteModal').classList.add('hidden');
    document.getElementById('resultModal').classList.add('hidden');
    document.getElementById('gameScreen').classList.add('hidden');
    document.getElementById('menuScreen').classList.remove('hidden');
}

function levelComplete() {
    gameRunning = false;
    document.getElementById('levelCompleteText').textContent = `关卡 ${level} 完成！\n得分: ${score}\n金币: ${coins}`;
    
    if (level >= 3) {
        document.getElementById('nextLevelBtn').style.display = 'none';
    } else {
        document.getElementById('nextLevelBtn').style.display = 'inline-block';
    }
    
    document.getElementById('levelCompleteModal').classList.remove('hidden');
}

function nextLevel() {
    document.getElementById('levelCompleteModal').classList.add('hidden');
    startGameFromMenu(level + 1);
}

function gameOver() {
    gameRunning = false;
    showResult('游戏结束', '你的血量已耗尽！');
}

function showResult(title, text) {
    document.getElementById('resultTitle').textContent = title;
    document.getElementById('resultText').textContent = text;
    document.getElementById('resultModal').classList.remove('hidden');
}

function handleResultClose() {
    document.getElementById('resultModal').classList.add('hidden');
    backToMenu();
}

function showLevelSelect() {
    previousPage = 'menu';
    document.getElementById('menuScreen').classList.add('hidden');
    document.getElementById('levelSelect').classList.remove('hidden');
}

function closeLevelSelect() {
    document.getElementById('levelSelect').classList.add('hidden');
    if (previousPage === 'menu') {
        document.getElementById('menuScreen').classList.remove('hidden');
    }
}

let currentLuckyBlock = null;
let luckyBlocks = [];

function checkLuckyBlockSpawn() {
    if (luckyBlocksSpawned >= maxLuckyBlocks) return;
    
    const blocksToSpawn = Math.floor(enemiesDefeated / blocksPerEnemyCount) - luckyBlocksSpawned;
    
    for (let i = 0; i < blocksToSpawn && luckyBlocksSpawned < maxLuckyBlocks; i++) {
        spawnLuckyBlock();
        luckyBlocksSpawned++;
        showInventoryMessage('🎁 出现了幸运方块！');
    }
}

function spawnLuckyBlock(isInitial = false) {
    const types = ['wooden', 'iron', 'gold', 'diamond', 'legendary'];
    const weights = currentTheme === 'forest' ? [0.5, 0.3, 0.1, 0.09, 0.01] : [0.2, 0.4, 0.25, 0.12, 0.03];
    
    let rand = Math.random();
    let type = 'wooden';
    for (let i = 0; i < weights.length; i++) {
        rand -= weights[i];
        if (rand <= 0) {
            type = types[i];
            break;
        }
    }
    
    let xPos;
    if (isInitial) {
        xPos = cameraX + 300 + Math.random() * 300;
    } else {
        xPos = cameraX + canvasWidth + Math.random() * 500;
    }
    
    luckyBlocks.push({
        x: xPos,
        y: canvasHeight - 130,
        type: type,
        opened: false,
        declined: false
    });
}

function checkLuckyBlockCollision() {
    luckyBlocks.forEach(block => {
        if (block.opened || block.declined) return;
        
        const screenX = block.x - cameraX;
        const distance = Math.abs(screenX - playerX);
        
        if (distance < 50 && !currentLuckyBlock) {
            currentLuckyBlock = block;
            showLuckyBlockDialog(block);
        }
    });
    
    luckyBlocks = luckyBlocks.filter(b => b.x > cameraX - 200 && b.x < cameraX + canvasWidth + 500);
}

function showLuckyBlockDialog(block) {
    const blockNames = {
        wooden: '木质幸运方块',
        iron: '铁质幸运方块',
        gold: '金质幸运方块',
        diamond: '钻石幸运方块',
        legendary: '传奇幸运方块'
    };
    
    const blockColors = {
        wooden: '#8B4513',
        iron: '#A8A8A8',
        gold: '#FFD700',
        diamond: '#00FFFF',
        legendary: '#FF00FF'
    };
    
    document.getElementById('luckyBlockTitle').textContent = `发现${blockNames[block.type]}！`;
    document.getElementById('luckyBlockMessage').textContent = '花费50金币开启，可能获得金币奖励或遭遇敌人！';
    // 边框要设在弹窗内容上，设在遮罩层上是看不到的
    document.querySelector('#luckyBlockModal .modal-content').style.borderColor = blockColors[block.type];
    document.getElementById('luckyBlockModal').classList.remove('hidden');
}

function confirmLuckyBlock() {
    if (!currentLuckyBlock) {
        showInventoryMessage('未找到幸运方块！');
        return;
    }
    if (coins < 50) {
        showInventoryMessage('金币不足！需要50金币');
        return;
    }
    
    coins -= 50;
    updateUI();
    document.getElementById('luckyBlockModal').classList.add('hidden');
    
    const block = currentLuckyBlock;
    block.opened = true;
    currentLuckyBlock = null;
    
    const rewards = {
        wooden: { coins: [10, 20, 30], enemyChance: 0.3 },
        iron: { coins: [20, 40, 60], enemyChance: 0.2 },
        gold: { coins: [50, 80, 120], enemyChance: 0.15 },
        diamond: { coins: [100, 150, 200], enemyChance: 0.1 },
        legendary: { coins: [200, 300, 500], enemyChance: 0.05 }
    };
    
    const reward = rewards[block.type];
    const rand = Math.random();
    
    if (rand < reward.enemyChance) {
        spawnEnemy();
        spawnEnemy();
        showInventoryMessage('⚠️ 刷出了敌人！');
    } else {
        const rewardCoins = reward.coins[Math.floor(Math.random() * reward.coins.length)];
        coins += rewardCoins;
        updateUI();
        showInventoryMessage(`🎉 获得 ${rewardCoins} 金币！`);
    }
}

function cancelLuckyBlock() {
    document.getElementById('luckyBlockModal').classList.add('hidden');
    // 标记为已拒绝，否则玩家还站在方块旁边，下一帧就会再次弹出对话框（取消按钮等于失效）
    if (currentLuckyBlock) {
        currentLuckyBlock.declined = true;
    }
    currentLuckyBlock = null;
}

function openInventory() {
    // 局内：显示半圆形快速背包，不暂停游戏
    if (gameRunning) {
        const container = document.getElementById('quickInventory');
        if (!container) {
            // 浏览器缓存了旧版 index.html 时没有这个容器，退回整页背包，
            // 至少别让"道具"按钮点了毫无反应
            openInventoryPage();
            return;
        }
        renderQuickInventory();
        container.classList.toggle('hidden');
        return;
    }
    
    openInventoryPage();
}

// 整页背包（主菜单用）
function openInventoryPage() {
    const grid = document.getElementById('inventoryItems');
    if (!grid) return;
    
    grid.innerHTML = '';
    
    inventory.forEach((item, index) => {
        const div = document.createElement('div');
        div.className = 'inventory-item' + (isEquipped(item) ? ' equipped' : '');
        div.innerHTML = `<span>${item.emoji}</span><span>${item.name}</span>` +
            (isEquipped(item) ? '<span class="equipped-badge">已装备</span>' : '');
        div.onclick = () => useItem(index);
        grid.appendChild(div);
    });
    
    const page = document.getElementById('inventoryPage');
    if (page) page.classList.remove('hidden');
}

// 渲染半圆形快速背包
function renderQuickInventory() {
    const container = document.getElementById('quickInventory');
    if (!container) return;
    
    container.innerHTML = '';
    
    const itemCount = inventory.length;
    if (itemCount === 0) return;
    
    // 动态获取道具按钮位置，让圆心对准按钮中心
    const itemBtn = document.querySelector('.action-btn.item') || 
                    document.querySelector('.mobile-btn.item-btn');
    if (itemBtn) {
        const rect = itemBtn.getBoundingClientRect();
        const centerX = rect.left + rect.width / 2;
        const centerY = rect.top + rect.height / 2;
        container.style.left = centerX + 'px';
        container.style.top = centerY + 'px';
        container.style.bottom = 'auto';
        container.style.right = 'auto';
    }
    
    const radius = 90; // 半圆半径
    // 上半圆：从 180°（左）到 0°（右），物品在圆心上方
    const startAngle = Math.PI;   // 180° 正左
    const endAngle = 0;           // 0° 正右
    const angleStep = itemCount > 1 ? (startAngle - endAngle) / (itemCount - 1) : 0;
    
    inventory.forEach((item, index) => {
        const angle = startAngle - angleStep * index;
        const x = Math.cos(angle) * radius;
        const y = -Math.sin(angle) * radius; // 负号表示向上（HTML y轴向下为正）
        
        const div = document.createElement('div');
        div.className = 'quick-item' + (isEquipped(item) ? ' equipped' : '');
        div.style.left = x + 'px';
        div.style.top = y + 'px';
        div.style.transitionDelay = (index * 0.03) + 's';
        div.innerHTML = `<span class="item-emoji">${item.emoji}</span><span>${item.name}</span>` +
            (isEquipped(item) ? '<span class="equipped-mark">E</span>' : '');
        div.onclick = (e) => {
            e.stopPropagation();
            useItem(index);
        };
        container.appendChild(div);
    });
}

function closeQuickInventory() {
    const container = document.getElementById('quickInventory');
    if (container) container.classList.add('hidden');
}

function openInventoryFromMenu() {
    previousPage = 'menu';
    document.getElementById('menuScreen').classList.add('hidden');
    openInventory();
}

function closeInventory() {
    document.getElementById('inventoryPage').classList.add('hidden');
    closeQuickInventory();
    
    if (previousPage === 'menu') {
        document.getElementById('menuScreen').classList.remove('hidden');
    }
}

function isEquipped(item) {
    return equipped.weapon === item || equipped.armor === item;
}

// 局内刷新半圆背包，菜单里刷新整页背包
function refreshInventoryUI() {
    if (gameRunning) {
        renderQuickInventory();
    } else {
        openInventory();
    }
}

function useItem(index) {
    const item = inventory[index];
    if (!item) return;
    
    // 武器 / 护甲：点击即装备或卸下，菜单和局内都可以换装
    if (item.type === 'weapon' || item.type === 'armor') {
        const slot = item.type === 'weapon' ? 'weapon' : 'armor';
        
        if (equipped[slot] === item) {
            equipped[slot] = null;
            showInventoryMessage(`已卸下 ${item.emoji} ${item.name}`);
        } else {
            equipped[slot] = item;
            const bonus = item.type === 'weapon'
                ? `攻击 +${item.attack}`
                : `减伤 ${Math.round(item.defense * defensePerPoint * 100)}%`;
            showInventoryMessage(`已装备 ${item.emoji} ${item.name}（${bonus}）`);
        }
        
        updateUI();
        refreshInventoryUI();
        return;
    }
    
    // 消耗品只能在游戏中使用
    if (!gameRunning) {
        showInventoryMessage('只能在游戏中使用道具！');
        return;
    }
    
    let used = false;
    if (item.effect && item.effect.hp) {
        playerHealth = Math.min(maxHealth, playerHealth + item.effect.hp);
        used = true;
    }
    if (item.effect && item.effect.sp) {
        playerStamina = Math.min(maxStamina, playerStamina + item.effect.sp);
        used = true;
    }
    
    // 没有任何实际效果的道具不要白白消耗掉
    if (!used) {
        showInventoryMessage(`${item.emoji} ${item.name} 暂时没有可用的效果`);
        return;
    }
    
    inventory.splice(index, 1);
    updateUI();
    refreshInventoryUI();
    showInventoryMessage(`使用了 ${item.emoji} ${item.name}`);
}

function showInventoryMessage(message) {
    const messageEl = document.createElement('div');
    messageEl.className = 'inventory-message';
    messageEl.textContent = message;
    messageEl.style.position = 'fixed';
    messageEl.style.top = '50%';
    messageEl.style.left = '50%';
    messageEl.style.transform = 'translate(-50%, -50%)';
    messageEl.style.background = '#333';
    messageEl.style.color = '#fff';
    messageEl.style.padding = '15px 25px';
    messageEl.style.borderRadius = '8px';
    messageEl.style.zIndex = '1000';
    messageEl.style.cursor = 'pointer';
    messageEl.style.fontSize = '18px';
    messageEl.style.boxShadow = '0 4px 15px rgba(0,0,0,0.5)';
    messageEl.addEventListener('click', () => {
        messageEl.remove();
    });
    document.body.appendChild(messageEl);
    setTimeout(() => {
        if (messageEl.parentNode) {
            messageEl.remove();
        }
    }, 3000);
}

function openShop() {
    previousPage = 'menu';
    const grid = document.getElementById('shopItems');
    grid.innerHTML = '';
    
    items.forEach(item => {
        const div = document.createElement('div');
        div.className = `shop-item${coins < item.price ? ' disabled' : ''}`;
        div.innerHTML = `
            <span class="emoji">${item.emoji}</span>
            <span class="name">${item.name}</span>
            <span class="price">💰 ${item.price}</span>
        `;
        
        if (coins >= item.price) {
            div.onclick = () => buyItem(item);
        }
        
        grid.appendChild(div);
    });
    
    document.getElementById('menuScreen').classList.add('hidden');
    document.getElementById('shopPage').classList.remove('hidden');
}

function closeShop() {
    document.getElementById('shopPage').classList.add('hidden');
    if (previousPage === 'menu') {
        document.getElementById('menuScreen').classList.remove('hidden');
    }
}

function buyItem(item) {
    if (coins < item.price) return;
    if (inventory.length >= 12) {
        showInventoryMessage('背包已满！');
        return;
    }
    
    coins -= item.price;
    inventory.push(item);
    updateUI();
    renderShop();
    showInventoryMessage(`购买了 ${item.emoji} ${item.name}`);
}

function renderShop() {
    const grid = document.getElementById('shopItems');
    grid.innerHTML = '';
    
    items.forEach(item => {
        const div = document.createElement('div');
        div.className = `shop-item${coins < item.price ? ' disabled' : ''}`;
        div.innerHTML = `
            <span class="emoji">${item.emoji}</span>
            <span class="name">${item.name}</span>
            <span class="price">💰 ${item.price}</span>
        `;
        
        if (coins >= item.price) {
            div.onclick = () => buyItem(item);
        }
        
        grid.appendChild(div);
    });
}

function exitGame() {
    if (!confirm('确定要退出游戏吗？')) return;
    
    // 浏览器只允许关闭由脚本自己打开的窗口，普通标签页会静默失败
    window.close();
    
    setTimeout(() => {
        showInventoryMessage('浏览器不允许网页关闭自己，请手动关闭标签页');
    }, 150);
}

function initKeyboard() {
    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('keyup', handleKeyUp);
}

function initJoystick() {
    const container = document.getElementById('joystickContainer');
    const knob = document.getElementById('joystickKnob');
    
    if (!container || !knob) {
        console.log('Joystick elements not found, will retry...');
        setTimeout(initJoystick, 100);
        return;
    }
    
    console.log('Joystick initialized successfully');
    
    let isDragging = false;
    let startX, startY;
    
    function getPosition(e) {
        if (e.touches && e.touches.length > 0) {
            return { x: e.touches[0].clientX, y: e.touches[0].clientY };
        }
        return { x: e.clientX, y: e.clientY };
    }
    
    function handleStart(e) {
        e.preventDefault();
        isDragging = true;
        const pos = getPosition(e);
        startX = pos.x;
        startY = pos.y;
        handleMove(e);
    }
    
    function handleMove(e) {
        if (!isDragging) return;
        e.preventDefault();
        
        const pos = getPosition(e);
        const rect = container.getBoundingClientRect();
        const centerX = rect.left + rect.width / 2;
        const centerY = rect.top + rect.height / 2;
        
        const dx = pos.x - centerX;
        const dy = pos.y - centerY;
        
        joystickAngle = Math.atan2(dy, dx);
        joystickDistance = Math.min(Math.sqrt(dx * dx + dy * dy), rect.width / 2 - 10);
        joystickActive = joystickDistance > 5;
        
        // 保留 CSS 中用于居中的 translate(-50%, -50%)，否则摇杆帽会偏移半个自身宽高
        const knobX = Math.cos(joystickAngle) * joystickDistance;
        const knobY = Math.sin(joystickAngle) * joystickDistance;
        knob.style.transform = `translate(-50%, -50%) translate(${knobX}px, ${knobY}px)`;
    }
    
    function handleEnd(e) {
        e.preventDefault();
        isDragging = false;
        joystickActive = false;
        joystickDistance = 0;
        knob.style.transform = 'translate(-50%, -50%)';
    }
    
    container.addEventListener('mousedown', handleStart);
    document.addEventListener('mousemove', handleMove);
    document.addEventListener('mouseup', handleEnd);
    
    container.addEventListener('touchstart', handleStart, { passive: false });
    document.addEventListener('touchmove', handleMove, { passive: false });
    document.addEventListener('touchend', handleEnd);
    document.addEventListener('touchcancel', handleEnd);
}

function handleKeyDown(e) {
    if (e.key.toLowerCase() === 'a') {
        keys.a = true;
    }
    if (e.key.toLowerCase() === 'd') {
        keys.d = true;
    }
}

function handleKeyUp(e) {
    if (e.key.toLowerCase() === 'a') {
        keys.a = false;
    }
    if (e.key.toLowerCase() === 'd') {
        keys.d = false;
    }
}

document.addEventListener('DOMContentLoaded', initGame);