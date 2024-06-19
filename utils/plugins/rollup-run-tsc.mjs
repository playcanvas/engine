import * as fs from 'node:fs';
import { execSync } from 'node:child_process';

const GREEN_OUT = '\x1b[32m';

export function runTsc(config = 'tsconfig.json') {
    if (!fs.existsSync(config)) {
        throw new Error(`tsconfig file does not exist: ${config}`);
    }
    return {
        name: 'run-tsc',
        buildStart() {
            const cmd = `tsc --project ${config}`;
            console.log(`${GREEN_OUT}${cmd}`);
            execSync(cmd);
        }
    };
}
