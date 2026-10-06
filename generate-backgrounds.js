const fs = require('fs');
const path = require('path');

// 生成程序化像素背景图片
function generatePixelBackground(theme, width = 1920, height = 720) {
    const layers = {};
    
    // 主题配置
    const themes = {
        space: {
            sky: { base: '#0a0a2e', gradient: '#1a1a4e' },
            clouds: ['#ffffff', '#ccccff', '#aaaadd'],
            mountains: ['#2a2a5e', '#3a3a7e', '#4a4a9e'],
            ground: '#1a1a3e'
        },
        forest: {
            sky: { base: '#87ceeb', gradient: '#b0e0e6' },
            clouds: ['#ffffff', '#f0f8ff'],
            mountains: ['#6b8e6b', '#7ca67c', '#8db78d'],
            ground: '#228b22'
        },
        dungeon: {
            sky: { base: '#1a1010', gradient: '#2a1a1a' },
            clouds: ['#333333', '#444444'],
            mountains: ['#3a2a2a', '#4a3a3a', '#5a4a4a'],
            ground: '#2a1a1a'
        }
    };
    
    const config = themes[theme];
    
    // 生成基础像素数据
    function createPixelData() {
        const data = [];
        for (let y = 0; y < height; y++) {
            const row = [];
            for (let x = 0; x < width; x++) {
                row.push({ r: 0, g: 0, b: 0, a: 0 });
            }
            data.push(row);
        }
        return data;
    }
    
    // 设置像素颜色
    function setPixel(data, x, y, color) {
        if (x >= 0 && x < width && y >= 0 && y < height) {
            data[y][x] = { r: color.r, g: color.g, b: color.b, a: 255 };
        }
    }
    
    // 绘制矩形
    function drawRect(data, x, y, w, h, color) {
        for (let dy = 0; dy < h; dy++) {
            for (let dx = 0; dx < w; dx++) {
                setPixel(data, x + dx, y + dy, color);
            }
        }
    }
    
    // 解析颜色
    function parseColor(hex) {
        const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
        return result ? {
            r: parseInt(result[1], 16),
            g: parseInt(result[2], 16),
            b: parseInt(result[3], 16)
        } : { r: 0, g: 0, b: 0 };
    }
    
    // 生成天空层
    layers.sky = createPixelData();
    const skyColor = parseColor(config.sky.base);
    const skyGradient = parseColor(config.sky.gradient);
    
    for (let y = 0; y < height * 0.6; y++) {
        const t = y / (height * 0.6);
        const r = Math.floor(skyColor.r + (skyGradient.r - skyColor.r) * t);
        const g = Math.floor(skyColor.g + (skyGradient.g - skyColor.g) * t);
        const b = Math.floor(skyColor.b + (skyGradient.b - skyColor.b) * t);
        
        for (let x = 0; x < width; x += 2) {
            const color = { r, g, b };
            drawRect(layers.sky, x, y, 2, 2, color);
        }
    }
    
    // 生成白云/星星
    if (theme === 'space') {
        // 太空主题：生成星星
        for (let i = 0; i < 200; i++) {
            const x = Math.floor(Math.random() * width);
            const y = Math.floor(Math.random() * height * 0.5);
            const brightness = Math.floor(Math.random() * 100) + 155;
            drawRect(layers.sky, x, y, 2, 2, { r: brightness, g: brightness, b: brightness });
            if (Math.random() > 0.7) {
                drawRect(layers.sky, x + 2, y, 2, 2, { r: brightness, g: brightness, b: brightness });
            }
        }
    } else {
        // 其他主题：生成云朵
        for (let i = 0; i < 8; i++) {
            const cloudX = Math.floor(Math.random() * width);
            const cloudY = Math.floor(Math.random() * height * 0.3);
            const cloudColors = config.clouds.map(c => parseColor(c));
            
            for (let j = 0; j < 20; j++) {
                const cx = (cloudX + j * 30) % width;
                const cy = cloudY + Math.floor(Math.random() * 20);
                const color = cloudColors[Math.floor(Math.random() * cloudColors.length)];
                drawRect(layers.sky, cx, cy, 16, 8, color);
                drawRect(layers.sky, cx + 4, cy - 8, 8, 8, color);
            }
        }
    }
    
    // 生成山脉/远景层
    layers.mountains = createPixelData();
    const mountainColors = config.mountains;
    
    for (let layer = 0; layer < 3; layer++) {
        const baseY = height * 0.4 + layer * 50;
        const mountainColor = parseColor(mountainColors[layer]);
        
        for (let x = 0; x < width; x += 8) {
            const peakHeight = Math.floor(Math.sin(x * 0.01 + layer) * 30 + 
                                   Math.sin(x * 0.02 + layer * 2) * 20 + 
                                   50 - layer * 15);
            
            for (let y = 0; y < peakHeight; y += 2) {
                for (let dx = 0; dx < 8; dx += 2) {
                    const py = baseY - y;
                    if (py >= 0) {
                        setPixel(layers.mountains, x + dx, py, mountainColor);
                        setPixel(layers.mountains, x + dx + 1, py, mountainColor);
                    }
                }
            }
        }
    }
    
    // 生成前景草地/树木层
    layers.foreground = createPixelData();
    const groundColor = parseColor(config.ground);
    
    // 绘制地面
    drawRect(layers.foreground, 0, height - 80, width, 80, groundColor);
    
    // 绘制草地纹理
    for (let x = 0; x < width; x += 4) {
        const grassHeight = 4 + Math.floor(Math.random() * 8);
        const grassY = height - 80 - grassHeight;
        for (let y = 0; y < grassHeight; y += 2) {
            const shade = Math.random() > 0.5 ? 20 : 0;
            setPixel(layers.foreground, x, grassY + y, { 
                r: groundColor.r + shade, 
                g: groundColor.g + shade, 
                b: groundColor.b + shade 
            });
            setPixel(layers.foreground, x + 1, grassY + y, { 
                r: groundColor.r + shade, 
                g: groundColor.g + shade, 
                b: groundColor.b + shade 
            });
        }
    }
    
    // 绘制树木
    if (theme === 'space') {
        // 太空主题：绘制小行星/建筑
        for (let i = 0; i < 10; i++) {
            const treeX = Math.floor(Math.random() * width);
            const treeY = height - 100 - Math.floor(Math.random() * 30);
            const treeColor = parseColor('#4a4a6a');
            drawRect(layers.foreground, treeX, treeY, 12, 20, treeColor);
            drawRect(layers.foreground, treeX - 4, treeY + 4, 20, 12, treeColor);
        }
    } else if (theme === 'forest') {
        // 森林主题：绘制树木
        for (let i = 0; i < 12; i++) {
            const treeX = (i * 180 + Math.floor(Math.random() * 50)) % width;
            const treeY = height - 100;
            const treeHeight = 60 + Math.floor(Math.random() * 40);
            
            // 树干
            const trunkColor = parseColor('#8B4513');
            drawRect(layers.foreground, treeX + 8, treeY, 8, 40, trunkColor);
            
            // 树冠
            const foliageColors = ['#228B22', '#2E8B2E', '#32CD32'];
            for (let j = 0; j < treeHeight; j += 8) {
                const width2 = 30 - j * 0.3;
                const y = treeY - j;
                const color = parseColor(foliageColors[Math.floor(Math.random() * foliageColors.length)]);
                drawRect(layers.foreground, treeX - width2/2 + 12, y, width2, 12, color);
            }
        }
    } else {
        // 地牢主题：绘制废墟/骨头
        for (let i = 0; i < 8; i++) {
            const treeX = (i * 250 + Math.floor(Math.random() * 50)) % width;
            const treeY = height - 100;
            const treeColor = parseColor('#5a5a5a');
            drawRect(layers.foreground, treeX, treeY, 20, 40, treeColor);
            drawRect(layers.foreground, treeX + 30, treeY + 10, 15, 30, treeColor);
        }
    }
    
    return layers;
}

