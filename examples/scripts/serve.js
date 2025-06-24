#!/usr/bin/env node

import { promises as fs } from 'fs';
import http from 'http';
import path from 'path';
import { parse as parseUrl } from 'url';

import { transformSync } from '@swc/core';
import serveHandler from 'serve-handler';

// Cache for transpiled TypeScript files
const cache = new Map();

// SWC configuration matching the project's existing setup
const swcOptions = {
    jsc: {
        parser: {
            syntax: 'typescript',
            tsx: false,
            decorators: false,
            dynamicImport: true
        },
        target: 'es2022',
        loose: false,
        externalHelpers: false
    },
    module: {
        type: 'es6',
        strict: false,
        strictMode: true,
        lazy: false,
        noInterop: false
    },
    sourceMaps: 'inline',
    inlineSourcesContent: true
};

/**
 * Check if a file exists
 * @param {string} filePath - The path to the file
 * @returns {Promise<boolean>} Whether the file exists
 */
async function fileExists(filePath) {
    try {
        await fs.access(filePath);
        return true;
    } catch {
        return false;
    }
}

/**
 * Get file modification time
 * @param {string} filePath - The path to the file
 * @returns {Promise<number | null>} The file modification time
 */
async function getMtime(filePath) {
    try {
        const stats = await fs.stat(filePath);
        return stats.mtime.getTime();
    } catch {
        return null;
    }
}

/**
 * Transpile TypeScript file to JavaScript
 * @param {string} tsPath - The path to the TypeScript file
 * @param {string} jsPath - The path to the JavaScript file
 * @returns {Promise<string>} The transpiled JavaScript code
 */
async function transpileTypeScript(tsPath, jsPath) {
    // Check cache
    const cacheKey = tsPath;
    const mtime = await getMtime(tsPath);

    if (cache.has(cacheKey)) {
        const cached = cache.get(cacheKey);
        if (cached.mtime === mtime) {
            console.log(`[Serve] Cache hit: ${path.relative(process.cwd(), tsPath)}`);
            return cached.content;
        }
    }

    console.log(`[Serve] Transpiling: ${path.relative(process.cwd(), tsPath)}`);

    try {
        const tsContent = await fs.readFile(tsPath, 'utf8');
        // @ts-ignore
        const result = transformSync(tsContent, {
            ...swcOptions,
            filename: tsPath
        });

        // Cache the result
        cache.set(cacheKey, {
            content: result.code,
            mtime: mtime
        });

        return result.code;
    } catch (error) {
        console.error(`[Serve] Error transpiling ${tsPath}:`, error.message);
        throw error;
    }
}

/**
 * Custom request handler that intercepts .js requests
 * @param {import('http').IncomingMessage} request - The incoming request
 * @param {import('http').ServerResponse} response - The outgoing response
 * @param {object} serveConfig - The serve configuration
 * @param {string} rootDir - The root directory to serve
 * @returns {Promise<void>}
 */
async function handleRequest(request, response, serveConfig, rootDir) {
    const parsedUrl = parseUrl(request.url ?? '');
    const requestPath = parsedUrl.pathname;

    // Only intercept .js file requests
    if (requestPath?.endsWith('.js')) {
        const absolutePath = path.join(rootDir, requestPath);
        const jsExists = await fileExists(absolutePath);

        // If .js file doesn't exist, check for .ts file
        if (!jsExists) {
            const tsPath = absolutePath.replace(/\.js$/, '.ts');
            const tsExists = await fileExists(tsPath);

            if (tsExists) {
                try {
                    const transpiledCode = await transpileTypeScript(tsPath, absolutePath);

                    // Send the transpiled JavaScript
                    response.setHeader('Content-Type', 'application/javascript; charset=utf-8');
                    response.setHeader('Cache-Control', 'no-cache');
                    response.statusCode = 200;
                    response.end(transpiledCode);
                    return;
                } catch (error) {
                    // Send error response
                    response.setHeader('Content-Type', 'text/plain; charset=utf-8');
                    response.statusCode = 500;
                    response.end(`Error transpiling TypeScript file: ${error.message}`);
                    return;
                }
            }
        }
    }

    // Pass through to serve-handler for all other requests
    return serveHandler(request, response, {
        ...serveConfig,
        public: rootDir
    });
}

/**
 * Start the server
 */
async function startServer() {
    const port = process.env.PORT || 3000;
    // Get directory to serve from command line args or environment variable
    const args = process.argv.slice(2);
    let rootDir = args[0] || process.env.SERVE_DIR || 'dist';

    // Resolve to absolute path
    rootDir = path.resolve(process.cwd(), rootDir);

    // Check if directory exists
    if (!await fileExists(rootDir)) {
        console.error(`[Serve] Error: Directory '${rootDir}' does not exist`);
        process.exit(1);
    }

    // Load serve configuration
    let serveConfig = {};
    try {
        const configPath = path.join(process.cwd(), 'serve.json');
        const configContent = await fs.readFile(configPath, 'utf8');
        serveConfig = JSON.parse(configContent);
    } catch {
        // No serve.json found, use defaults
    }

    const server = http.createServer((request, response) => {
        handleRequest(request, response, serveConfig, rootDir).catch((error) => {
            console.error('[Serve] Server error:', error);
            response.statusCode = 500;
            response.end('Internal Server Error');
        });
    });

    server.listen(port, () => {
        console.log(`[Serve] TS-enabled server running at http://localhost:${port}`);
        console.log(`[Serve] Serving directory: ${rootDir}`);
    });
}

// Start the server
startServer().catch((error) => {
    console.error('[Serve] Failed to start server:', error);
    process.exit(1);
});

export { handleRequest, transpileTypeScript };
