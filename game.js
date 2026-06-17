let gameState = 'menu';
let score = 0;
let coins = 100;
let level = 1;
let playerHealth = 100;
let maxHealth = 100;
let inventory = [];

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

let backgroundLayers = {
    space: { sky: null, mountains: null, foreground: null },
    forest: { sky: null, mountains: null, foreground: null, background: null },
    dungeon: { sky: null, mountains: null, foreground: null }
};
let backgroundsLoaded = false;

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
                console.log(`背景图片加载失败: ${theme}/${layer}, 将使用程序生成背景`);
                loadedCount++;
                checkLoaded();
            };
            img.src = `/assets/backgrounds/${theme}/${layer}.png`;
            backgroundLayers[theme][layer] = img;
        });
    });
    
    const forestBg = new Image();
    forestBg.onload = () => {
        loadedCount++;
        checkLoaded();
    };
    forestBg.onerror = () => {
        console.log('森林背景图片加载失败');
        loadedCount++;
        checkLoaded();
    };
    forestBg.src = '/assets/backgrounds/forest/background.png';
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
    ctx = canvas.getContext('2d');
    ctx.imageSmoothingEnabled = false;
    
    loadBackgroundImages();
    
    inventory = [items[0], items[0], items[1]];
    
    initKeyboard();
    initJoystick();
    
    console.log('游戏初始化完成');
}

function updateUI() {
    document.getElementById('score').textContent = score;
    document.getElementById('coins').textContent = coins;
    document.getElementById('level').textContent = level;
    
    const healthPercent = (playerHealth / maxHealth) * 100;
    document.getElementById('healthBar').style.width = healthPercent + '%';
    document.getElementById('healthText').textContent = playerHealth + '/' + maxHealth;
}

function startGameFromMenu(levelNum) {
    level = levelNum;
    score = 0;
    playerHealth = maxHealth;
    
    const themeOrder = ['forest', 'space', 'dungeon'];
    currentTheme = themeOrder[level - 1];
    
    document.getElementById('menuScreen').classList.add('hidden');
    document.getElementById('gameScreen').classList.remove('hidden');
    
    startGame();
}

function startGame() {
    gameRunning = true;
    gamePaused = false;
    enemies = [];
    projectiles = [];
    particles = [];
    cameraX = 0;
    lastSpawnDistance = 0;
    updateUI();
    
    spawnEnemy();
    gameLoop();
}

function gameLoop() {
    if (!gameRunning) return;
    if (gamePaused) {
        requestAnimationFrame(gameLoop);
        return;
    }
    
    update();
    render();
    
    requestAnimationFrame(gameLoop);
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
        if (joystickAngle > -Math.PI/4 && joystickAngle < Math.PI/4) {
            moveDistance += speed;
        } else if (joystickAngle > Math.PI/4 && joystickAngle < 3*Math.PI/4) {
            playerY -= speed * 0.7;
        } else if (joystickAngle < -Math.PI/4 && joystickAngle > -3*Math.PI/4) {
            playerY += speed * 0.7;
        } else {
            moveDistance -= speed * 0.5;
        }
    }
    
    playerY = Math.max(150, Math.min(canvas.height - 100, playerY));
    
    cameraX += moveDistance;
    
    if (cameraX < 0) cameraX = 0;
    if (cameraX > mapWidth - canvas.width) cameraX = mapWidth - canvas.width;
    
    if (cameraX - lastSpawnDistance >= spawnInterval) {
        spawnEnemy();
        lastSpawnDistance = cameraX;
    }
    
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
                playerHealth -= enemy.attack * 0.03;
                updateUI();
            }
        }
    });
    
    enemies = enemies.filter(e => e.x > cameraX - 100 && e.x < cameraX + canvas.width + 200);
    
    projectiles.forEach(p => {
        p.x += p.speed;
        
        enemies.forEach(enemy => {
            const screenX = enemy.x - cameraX;
            if (Math.abs(p.x - screenX) < 20 && Math.abs(p.y - enemy.y) < 20) {
                enemy.hp -= p.damage;
                p.active = false;
                createParticles(enemy.x, enemy.y, '#ff0');
                
                if (enemy.hp <= 0) {
                    enemies = enemies.filter(e => e !== enemy);
                    score += enemy.scoreValue;
                    coins += Math.floor(Math.random() * 20) + 10;
                    updateUI();
                    createParticles(enemy.x, enemy.y, '#0f0');
                }
            }
        });
    });
    
    projectiles = projectiles.filter(p => p.active && p.x < canvas.width + 100);
    
    particles.forEach(p => {
        p.x += p.vx;
        p.y += p.vy;
        p.life--;
    });
    particles = particles.filter(p => p.life > 0);
    
    if (cameraX >= mapWidth - canvas.width - 100) {
        levelComplete();
    }
    
    if (playerHealth <= 0) {
        gameOver();
    }
}

