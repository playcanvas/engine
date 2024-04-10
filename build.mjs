// Build helper scripts
// Format: node build.mjs [options]
// Options:
// target:<moduleFormat>:<buildType> - Specify the target module format and build type. Example: target:esm:release
// target:<moduleFormat> - Specify the target module format only. Example: target:esm
// target:<buildType> - Specify the build type only. Example: target:release
// tree:<treeType> - Specify the tree type. Example: tree:map
import { execSync } from 'child_process';

const ARGS = process.argv.slice(2);

const env = [];

for (let i = 0; i < ARGS.length; i++) {
    if (ARGS[i].startsWith('target') || ARGS[i].startsWith('tree')) {
        env.push(`--environment ${ARGS[i]}`);
    }
}

const cmd = `rollup -c ${env.join(' ')}`;
console.log(cmd);
execSync(cmd, { stdio: 'inherit' });
