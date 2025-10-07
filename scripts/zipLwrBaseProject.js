/*
 * Creates lwr-base-project.zip at the repository root.
 * - Includes lwr-base-project contents
 * - Excludes node_modules and caches to reduce VSIX size
 */
const path = require('path');
const fs = require('fs');
const AdmZip = require('adm-zip');

const ROOT = path.resolve(__dirname, '..');
const SRC_DIR = path.join(ROOT, 'lwr-base-project');
const OUT_ZIP = path.join(ROOT, 'lwr-base-project.zip');

function shouldExclude(relPath) {
    const parts = relPath.split(path.sep);
    if (parts.includes('node_modules')) return true;
    if (parts.includes('__lwr_cache__')) return true;
    if (relPath.endsWith('.map')) return true;
    return false;
}

function addDir(zip, dirPath, rootRel) {
    const entries = fs.readdirSync(dirPath, { withFileTypes: true });
    for (const entry of entries) {
        const abs = path.join(dirPath, entry.name);
        const rel = path.join(rootRel, entry.name);
        if (shouldExclude(rel)) continue;
        if (entry.isDirectory()) {
            addDir(zip, abs, rel);
        } else if (entry.isFile()) {
            zip.addLocalFile(abs, path.dirname(rel));
        }
    }
}

function main() {
    if (!fs.existsSync(SRC_DIR)) {
        console.log(`[zip] Skipping: ${SRC_DIR} not found`);
        return;
    }
    if (fs.existsSync(OUT_ZIP)) fs.unlinkSync(OUT_ZIP);

    const zip = new AdmZip();
    // Put files under lwr-base-project/ root inside the zip
    addDir(zip, SRC_DIR, 'lwr-base-project');
    zip.writeZip(OUT_ZIP);
    const sizeKb = (fs.statSync(OUT_ZIP).size / 1024).toFixed(1);
    console.log(`[zip] Created ${OUT_ZIP} (${sizeKb} KB)`);
}

main();
