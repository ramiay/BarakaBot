// src/utils/files.js
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const UPLOAD_DIR = path.join(__dirname, '../../tmp/uploads');

function ensureDirs() {
    fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

function nowSlug() {
    return new Date().toISOString().replace(/[:.]/g, '-');
}

async function saveBufferToTemp(buffer, ext = 'jpg') {
    ensureDirs();
    const filename = `${nowSlug()}-${crypto.randomBytes(4).toString('hex')}.${ext}`;
    const absPath = path.join(UPLOAD_DIR, filename);
    await fs.promises.writeFile(absPath, buffer);
    return absPath; // local path for processing (NOT public)
}

module.exports = { saveBufferToTemp };
