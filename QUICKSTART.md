# 快速启动指南 - 像素RPG游戏

## 🚀 快速开始

### 1. 安装依赖（只有需要后端接口时才必要）
```bash
cd C:\Users\BQL\Desktop\vscode\Trae\6_16
npm install
```

### 2. 启动服务器
```bash
node server.js
```

### 3. 访问游戏
打开浏览器访问: **http://localhost:3001**

> - 端口由 `server.js` 里的 `PORT || 3001` 决定，**不是 3000**。
> - 纯前端部分不需要起服务器：直接双击 `index.html`，或用任意静态服务器托管**仓库根目录**。
> - 线上地址（GitHub Pages，部署的就是根目录这份代码）：
>   https://fortune191954.github.io/GAME-challenge-hh-hh/
> - `server.js` 会挡掉 `node_modules`、`package.json`、`server.js`、`*.md` 等开发文件，只暴露游戏资源。

## 🎮 游戏功能

> ⚠️ 标注「后端接口」的部分只在 `server.js` 里存在，前端页面**没有接入**（没有登录界面），属于早期版本遗留。

### 用户系统（后端接口，前端未接入）
- **注册账号**: `POST /api/register`
- **登录**: `POST /api/login`
- **存档 / 排行榜**: `POST /api/updateScore`、`GET /api/leaderboard`（数据存在内存里，重启即丢）

### 游戏玩法
- **闯关模式**: 走到地图尽头即过关，击败敌人获得分数与金币
- **三种主题地图**（顺序与代码一致）:
  - 第1关: 森林探险
  - 第2关: 太空冒险
  - 第3关: 地牢闯关

### 操作
| 操作 | 桌面端 | 手机端 |
|---|---|---|
| 移动 | `A` / `D` 键 | 左下角虚拟摇杆（只响应左右） |
| 普通攻击 | 「攻击」按钮 | ⚔️ 按钮 |
| 技能 | 「技能 30SP」按钮 | ✨ 按钮 |
| 背包 | 「道具」按钮（局内是半圆快速背包） | 🎒 按钮 |
| 暂停 | 顶部「⏸️ 暂停」 | 同左 |

### 战斗与属性
- **普通攻击**: 伤害 = 基础攻击 15 + 武器攻击
- **技能**: 消耗 30 点体力，发射**贯穿弹**（40 伤害，可一次打穿一列敌人）
- **体力 (SP)**: 上限 100，随时间自动恢复（约 3.6 点/秒）；体力不足只能普攻，不影响移动
- **防御**: 护甲按比例减伤，每 1 点防御减伤 5%，上限 80%（铁甲 25%、金甲 50%）

### 道具与装备
- **背包**: 主菜单点「背包」是整页背包；游戏中点「道具」是半圆快速背包（**不暂停游戏**）
- **消耗品**: 生命药水 +50 HP、体力药水 +20 SP，只能在游戏中使用
- **装备**: 武器/护甲在背包里**点一下即装备**（再点一下卸下），已装备的道具带金色边框和「已装备」标记
  - 菜单里也能换装，换装不会消耗道具
  - 换装后顶部 HUD 的「攻击 / 防御」实时更新

### 经济系统
- **金币**: 击杀敌人掉落 10–30
- **幸运方块**: 每击杀 3 只怪刷 1 个（上限 5 个），花 50 金币开启，按品质抽奖（可能爆金币，也可能刷出敌人）

## ⚖️ 数值调整

平衡数值集中在 `game.js` 顶部，改这里即可：

```javascript
const baseAttack = 15;                 // 空手攻击力
const staminaRegenPerFrame = 0.06;     // 体力恢复速度（约 3.6/秒）
const skillCost = 30;                  // 技能消耗体力
const skillDamage = 40;                // 技能伤害
const defensePerPoint = 0.05;          // 每点防御减伤比例
const maxDamageReduction = 0.8;        // 减伤上限
```

道具价格与属性在 `items` 数组里；敌人属性在 `enemyTypes` 里。

## 🧪 自动化测试

改动 `game.js` 后建议先跑一遍冒烟测试（无需浏览器、无需安装依赖）：

