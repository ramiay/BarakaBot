// src/utils/imageEnhance.js
// Enhances input image via OpenAI Images (if available), falling back to local sharp adjustments.

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const { OPENAI_API_KEY } = require('../config');

let openai = null;
try {
    const { OpenAI } = require('openai');
    openai = new OpenAI({ apiKey: OPENAI_API_KEY });
} catch (_) {
    // openai SDK not installed or key missing — we'll fall back to sharp
}

let sharp = null;
try {
    sharp = require('sharp');
} catch (_) {
    // sharp not installed — if OpenAI fails, we’ll just return original
}

const TMP_DIR = path.join(__dirname, '../../tmp/enhanced');
function ensureTmp() { fs.mkdirSync(TMP_DIR, { recursive: true }); }
function nowSlug() { return new Date().toISOString().replace(/[:.]/g, '-'); }
function tmpOutPath(ext = 'png') {
    ensureTmp();
    return path.join(TMP_DIR, `${nowSlug()}-${crypto.randomBytes(4).toString('hex')}.${ext}`);
}

/**
 * Try AI enhancement first (OpenAI Images edit).
 * If it fails or quota exceeded, fallback to local sharp adjustments.
 */
async function enhanceImage(inputPath, { prompt } = {}) {
    // 1) Try OpenAI Images edit
    if (openai && OPENAI_API_KEY) {
        try {
            // Use Images edits to retouch photo
            // In Node SDK v4, image editing can be done via images.edits
            const result = await openai.images.edits({
                model: 'gpt-image-1',
                image: fs.createReadStream(inputPath),
                prompt: prompt || 'Enhance the product photo: brighten slightly, improve contrast and sharpness, tasteful saturation boost, keep realistic.',
                size: '1024x1024',
                // background removal etc. could be hinted in prompt if desired
                // n: 1 (default)
            });

            const b64 = result.data?.[0]?.b64_json;
            if (b64) {
                const buf = Buffer.from(b64, 'base64');
                const out = tmpOutPath('png');
                await fs.promises.writeFile(out, buf);
                return out;
            }
        } catch (e) {
            // Fall back if OpenAI call fails (rate limit/quota/etc.)
            // console.warn('OpenAI image edit failed, using local enhancement:', e?.message);
        }
    }

    // 2) Local enhancement fallback via sharp (no external calls)
    if (sharp) {
        try {
            const out = tmpOutPath('jpg');
            // Simple, safe edits: slight exposure, contrast, saturation, sharpen
            await sharp(inputPath)
                .jpeg({ quality: 92 })
                .modulate({ brightness: 1.05, saturation: 1.12 }) // gentle pop
                .linear(1.05, -6) // contrast-ish tweak
                .sharpen(1.1, 1.0, 0.8)
                .toFile(out);
            return out;
        } catch (e) {
            // If sharp fails, return original
            return inputPath;
        }
    }

    // 3) Nothing available, just return original
    return inputPath;
}

module.exports = { enhanceImage };
