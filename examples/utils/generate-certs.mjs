/**
 * Generate local HTTPS certificates for `npm run develop:https` via mkcert.
 *
 * Output: examples/.cert/dev-cert.pem and dev-key.pem
 *
 * Default SANs:
 *   localhost, 127.0.0.1, ::1, <LocalHostName>.local (macOS) or os.hostname()
 *
 * Extra SANs (LAN IPs, alternate hostnames) via positional args:
 *   npm run cert -- 10.0.0.42 192.168.1.50
 *
 * EXAMPLES_CERT_HOSTS=<comma-separated> is also honored as a fallback.
 *
 * Never auto-installs mkcert — if missing, prints instructions and exits 1.
 */

import { execFileSync, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const CERT_DIR = path.resolve('.cert');
const CERT_FILE = path.join(CERT_DIR, 'dev-cert.pem');
const KEY_FILE = path.join(CERT_DIR, 'dev-key.pem');
const PORT = process.env.EXAMPLES_PORT ?? 5555;

const fail = (msg) => {
    console.error(msg);
    process.exit(1);
};

const haveMkcert = () => {
    const probe = spawnSync('mkcert', ['-version'], { stdio: 'ignore' });
    return probe.status === 0;
};

const macLocalHostName = () => {
    if (process.platform !== 'darwin') return null;
    try {
        return execFileSync('scutil', ['--get', 'LocalHostName'], { encoding: 'utf8' }).trim();
    } catch {
        return null;
    }
};

const primaryHostName = () => {
    return macLocalHostName() ?? os.hostname().replace(/\.local$/, '');
};

const main = () => {
    if (!haveMkcert()) {
        fail(
            'mkcert not found on PATH.\n\n' +
            'Install it first:\n' +
            '  macOS:   brew install mkcert nss\n' +
            '  Windows: choco install mkcert  (or scoop install mkcert)\n' +
            '  Linux:   see https://github.com/FiloSottile/mkcert#installation\n\n' +
            'Then run once to trust the local root CA on this machine:\n' +
            '  mkcert -install\n\n' +
            'Finally re-run: npm run cert'
        );
    }

    fs.mkdirSync(CERT_DIR, { recursive: true });

    const host = primaryHostName();
    const fromArgs = process.argv.slice(2);
    const fromEnv = (process.env.EXAMPLES_CERT_HOSTS ?? '').split(',');
    const extras = [...fromArgs, ...fromEnv]
    .map(s => s.trim())
    .filter(Boolean);

    // dedupe while preserving order
    const sans = [...new Set(['localhost', '127.0.0.1', '::1', `${host}.local`, ...extras])];

    console.log(`Generating dev cert for: ${sans.join(', ')}`);

    const result = spawnSync(
        'mkcert',
        ['-cert-file', CERT_FILE, '-key-file', KEY_FILE, ...sans],
        { stdio: 'inherit' }
    );
    if (result.status !== 0) {
        fail('mkcert failed to generate certificate.');
    }

    console.log('');
    console.log(`Wrote ${path.relative(process.cwd(), CERT_FILE)}`);
    console.log(`Wrote ${path.relative(process.cwd(), KEY_FILE)}`);
    console.log('');
    console.log('Start the HTTPS dev server with:');
    console.log('  npm run develop:https');
    console.log('');
    console.log('Then open on this Mac:');
    console.log(`  https://${host}.local:${PORT}`);
    console.log(`  https://localhost:${PORT}`);
};

main();