```bash
npm test                        # 等价于 node test-game.js
node test-game.js               # 默认测根目录的 game.js
node test-game.js 其它副本.js    # 也可以指定别的文件
```

测试用 `vm` 搭一套最小 DOM/Canvas 桩件，真实跑游戏循环，校验初始化、刷怪与剔除、
攻击击杀结算、装备加成与减伤、技能与体力、商店、道具、幸运方块、快速背包、
DPR 缩放、摇杆居中、关卡完成、暂停恢复等流程。全部通过时退出码为 0。

## 📁 项目结构

> ✅ 游戏代码**只有一份**，就在仓库根目录 —— GitHub Pages 部署的和本地跑的是同一份，不存在"改了没生效"。

```
6_16/
├── index.html                  # 游戏主页面
├── game.js                     # 游戏核心逻辑（唯一一份）
├── style.css                   # 像素风格样式
├── assets/
│   ├── backgrounds/            # 背景图片（三主题三层）
│   │   ├── space/              # 太空：sky / mountains / foreground
│   │   ├── forest/             # 森林：sky / mountains / foreground / background
│   │   └── dungeon/            # 地牢：sky / mountains / foreground
│   └── images/lucky_block/     # 幸运方块图片（当前用 emoji 表现，未引用）
├── image/                      # 原始素材：玩家/怪物/武器大图（当前未引用）
├── test-game.js                # 冒烟测试
├── server.js                   # 可选的 Node.js + Express 后端
├── test-api.js                 # 后端接口手测脚本
├── package.json
├── QUICKSTART.md               # 本文件
├── 经验.md                      # 踩坑与修复记录
├── generate-backgrounds.js      # 背景生成脚本
└── convert-to-png.js           # 图片格式转换脚本
```

## 🎨 自定义背景

每种主题分三层（`assets/backgrounds/<主题>/`）：
- **天空层** (sky.png): 云朵/星星，视差最慢
- **山脉层** (mountains.png): 远景山脉，中等速度
- **前景层** (foreground.png): 草地和树木，与角色同速

森林主题额外有一张 `background.png`，会**直接铺满整个画布**（不走分层视差）。

**替换图片**：准备 1920×720 的 PNG，保证左右边缘可无缝拼接，覆盖对应文件即可。
浏览器有缓存的话按 `Ctrl+F5` 强刷；`game.js` 里资源路径用**相对路径**，不要改成 `/assets/...`
（GitHub Pages 部署在 `/GAME-challenge-hh-hh/` 子目录下，绝对路径会 404）。

## 🔧 技术栈

- **前端**: HTML5 Canvas + 原生 JavaScript（无框架、无构建步骤）
- **后端**: Node.js + Express（可选）
- **样式**: 纯 CSS 像素风格
- **数据**: 内存存储（可升级为数据库）

## 📝 开发说明

### 添加新的道具/武器
编辑 `game.js` 中的 `items` 数组：

```javascript
const items = [
    { id: 'item_id', name: '物品名', emoji: '图标', type: 'consumable', effect: { hp: 50 }, price: 20 },
    // type: 'weapon' 用 attack 字段；type: 'armor' 用 defense 字段
];
```

### 添加新的敌人
编辑 `game.js` 中的 `enemyTypes` 对象：

```javascript
const enemyTypes = {
    forest: [
        { emoji: '🟢', hp: 20, attack: 5, speed: 0.8 },
        // 继续添加...
    ],
};
```

### 改完记得
1. `npm test` 跑一遍冒烟测试
2. 在 `经验.md` 里补一条问题/改动记录（仓库惯例）
3. `git commit`（Pages 会自动重新部署，通常 1 分钟内生效）

## 🎯 游戏技巧

1. **先换武器再推图**: 战斧 +15 攻击相当于普攻伤害翻倍
2. **技能留给人堆**: 贯穿弹能一次打穿一列，敌人排成行时最划算
3. **体力不用省**: 会自动恢复，进关卡时是满的
4. **护甲性价比高**: 金甲 50% 减伤，比多买几瓶药水划算

## 📞 获取帮助

游戏遇到问题？检查：
1. Node.js 是否正确安装（`node -v`）
2. 端口 3001 是否被占用
3. 浏览器控制台（F12）是否有报错，Network 面板有没有 404
