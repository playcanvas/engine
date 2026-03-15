import fs from 'fs';

fs.rmSync('dist', { recursive: true, force: true });
fs.rmSync('cache', { recursive: true, force: true });
