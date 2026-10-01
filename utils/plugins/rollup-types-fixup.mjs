import fs from 'fs';
import path from 'path';

const GREEN_OUT = '\x1b[32m';
const BOLD_OUT = '\x1b[1m';
const REGULAR_OUT = '\x1b[22m';

const TYPES_PATH = './build/playcanvas/src';

const STANDARD_MAT_PROPS = [
    ['anisotropyMap', 'Texture|null'],
    ['anisotropyMapOffset', 'Vec2'],
    ['anisotropyMapRotation', 'number'],
    ['anisotropyMapTiling', 'Vec2'],
    ['anisotropyMapUv', 'number'],
    ['aoMap', 'Texture|null'],
    ['aoMapChannel', 'string'],
    ['aoMapOffset', 'Vec2'],
    ['aoMapRotation', 'number'],
    ['aoMapTiling', 'Vec2'],
    ['aoMapUv', 'number'],
    ['aoDetailMap', 'Texture|null'],
    ['aoDetailMapChannel', 'string'],
    ['aoDetailMapOffset', 'Vec2'],
    ['aoDetailMapRotation', 'number'],
    ['aoDetailMapTiling', 'Vec2'],
    ['aoDetailMapUv', 'number'],
    ['aoDetailMode', 'string'],
    ['aoVertexColor', 'boolean'],
    ['aoVertexColorChannel', 'string'],
    ['clearCoatGlossInvert', 'boolean'],
    ['clearCoatGlossMap', 'Texture|null'],
    ['clearCoatGlossMapChannel', 'string'],
    ['clearCoatGlossMapOffset', 'Vec2'],
    ['clearCoatGlossMapRotation', 'number'],
    ['clearCoatGlossMapTiling', 'Vec2'],
    ['clearCoatGlossMapUv', 'number'],
    ['clearCoatGlossVertexColor', 'boolean'],
    ['clearCoatGlossVertexColorChannel', 'string'],
    ['clearCoatMap', 'Texture|null'],
    ['clearCoatMapChannel', 'string'],
    ['clearCoatMapOffset', 'Vec2'],
    ['clearCoatMapRotation', 'number'],
    ['clearCoatMapTiling', 'Vec2'],
    ['clearCoatMapUv', 'number'],
    ['clearCoatNormalMap', 'Texture|null'],
    ['clearCoatNormalMapOffset', 'Vec2'],
    ['clearCoatNormalMapRotation', 'number'],
    ['clearCoatNormalMapTiling', 'Vec2'],
    ['clearCoatNormalMapUv', 'number'],
    ['clearCoatVertexColor', 'boolean'],
    ['clearCoatVertexColorChannel', 'string'],
    ['cubeMap', 'Texture|null'],
    ['cubeMapProjection', 'number'],
    ['diffuseDetailMap', 'Texture|null'],
    ['diffuseDetailMapChannel', 'string'],
    ['diffuseDetailMapOffset', 'Vec2'],
    ['diffuseDetailMapRotation', 'number'],
    ['diffuseDetailMapTiling', 'Vec2'],
    ['diffuseDetailMapUv', 'number'],
    ['diffuseDetailMode', 'string'],
    ['diffuseMap', 'Texture|null'],
    ['diffuseMapChannel', 'string'],
    ['diffuseMapOffset', 'Vec2'],
    ['diffuseMapRotation', 'number'],
    ['diffuseMapTiling', 'Vec2'],
    ['diffuseMapUv', 'number'],
    ['diffuseVertexColor', 'boolean'],
    ['diffuseVertexColorChannel', 'string'],
    ['emissiveMap', 'Texture|null'],
    ['emissiveMapChannel', 'string'],
    ['emissiveMapOffset', 'Vec2'],
    ['emissiveMapRotation', 'number'],
    ['emissiveMapTiling', 'Vec2'],
    ['emissiveMapUv', 'number'],
    ['emissiveVertexColor', 'boolean'],
    ['emissiveVertexColorChannel', 'string'],
    ['enableGGXSpecular', 'boolean'],
    ['envAtlas', 'Texture|null'],
    ['fresnelModel', 'number'],
    ['glossInvert', 'boolean'],
    ['glossMap', 'Texture|null'],
    ['glossMapChannel', 'string'],
    ['glossMapOffset', 'Vec2'],
    ['glossMapRotation', 'number'],
    ['glossMapTiling', 'Vec2'],
    ['glossMapUv', 'number'],
    ['glossVertexColor', 'boolean'],
    ['glossVertexColorChannel', 'string'],
    ['heightMap', 'Texture|null'],
    ['heightMapChannel', 'string'],
    ['heightMapOffset', 'Vec2'],
    ['heightMapRotation', 'number'],
    ['heightMapTiling', 'Vec2'],
    ['heightMapUv', 'number'],
    ['lightMap', 'Texture|null'],
    ['lightMapChannel', 'string'],
    ['lightMapOffset', 'Vec2'],
    ['lightMapRotation', 'number'],
    ['lightMapTiling', 'Vec2'],
    ['lightMapUv', 'number'],
    ['lightVertexColor', 'boolean'],
    ['lightVertexColorChannel', 'string'],
    ['metalnessMap', 'Texture|null'],
    ['metalnessMapChannel', 'string'],
    ['metalnessMapOffset', 'Vec2'],
    ['metalnessMapRotation', 'number'],
    ['metalnessMapTiling', 'Vec2'],
    ['metalnessMapUv', 'number'],
    ['metalnessVertexColor', 'boolean'],
    ['metalnessVertexColorChannel', 'string'],
    ['normalDetailMap', 'Texture|null'],
    ['normalDetailMapOffset', 'Vec2'],
    ['normalDetailMapRotation', 'number'],
    ['normalDetailMapTiling', 'Vec2'],
    ['normalDetailMapUv', 'number'],
    ['normalMap', 'Texture|null'],
    ['normalMapOffset', 'Vec2'],
    ['normalMapRotation', 'number'],
    ['normalMapTiling', 'Vec2'],
    ['normalMapUv', 'number'],
    ['occludeDirect', 'boolean'],
    ['occludeSpecular', 'number'],
    ['opacityDither', 'string'],
    ['opacityShadowDither', 'string'],
    ['opacityFadesSpecular', 'boolean'],
    ['opacityMap', 'Texture|null'],
    ['opacityMapChannel', 'string'],
    ['opacityMapOffset', 'Vec2'],
    ['opacityMapRotation', 'number'],
    ['opacityMapTiling', 'Vec2'],
    ['opacityMapUv', 'number'],
    ['opacityVertexColor', 'boolean'],
    ['opacityVertexColorChannel', 'string'],
    ['pixelSnap', 'boolean'],
    ['shadowCatcher', 'boolean'],
    ['specularMap', 'Texture|null'],
    ['specularMapChannel', 'string'],
    ['specularMapOffset', 'Vec2'],
    ['specularMapRotation', 'number'],
    ['specularMapTiling', 'Vec2'],
    ['specularMapUv', 'number'],
    ['specularVertexColor', 'boolean'],
    ['specularVertexColorChannel', 'string'],
    ['specularityFactorMap', 'Texture|null'],
    ['specularityFactorMapChannel', 'string'],
    ['specularityFactorMapOffset', 'Vec2'],
    ['specularityFactorMapRotation', 'number'],
    ['specularityFactorMapTiling', 'Vec2'],
    ['specularityFactorMapUv', 'number'],
    ['useSheen', 'boolean'],
    ['sheenMap', 'Texture|null'],
    ['sheenMapChannel', 'string'],
    ['sheenMapOffset', 'Vec2'],
    ['sheenMapRotation', 'number'],
    ['sheenMapTiling', 'Vec2'],
    ['sheenMapUv', 'number'],
    ['sheenVertexColor', 'boolean'],
    ['sheenVertexColorChannel', 'string'],
    ['sphereMap', 'Texture|null'],
    ['twoSidedLighting', 'boolean'],
    ['useFog', 'boolean'],
    ['useTonemap', 'boolean'],
    ['useLighting', 'boolean'],
    ['useMetalness', 'boolean'],
    ['useMetalnessSpecularColor', 'boolean'],
    ['useSkybox', 'boolean']
];