// 导出为PPM格式（简单图片格式）
function exportPPM(data, filename) {
    const lines = [`P3\n1920 720\n255\n`];
    
    for (let y = 0; y < data.length; y++) {
        for (let x = 0; x < data[y].length; x++) {
            const pixel = data[y][x];
            lines.push(`${pixel.r} ${pixel.g} ${pixel.b}`);
        }
        lines.push('');
    }
    
    fs.writeFileSync(filename, lines.join('\n'));
}

// 导出为简单的BMP格式
function exportBMP(data, filename) {
    const width = data[0].length;
    const height = data.length;
    const rowSize = Math.ceil((width * 3) / 4) * 4;
    const pixelDataSize = rowSize * height;
    const fileSize = 54 + pixelDataSize;
    
    const buffer = Buffer.alloc(fileSize);
    
    // BMP Header
    buffer.write('BM', 0);
    buffer.writeUInt32LE(fileSize, 2);
    buffer.writeUInt32LE(0, 6);
    buffer.writeUInt32LE(54, 10);
    
    // DIB Header
    buffer.writeUInt32LE(40, 14);
    buffer.writeInt32LE(width, 18);
    buffer.writeInt32LE(height, 22);
    buffer.writeUInt16LE(1, 26);
    buffer.writeUInt16LE(24, 28);
    buffer.writeUInt32LE(0, 30);
    buffer.writeUInt32LE(pixelDataSize, 34);
    buffer.writeInt32LE(2835, 38);
    buffer.writeInt32LE(2835, 42);
    buffer.writeUInt32LE(0, 46);
    buffer.writeUInt32LE(0, 50);
    
    // Pixel data (bottom-up)
    let offset = 54;
    for (let y = height - 1; y >= 0; y--) {
        for (let x = 0; x < width; x++) {
            const pixel = data[y][x];
            buffer.writeUInt8(pixel.b, offset++);
            buffer.writeUInt8(pixel.g, offset++);
            buffer.writeUInt8(pixel.r, offset++);
        }
        // Padding
        while (offset % 4 !== 54 % 4) {
            buffer.writeUInt8(0, offset++);
        }
    }
    
    fs.writeFileSync(filename, buffer);
}

