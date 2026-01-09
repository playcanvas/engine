/**
 * Build helper script with parallel execution support
 * Usage: node build.mjs [options] -- [rollup options]
 *
 * Options:
 * target[:<moduleFormat>][:<buildType>][:<bundleState>] - Specify the target
 *     - moduleFormat (esm, umd)
 *     - buildType (release, debug, profiler, min)
 *     - bundleState (unbundled, bundled)
 * Example: target:esm:release:bundled
 *
 * treemap - Enable treemap build visualization (release only).
 * treenet - Enable treenet build visualization (release only).
 * treesun - Enable treesun build visualization (release only).
 * treeflame - Enable treeflame build visualization (release only).
 *
 * --sequential - Run builds sequentially (shows full rollup output)
 *
 * Watch mode (-w or --watch):
 * - Pass -w flag to enable watch mode
 * - Watch mode requires a specific target (e.g., target:debug)
 * - Watch mode always runs sequentially with full output
 */

import { spawn, execSync } from 'child_process';
import fs from 'fs';
import os from 'os';
import { version, revision } from './utils/rollup-version-revision.mjs';

const args = process.argv.slice(2);

// Auto-detect environment: interactive terminal vs CI/piped output
const isInteractive = process.stdout.isTTY && !process.env.CI;

// ANSI codes
const BLUE = '\x1b[34m';
const GREEN = '\x1b[32m';
const YELLOW = '\x1b[33m';
const RED = '\x1b[31m';
const GRAY = '\x1b[90m';
const BOLD = '\x1b[1m';
const DIM = '\x1b[2m';
const RESET = '\x1b[0m';
const CLEAR_LINE = '\x1b[2K';
const CURSOR_UP = '\x1b[1A';

// Symbols
const SYM_PENDING = '○';
const SYM_RUNNING = '◐';
const SYM_DONE = '●';
const SYM_FAIL = '✗';

// Parse arguments
const ENV_START_MATCHES = ['target', 'treemap', 'treenet', 'treesun', 'treeflame'];
const envArgs = [];
const rollupArgs = [];
let sequential = false;

for (let i = 0; i < args.length; i++) {
    if (args[i] === '--sequential') {
        sequential = true;
        continue;
    }
    if (ENV_START_MATCHES.some(match => args[i].startsWith(match)) && args[i - 1] !== '--environment') {
        envArgs.push(args[i]);
    } else {
        rollupArgs.push(args[i]);
    }
}

const envTarget = envArgs.find(arg => arg.startsWith('target'))?.replace('target:', '').toLowerCase() ?? null;
const hasVisualization = envArgs.some(arg => ['treemap', 'treenet', 'treesun', 'treeflame'].includes(arg));
const isWatchMode = rollupArgs.includes('-w') || rollupArgs.includes('--watch');

// Determine mode
let mode = 'parallel';
if (sequential) mode = 'sequential';
if (isWatchMode) mode = 'watch';
if (hasVisualization) mode = 'sequential';

// Print banner
if (isInteractive) {
    console.log(`${BLUE}${BOLD}PlayCanvas Engine Build${RESET}`);
    console.log(`${GRAY}v${version} · ${revision} · ${mode} mode${RESET}\n`);
} else {
    console.log(`PlayCanvas Engine Build v${version} (${revision}) [${mode} mode]`);
}

// Clean build directory for full builds (not in watch mode)
if (envTarget === null && !isWatchMode && fs.existsSync('build')) {
    fs.rmSync('build', { recursive: true });
}

/**
 * Build target definitions with their dependencies
 */
const BUILD_TARGETS = [
    { id: 'umd-release', target: 'umd:release', label: 'UMD Release', dependsOn: [] },
    { id: 'esm-release-unbundled', target: 'esm:release:unbundled', label: 'ESM Release (modules)', dependsOn: [] },
    { id: 'umd-debug', target: 'umd:debug', label: 'UMD Debug', dependsOn: [] },
    { id: 'esm-debug-unbundled', target: 'esm:debug:unbundled', label: 'ESM Debug (modules)', dependsOn: [] },
    { id: 'umd-profiler', target: 'umd:profiler', label: 'UMD Profiler', dependsOn: [] },
    { id: 'esm-profiler-unbundled', target: 'esm:profiler:unbundled', label: 'ESM Profiler (modules)', dependsOn: [] },
    { id: 'esm-release-bundled', target: 'esm:release:bundled', label: 'ESM Release (bundle)', dependsOn: ['esm-release-unbundled'] },
    { id: 'esm-debug-bundled', target: 'esm:debug:bundled', label: 'ESM Debug (bundle)', dependsOn: ['esm-debug-unbundled'] },
    { id: 'esm-profiler-bundled', target: 'esm:profiler:bundled', label: 'ESM Profiler (bundle)', dependsOn: ['esm-profiler-unbundled'] },
    { id: 'umd-min', target: 'umd:min', label: 'UMD Minified', dependsOn: ['umd-release'] },
    { id: 'esm-min', target: 'esm:min', label: 'ESM Minified', dependsOn: ['esm-release-bundled'] },
    { id: 'types', target: 'types', label: 'TypeScript Types', dependsOn: ['esm-release-unbundled'] }
];

