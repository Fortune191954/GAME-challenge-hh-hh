#!/usr/bin/env node
/**
 * 像素冒险 RPG - 无依赖冒烟测试（不需要浏览器、不需要 npm install）
 *
 * 用法:
 *   node test-game.js                  # 测试根目录的 game.js（唯一一份代码）
 *   node test-game.js game.js          # 同上，显式指定
 *   node test-game.js 别的路径/game.js  # 测试其它副本
 *
 * 原理: 用 vm 在沙箱里搭一套最小 DOM/Canvas 桩件，注入探针后真实跑游戏循环，
 *       断言核心流程（初始化、刷怪、攻击击杀、装备、体力技能、商店、道具、
 *       幸运方块、关卡完成）。
 */

const fs = require('fs');
const path = require('path');
const vm = require('vm');

// ---------------------------------------------------------------- DOM 桩件

const CTX_CONTEXT_STUB = new Proxy({}, {
    get(target, key) {
        if (key in target) return target[key];
        return () => {};
    },
    set(target, key, value) {
        target[key] = value;
        return true;
    }
});

class El {
    constructor(id = '') {
        this.id = id;
        this.style = {};
        this.dataset = {};
        this.children = [];
        this.textContent = '';
        this.innerHTML = '';
        this.onclick = null;
        this.parentElement = null;
        this._classes = new Set();
        this._listeners = {};
        this.classList = {
            add: (...names) => names.forEach(n => this._classes.add(n)),
            remove: (...names) => names.forEach(n => this._classes.delete(n)),
            contains: name => this._classes.has(name),
            toggle: name => (this._classes.has(name) ? this._classes.delete(name) : this._classes.add(name))
        };
    }
    appendChild(child) { this.children.push(child); return child; }
    removeChild(child) { this.children = this.children.filter(c => c !== child); return child; }
    remove() { }
    addEventListener(type, fn) { (this._listeners[type] = this._listeners[type] || []).push(fn); }
    removeEventListener() { }
    dispatch(type, event) { (this._listeners[type] || []).forEach(fn => fn(event)); }
    getBoundingClientRect() { return { left: 100, top: 100, width: 100, height: 100, right: 200, bottom: 200 }; }
    querySelector() { return null; }
    querySelectorAll() { return []; }
    getContext() { return CTX_CONTEXT_STUB; }
    isVisible() { return !this._classes.has('hidden'); }
}

class ImageStub {
    constructor() { this.width = 1920; this.height = 720; this.complete = false; this._src = ''; }
    set src(value) {
        this._src = value;
        this.complete = true;
        if (typeof this.onload === 'function') this.onload();
    }
    get src() { return this._src; }
}

