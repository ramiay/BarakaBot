// src/utils/canvasGen.js
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
    await fs.promises.writeFile(absPath, buffer);
    return { absPath, publicUrl: `${PUBLIC_BASE_URL}/static/outputs/${filename}` };
}

/**
 * Draws the user image “cover-style” so it fills the canvas without distortion.
 */
function drawCover(ctx, img, W, H) {
    const imgRatio = img.width / img.height;
    const canvasRatio = W / H;
    let drawW, drawH, dx, dy;
    if (imgRatio > canvasRatio) {
        drawH = H; drawW = Math.round(H * imgRatio);
        dx = Math.round((W - drawW) / 2); dy = 0;
    } else {
        drawW = W; drawH = Math.round(W / imgRatio);
        dx = 0; dy = Math.round((H - drawH) / 2);
    }
    ctx.drawImage(img, dx, dy, drawW, drawH);
}

/**
 * Minimal text panel used on both formats.
 */
function drawPanelAndText(ctx, W, H, brand, headline, variant = 'post') {
    // panel sizing differs slightly per variant
    const isPost = variant === 'post';
    const panelH = isPost ? 220 : 260;

    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.fillRect(0, H - panelH, W, panelH);

    ctx.fillStyle = '#fff';
    ctx.font = isPost ? 'bold 50px Arial' : 'bold 64px Arial';
    ctx.fillText(brand || 'Your Shop', 48, H - panelH + (isPost ? 56 : 66));

    ctx.font = isPost ? '36px Arial' : '44px Arial';
    ctx.fillText(headline || 'New arrival', 48, H - (isPost ? 60 : 72));
}

/**
 * Build a 1080×1350 feed post image.
 */
async function createFeedPost({ userImagePath, brand, headline, style = 'minimal' }) {
    const W = 1080, H = 1350; // 4:5
    const canvas = createCanvas(W, H);
    const ctx = canvas.getContext('2d');
    const img = await loadImage(userImagePath);

    drawCover(ctx, img, W, H);
    drawPanelAndText(ctx, W, H, brand, headline, 'post');

    const buffer = canvas.toBuffer('image/jpeg', { quality: 0.9 });
    return saveBufferToFile(buffer, 'jpg');
}

/**
 * Build a 1080×1920 story image.
 */
async function createStory({ userImagePath, brand, headline, style = 'minimal' }) {
    const W = 1080, H = 1920; // 9:16
    const canvas = createCanvas(W, H);
    const ctx = canvas.getContext('2d');
    const img = await loadImage(userImagePath);

    drawCover(ctx, img, W, H);
    drawPanelAndText(ctx, W, H, brand, headline, 'story');

    const buffer = canvas.toBuffer('image/jpeg', { quality: 0.9 });
    return saveBufferToFile(buffer, 'jpg');
}

module.exports = {
    // backwards-compatible name used by your server:
    createSocialGraphic: createFeedPost,
    // new export for stories:
    createStory
};