/**
 * Check if a target should be included based on the envTarget filter.
 *
 * @param {object} targetDef - The build target definition.
 * @returns {boolean} True if the target should be included.
 */
function shouldIncludeTarget(targetDef) {
    if (envTarget === null) return true;
    const { target } = targetDef;
    const parts = target.split(':');
    return envTarget === target ||
           envTarget === parts[0] ||
           envTarget === parts[1] ||
           envTarget === parts[2] ||
           envTarget === `${parts[0]}:${parts[1]}` ||
           envTarget === `${parts[0]}:${parts[2]}` ||
           envTarget === `${parts[1]}:${parts[2]}`;
}

/**
 * Run a single rollup build.
 *
 * @param {object} targetDef - Target definition.
 * @param {string[]} extraEnvArgs - Extra environment arguments.
 * @param {boolean} quiet - If true, capture output; if false, show in terminal.
 * @returns {Promise<{id: string, output: string}>} Build result.
 */
function runBuild(targetDef, extraEnvArgs = [], quiet = true) {
    return new Promise((resolve, reject) => {
        const allEnvArgs = [`target:${targetDef.target}`, ...extraEnvArgs];
        const envString = allEnvArgs.map(e => `--environment ${e}`).join(' ');
        const cmd = `rollup -c ${rollupArgs.join(' ')} ${envString}`;

        const output = [];
        const child = spawn(cmd, {
            shell: true,
            stdio: quiet ? ['pipe', 'pipe', 'pipe'] : 'inherit'
        });

        if (quiet) {
            child.stdout.on('data', data => output.push(data.toString()));
            child.stderr.on('data', data => output.push(data.toString()));
        }

        child.on('close', (code) => {
            if (code === 0) {
                resolve({ id: targetDef.id, output: output.join('') });
            } else {
                reject(new Error(output.join('') || `Exit code ${code}`));
            }
        });

        child.on('error', err => reject(err));
    });
}

/**
 * Run watch mode - passes through to rollup directly.
 *
 * @param {string[]} extraEnvArgs - Extra environment arguments.
 */
function runWatchMode(extraEnvArgs = []) {
    const allEnvArgs = envArgs.concat(extraEnvArgs);
    const envString = allEnvArgs.map(e => `--environment ${e}`).join(' ');
    const cmd = `rollup -c ${rollupArgs.join(' ')} ${envString}`;

    console.log(`${YELLOW}Starting watch mode...${RESET}\n`);

    try {
        execSync(cmd, { stdio: 'inherit' });
    } catch (e) {
        if (e.signal !== 'SIGINT') {
            console.error(`${RED}Watch mode error: ${e.message}${RESET}`);
        }
    }
}

/**
 * Status display manager for clean terminal output
 */
class StatusDisplay {
    constructor(targets) {
        this.targets = targets;
        this.status = new Map(targets.map(t => [t.id, 'pending']));
        this.times = new Map();
        this.startTimes = new Map();
        this.errors = new Map();
        this.lineCount = 0;
    }

    start(id) {
        this.status.set(id, 'running');
        this.startTimes.set(id, performance.now());
        this.render();
    }

    complete(id) {
        this.status.set(id, 'done');
        this.times.set(id, ((performance.now() - this.startTimes.get(id)) / 1000).toFixed(1));
        this.render();
    }

    fail(id, error) {
        this.status.set(id, 'failed');
        this.times.set(id, ((performance.now() - this.startTimes.get(id)) / 1000).toFixed(1));
        this.errors.set(id, error);
        this.render();
    }

    getSymbol(status) {
        switch (status) {
            case 'pending': return `${GRAY}${SYM_PENDING}${RESET}`;
            case 'running': return `${YELLOW}${SYM_RUNNING}${RESET}`;
            case 'done': return `${GREEN}${SYM_DONE}${RESET}`;
            case 'failed': return `${RED}${SYM_FAIL}${RESET}`;
            default: return SYM_PENDING;
        }
    }