// 注入到游戏源码末尾的探针：让测试能读写脚本作用域里的 let 变量
const PROBE = `
globalThis.__viewH = () => (typeof canvasHeight === 'undefined' ? 400 : canvasHeight);
globalThis.__peek = () => ({
    score, coins, level, playerHealth, maxHealth,
    enemyCount: enemies.length,
    projectileCount: projectiles.length,
    inventoryCount: inventory.length,
    cameraX, gameRunning, gamePaused,
    canvasWidth: typeof canvasWidth === 'undefined' ? canvas.width : canvasWidth,
    canvasHeight: __viewH(),
    playerStamina: typeof playerStamina === 'undefined' ? -1 : playerStamina,
    maxStamina: typeof maxStamina === 'undefined' ? -1 : maxStamina,
    attackPower: typeof getAttackPower === 'function' ? getAttackPower() : -1,
    defense: typeof getDefense === 'function' ? getDefense() : -1,
    damageReduction: typeof getDamageReduction === 'function' ? getDamageReduction() : -1,
    equippedWeapon: typeof equipped === 'undefined' || !equipped.weapon ? null : equipped.weapon.id,
    equippedArmor: typeof equipped === 'undefined' || !equipped.armor ? null : equipped.armor.id,
    lastProjectileDamage: projectiles.length ? projectiles[projectiles.length - 1].damage : -1,
    lastProjectilePierces: projectiles.length ? !!projectiles[projectiles.length - 1].pierce : false,
    hasSkill: typeof playerSkill === 'function',
    luckyBlockCount: typeof luckyBlocks === 'undefined' ? -1 : luckyBlocks.length,
    luckyBlocksSpawned: typeof luckyBlocksSpawned === 'undefined' ? -1 : luckyBlocksSpawned,
    enemiesDefeated: typeof enemiesDefeated === 'undefined' ? -1 : enemiesDefeated,
    backgroundSrcs: ['space', 'forest', 'dungeon'].map(t => (backgroundLayers[t].sky || {}).src || ''),
    hasQuickInventory: typeof renderQuickInventory === 'function',
    hasLuckyBlockSpawn: typeof spawnLuckyBlock === 'function',
    hasResizeCanvas: typeof resizeCanvas === 'function'
});
globalThis.__setCameraX = v => { cameraX = v; };
globalThis.__setCoins = v => { coins = v; };
globalThis.__setHealth = v => { playerHealth = v; };
globalThis.__setEnemiesDefeated = v => { enemiesDefeated = v; };
globalThis.__setKeys = v => { keys = v; };
globalThis.__clearEnemies = () => { enemies.length = 0; };
globalThis.__addEnemyAtScreen = (screenX, opts) => {
    const enemy = Object.assign({
        x: cameraX + screenX, y: __viewH() - 120, emoji: '🟢',
        hp: 15, maxHp: 15, attack: 0, speed: 0, scoreValue: 20, active: true
    }, opts || {});
    enemies.push(enemy);
    return enemy;
};
globalThis.__placeLuckyBlockAtScreen = (screenX, type) => {
    luckyBlocks.push({ x: cameraX + screenX, y: __viewH() - 130, type: type || 'wooden', opened: false, declined: false });
};
globalThis.__setRandom = v => { Math.random = () => v; };
globalThis.__restoreRandom = v => { Math.random = v; };
globalThis.__setStamina = v => { playerStamina = v; };
globalThis.__giveItem = id => {
    inventory.push(items.find(i => i.id === id));
    return inventory.length - 1;
};
`;

function createHarness(gamePath) {
    const source = fs.readFileSync(gamePath, 'utf8');
    const elements = new Map();
    const getEl = id => {
        if (!elements.has(id)) elements.set(id, new El(id));
        return elements.get(id);
    };

    const canvas = getEl('gameCanvas');
    // index.html 里 canvas 声明为 width="800" height="400"，根目录版本直接用 canvas.width
    canvas.width = 800;
    canvas.height = 400;
    canvas.parentElement = getEl('gameContainer');
    // 还原 index.html 中带 class="... hidden" 的元素初始状态
    ['levelSelect', 'inventoryPage', 'shopPage', 'gameScreen', 'luckyBlockModal',
        'pauseModal', 'levelCompleteModal', 'resultModal', 'quickInventory']
        .forEach(id => getEl(id).classList.add('hidden'));
    canvas.parentElement.getBoundingClientRect = () => ({ left: 0, top: 0, width: 800, height: 400, right: 800, bottom: 400 });

    const documentStub = new El('document');
    documentStub.body = new El('body');
    documentStub.getElementById = getEl;
    const queryCache = new Map();
    documentStub.querySelector = selector => {
        if (!queryCache.has(selector)) queryCache.set(selector, new El(selector));
        return queryCache.get(selector);
    };
    documentStub.querySelectorAll = () => [];
    documentStub.createElement = tag => new El(tag);

    const windowStub = {
        devicePixelRatio: 2,
        closed: false,
        addEventListener() { },
        close() { this.closed = true; }
    };

    let pendingFrame = null;
    const timers = [];
    const logs = [];

    const sandbox = {
        console: {
            log: (...a) => logs.push(['log', a.join(' ')]),
            error: (...a) => logs.push(['error', a.join(' ')]),
            warn: (...a) => logs.push(['warn', a.join(' ')])
        },
        document: documentStub,
        window: windowStub,
        Image: ImageStub,
        confirm: () => true,
        requestAnimationFrame: cb => { pendingFrame = cb; return 1; },
        cancelAnimationFrame: () => { pendingFrame = null; },
        setTimeout: (fn, ms) => { timers.push({ fn, ms }); return timers.length; },
        clearTimeout: () => { }
    };

    const context = vm.createContext(sandbox);
    vm.runInContext(source + '\n' + PROBE, context, { filename: gamePath });

    return {
        path: gamePath,
        sandbox,
        getEl,
        canvas,
        window: windowStub,
        document: documentStub,
        logs,
        peek: () => sandbox.__peek(),
        evalIn: code => vm.runInContext(code, context),
        boot() { documentStub.dispatch('DOMContentLoaded', {}); },
        flushTimers() {
            const due = timers.splice(0, timers.length);
            due.forEach(t => t.fn());
        },
        /** 推进 n 帧游戏循环 */
        step(n = 1) {
            for (let i = 0; i < n; i++) {
                if (!pendingFrame) break;
                const cb = pendingFrame;
                pendingFrame = null;
                cb(i * 16.7);
            }
        }
    };
}

