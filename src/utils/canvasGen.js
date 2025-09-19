const { createCanvas, loadImage } = require('canvas');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { PUBLIC_BASE_URL } = require('../config');

const OUTPUT_DIR = path.join(__dirname, '../../public/outputs');
fs.mkdirSync(OUTPUT_DIR, { recursive: true });

function nowSlug() {
    return new Date().toISOString().replace(/[:.]/g, '-');
}

async function saveBufferToFile(buffer, ext = 'jpg') {
    const filename = `${nowSlug()}-${crypto.randomBytes(4).toString('hex')}.${ext}`;
    const absPath = path.join(OUTPUT_DIR, filename);
    fs.writeFileSync(absPath, buffer);
    return { absPath, publicUrl: `${PUBLIC_BASE_URL}/static/outputs/${filename}` };
}

async function createSocialGraphic({ userImagePath, brand, headline, style }) {
    const W = 1080, H = 1350;
    const canvas = createCanvas(W, H);
    const ctx = canvas.getContext('2d');
    const img = await loadImage(userImagePath);
    ctx.drawImage(img, 0, 0, W, H);

    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.fillRect(0, H - 200, W, 200);

    ctx.fillStyle = '#fff';
    ctx.font = 'bold 48px Arial';
    ctx.fillText(brand, 40, H - 140);

    ctx.font = '36px Arial';
    ctx.fillText(headline, 40, H - 80);

    const buffer = canvas.toBuffer('image/jpeg');
    return saveBufferToFile(buffer, 'jpg');
}

module.exports = { createSocialGraphic };
