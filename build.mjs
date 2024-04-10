// Build helper scripts
// Format: node build.mjs [options]
// Options:
// target:<moduleFormat>:<buildType> - Specify the target module format and build type. Example: target:esm:release
// target:<moduleFormat> - Specify the target module format only. Example: target:esm
// target:<buildType> - Specify the build type only. Example: target:release
// tree:<treeType> - Specify the tree type. Example: tree:map
import { execSync } from 'child_process';

const args = process.argv.slice(2);

const ENV_START_MATCHES = [
    'target',
    'treemap',
    'treenet',
    'treesun'
];

const env = [];
for (let i = 0; i < args.length; i++) {
    if (ENV_START_MATCHES.some(match => args[i].startsWith(match))) {
        env.push(`--environment ${args[i]}`);
        args.splice(i, 1);
        i--;
        continue;
    }
}

const cmd = `rollup -c ${args.join(' ')} ${env.join(' ')}`;
console.log(cmd);
execSync(cmd, { stdio: 'inherit' });
