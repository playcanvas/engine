import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const CERT_DIR = path.resolve('.cert');
const CERT_FILE = path.join(CERT_DIR, 'cert.pem');
const KEY_FILE = path.join(CERT_DIR, 'key.pem');
const MKCERT_HELP = `mkcert failed.

Install mkcert, run:
  mkcert -install

Then re-run:
  npm run cert`;

export const ALLOWED_HOSTS = ['localhost', '.local'];

/**
 * @returns {{ cert: Buffer, key: Buffer } | undefined} vite https config.
 */
export const httpsConfig = () => {
    if (process.env.EXAMPLES_HTTPS !== '1') {
        return undefined;
    }

    if (!fs.existsSync(CERT_FILE) || !fs.existsSync(KEY_FILE)) {
        throw new Error(
            `HTTPS dev requested but certs not found in ${CERT_DIR}. ` +
            'Run "npm run cert" to generate them.'
        );
    }

    return {
        cert: fs.readFileSync(CERT_FILE),
        key: fs.readFileSync(KEY_FILE)
    };
};

/**
 * @param {string[]} hosts - extra host names or lan ips.
 * @returns {boolean} true if certs were generated.
 */
export const generateCertificates = (hosts) => {
    fs.mkdirSync(CERT_DIR, { recursive: true });

    const local = process.platform === 'darwin' ?
        spawnSync('scutil', ['--get', 'LocalHostName'], { encoding: 'utf8' }) : null;
    const host = local?.status === 0 && local.stdout.trim() ?
        local.stdout.trim() : os.hostname().replace(/\.local$/, '');
    const sans = [...new Set([
        'localhost',
        '127.0.0.1',
        '::1',
        `${host}.local`,
        ...hosts.map(value => value.trim()).filter(Boolean)
    ])];

    console.log(`Generating dev cert for: ${sans.join(', ')}`);

    const result = spawnSync('mkcert', ['-cert-file', CERT_FILE, '-key-file', KEY_FILE, ...sans], {
        stdio: 'inherit'
    });
    if (result.status !== 0) {
        console.error(MKCERT_HELP);
        return false;
    }

    console.log(`Wrote ${path.relative(process.cwd(), CERT_FILE)}
Wrote ${path.relative(process.cwd(), KEY_FILE)}

Start the HTTPS dev server with:
  npm run dev:https

Or without automatic reloads:
  npm run develop:https

Then open on this machine:
  https://${host}.local:${process.env.EXAMPLES_PORT ?? 5555}
  https://localhost:${process.env.EXAMPLES_PORT ?? 5555}`);

    return true;
};