    getElapsed(id) {
        const status = this.status.get(id);
        if (status === 'pending') return '';
        if (this.times.has(id)) return `${DIM}${this.times.get(id)}s${RESET}`;
        const elapsed = ((performance.now() - this.startTimes.get(id)) / 1000).toFixed(0);
        return `${DIM}${elapsed}s${RESET}`;
    }

    clear() {
        for (let i = 0; i < this.lineCount; i++) {
            process.stdout.write(CURSOR_UP + CLEAR_LINE);
        }
    }

    render() {
        // Clear previous output
        this.clear();

        // Count by status
        const counts = { pending: 0, running: 0, done: 0, failed: 0 };
        for (const status of this.status.values()) {
            counts[status]++;
        }

        // Header line with counts
        const header = [
            counts.running > 0 ? `${YELLOW}${counts.running} building${RESET}` : null,
            counts.done > 0 ? `${GREEN}${counts.done} done${RESET}` : null,
            counts.failed > 0 ? `${RED}${counts.failed} failed${RESET}` : null,
            counts.pending > 0 ? `${GRAY}${counts.pending} pending${RESET}` : null
        ].filter(Boolean).join(` ${GRAY}·${RESET} `);

        console.log(header);

        // Render each target on one line
        const lines = [];
        for (const target of this.targets) {
            const status = this.status.get(target.id);
            const symbol = this.getSymbol(status);
            const elapsed = this.getElapsed(target.id);
            const label = status === 'running' ? target.label : (status === 'done' ? `${DIM}${target.label}${RESET}` : target.label);
            lines.push(`  ${symbol} ${label} ${elapsed}`);
        }
        console.log(lines.join('\n'));

        this.lineCount = lines.length + 1;
    }

    printErrors() {
        if (this.errors.size > 0) {
            console.log(`\n${RED}${BOLD}Build Errors:${RESET}`);
            for (const [id, error] of this.errors) {
                const target = this.targets.find(t => t.id === id);
                console.log(`\n${RED}${target?.label ?? id}:${RESET}`);
                console.log(error);
            }
        }
    }

    printSummary(totalTime) {
        console.log(`\n${GREEN}${BOLD}Build complete${RESET} ${DIM}in ${totalTime}s${RESET}`);
    }
}

/**
 * CI-friendly linear output display (no cursor manipulation)
 */
class CIDisplay {
    constructor(targets) {
        this.targets = targets;
        this.total = targets.length;
        this.started = 0;
        this.completed = 0;
        this.startTimes = new Map();
        this.errors = new Map();
    }

    start(id) {
        this.started++;
        this.startTimes.set(id, performance.now());
        const target = this.targets.find(t => t.id === id);
        console.log(`[${this.started}/${this.total}] Building ${target?.label ?? id}...`);
    }

    complete(id) {
        this.completed++;
        const elapsed = ((performance.now() - this.startTimes.get(id)) / 1000).toFixed(1);
        const target = this.targets.find(t => t.id === id);
        console.log(`         ${SYM_DONE} ${target?.label ?? id} (${elapsed}s)`);
    }

    fail(id, error) {
        this.completed++;
        const elapsed = ((performance.now() - this.startTimes.get(id)) / 1000).toFixed(1);
        const target = this.targets.find(t => t.id === id);
        console.log(`         ${SYM_FAIL} ${target?.label ?? id} FAILED (${elapsed}s)`);
        this.errors.set(id, error);
    }

    render() {
        // No-op for CI - we print on events instead
    }

    printErrors() {
        if (this.errors.size > 0) {
            console.log('\n=== Build Errors ===');
            for (const [id, error] of this.errors) {
                const target = this.targets.find(t => t.id === id);
                console.log(`\n${target?.label ?? id}:`);
                console.log(error);
            }
        }
    }

    printSummary(totalTime) {
        console.log(`\nBuild complete in ${totalTime}s`);
    }
}

/**
 * Dynamic task pool scheduler with clean status display.
 *
 * @param {object[]} targets - Array of build target definitions.
 * @param {string[]} extraEnvArgs - Extra environment arguments.
 */
