// src/utils/canva.js
// E-commerce composition (subject cutout + brand background + SALE headline)
// Feed (4:5) + Story (9:16)

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const axios = require('axios');
const FormData = require('form-data');
const { createCanvas, loadImage } = require('canvas');
const { PUBLIC_BASE_URL } = require('../config');

const OUTPUT_DIR = path.join(__dirname, '../../public/outputs');
fs.mkdirSync(OUTPUT_DIR, { recursive: true });

const {
    REMOVE_BG_API_KEY = '',
    SALE_BG = 'gradient',     // gradient | white | brand
    SALE_COLOR = '#111111',
    BRAND_COLOR = '#ff3b30',
} = process.env;

function nowSlug() { return new Date().toISOString().replace(/[:.]/g, '-'); }
function tmpOutName(ext = 'png') { return `${nowSlug()}-${crypto.randomBytes(4).toString('hex')}.${ext}`; }

async function savePublic(buffer, ext = 'jpg') {
    const filename = tmpOutName(ext);
    const absPath = path.join(OUTPUT_DIR, filename);
    await fs.promises.writeFile(absPath, buffer);
    return { absPath, publicUrl: `${PUBLIC_BASE_URL}/static/outputs/${filename}` };
}

async function cutoutSubject(inputPath) {
    if (!REMOVE_BG_API_KEY) return inputPath; // fallback (no cutout)
    const form = new FormData();
    form.append('image_file', fs.createReadStream(inputPath));
    form.append('size', 'auto');

    const res = await axios.post('https://api.remove.bg/v1.0/removebg', form, {
        headers: { ...form.getHeaders(), 'X-Api-Key': REMOVE_BG_API_KEY },
        responseType: 'arraybuffer',
        timeout: 30000,
        maxRedirects: 2,
    });

    const out = path.join(OUTPUT_DIR, tmpOutName('png'));
    await fs.promises.writeFile(out, Buffer.from(res.data));
    return out; // PNG with alpha
}

function drawBackground(ctx, W, H) {
    if (SALE_BG === 'white') {
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, W, H);
        return;
    }
    if (SALE_BG === 'brand') {
        ctx.fillStyle = BRAND_COLOR;
        ctx.fillRect(0, 0, W, H);
        return;
    }
    const g = ctx.createLinearGradient(0, 0, W, H);
    g.addColorStop(0, '#ffffff');
    g.addColorStop(1, '#f3f6ff');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
}

function fitContain(imgW, imgH, boxW, boxH) {
    const r = Math.min(boxW / imgW, boxH / imgH);
    const w = Math.round(imgW * r);
    const h = Math.round(imgH * r);
    const x = Math.round((boxW - w) / 2);
    const y = Math.round((boxH - h) / 2);
    return { x, y, w, h };
}

function roundRect(ctx, x, y, w, h, r) {
    const rr = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + rr, y);
    ctx.arcTo(x + w, y, x + w, y + h, rr);
    ctx.arcTo(x + w, y + h, x, y + h, rr);
    ctx.arcTo(x, y + h, x, y, rr);
    ctx.arcTo(x, y, x + w, y, rr);
    ctx.closePath();
}

function drawSaleBadge(ctx, x, y, text = 'SALE', color = BRAND_COLOR, rotateRad = -Math.PI / 12) {
    const w = 520, h = 140;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(rotateRad);
    ctx.fillStyle = color;
    roundRect(ctx, 0, 0, w, h, 24);
    ctx.fill();

    ctx.fillStyle = '#ffffff';
    ctx.font = '900 92px Arial';
    ctx.textBaseline = 'middle';
    const metrics = ctx.measureText(text);
    const tx = (w - metrics.width) / 2;
    ctx.fillText(text, tx, h / 2 + 3);
    ctx.restore();
}

function drawBottomInfo(ctx, W, H, headline, subline, scale = 1.0) {
    const panelH = Math.round(260 * scale);
    ctx.fillStyle = 'rgba(0,0,0,0.06)';
    roundRect(ctx, 40 * scale, H - panelH - 40 * scale, W - 80 * scale, panelH, 28 * scale);
    ctx.fill();

    ctx.fillStyle = SALE_COLOR;
    ctx.font = `900 ${Math.round(96 * scale)}px Arial`;
    ctx.fillText('SALE', 80 * scale, H - panelH + 40 * scale);

    ctx.fillStyle = '#111';
    ctx.font = `bold ${Math.round(48 * scale)}px Arial`;
    ctx.fillText(headline || 'New arrivals • Limited time', 80 * scale, H - panelH + 125 * scale);

    if (subline) {
        ctx.fillStyle = '#333';
        ctx.font = `${Math.round(36 * scale)}px Arial`;
        ctx.fillText(subline, 80 * scale, H - panelH + 190 * scale);
    }
}

// ---- FEED POST (4:5) ----
async function makeEcomSaleGraphic({ userImagePath, headline, subline }) {
    const W = 1080, H = 1350;
    const canvas = createCanvas(W, H);
    const ctx = canvas.getContext('2d');

    const cutoutPath = await cutoutSubject(userImagePath);
    const cutout = await loadImage(cutoutPath);

    drawBackground(ctx, W, H);

    const box = { x: 100, y: 100, w: W - 200, h: H - 520 };
    const fit = fitContain(cutout.width, cutout.height, box.w, box.h);
    ctx.drawImage(cutout, box.x + fit.x, box.y + fit.y, fit.w, fit.h);

    drawSaleBadge(ctx, W - 560, 80, 'SALE', BRAND_COLOR, -Math.PI / 12);
    drawBottomInfo(ctx, W, H, headline, subline, 1.0);

    const buffer = canvas.toBuffer('image/jpeg', { quality: 0.95, progressive: true });
    return savePublic(buffer, 'jpg');
}

// ---- STORY (9:16) ----
async function makeEcomSaleStory({ userImagePath, headline, subline }) {
    const W = 1080, H = 1920;
    const canvas = createCanvas(W, H);
    const ctx = canvas.getContext('2d');

    const cutoutPath = await cutoutSubject(userImagePath);
    const cutout = await loadImage(cutoutPath);

    drawBackground(ctx, W, H);

    const box = { x: 100, y: 160, w: W - 200, h: H - 760 }; // more vertical room
    const fit = fitContain(cutout.width, cutout.height, box.w, box.h);
    ctx.drawImage(cutout, box.x + fit.x, box.y + fit.y, fit.w, fit.h);

    drawSaleBadge(ctx, W - 600, 120, 'SALE', BRAND_COLOR, -Math.PI / 10);
    drawBottomInfo(ctx, W, H, headline, subline, 1.2);

    const buffer = canvas.toBuffer('image/jpeg', { quality: 0.95, progressive: true });
    return savePublic(buffer, 'jpg');
}

module.exports = {
    makeEcomSaleGraphic, // Feed 4:5
    makeEcomSaleStory    // Story 9:16
};