function render() {
    const theme = themes[currentTheme];
    const groundHeight = 80;
    const groundY = canvas.height - groundHeight;
    
    ctx.fillStyle = theme.bgColor;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    if (currentTheme === 'forest' && backgroundLayers.forest.background && backgroundLayers.forest.background.complete) {
        ctx.drawImage(backgroundLayers.forest.background, 0, 0, canvas.width, canvas.height);
    } else if (backgroundsLoaded) {
        const layers = backgroundLayers[currentTheme];
        
        if (layers.sky && layers.sky.complete) {
            ctx.drawImage(layers.sky, -cameraX * theme.parallaxSpeed.sky % 1920, 0, 1920, 720, 0, 0, canvas.width, canvas.height);
            ctx.drawImage(layers.sky, (1920 - cameraX * theme.parallaxSpeed.sky % 1920) % 1920, 0, 1920, 720, canvas.width - (cameraX * theme.parallaxSpeed.sky % canvas.width), 0, canvas.width, canvas.height);
        }
        
        if (layers.mountains && layers.mountains.complete) {
            ctx.drawImage(layers.mountains, -cameraX * theme.parallaxSpeed.mountains % 1920, 0, 1920, 720, 0, 0, canvas.width, canvas.height);
            ctx.drawImage(layers.mountains, (1920 - cameraX * theme.parallaxSpeed.mountains % 1920) % 1920, 0, 1920, 720, canvas.width - (cameraX * theme.parallaxSpeed.mountains % canvas.width), 0, canvas.width, canvas.height);
        }
        
        if (layers.foreground && layers.foreground.complete) {
            ctx.drawImage(layers.foreground, -cameraX * theme.parallaxSpeed.foreground % 1920, 0, 1920, 720, 0, 0, canvas.width, canvas.height);
            ctx.drawImage(layers.foreground, (1920 - cameraX * theme.parallaxSpeed.foreground % 1920) % 1920, 0, 1920, 720, canvas.width - (cameraX * theme.parallaxSpeed.foreground % canvas.width), 0, canvas.width, canvas.height);
        }
    } else {
        for (let i = 0; i < 100; i++) {
            const x = (i * 50 - cameraX * 0.5) % canvas.width;
            const y = (i * 30) % (canvas.height - 100);
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
        ctx.fillStyle = '#ff6600';
        ctx.beginPath();
        ctx.arc(p.x, p.y, 5, 0, Math.PI * 2);
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
    ctx.fillRect(0, y, canvas.width, height);
    
    const stripeWidth = 40;
    const gapWidth = 20;
    const patternWidth = stripeWidth + gapWidth;
    const offset = patternWidth - (cameraX % patternWidth);
    
    ctx.fillStyle = '#2a4a2a';
    
    for (let stripeX = -patternWidth + offset; stripeX < canvas.width + patternWidth; stripeX += patternWidth) {
        ctx.fillRect(stripeX, y + 5, stripeWidth, height - 10);
    }
    
    ctx.fillStyle = '#333';
    ctx.fillRect(0, y + height - 3, canvas.width, 3);
}

function spawnEnemy() {
    const availableEnemies = enemyTypes[currentTheme];
    const enemyType = availableEnemies[Math.floor(Math.random() * availableEnemies.length)];
    
    enemies.push({
        x: cameraX + canvas.width + 100 + Math.random() * 200,
        y: canvas.height - 120,
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
        damage: 15,
        active: true
    });
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

function confirmLuckyBlock() {
    if (!currentLuckyBlock) return;
    if (coins < 50) {
        showInventoryMessage('金币不足！');
        return;
    }
    
    coins -= 50;
    updateUI();
    document.getElementById('luckyBlockModal').classList.add('hidden');
    
    const block = currentLuckyBlock;
    currentLuckyBlock = null;
    
    const rand = Math.random();
    if (rand < 0.8) {
        const rewardCoins = Math.floor(Math.random() * 30) + 10;
        coins += rewardCoins;
        updateUI();
        showInventoryMessage(`🎉 获得 ${rewardCoins} 金币！`);
    } else {
        spawnEnemy();
        showInventoryMessage('⚠️ 刷出了敌人！');
    }
}

function cancelLuckyBlock() {
    document.getElementById('luckyBlockModal').classList.add('hidden');
    currentLuckyBlock = null;
}

function openInventory() {
    const grid = document.getElementById('inventoryItems');
    grid.innerHTML = '';
    
    inventory.forEach((item, index) => {
        const div = document.createElement('div');
        div.className = 'inventory-item';
        div.innerHTML = `<span>${item.emoji}</span><span>${item.name}</span>`;
        div.onclick = () => useItem(index);
        grid.appendChild(div);
    });
    
    document.getElementById('inventoryPage').classList.remove('hidden');
}

function openInventoryFromMenu() {
    previousPage = 'menu';
    document.getElementById('menuScreen').classList.add('hidden');
    openInventory();
}

function closeInventory() {
    document.getElementById('inventoryPage').classList.add('hidden');
    if (previousPage === 'menu') {
        document.getElementById('menuScreen').classList.remove('hidden');
    }
}

function useItem(index) {
    const item = inventory[index];
    if (item.type === 'consumable') {
        if (item.effect.hp) {
            playerHealth = Math.min(maxHealth, playerHealth + item.effect.hp);
            updateUI();
        }
        inventory.splice(index, 1);
        openInventory();
        showInventoryMessage(`使用了 ${item.emoji} ${item.name}`);
    }
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
    if (confirm('确定要退出游戏吗？')) {
        window.close();
    }
}

function initKeyboard() {
    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('keyup', handleKeyUp);
}

function initJoystick() {
    const container = document.getElementById('joystickContainer');
    const knob = document.getElementById('joystickKnob');
    if (!container || !knob) return;
    
    const baseRect = container.getBoundingClientRect();
    const centerX = baseRect.width / 2;
    const centerY = baseRect.height / 2;
    const maxDistance = Math.min(centerX, centerY) - 10;
    
    function updateJoystick(clientX, clientY) {
        const x = clientX - baseRect.left - centerX;
        const y = clientY - baseRect.top - centerY;
        
        joystickAngle = Math.atan2(y, x);
        joystickDistance = Math.min(Math.sqrt(x * x + y * y), maxDistance);
        
        if (joystickDistance > 5) {
            joystickActive = true;
            const knobX = Math.cos(joystickAngle) * joystickDistance;
            const knobY = Math.sin(joystickAngle) * joystickDistance;
            knob.style.transform = `translate(${knobX}px, ${knobY}px)`;
        }
    }
    
    function resetJoystick() {
        joystickActive = false;
        joystickDistance = 0;
        knob.style.transform = 'translate(0, 0)';
    }
    
    container.addEventListener('mousedown', (e) => {
        updateJoystick(e.clientX, e.clientY);
    });
    
    document.addEventListener('mousemove', (e) => {
        if (joystickActive) {
            updateJoystick(e.clientX, e.clientY);
        }
    });
    
    document.addEventListener('mouseup', resetJoystick);
    
    container.addEventListener('touchstart', (e) => {
        const touch = e.touches[0];
        updateJoystick(touch.clientX, touch.clientY);
        e.preventDefault();
    });
    
    document.addEventListener('touchmove', (e) => {
        if (joystickActive) {
            const touch = e.touches[0];
            updateJoystick(touch.clientX, touch.clientY);
        }
        e.preventDefault();
    });
    
    document.addEventListener('touchend', resetJoystick);
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