// ---------------------------------------------------------------- 断言工具

const results = [];
function check(name, fn) {
    try {
        fn();
        results.push({ name, status: 'PASS', detail: '' });
    } catch (err) {
        results.push({ name, status: 'FAIL', detail: err.message });
    }
}
function skip(name, reason) {
    results.push({ name, status: 'SKIP', detail: reason });
}
function assert(cond, msg) {
    if (!cond) throw new Error(msg);
}

/** 让一个高攻敌人贴脸打一帧，返回玩家掉血量（用来验证减伤） */
function measureEnemyDamage(h, sandbox) {
    sandbox.__clearEnemies();
    sandbox.__setHealth(100);
    sandbox.__addEnemyAtScreen(100, { attack: 100, hp: 9999, maxHp: 9999, speed: 0 }); // playerX = 100
    h.step(1);
    const taken = 100 - h.peek().playerHealth;
    sandbox.__clearEnemies();
    return taken;
}

// ---------------------------------------------------------------- 测试主体

function runSuite(gamePath) {
    const label = path.relative(process.cwd(), path.resolve(gamePath));
    results.push({ name: `===== ${label} =====`, status: 'HEAD', detail: '' });

    const h = createHarness(gamePath);
    const { sandbox } = h;

    // --- 1. 初始化
    check('DOMContentLoaded 后初始化无异常', () => {
        h.boot();
        const errors = h.logs.filter(([level]) => level === 'error');
        assert(errors.length === 0, '初始化报错: ' + JSON.stringify(errors));
        assert(h.evalIn('typeof startGame') === 'function', 'startGame 未定义');
    });

    // --- 2. 资源路径必须是相对路径（GitHub Pages 子目录部署的关键）
    check('背景资源使用相对路径', () => {
        const { backgroundSrcs } = h.peek();
        assert(backgroundSrcs.every(Boolean), '背景图 src 为空');
        const absolute = backgroundSrcs.filter(src => src.startsWith('/'));
        assert(absolute.length === 0, '发现绝对路径: ' + absolute.join(', '));
        assert(backgroundSrcs.every(src => src.startsWith('assets/')), '路径前缀异常: ' + backgroundSrcs.join(', '));
    });

    // --- 3. HTML 与 JS 必须对得上（桩件会自动创建元素，光靠上面的用例查不出漏写 id）
    const htmlPath = path.join(path.dirname(path.resolve(gamePath)), 'index.html');
    const gameSource = fs.readFileSync(gamePath, 'utf8');

    if (fs.existsSync(htmlPath)) {
        const html = fs.readFileSync(htmlPath, 'utf8');

        check('game.js 引用的元素 id 都存在于 index.html', () => {
            const ids = [...new Set([...gameSource.matchAll(/getElementById\(\s*['"]([^'"]+)['"]\s*\)/g)].map(m => m[1]))];
            const missing = ids.filter(id => !new RegExp(`id=["']${id}["']`).test(html));
            assert(missing.length === 0, `index.html 缺少: ${missing.join(', ')}`);
        });

        check('index.html 的 onclick 函数都在 game.js 里定义', () => {
            const handlers = [...new Set([...html.matchAll(/on(?:click|change|input)=["']([A-Za-z_$][\w$]*)\s*\(/g)].map(m => m[1]))];
            const missing = handlers.filter(fn => !new RegExp(`function\\s+${fn}\\s*\\(`).test(gameSource));
            assert(missing.length === 0, `game.js 缺少函数: ${missing.join(', ')}`);
        });
    } else {
        skip('HTML/JS 一致性检查', `找不到 ${htmlPath}`);
    }

    // --- 4. 开始第 1 关
    check('开始关卡后进入运行态并刷出敌人', () => {
        sandbox.startGameFromMenu(1);
        h.flushTimers(); // 内部 setTimeout(100) 才真正 startGame
        const s = h.peek();
        assert(s.gameRunning === true, 'gameRunning 未变为 true');
        assert(s.level === 1, '关卡号不是 1');
        assert(s.enemyCount > 0, '没有刷出敌人');
        h.step(60);
        assert(h.peek().enemyCount > 0, '刷出的敌人被剔除线误删（生成点越界）');
        assert(h.peek().gameRunning === true, '60 帧后游戏停止了');
    });

    // --- 4. 攻击 -> 击杀 -> 计分掉金币
    check('攻击命中可击杀敌人并结算分数与金币', () => {
        const before = h.peek();
        sandbox.__clearEnemies();
        sandbox.__addEnemyAtScreen(300, { hp: 15, maxHp: 15 });
        sandbox.playerAttack();
        assert(h.peek().projectileCount > 0, 'playerAttack 没有产生子弹');
        h.step(40);
        const after = h.peek();
        assert(after.enemyCount === 0, '敌人没有被击杀');
        assert(after.score > before.score, `分数没有增加 (${before.score} -> ${after.score})`);
        assert(after.coins > before.coins, `金币没有增加 (${before.coins} -> ${after.coins})`);
    });

    // --- 5. 道具：生命药水
    check('使用生命药水可以回血并消耗道具', () => {
        sandbox.__setHealth(40);
        const invBefore = h.peek().inventoryCount;
        sandbox.useItem(0);
        const s = h.peek();
        assert(s.playerHealth > 40, '血量没有恢复');
        assert(s.inventoryCount === invBefore - 1, '药水没有被消耗');
    });

    // --- 6. 商店购买
    check('商店购买扣金币并入背包', () => {
        sandbox.__setCoins(200);
        h.step(1);
        const invBefore = h.peek().inventoryCount;
        sandbox.buyItem({ id: 'sword', name: '铁剑', emoji: '⚔️', type: 'weapon', attack: 10, price: 100 });
        const s = h.peek();
        assert(s.coins === 100, `金币扣减异常: ${s.coins}`);
        assert(s.inventoryCount === invBefore + 1, '道具没有进背包');
    });

    // --- 6b. 装备系统
    const hasEquipment = h.peek().attackPower >= 0;

    if (hasEquipment) {
        check('装备武器提升攻击力并作用到子弹伤害', () => {
            const before = h.peek().attackPower;
            const index = sandbox.__giveItem('axe'); // 战斧 +15
            sandbox.useItem(index);
            const s = h.peek();
            assert(s.attackPower === before + 15, `攻击力异常: ${before} -> ${s.attackPower}`);
            assert(s.equippedWeapon === 'axe', '装备槽没有记录武器');
            sandbox.playerAttack();
            assert(h.peek().lastProjectileDamage === s.attackPower, '子弹伤害没吃上装备加成');
            sandbox.useItem(index); // 再点一次卸下
            assert(h.peek().attackPower === before, '卸下后攻击力没有还原');
            assert(h.peek().equippedWeapon === null, '卸下后装备槽没有清空');
            sandbox.useItem(index); // 重新装上，供后面的用例使用
        });

        check('装备护甲按比例减伤', () => {
            const index = sandbox.__giveItem('armor_iron'); // 铁甲 防御 5 -> 减伤 25%
            sandbox.useItem(index);
            const s = h.peek();
            assert(s.defense === 5, `防御力异常: ${s.defense}`);
            assert(Math.abs(s.damageReduction - 0.25) < 1e-9, `减伤比例异常: ${s.damageReduction}`);

            // 实际测一次同强度敌人造成的掉血
            const damagedWithArmor = measureEnemyDamage(h, sandbox);
            const armorIndex = h.peek().equippedArmor ? index : -1;
            assert(armorIndex >= 0, '护甲没有装上');
            sandbox.useItem(index); // 卸甲
            const damagedBare = measureEnemyDamage(h, sandbox);
            sandbox.useItem(index); // 重新穿上

            assert(damagedWithArmor < damagedBare, `护甲没有减伤: ${damagedWithArmor} vs ${damagedBare}`);
            const ratio = damagedWithArmor / damagedBare;
            assert(Math.abs(ratio - 0.75) < 0.02, `减伤比例不符（期望 0.75）: ${ratio.toFixed(3)}`);
        });

        check('技能消耗体力且可以贯穿多个敌人', () => {
            sandbox.__setStamina(100);
            sandbox.__clearEnemies();
            sandbox.__addEnemyAtScreen(200, { hp: 30, maxHp: 30 });
            sandbox.__addEnemyAtScreen(240, { hp: 30, maxHp: 30 });
            sandbox.__addEnemyAtScreen(280, { hp: 30, maxHp: 30 });

            sandbox.playerSkill();
            const fired = h.peek();
            assert(fired.playerStamina === 70, `技能体力消耗异常: ${fired.playerStamina}`);
            assert(fired.lastProjectileDamage === 40, `技能伤害异常: ${fired.lastProjectileDamage}`);
            assert(fired.lastProjectilePierces === true, '技能弹不是贯穿弹');

            h.step(40);
            assert(h.peek().enemyCount === 0, '贯穿弹没有打穿一列敌人');
            assert(h.peek().projectileCount >= 1, '贯穿弹命中后自己被消耗掉了');
        });

        check('体力不足时无法释放技能', () => {
            sandbox.__setStamina(10);
            const before = h.peek().projectileCount;
            sandbox.playerSkill();
            const s = h.peek();
            assert(s.projectileCount === before, '体力不足仍然放出了技能');
            assert(s.playerStamina === 10, '体力被错误扣除');
        });

        check('体力药水恢复体力', () => {
            sandbox.__setStamina(40);
            const index = sandbox.__giveItem('potion_sp');
            sandbox.useItem(index);
            assert(h.peek().playerStamina === 60, `体力恢复异常: ${h.peek().playerStamina}`);
        });

        check('体力随时间自动恢复', () => {
            sandbox.__setStamina(50);
            sandbox.__setHealth(100);
            sandbox.__clearEnemies();
            h.step(60);
            const stamina = h.peek().playerStamina;
            assert(stamina > 50, `体力没有随时间恢复: ${stamina}`);
            assert(stamina <= 100, `体力溢出: ${stamina}`);
        });
    } else {
        skip('装备系统', '该文件没有 equipped/getAttackPower');
        skip('技能与体力', '该文件没有 playerSkill/playerStamina');
    }

    const isPublicVersion = h.peek().hasLuckyBlockSpawn;

    // --- 7. 幸运方块（仅 public 版本实现）
    if (isPublicVersion) {
        check('击杀 3 只怪后刷出幸运方块', () => {
            sandbox.__setEnemiesDefeated(3);
            sandbox.checkLuckyBlockSpawn();
            const s = h.peek();
            assert(s.luckyBlockCount > 0, '没有刷出幸运方块');
            assert(s.luckyBlocksSpawned > 0, 'luckyBlocksSpawned 计数没有增加');
        });

        check('靠近幸运方块弹出对话框', () => {
            sandbox.__placeLuckyBlockAtScreen(100, 'wooden');
            sandbox.checkLuckyBlockCollision();
            assert(h.getEl('luckyBlockModal').isVisible(), '对话框没有显示');
            assert(/幸运方块/.test(h.getEl('luckyBlockTitle').textContent), '标题没有写入方块名');
        });

        check('确认开启扣 50 金币并发放奖励', () => {
            sandbox.__setCoins(100);
            const origRandom = h.evalIn('Math.random');
            sandbox.__setRandom(0.99); // 固定成"发奖励"分支
            sandbox.confirmLuckyBlock();
            sandbox.__restoreRandom(origRandom);
            const s = h.peek();
            assert(s.coins > 50, `金币没有发放奖励: ${s.coins}`);
            assert(!h.getEl('luckyBlockModal').isVisible(), '对话框没有关闭');
        });

        check('取消开启后不会反复弹窗', () => {
            sandbox.__placeLuckyBlockAtScreen(100, 'wooden');
            sandbox.checkLuckyBlockCollision();
            assert(h.getEl('luckyBlockModal').isVisible(), '第一次没有弹出');
            sandbox.cancelLuckyBlock();
            assert(!h.getEl('luckyBlockModal').isVisible(), '取消后弹窗没关');
            sandbox.checkLuckyBlockCollision(); // 玩家还站在原地
            assert(!h.getEl('luckyBlockModal').isVisible(), '取消后又被重新弹出（取消按钮失效）');
        });

        check('局内背包走半圆快速背包分支', () => {
            sandbox.openInventory();
            const quick = h.getEl('quickInventory');
            assert(quick.children.length > 0, '快速背包没有渲染出道具');
            assert(quick.isVisible(), '第一次点击应该展开');
            assert(/px$/.test(String(quick.style.left)), `圆心没有对准道具按钮: left=${quick.style.left}`);
            sandbox.openInventory(); // 再点一次收起
            assert(!quick.isVisible(), '再次点击应该收起');
            assert(typeof quick.children[0].onclick === 'function', '道具没有绑定点击事件');
        });

        check('resizeCanvas 按 DPR 缩放画布', () => {
            sandbox.resizeCanvas();
            assert(h.canvas.width === 1600 && h.canvas.height === 800, `画布尺寸异常: ${h.canvas.width}x${h.canvas.height}`);
        });
    } else {
        skip('幸运方块生成', '该文件未实现 spawnLuckyBlock');
        skip('幸运方块弹窗/取消', '该文件未实现 checkLuckyBlockCollision');
        skip('局内快速背包', '该文件未实现 renderQuickInventory');
        skip('DPR 画布缩放', '该文件未实现 resizeCanvas');
    }

    // --- 8. 摇杆（两个版本都有）
    check('摇杆帽拖动后仍保持居中偏移', () => {
        const container = h.getEl('joystickContainer');
        const knob = h.getEl('joystickKnob');
        container.dispatch('mousedown', { clientX: 190, clientY: 150, preventDefault() { }, touches: undefined });
        assert(sandbox.joystickActive === true || h.evalIn('joystickActive') === true, '摇杆没有激活');
        const transform = String(knob.style.transform);
        assert(transform.includes('-50%'), `丢失居中偏移: ${transform}`);
        assert(transform.includes('40px'), `摇杆帽位移异常: ${transform}`);
        h.document.dispatch('mouseup', { preventDefault() { } });
        assert(String(knob.style.transform) === 'translate(-50%, -50%)', `复位异常: ${knob.style.transform}`);
    });

    // --- 9. 关卡完成
    check('走到地图尽头触发关卡完成', () => {
        sandbox.__setCameraX(10000 - h.peek().canvasWidth - 50);
        h.step(2);
        assert(h.getEl('levelCompleteModal').isVisible(), '关卡完成弹窗没有出现');
        assert(h.peek().gameRunning === false, '游戏循环没有停止');
    });

    // --- 10. 暂停/恢复/返回主菜单
    check('暂停、恢复与返回主菜单状态正确', () => {
        sandbox.backToMenu();
        sandbox.startGameFromMenu(2);
        h.flushTimers();
        sandbox.pauseGame();
        assert(h.getEl('pauseModal').isVisible(), '暂停弹窗没有出现');
        const pausedX = h.peek().cameraX;
        sandbox.__setKeys({ a: false, d: true });
        h.step(10);
        assert(h.peek().cameraX === pausedX, '暂停期间画面仍在推进');
        sandbox.resumeGame();
        h.step(10);
        assert(h.peek().cameraX > pausedX, '恢复后没有继续移动');
        sandbox.backToMenu();
        assert(h.getEl('menuScreen').isVisible(), '没有回到主菜单');
        assert(h.peek().gameRunning === false, '游戏循环没有停止');
    });

    // --- 11. 退出按钮
    check('退出按钮在浏览器拒绝关闭时给出提示', () => {
        sandbox.exitGame();
        assert(h.window.closed === true, '没有尝试关闭窗口');
        const bodyChildren = h.document.body.children.length;
        h.flushTimers();
        assert(bodyChildren > 0, '没有给出兜底提示');
    });

    // --- 12. 菜单中也能换装，且不会消耗道具
    if (hasEquipment) {
        check('菜单中装备道具不会被消耗', () => {
            sandbox.backToMenu();
            const index = sandbox.__giveItem('sword');
            const invBefore = h.peek().inventoryCount;
            sandbox.useItem(index);
            const s = h.peek();
            assert(s.inventoryCount === invBefore, '装备时道具被消耗掉了');
            assert(s.equippedWeapon === 'sword', '菜单中装备失败');
            assert(h.getEl('inventoryPage').isVisible(), '菜单背包没有刷新出来');
            sandbox.startGameFromMenu(1);
            h.flushTimers();
            assert(h.peek().gameRunning === true, '重新开局失败');
        });
    }

    // --- 13. 全程无运行时错误
    check('全流程未产生 console 错误', () => {
        const errors = h.logs.filter(([level]) => level === 'error');
        assert(errors.length === 0, JSON.stringify(errors));
    });
}

// ---------------------------------------------------------------- 入口

const targets = process.argv.slice(2);
if (targets.length === 0) targets.push('game.js');

targets.forEach(target => {
    if (!fs.existsSync(target)) {
        results.push({ name: `===== ${target} =====`, status: 'FAIL', detail: '文件不存在' });
        return;
    }
    runSuite(target);
});

let width = 0;
results.forEach(r => { width = Math.max(width, r.name.length); });

const icons = { PASS: '✅', FAIL: '❌', SKIP: '➖', HEAD: '📄' };
console.log('');
results.forEach(r => {
    if (r.status === 'HEAD') {
        console.log('\n' + r.name);
        return;
    }
    console.log(`  ${icons[r.status]} ${r.name.padEnd(width)} ${r.detail}`);
});

const failed = results.filter(r => r.status === 'FAIL').length;
const passed = results.filter(r => r.status === 'PASS').length;
const skipped = results.filter(r => r.status === 'SKIP').length;
console.log(`\n通过 ${passed} / 失败 ${failed} / 跳过 ${skipped}\n`);
process.exit(failed > 0 ? 1 : 0);
