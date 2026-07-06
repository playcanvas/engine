/* eslint-disable-next-line import/no-unresolved */
import { OptionDefaults } from 'typedoc';

/**
 * TypeDoc configuration for the reusable scripts in scripts/esm, published at
 * https://api.playcanvas.com/scripts/. Run via `npm run docs:scripts` (requires the engine
 * types to be built first, which the npm script takes care of).
 */

const ENGINE_DOCS = 'https://api.playcanvas.com/engine';

// Script attribute tags (parsed by the Editor's attribute parser). Registered so TypeDoc
// accepts them; all but @description are UI metadata and are excluded from the output.
const ATTRIBUTE_TAGS = [
    '@attribute',
    '@title',
    '@description',
    '@range',
    '@precision',
    '@step',
    '@visibleif',
    '@enabledif',
    '@resource'
];

/**
 * Engine symbols referenced by the scripts' JSDoc (including comments inherited from base
 * classes like Script and EventHandler via the d.ts), grouped by the page type they have in the
 * engine API reference. TypeDoc warns about any referenced symbol missing from these lists
 * ("...resolved but is not included in the documentation") — harvest such warnings into the
 * matching list.
 */
const engineSymbols = {
    classes: [
        'AppBase',
        'Asset',
        'BoundingBox',
        'CameraComponent',
        'CameraFrame',
        'Color',
        'Entity',
        'EventHandle',
        'EventHandler',
        'GraphicsDevice',
        'GSplatContainer',
        'GSplatFormat',
        'GSplatResourceBase',
        'Layer',
        'Material',
        'Mesh',
        'MeshInstance',
        'Quat',
        'RenderTarget',
        'Script',
        'ScriptComponent',
        'Shader',
        'ShaderMaterial',
        'StandardMaterial',
        'Texture',
        'Vec2',
        'Vec3',
        'XrInputSource'
    ],
    interfaces: [],
    types: [
        'HandleEventCallback'
    ],
    variables: [],
    functions: [],
    // Class.member references, mapped to lowercased anchors on the class page
    members: [
        'EventHandle.off',
        'GSplatResourceBase.centers'
    ]
};

const playcanvasLinks = {};
for (const [group, dir] of [
    ['classes', 'classes'],
    ['interfaces', 'interfaces'],
    ['types', 'types'],
    ['variables', 'variables'],
    ['functions', 'functions']
]) {
    for (const name of engineSymbols[group]) {
        playcanvasLinks[name] = `${ENGINE_DOCS}/${dir}/${name}.html`;
    }
}
for (const ref of engineSymbols.members) {
    const [cls, member] = ref.split('.');
    playcanvasLinks[ref] = `${ENGINE_DOCS}/classes/${cls}.html#${member.toLowerCase()}`;
}

export default {
    blockTags: [...OptionDefaults.blockTags, ...ATTRIBUTE_TAGS],
    compilerOptions: {
        allowSyntheticDefaultImports: true,
        checkJs: false
    },
    excludeTags: [...OptionDefaults.excludeTags, ...ATTRIBUTE_TAGS.filter(t => t !== '@description')],
    entryPoints: [
        './scripts/esm'
    ],
    entryPointStrategy: 'expand',
    exclude: [
        '**/node_modules/**'
    ],
    excludeNotDocumented: true,
    externalSymbolLinkMappings: {
        playcanvas: playcanvasLinks
    },
    favicon: 'utils/typedoc/favicon.ico',
    hostedBaseUrl: 'https://api.playcanvas.com/scripts/',
    includeVersion: true,
    name: 'Engine Scripts API Reference',
    navigationLinks: {
        'Developer Site': 'https://developer.playcanvas.com/',
        'Blog': 'https://blog.playcanvas.com/',
        'Discord': 'https://discord.gg/RSaMRzg',
        'Forum': 'https://forum.playcanvas.com/',
        'GitHub': 'https://github.com/playcanvas/engine'
    },
    out: 'docs-scripts',
    plugin: [
        'typedoc-plugin-mdn-links'
    ],
    readme: 'scripts/esm/README.md',
    sidebarLinks: {
        'Home': '/',
        'Engine API': '/engine/'
    },
    searchGroupBoosts: {
        'Classes': 2
    }
};