// The accessors are injected directly after this member of the tsc-emitted class body.
const STANDARD_MAT_ANCHOR = 'reset(): void;';

// A block injected by an earlier run, found directly after the anchor. tsc indents the class body
// with four spaces while the injected lines are tab-indented, so a run of tab-indented (or blank)
// lines there can only be a previous injection. Matching it lets the transformer replace a stale
// block in place rather than add a second copy, which matters when an incremental tsc run leaves
// behind a declaration file that was fixed up with an older STANDARD_MAT_PROPS.
const STANDARD_MAT_INJECTED = /^(?:\r?\n(?: *\t[^\n]*)?)*(?=\r?\n)/;

// tsc emits the AssetMap typedef as a type alias, which cannot be augmented. Rewriting it into an
// interface lets an application add its own asset types with
// `declare module 'playcanvas' { interface AssetMap { mytype: MyResource } }`.
const ASSET_MAP_ALIAS = 'export type AssetMap = {';
const ASSET_MAP_INTERFACE = 'export interface AssetMap {';

const REPLACEMENTS = [{
    path: `${TYPES_PATH}/scene/materials/standard-material.d.ts`,
    replacement: {
        transformer: (contents) => {
            const anchorIndex = contents.indexOf(STANDARD_MAT_ANCHOR);
            if (anchorIndex === -1) {
                throw new Error(`types-fixup: '${STANDARD_MAT_ANCHOR}' not found in the StandardMaterial declarations`);
            }
            const anchorEnd = anchorIndex + STANDARD_MAT_ANCHOR.length;
            const rest = contents.slice(anchorEnd);
            const previous = rest.match(STANDARD_MAT_INJECTED);
            const remainder = rest.slice(previous ? previous[0].length : 0);

            // Each description is looked up in the class JSDoc by its "@property {Type} name" tag.
            // This is a plain string search on purpose: the type can contain characters that mean
            // something in a regex (e.g. Texture|null), which used to match the wrong tag.
            const accessors = STANDARD_MAT_PROPS.map((prop) => {
                const tag = `@property {${prop[1]}} ${prop[0]} `;
                const tagIndex = contents.indexOf(tag);
                let typeDescription = '';
                if (tagIndex !== -1) {
                    // the description runs up to the next block tag, or to the end of the comment
                    const start = tagIndex + tag.length;
                    let end = contents.indexOf('\n * @', start);
                    if (end === -1) {
                        end = contents.indexOf('\n */', start);
                    }
                    typeDescription = end === -1 ? contents.slice(start) : contents.slice(start, end);
                }

                // Strip newlines, asterisks, and tabs from the type description
                const cleanTypeDescription = typeDescription
                .trim()
                .replace(/[\n\t*]/g, ' ') // remove newlines, tabs, and asterisks
                .replace(/\s+/g, ' '); // collapse whitespace

                const jsdoc = cleanTypeDescription ? `/** ${cleanTypeDescription} */` : '';
                return `\t${jsdoc}\n\tset ${prop[0]}(arg: ${prop[1]});\n\tget ${prop[0]}(): ${prop[1]};\n\n`;
            }).join('');

            return `${contents.slice(0, anchorEnd)}\n${accessors}${remainder}`;
        },
        footer: `
import { Color } from '../../core/math/color.js';
import { Vec2 } from '../../core/math/vec2.js';
import { BoundingBox } from '../../core/shape/bounding-box.js';
import { Texture } from '../../platform/graphics/texture.js';
`
    }
}, {
    path: `${TYPES_PATH}/framework/script/script-type.d.ts`,
    replacement: {
        guard: 'initialize?(): void;',
        from: 'get enabled(): boolean;',
        to: `get enabled(): boolean;
    /**
     * Called when script is about to run for the first time.
     */
    initialize?(): void;
    /**
     * Called after all initialize methods are executed in the same tick or enabling chain of actions.
     */
    postInitialize?(): void;
    /**
     * Called for enabled (running state) scripts on each tick.
     * @param dt - The delta time in seconds since the last frame.
     */
    update?(dt: number): void;
    /**
     * Called for enabled (running state) scripts on each tick, after update.
     * @param dt - The delta time in seconds since the last frame.
     */
    postUpdate?(dt: number): void;
    /**
     * Called when a ScriptType that already exists in the registry gets redefined. If the new
     * ScriptType has a \`swap\` method in its prototype, then it will be executed to perform
     * hot-reload at runtime.
     * @param old - Old instance of the scriptType to copy data to the new instance.
     */
    swap?(old: ScriptType): void;
`
    }
}, {
    path: `${TYPES_PATH}/framework/asset/asset.d.ts`,
    replacement: {
        guard: ASSET_MAP_INTERFACE,
        transformer: (contents) => {
            const start = contents.indexOf(ASSET_MAP_ALIAS);
            if (start === -1) {
                throw new Error(`types-fixup: '${ASSET_MAP_ALIAS}' not found in the Asset declarations`);
            }

            // tsc puts each member on its own indented line and the closing `};` at column 0, so
            // the first line-initial `};` after the alias closes it
            const closing = contents.slice(start).match(/^\};\r?$/m);
            if (!closing) {
                throw new Error('types-fixup: the end of the AssetMap alias was not found in the Asset declarations');
            }
            const end = start + closing.index;
            const body = contents.slice(start + ASSET_MAP_ALIAS.length, end);
            return `${contents.slice(0, start)}${ASSET_MAP_INTERFACE}${body}}${contents.slice(end + 2)}`;
        }
    }
}];

