const fs = require('fs');
const path = require('path');

// BMP转PNG转换器（简化版）
function convertBMPtoPNG(bmpPath, pngPath) {
    const bmpData = fs.readFileSync(bmpPath);
    
    // 读取BMP header
    const fileSize = bmpData.readUInt32LE(2);
    const offset = bmpData.readUInt32LE(10);
    const headerSize = bmpData.readUInt32LE(14);
    const width = bmpData.readInt32LE(18);
    const height = Math.abs(bmpData.readInt32LE(22));
    const bitsPerPixel = bmpData.readUInt16LE(28);
    
    // 创建简单的PNG
    // PNG signature
    const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
    
    // IHDR chunk
    const ihdrData = Buffer.alloc(13);
    ihdrData.writeUInt32BE(width, 0);
    ihdrData.writeUInt32BE(height, 4);
    ihdrData.writeUInt8(8, 8); // bit depth
    ihdrData.writeUInt8(2, 9); // color type (RGB)
    ihdrData.writeUInt8(0, 10); // compression
    ihdrData.writeUInt8(0, 11); // filter
    ihdrData.writeUInt8(0, 12); // interlace
    
    const ihdrCrc = crc32(Buffer.concat([Buffer.from('IHDR'), ihdrData]));
    const ihdrChunk = Buffer.concat([
        Buffer.from([0, 0, 0, 13]),
        Buffer.from('IHDR'),
        ihdrData,
        ihdrCrc
    ]);
    
    // IDAT chunk - 提取RGB数据并添加filter byte
    const rowBytes = width * 3;
    const paddedRowBytes = Math.ceil(rowBytes / 4) * 4;
    const rawData = [];
    
    for (let y = height - 1; y >= 0; y--) {
        rawData.push(0); // filter byte
        const rowOffset = offset + y * paddedRowBytes;
        for (let x = 0; x < width; x++) {
            const pixelOffset = rowOffset + x * 3;
            rawData.push(bmpData[pixelOffset + 2]); // R
            rawData.push(bmpData[pixelOffset + 1]); // G
            rawData.push(bmpData[pixelOffset]);     // B
        }
    }
    
    // 压缩数据
    const zlib = require('zlib');
    const compressed = zlib.deflateSync(Buffer.from(rawData));
    
    const idatCrc = crc32(Buffer.concat([Buffer.from('IDAT'), compressed]));
    const idatLength = Buffer.alloc(4);
    idatLength.writeUInt32BE(compressed.length, 0);
    const idatChunk = Buffer.concat([
        idatLength,
        Buffer.from('IDAT'),
        compressed,
        idatCrc
    ]);
    
    // IEND chunk
    const iendCrc = crc32(Buffer.from('IEND'));
    const iendChunk = Buffer.concat([
        Buffer.from([0, 0, 0, 0]),
        Buffer.from('IEND'),
        iendCrc
    ]);
    
    // 组合PNG
    const png = Buffer.concat([signature, ihdrChunk, idatChunk, iendChunk]);
    fs.writeFileSync(pngPath, png);
}

// CRC32计算
function crc32(data) {
    let crc = 0xFFFFFFFF;
    const table = [];
    
    for (let i = 0; i < 256; i++) {
        let c = i;
        for (let j = 0; j < 8; j++) {
            c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
        }
        table[i] = c;
    }
    
    for (let i = 0; i < data.length; i++) {
        crc = table[(crc ^ data[i]) & 0xFF] ^ (crc >>> 8);
    }
    
    const result = Buffer.alloc(4);
    result.writeUInt32BE((crc ^ 0xFFFFFFFF) >>> 0, 0);
    return result;
}

// 转换所有BMP到PNG
const themes = ['space', 'forest', 'dungeon'];
const basePath = path.join(__dirname, 'public', 'assets', 'backgrounds');

console.log('开始转换BMP到PNG...\n');

themes.forEach(theme => {
    const themePath = path.join(basePath, theme);
    const files = ['sky.png', 'mountains.png', 'foreground.png', 'background.png'];
    
    console.log(`转换 ${theme} 主题...`);
    
    files.forEach(file => {
        const bmpPath = path.join(themePath, file);
        const pngPath = path.join(themePath, file);
        
        if (fs.existsSync(bmpPath)) {
            convertBMPtoPNG(bmpPath, pngPath);
            console.log(`  ✓ ${file}`);
            fs.unlinkSync(bmpPath); // 删除BMP
        }
    });
    
    console.log('');
});

console.log('所有图片转换完成！PNG格式已就绪。');
