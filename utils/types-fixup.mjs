import fs from 'fs';

// A regex that matches a string starting with 'constructor' and ending with ');'
const regexConstructor = /constructor(.*?)\);/g;

// Generate TS declarations for getter/setter pairs
const getDeclarations = (properties) => {
    let declarations = '';

    properties.forEach((prop) => {
        declarations += `
    set ${prop[0]}(arg: ${prop[1]});
    get ${prop[0]}(): ${prop[1]};
`;
    });

    return declarations;
};

let path, dts;

const elementComponentProps = [
    ['alignment', 'Vec2'],
    ['autoFitHeight', 'boolean'],
    ['autoFitWidth', 'boolean'],
    ['autoHeight', 'boolean'],
    ['autoWidth', 'boolean'],
    ['color', 'Color'],
    ['enableMarkup', 'boolean'],
    ['font', 'Font|CanvasFont'],
    ['fontAsset', 'number'],
    ['fontSize', 'number'],
    ['key', 'string'],
    ['lineHeight', 'number'],
    ['mask', 'boolean'],
    ['material', 'Material'],
    ['materialAsset', 'number'],
    ['maxFontSize', 'number'],
    ['maxLines', 'number'],
    ['minFontSize', 'number'],
    ['opacity', 'number'],
    ['outlineColor', 'Color'],
    ['outlineThickness', 'number'],
    ['pixelsPerUnit', 'number'],
    ['rangeEnd', 'number'],
    ['rangeStart', 'number'],
    ['rect', 'Vec4'],
    ['rtlReorder', 'boolean'],
    ['shadowColor', 'Color'],
    ['shadowOffset', 'number'],
    ['spacing', 'number'],
    ['sprite', 'Sprite'],
    ['spriteAsset', 'number'],
    ['spriteFrame', 'number'],
    ['text', 'string'],
    ['texture', 'Texture'],
    ['textureAsset', 'number'],
    ['unicodeConverter', 'boolean'],
    ['wrapLines', 'boolean']
];

path = './types/framework/components/element/component.d.ts';
dts = fs.readFileSync(path, 'utf8');
dts = dts.replace(regexConstructor, '$&\n' + getDeclarations(elementComponentProps));
// We need to import types that are newly introduced in the property list above
dts += `
import { Color } from '../../../core/math/color.js';
import { Texture } from '../../../platform/graphics/texture.js';
import { Sprite } from '../../../scene/sprite.js';
import { Material } from '../../../scene/materials/material.js';
import { Entity } from '../../../framework/entity.js';
import { CanvasFont } from '../../../framework/font/canvas-font.js';
import { Font } from '../../../framework/font/font.js';
`;
fs.writeFileSync(path, dts);

const scrollbarComponentProps = [
    ['handleEntity', 'Entity'],
    ['handleSize', 'number'],
    ['orientation', 'number']
];

path = './types/framework/components/scrollbar/component.d.ts';
dts = fs.readFileSync(path, 'utf8');
dts = dts.replace(regexConstructor, '$&\n' + getDeclarations(scrollbarComponentProps));
// We need to import types that are newly introduced in the property list above
dts += `
import { Entity } from '../../../framework/entity.js';
`;
fs.writeFileSync(path, dts);

const scrollViewComponentProps = [
    ['bounceAmount', 'number'],
    ['contentEntity', 'Entity'],
    ['friction', 'number'],
    ['horizontal', 'boolean'],
    ['horizontalScrollbarEntity', 'Entity'],
    ['horizontalScrollbarVisibility', 'number'],
    ['mouseWheelSensitivity', 'Vec2'],
    ['scrollMode', 'number'],
    ['useMouseWheel', 'boolean'],
    ['vertical', 'boolean'],
    ['verticalScrollbarEntity', 'Entity'],
    ['verticalScrollbarVisibility', 'number'],
    ['viewportEntity', 'Entity']
];

path = './types/framework/components/scroll-view/component.d.ts';
dts = fs.readFileSync(path, 'utf8');
dts = dts.replace(regexConstructor, '$&\n' + getDeclarations(scrollViewComponentProps));
// We need to import types that are newly introduced in the property list above
dts += `
import { Entity } from '../../../framework/entity.js';
`;
fs.writeFileSync(path, dts);

const standardMaterialProps = [
    ['alphaFade', 'boolean'],
    ['ambient', 'Color'],
    ['ambientTint', 'boolean'],
    ['anisotropy', 'number'],
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
    ['conserveEnergy', 'boolean'],
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
    ['diffuseTint', 'boolean'],
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
    ['emissiveTint', 'boolean'],
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
    ['occludeDirect', 'number'],
    ['occludeSpecular', 'number'],
    ['occludeSpecularIntensity', 'number'],
    ['onUpdateShader', 'UpdateShaderCallback'],
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
    ['shadingModel', 'number'],
    ['specular', 'Color'],
    ['specularMap', 'Texture|null'],
    ['specularMapChannel', 'string'],
    ['specularMapOffset', 'Vec2'],
    ['specularMapRotation', 'number'],
    ['specularMapTiling', 'Vec2'],
    ['specularMapUv', 'number'],
    ['specularTint', 'boolean'],
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
    ['sheenTint', 'boolean'],
    ['sheenVertexColor', 'boolean'],
    ['sheenVertexColorChannel', 'string'],
    ['sphereMap', 'Texture|null'],
    ['twoSidedLighting', 'boolean'],
    ['useFog', 'boolean'],
    ['useGammaTonemap', 'boolean'],
    ['useLighting', 'boolean'],
    ['useMetalness', 'boolean'],
    ['useMetalnessSpecularColor', 'boolean'],
    ['useSkybox', 'boolean']
];

path = './types/scene/materials/standard-material.d.ts';
dts = fs.readFileSync(path, 'utf8');
dts = dts.replace('reset(): void;', 'reset(): void;\n' + getDeclarations(standardMaterialProps));
// We need to import types that are newly introduced in the property list above
dts += `
import { Color } from '../../core/math/color.js';
import { Vec2 } from '../../core/math/vec2.js';
import { BoundingBox } from '../../core/shape/bounding-box.js';
import { Texture } from '../../platform/graphics/texture.js';
`;
fs.writeFileSync(path, dts);

path = './types/framework/script/script-type.d.ts';
dts = fs.readFileSync(path, 'utf8');
dts = dts.replace('get enabled(): boolean;', `get enabled(): boolean;
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
`);
fs.writeFileSync(path, dts);