export function fixTypes(root = '.') {
    REPLACEMENTS.forEach((item) => {
        const { from, to, footer, guard, transformer } = item.replacement;
        let contents = fs.readFileSync(path.resolve(root, item.path), 'utf-8');
        if (!guard || !contents.includes(guard)) {
            contents = transformer ? transformer(contents) : contents.replace(from, to);
        }
        if (footer) {
            // append only the footer lines the file does not already contain - tsc emits the import
            // itself when the source references the type (e.g. an explicit accessor)
            // tsc emits a type-only import for a type it only sees in JSDoc, so compare without the
            // import keyword: "{ BoundingBox } from '...'" is present either way
            const missing = footer.split('\n').filter((line) => {
                const trimmed = line.trim();
                return trimmed && !contents.includes(trimmed.replace(/^import (type )?/, ''));
            });
            if (missing.length > 0) {
                contents += `\n${missing.join('\n')}\n`;
            }
        }
        fs.writeFileSync(path.resolve(root, item.path), contents, 'utf-8');
        console.log(`${GREEN_OUT}type fixed ${BOLD_OUT}${item.path}${REGULAR_OUT}`);
    });
}

export function typesFixup(root = '.') {
    return {
        name: 'types-fixup',
        buildStart() {
            fixTypes(root);
        }
    };
}
