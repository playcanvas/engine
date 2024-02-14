import { readFileSync } from 'node:fs';
import { execSync } from 'node:child_process';

/**
 * @returns {string} Version string like `1.58.0-dev`
 */
function getVersion() {
    const text = readFileSync('./package.json', 'utf8');
    const json = JSON.parse(text);
    return json.version;
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