// 创建完整的拼合背景
function generateCompositeBackground(theme) {
    const layers = generatePixelBackground(theme);
    const width = 1920;
    const height = 720;
    
    const composite = [];
    for (let y = 0; y < height; y++) {
        const row = [];
        for (let x = 0; x < width; x++) {
            row.push({ r: 0, g: 0, b: 0, a: 255 });
        }
        composite.push(row);
    }
    
    // 合并图层（从后到前）
    const layerOrder = ['sky', 'mountains', 'foreground'];
    
    for (const layerName of layerOrder) {
        const layer = layers[layerName];
        for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
                const pixel = layer[y][x];
                if (pixel.a > 0) {
                    composite[y][x] = pixel;
                }
            }
        }
    }
    
    return composite;
}

// 主程序
console.log('开始生成像素背景图片...\n');

const themes = ['space', 'forest', 'dungeon'];
const basePath = path.join(__dirname, 'public', 'assets', 'backgrounds');

themes.forEach(theme => {
    console.log(`生成 ${theme} 主题背景...`);
    
    const themePath = path.join(basePath, theme);
    if (!fs.existsSync(themePath)) {
        fs.mkdirSync(themePath, { recursive: true });
    }
    
    const layers = generatePixelBackground(theme);
    
    // 导出分层图片
    exportBMP(layers.sky, path.join(themePath, 'sky.png'));
    console.log(`  - 生成了 sky.png`);
    
    exportBMP(layers.mountains, path.join(themePath, 'mountains.png'));
    console.log(`  - 生成了 mountains.png`);
    
    exportBMP(layers.foreground, path.join(themePath, 'foreground.png'));
    console.log(`  - 生成了 foreground.png`);
    
    // 导出完整背景
    const composite = generateCompositeBackground(theme);
    exportBMP(composite, path.join(themePath, 'background.png'));
    console.log(`  - 生成了 background.png (完整背景)`);
    
    console.log(`\n${theme} 主题完成!\n`);
});

console.log('所有背景图片生成完成!');
console.log('图片位置: assets/backgrounds/[theme]/');
console.log('\n每种主题包含:');
console.log('  - sky.png: 天空层（云朵/星星）');
console.log('  - mountains.png: 远景山脉层');
console.log('  - foreground.png: 前景草地/树木层');
console.log('  - background.png: 完整合成的背景');
console.log('\n提示: 这些是BMP格式的无缝像素背景，可以转换为PNG使用。');
