import fs from 'fs';
import path from 'path';

const GREEN_OUT = '\x1b[32m';
const BOLD_OUT = '\x1b[1m';
const REGULAR_OUT = '\x1b[22m';

const TYPES_PATH = './build/playcanvas/src';

// StandardMaterial defines its accessors dynamically, so TypeScript emits none of them. They are
// declared by hand from this list, and their doc comments are taken from the matching
// `@property {type} name` tag in the class JSDoc - so the type here must match the type documented
// there, or the build fails. An optional third element supplies the doc comment for properties that
// have no `@property` tag (deprecated aliases, which are defined in src/deprecated/deprecated.js).
const STANDARD_MAT_PROPS = [
    ['alphaFade', 'number'],
    ['ambient', 'Color'],
    ['anisotropy', 'number', 'Defines amount of anisotropy. @deprecated Use {@link StandardMaterial#anisotropyIntensity} and {@link StandardMaterial#anisotropyRotation} instead.'],
    ['anisotropyIntensity', 'number'],
    ['anisotropyRotation', 'number'],
    ['anisotropyMap', 'Texture|null'],
    ['anisotropyMapOffset', 'Vec2'],
    ['anisotropyMapRotation', 'number'],
    ['anisotropyMapTiling', 'Vec2'],
    ['anisotropyMapUv', 'number'],
    ['aoIntensity', 'number'],
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
    ['bumpiness', 'number'],
    ['clearCoat', 'number'],
    ['clearCoatBumpiness', 'number'],
    ['clearCoatGlossInvert', 'boolean'],
    ['clearCoatGlossMap', 'Texture|null'],
    ['clearCoatGlossMapChannel', 'string'],
    ['clearCoatGlossMapOffset', 'Vec2'],
    ['clearCoatGlossMapRotation', 'number'],
    ['clearCoatGlossMapTiling', 'Vec2'],
    ['clearCoatGlossMapUv', 'number'],
    ['clearCoatGlossVertexColor', 'boolean'],
    ['clearCoatGlossVertexColorChannel', 'string'],
    ['clearCoatGloss', 'number'],
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
    ['cubeMapProjectionBox', 'BoundingBox'],
    ['diffuse', 'Color'],
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
    ['emissive', 'Color'],
    ['emissiveIntensity', 'number'],
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
    ['gloss', 'number'],
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
    ['heightMapFactor', 'number'],
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
    ['metalness', 'number'],
    ['metalnessMap', 'Texture|null'],
    ['metalnessMapChannel', 'string'],
    ['metalnessMapOffset', 'Vec2'],
    ['metalnessMapRotation', 'number'],
    ['metalnessMapTiling', 'Vec2'],
    ['metalnessMapUv', 'number'],
    ['metalnessVertexColor', 'boolean'],
    ['metalnessVertexColorChannel', 'string'],
    ['normalDetailMap', 'Texture|null'],
    ['normalDetailMapBumpiness', 'number'],
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
    ['occludeSpecularIntensity', 'number'],
    ['opacity', 'number'],
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
    ['reflectivity', 'number'],
    ['refraction', 'number'],
    ['refractionIndex', 'number'],
    ['dispersion', 'number'],
    ['shadowCatcher', 'boolean'],
    ['specular', 'Color'],
    ['specularMap', 'Texture|null'],
    ['specularMapChannel', 'string'],
    ['specularMapOffset', 'Vec2'],
    ['specularMapRotation', 'number'],
    ['specularMapTiling', 'Vec2'],
    ['specularMapUv', 'number'],
    ['specularVertexColor', 'boolean'],
    ['specularVertexColorChannel', 'string'],
    ['specularityFactor', 'number'],
    ['specularityFactorMap', 'Texture|null'],
    ['specularityFactorMapChannel', 'string'],
    ['specularityFactorMapOffset', 'Vec2'],
    ['specularityFactorMapRotation', 'number'],
    ['specularityFactorMapTiling', 'Vec2'],
    ['specularityFactorMapUv', 'number'],
    ['useSheen', 'boolean'],
    ['sheen', 'Color'],
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

/**
 * Parses the `@property` tags of the StandardMaterial class JSDoc block.
 *
 * @param {string} contents - The contents of the generated standard-material.d.ts.
 * @returns {Map<string, {type: string, description: string}>} The documented properties, keyed by
 * property name.
 */
const parseProperties = (contents) => {
    const properties = new Map();

    // Only consider the class JSDoc block, and split it on tag boundaries so that multi-line
    // descriptions stay attached to the tag they belong to
    const block = contents.slice(0, contents.indexOf('export class StandardMaterial'));
    for (const tag of block.split('\n * @')) {
        const match = /^property \{(.+?)\} (\w+)\s([\s\S]*)$/.exec(tag);
        if (match) {
            const [, type, name, description] = match;
            properties.set(name, {
                type,
                description: description
                .replace(/[\n\t*]/g, ' ') // remove newlines, tabs, and asterisks
                .replace(/\s+/g, ' ') // collapse whitespace
                .trim()
            });
        }
    }

    return properties;
};

const REPLACEMENTS = [{
    path: `${TYPES_PATH}/scene/materials/standard-material.d.ts`,
    replacement: {
        guard: 'set alphaFade(arg:',
        transformer: (contents) => {
            const properties = parseProperties(contents);
            const errors = [];

            const accessors = STANDARD_MAT_PROPS.map(([name, type, doc]) => {
                let description = doc;
                if (description === undefined) {
                    const property = properties.get(name);
                    if (!property) {
                        errors.push(`${name}: declared as '${type}' but has no @property tag`);
                    } else if (property.type !== type) {
                        errors.push(`${name}: declared as '${type}' but documented as '${property.type}'`);
                    }
                    description = property?.description ?? '';
                }

                const jsdoc = description ? `/** ${description} */` : '';
                return `\t${jsdoc}\n\tset ${name}(arg: ${type});\n\tget ${name}(): ${type};\n\n`;
            }).join('');

            if (errors.length) {
                throw new Error(`StandardMaterial types disagree with its JSDoc - fix the @property tag in src/scene/materials/standard-material.js or the type in STANDARD_MAT_PROPS:\n  ${errors.join('\n  ')}`);
            }

            return contents.replace('reset(): void;', `reset(): void;
                ${accessors}`);
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
}];

export function fixTypes(root = '.') {
    REPLACEMENTS.forEach((item) => {
        const { from, to, footer, guard, transformer } = item.replacement;
        let contents = fs.readFileSync(path.resolve(root, item.path), 'utf-8');
        if (!guard || !contents.includes(guard)) {
            contents = transformer ? transformer(contents) : contents.replace(from, to);
        }
        if (footer && !contents.includes(footer.trim())) {
            contents += footer;
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
