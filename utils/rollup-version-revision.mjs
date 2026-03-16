import { readFileSync } from 'node:fs';
import { execSync } from 'node:child_process';

/**
 * @returns {string} Version string like `1.58.0-dev`
 */
function getVersion() {
    let path;
    try {
        path = execSync('git rev-parse --show-toplevel').toString().trim();
    } catch (e) {
        path = '.';
    }
    const pkg = JSON.parse(readFileSync(`${path}/package.json`, 'utf-8'));
    return pkg.version;
}

/**
 * @returns {string} Revision string like `644d08d39` (9 digits/chars).
 */
function getRevision() {
    let revision;
    try {
        revision = execSync('git rev-parse --short HEAD').toString().trim();
    } catch (e) {
        revision = 'unknown';
    }
    return revision;
}

const version = getVersion();
const revision = getRevision();

export { version, revision };