async function buildParallel(targets, extraEnvArgs = []) {
    const maxConcurrency = Math.max(1, os.cpus().length - 1);
    const display = isInteractive ? new StatusDisplay(targets) : new CIDisplay(targets);

    const completed = new Set();
    const pending = new Map(targets.map(t => [t.id, t]));
    const active = new Map();

    const startTime = performance.now();
    let failed = null;

    const canStart = targetDef => targetDef.dependsOn.every(dep => completed.has(dep));

    const startBuild = (targetDef) => {
        display.start(targetDef.id);

        const promise = runBuild(targetDef, extraEnvArgs, true)
        .then(result => ({ id: targetDef.id, success: true, output: result.output }))
        .catch(err => ({ id: targetDef.id, success: false, error: err.message }));

        active.set(targetDef.id, promise);
        pending.delete(targetDef.id);
    };

    const fillPool = () => {
        if (failed) return;
        for (const [, targetDef] of pending) {
            if (active.size >= maxConcurrency) break;
            if (canStart(targetDef)) {
                startBuild(targetDef);
            }
        }
    };

    // Initial render
    display.render();
    fillPool();

    // eslint-disable-next-line no-await-in-loop -- intentional: dynamic task pool waits for next completed task
    while (active.size > 0 || pending.size > 0) {
        if (active.size === 0 && pending.size > 0) {
            throw new Error('Circular dependency detected');
        }

        const result = await Promise.race(active.values()); // eslint-disable-line no-await-in-loop
        active.delete(result.id);

        if (result.success) {
            completed.add(result.id);
            display.complete(result.id);
            fillPool();
        } else {
            failed = result.error;
            display.fail(result.id, result.error);

            if (active.size > 0) {
                await Promise.allSettled(active.values()); // eslint-disable-line no-await-in-loop
            }

            display.printErrors();
            throw new Error(`Build failed: ${result.id}`);
        }
    }

    const totalTime = ((performance.now() - startTime) / 1000).toFixed(1);
    display.printSummary(totalTime);
}

/**
 * Build targets sequentially with full output.
 *
 * @param {object[]} targets - Array of build target definitions.
 * @param {string[]} extraEnvArgs - Extra environment arguments.
 */
async function buildSequential(targets, extraEnvArgs = []) {
    const startTime = performance.now();

    for (const targetDef of targets) {
        console.log(`${YELLOW}Building ${targetDef.label}...${RESET}`);
        await runBuild(targetDef, extraEnvArgs, false); // eslint-disable-line no-await-in-loop
        console.log(`${GREEN}✓ ${targetDef.label}${RESET}\n`);
    }

    const totalTime = ((performance.now() - startTime) / 1000).toFixed(1);
    console.log(`${GREEN}${BOLD}Build complete${RESET} ${DIM}in ${totalTime}s${RESET}`);
}

/**
 * Topological sort for dependency ordering.
 *
 * @param {object[]} targets - Array of build target definitions.
 * @returns {object[]} Sorted array of targets.
 */
function topologicalSort(targets) {
    const sorted = [];
    const visited = new Set();
    const visiting = new Set();
    const targetMap = new Map(targets.map(t => [t.id, t]));

    function visit(id) {
        if (visited.has(id)) return;
        if (visiting.has(id)) throw new Error(`Circular dependency: ${id}`);
        const target = targetMap.get(id);
        if (!target) return;
        visiting.add(id);
        for (const dep of target.dependsOn) visit(dep);
        visiting.delete(id);
        visited.add(id);
        sorted.push(target);
    }

    for (const target of targets) visit(target.id);
    return sorted;
}

// Main execution
(async () => {
    try {
        if (isWatchMode) {
            runWatchMode();
            return;
        }

        const filteredTargets = BUILD_TARGETS.filter(shouldIncludeTarget);
        const targetIds = new Set(filteredTargets.map(t => t.id));
        const withDependencies = filteredTargets.slice();

        // Recursively add all dependencies (transitive)
        const addDependencies = (target) => {
            for (const dep of target.dependsOn) {
                if (!targetIds.has(dep)) {
                    const depTarget = BUILD_TARGETS.find(t => t.id === dep);
                    if (depTarget) {
                        targetIds.add(dep);
                        withDependencies.unshift(depTarget);
                        addDependencies(depTarget);
                    }
                }
            }
        };

        for (const target of filteredTargets) {
            addDependencies(target);
        }

        const sorted = topologicalSort(withDependencies);

        if (sorted.length === 0) {
            console.error(isInteractive ? `${RED}${BOLD}No targets found${RESET}` : 'ERROR: No targets found');
            process.exit(1);
        }

        const vizArgs = envArgs.filter(arg => ['treemap', 'treenet', 'treesun', 'treeflame'].includes(arg));

        if (mode === 'sequential') {
            await buildSequential(sorted, vizArgs);
        } else {
            await buildParallel(sorted, vizArgs);
        }
    } catch (err) {
        console.error(isInteractive ? `\n${RED}${BOLD}Build failed:${RESET} ${err.message}` : `\nBuild failed: ${err.message}`);
        process.exit(1);
    }
})();
