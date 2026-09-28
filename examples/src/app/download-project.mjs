import { zipSync, strToU8, strFromU8 } from 'fflate';

import { VERSION } from './constants.mjs';
import { getExampleSnapshot } from './example-snapshot.mjs';
import { readState, validPhysicsBackend } from './url-state.mjs';

// matches the module specifier of `from '...'`, side-effect `import '...'`, and dynamic `import('...')`
const IMPORT_RE = /(\b(?:from|import)[\s(]*)(['"])([^'"\n]+)\2/g;

// matches runtime asset url string literals like './assets/x.glb' or '/scripts/y.js'
const ASSET_RE = /['"`](\.?\/(?:assets|scripts)\/[\w./-]+)['"`]/g;

// files imported for their raw text contents (mirrors the iframe runtime's blob behavior)
const RAW_EXT = /\.(?:vert|frag|wgsl|glsl|html|css|txt)$/;

// the `// @config` comment block (browser-safe copy of utils/example-source.mjs configRegex)
const CONFIG_RE = /^[ \t]*\/\/ @config[ \t]*(?:\r?\n[ \t]*\/\/[^\r\n]*)*(?:\r?\n|$)/gm;

const STATIC_BASE = '/static';

// install the newest published release; the exact dev/beta version the site runs is often unpublished
const PC_RANGE = 'latest';

const OBSERVER_VERSION = '1.7.1';
const VITE_VERSION = '8.0.14';

// license files whose terms require them to ship with the assets they cover, mapped to those
// assets' url prefixes. attribution is preserved generally via @credit -> CREDITS.md; this
// co-locates the actual file only when its assets are bundled, avoiding blanket sidecar probing.
const COLOCATED_LICENSES = {
    '/assets/spine/license.txt': ['/assets/spine/'],
    '/assets/fonts/roboto-license.txt': [
        '/assets/fonts/roboto-regular.json',
        '/assets/fonts/roboto-bold.json'
    ],
    '/assets/fonts/roboto-extralight-license.txt': ['/assets/fonts/roboto-extralight.json'],
    '/assets/wasm/jolt/LICENSE': ['/assets/wasm/jolt/']
};

/**
 * @param {string} spec - Import specifier.
 * @param {Set<string>} vendored - Collects relative asset-module paths to vendor (e.g. 'assets/scripts/misc/x.mjs').
 * @returns {string} Rewritten specifier.
 */
const rewriteSpec = (spec, vendored) => {
    if (spec === 'examples/context') {
        return './context.mjs';
    }
    if (spec.startsWith('examples/assets/')) {
        const rel = spec.slice('examples/'.length);
        if (/\.(?:mjs|js)$/.test(rel)) {
            vendored.add(rel);
        }
        return `./${rel}`;
    }
    if (/^\.{1,2}\//.test(spec) && RAW_EXT.test(spec.split('?')[0])) {
        return `${spec}?raw`;
    }
    return spec;
};

/**
 * @param {string} source - Module source.
 * @param {Set<string>} vendored - Collects asset-module paths to vendor.
 * @returns {string} Source with import specifiers rewritten for a standalone project.
 */
const rewriteImports = (source, vendored) => source.replace(IMPORT_RE, (m, pre, q, spec) => {
    const next = rewriteSpec(spec, vendored);
    return next === spec ? m : `${pre}${q}${next}${q}`;
});

/**
 * Strips the @config block then trims leading blank lines (mirrors build-examples.mjs transformSource).
 *
 * @param {string} source - The example source.
 * @returns {string} The transformed source.
 */
const transformSource = source => source.replace(CONFIG_RE, '').replace(/^(?:[ \t]*\r?\n)+/, '');

/**
 * @param {string[]} sources - Source strings to scan.
 * @returns {{ urls: string[], dynamic: string[] }} Static asset urls (normalized to '/assets/..') and dynamic-dir prefixes.
 */
const scanAssetUrls = (sources) => {
    const urls = new Set();
    const dynamic = new Set();
    for (const src of sources) {
        if (!src) {
            continue;
        }
        for (const [, raw] of src.matchAll(ASSET_RE)) {
            const u = raw.replace(/^\.?\//, '/');
            const last = u.slice(u.lastIndexOf('/') + 1);
            // no extension on the final segment -> likely a directory used to build urls dynamically
            if (!last.includes('.')) {
                dynamic.add(u);
                continue;
            }
            urls.add(u);
        }
    }
    return { urls: [...urls], dynamic: [...dynamic] };
};

/**
 * A font asset loads its texture pages from urls derived from its own, which the example source
 * never names: 'name.png', then 'name1.png', 'name2.png' and so on (mirrors FontHandler).
 *
 * @param {string} url - Url of a bundled asset.
 * @param {Uint8Array} bytes - The asset's contents.
 * @returns {string[]} The urls of the font's texture pages, or none if the asset is not a font.
 */
const fontPages = (url, bytes) => {
    if (!url.endsWith('.json')) {
        return [];
    }
    let data;
    try {
        data = JSON.parse(strFromU8(bytes));
    } catch {
        return [];
    }
    if (!data?.info || !data.chars) {
        return [];
    }
    const first = url.replace('.json', '.png');
    const count = Array.isArray(data.info.maps) ? data.info.maps.length : 1;
    return Array.from({ length: count }, (_, i) => (i === 0 ? first : first.replace('.png', `${i}.png`)));
};

// mirrors the example's runtime context (examples/context): an empty observer the example seeds itself
/**
 * @param {string} deviceType - Graphics device type.
 * @param {string} physicsBackend - Physics backend.
 * @returns {string} The context shim source.
 */
const renderContextShim = (deviceType, physicsBackend) => /* javascript */ `import { Observer } from '@playcanvas/observer';

export const data = new Observer({});
export const deviceType = ${JSON.stringify(deviceType)};
export const physicsBackend = ${JSON.stringify(physicsBackend)};
export const win = window;
`;

/**
 * @param {string} name - Project (package) name.
 * @returns {string} The package.json contents.
 */
const renderPackageJson = name => `${JSON.stringify({
    name,
    private: true,
    version: '0.0.0',
    type: 'module',
    scripts: { dev: 'vite', build: 'vite build', preview: 'vite preview' },
    dependencies: { playcanvas: PC_RANGE, '@playcanvas/observer': OBSERVER_VERSION },
    devDependencies: { vite: VITE_VERSION }
}, null, 2)}\n`;

const VITE_CONFIG = /* javascript */ `import { defineConfig } from 'vite';

export default defineConfig({
    assetsInclude: ['**/*.glb', '**/*.bin', '**/*.wasm']
});
`;

/**
 * @param {string} title - Page title.
 * @returns {string} The index.html contents.
 */
const renderIndexHtml = title => /* html */ `<!DOCTYPE html>
<html>
    <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
        <title>${title}</title>
        <style>
            html, body { margin: 0; padding: 0; width: 100%; height: 100%; overflow: hidden; background: #000; }
            #appInner { position: absolute; inset: 0; }
            #application-canvas { width: 100%; height: 100%; display: block; }
            #controlPanel { position: absolute; top: 0; right: 0; max-height: 100%; overflow: auto; z-index: 1; }
        </style>
    </head>
    <body>
        <div id="appInner"><canvas id="application-canvas"></canvas></div>
        <div id="controlPanel"></div>
        <script type="module" src="/src/main.mjs"></script>
    </body>
</html>
`;

const MAIN = /* javascript */ `import seed from './data.json';
import { data } from './context.mjs';

import './example.mjs';

// replay the captured control state after the example initializes (mirrors the examples browser)
for (const [path, value] of Object.entries(seed)) {
    if (data.has(path)) {
        data.set(path, value);
    }
}
`;

/**
 * @param {string} title - Example title.
 * @param {string[]} dynamic - Dynamic asset prefixes that were not bundled.
 * @param {string[]} failed - Asset urls that could not be fetched.
 * @returns {string} The README contents.
 */
const renderReadme = (title, dynamic, failed) => {
    let md = /* markdown */ `# ${title}

A standalone PlayCanvas example, exported as a Vite project.

\`\`\`bash
npm install
npm run dev
\`\`\`

Then open the printed local URL.

The example's current control values are captured in \`src/data.json\` and applied after it loads.
`;
    if (VERSION) {
        md += `\n> Depends on \`playcanvas@${PC_RANGE}\` (the newest published release). This example was authored against \`${VERSION}\`, so a newer release may behave slightly differently.\n`;
    }
    if (dynamic.length) {
        md += `\n> **Heads up:** these assets are referenced dynamically and were not bundled — the example may need network access for them:\n${dynamic.map(d => `> - \`${d}\``).join('\n')}\n`;
    }
    if (failed.length) {
        md += `\n> **Warning:** these referenced assets could not be fetched and are missing:\n${failed.map(f => `> - \`${f}\``).join('\n')}\n`;
    }
    return md;
};

/**
 * Renders the author-written `@credit` attribution into a standalone CREDITS.md.
 *
 * @param {{ title: string, author: string, source?: string, license?: string }[]} credits - Parsed @credit entries.
 * @returns {string} The CREDITS.md contents.
 */
const renderCredits = credits => `# Credits

Third-party assets used by this example:

${credits.map((c) => {
        const lines = [`## ${c.title}`, `- **Author:** ${c.author}`];
        if (c.source) {
            lines.push(`- **Source:** ${c.source}`);
        }
        if (c.license) {
            lines.push(`- **License:** ${c.license}`);
        }
        return lines.join('\n');
    }).join('\n\n')}\n`;

/**
 * Builds a standalone, runnable Vite project for a single example and returns the zip bytes.
 *
 * @param {object} opts - Options.
 * @param {Record<string, string>} opts.files - Example source buffers keyed by filename.
 * @param {string} opts.category - Kebab category.
 * @param {string} opts.exampleName - Kebab example name.
 * @param {string} opts.deviceType - Graphics device type to hardcode in the shim.
 * @param {string} [opts.physicsBackend] - Physics backend to hardcode in the shim.
 * @param {object} opts.data - The example's current control state, replayed after it loads.
 * @param {{ title: string, author: string, source?: string, license?: string }[]} [opts.credits] - Parsed @credit attribution, written to CREDITS.md.
 * @returns {Promise<Uint8Array>} The zip archive bytes.
 */
export const buildProjectZip = async ({ files, category, exampleName, deviceType, physicsBackend = 'ammo', data, credits }) => {
    const root = `${category}-${exampleName}`;
    const title = `${category} / ${exampleName}`;
    /** @type {Record<string, Uint8Array>} */
    const out = {};
    /**
     * @param {string} p - Path within the project root.
     * @param {string} text - File contents.
     */
    const add = (p, text) => {
        out[`${root}/${p}`] = strToU8(text);
    };

    /** @type {Set<string>} */
    const vendored = new Set();

    // example source: strip @config, rewrite imports
    add('src/example.mjs', rewriteImports(transformSource(files['example.mjs'] ?? ''), vendored));

    // ship the example's remaining own files (shaders/text) verbatim; the controls UI is dropped
    for (const [name, src] of Object.entries(files)) {
        if (name === 'example.mjs' || name === 'controls.jsx') {
            continue;
        }
        if (/\.(?:mjs|js)$/.test(name)) {
            add(`src/${name}`, rewriteImports(src, vendored));
        } else {
            add(`src/${name}`, src);
        }
    }

    // vendor non-published asset modules (e.g. assets/scripts/misc/*.mjs), recursing into their imports
    /** @type {Set<string>} */
    const vendoredSeen = new Set();
    /** @type {string[]} */
    const failed = [];
    /**
     * @param {string} rel - Asset-relative module path (e.g. 'assets/scripts/misc/x.mjs').
     * @returns {Promise<void>} Resolves once the module (and its imports) are vendored.
     */
    const vendorModule = async (rel) => {
        if (vendoredSeen.has(rel)) {
            return;
        }
        vendoredSeen.add(rel);
        const res = await fetch(`${STATIC_BASE}/${rel}`);
        if (!res.ok) {
            failed.push(`/${rel}`);
            return;
        }
        /** @type {Set<string>} */
        const nested = new Set();
        add(`src/${rel}`, rewriteImports(await res.text(), nested));
        await Promise.all([...nested].map(vendorModule));
    };
    await Promise.all([...vendored].map(vendorModule));

    // scaffold
    add('src/context.mjs', renderContextShim(deviceType, physicsBackend));
    add('src/data.json', `${JSON.stringify(data ?? {}, null, 2)}\n`);
    add('src/main.mjs', MAIN);
    add('index.html', renderIndexHtml(title));
    add('package.json', renderPackageJson(root));
    add('vite.config.mjs', VITE_CONFIG);

    // scan + fetch referenced assets into public/ (paths resolve unchanged under Vite), with the
    // texture pages of any fonts among them
    const { urls, dynamic } = scanAssetUrls([files['example.mjs']]);
    /** @type {Set<string>} */
    const fetched = new Set();
    /**
     * @param {string} u - Asset url, from the site root.
     * @returns {Promise<void>} Resolves once the asset, and any pages it has, are bundled.
     */
    const fetchAsset = async (u) => {
        if (fetched.has(u)) {
            return;
        }
        fetched.add(u);
        const res = await fetch(`${STATIC_BASE}${u}`);
        if (!res.ok) {
            failed.push(u);
            return;
        }
        const bytes = new Uint8Array(await res.arrayBuffer());
        out[`${root}/public${u}`] = bytes;
        await Promise.all(fontPages(u, bytes).map(fetchAsset));
    };
    await Promise.all(urls.map(fetchAsset));

    // co-locate license files whose terms require shipping the file with the assets they cover
    await Promise.all(Object.entries(COLOCATED_LICENSES).map(async ([lic, covers]) => {
        if (urls.some(u => covers.some(c => u.startsWith(c)))) {
            await fetchAsset(lic);
        }
    }));

    if (dynamic.length) {
        console.warn('[download] dynamic asset prefixes not bundled:', dynamic);
    }
    if (failed.length) {
        console.warn('[download] assets that could not be fetched:', failed);
    }

    add('README.md', renderReadme(title, dynamic, failed));

    // preserve author-written attribution (@credit blocks) as a dedicated CREDITS.md
    if (credits?.length) {
        add('CREDITS.md', renderCredits(credits));
    }

    return zipSync(out, { level: 0 });
};

/**
 * Builds the current example's project zip and triggers a browser download.
 *
 * @returns {Promise<void>} Resolves once the download has been triggered.
 */
export const downloadExampleProject = async () => {
    const snap = getExampleSnapshot();
    if (!snap) {
        return;
    }
    const deviceType = window.activeGraphicsDevice ?? readState().device ??
        localStorage.getItem('preferredGraphicsDevice') ?? 'webgl2';
    const physicsBackend = validPhysicsBackend(readState().physics) ??
        validPhysicsBackend(localStorage.getItem('preferredPhysicsBackend')) ?? 'ammo';
    const bytes = await buildProjectZip({
        files: snap.files,
        category: snap.category,
        exampleName: snap.example,
        deviceType,
        physicsBackend,
        data: snap.data,
        credits: snap.credits
    });
    const part = /** @type {BlobPart} */ (bytes);
    const url = URL.createObjectURL(new Blob([part], { type: 'application/zip' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = `${snap.category}-${snap.example}.zip`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
};
