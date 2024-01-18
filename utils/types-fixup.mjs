import fs from 'fs';

// Create a regex that matches any string starting with Class< and ending with >
const regex = /Class<(.*?)>/g;
const paths = [
    './types/framework/components/script/component.d.ts',
    './types/framework/entity.d.ts',
    './types/framework/script/script-attributes.d.ts',
    './types/framework/script/script-registry.d.ts',
    './types/framework/script/script.d.ts'
];

paths.forEach((path, index) => {
    let dts = fs.readFileSync(path, 'utf8');
    dts = dts.replace(regex, 'typeof ScriptType');
    // The .d.ts files don't know what a ScriptType is, so import it
    if (index === 0) {
        dts += `
import { ScriptType } from '../../script/script-type.js';
`;
    } else if (index === 1) {
        dts += `
import { ScriptType } from './script/script-type.js';
`;
    } else {
        dts += `
import { ScriptType } from './script-type.js';
`;
    }
    fs.writeFileSync(path, dts);
});

// Fix up description parameter for VertexFormat constructor because tsc
// doesn't recognize it as an array
let path = './types/platform/graphics/vertex-format.d.ts';
let dts = fs.readFileSync(path, 'utf8');
dts = dts.replace('}, vertexCount?: number);', '}[], vertexCount?: number);');
fs.writeFileSync(path, dts);

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

const componentProps = [
    ['enabled', 'boolean']
];

path = './types/framework/components/component.d.ts';
dts = fs.readFileSync(path, 'utf8');
dts = dts.replace(regexConstructor, '$&\n' + getDeclarations(componentProps));
fs.writeFileSync(path, dts);

const buttonComponentProps = [
    ['active', 'boolean'],
    ['fadeDuration', 'number'],
    ['hitPadding', 'Vec4'],
    ['hoverSpriteAsset', 'Asset'],
    ['hoverSpriteFrame', 'number'],
    ['hoverTint', 'Color'],
    ['imageEntity', 'Entity'],
    ['inactiveSpriteAsset', 'Asset'],
    ['inactiveSpriteFrame', 'number'],
    ['inactiveTint', 'Color'],
    ['pressedSpriteAsset', 'Asset'],
    ['pressedSpriteFrame', 'number'],
    ['pressedTint', 'Color'],
    ['transitionMode', 'number']
];

path = './types/framework/components/button/component.d.ts';
dts = fs.readFileSync(path, 'utf8');
dts = dts.replace(regexConstructor, '$&\n' + getDeclarations(buttonComponentProps));
// We need to import types that are newly introduced in the property list above
dts += `
import { Vec4 } from '../../../core/math/vec4.js';
import { Entity } from '../../../framework/entity.js';
import { Asset } from '../../../framework/asset/asset.js';
`;
fs.writeFileSync(path, dts);

const collisionComponentProps = [
    ['axis', 'number'],
    ['halfExtents', 'Vec3'],
    ['height', 'number'],
    ['model', 'Model|null'],
    ['radius', 'number'],
    ['type', 'string']
];

path = './types/framework/components/collision/component.d.ts';
dts = fs.readFileSync(path, 'utf8');
dts = dts.replace(regexConstructor, '$&\n' + getDeclarations(collisionComponentProps));
// We need to import types that are newly introduced in the property list above
dts += `
import { Vec3 } from '../../../core/math/vec3.js';
import { Model } from '../../../scene/model.js';
`;
fs.writeFileSync(path, dts);

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

const lightComponentProps = [
    ['affectDynamic', 'boolean'],
    ['affectLightmapped', 'boolean'],
    ['bake', 'boolean'],
    ['bakeArea', 'number'],
    ['bakeDir', 'boolean'],
    ['bakeNumSamples', 'number'],
    ['cascadeDistribution', 'number'],
    ['castShadows', 'boolean'],
    ['color', 'Color'],
    ['cookieAngle', 'number'],
    ['cookieChannel', 'string'],
    ['cookieFalloff', 'boolean'],
    ['cookieIntensity', 'number'],
    ['cookieOffset', 'Vec2'],
    ['cookieScale', 'Vec2'],
    ['falloffMode', 'number'],
    ['innerConeAngle', 'number'],
    ['intensity', 'number'],
    ['luminance', 'number'],
    ['isStatic', 'boolean'],
    ['layers', 'number[]'],
    ['mask', 'number'],
    ['normalOffsetBias', 'number'],
    ['numCascades', 'number'],
    ['outerConeAngle', 'number'],
    ['range', 'number'],
    ['shadowBias', 'number'],
    ['shadowDistance', 'number'],
    ['shadowIntensity', 'number'],
    ['shadowResolution', 'number'],
    ['shadowType', 'number'],
    ['shadowUpdateMode', 'number'],
    ['shape', 'number'],
    ['affectSpecularity', 'boolean'],
    ['type', 'string'],
    ['vsmBlurMode', 'number'],
    ['vsmBlurSize', 'number']
];

path = './types/framework/components/light/component.d.ts';
dts = fs.readFileSync(path, 'utf8');
dts = dts.replace(regexConstructor, '$&\n' + getDeclarations(lightComponentProps));
// We need to import types that are newly introduced in the property list above
dts += `
import { Color } from '../../../core/math/color.js';
import { Vec2 } from '../../../core/math/vec2.js';
`;
fs.writeFileSync(path, dts);

const particleSystemComponentProps = [
    ['alignToMotion', 'boolean'],
    ['alphaGraph', 'Curve'],
    ['alphaGraph2', 'Curve'],
    ['animIndex', 'number'],
    ['animLoop', 'boolean'],
    ['animNumAnimations', 'number'],
    ['animNumFrames', 'number'],
    ['animSpeed', 'number'],
    ['animStartFrame', 'number'],
    ['animTilesX', 'number'],
    ['animTilesY', 'number'],
    ['autoPlay', 'boolean'],
    ['blend', 'number'],
    ['colorGraph', 'CurveSet'],
    ['colorMapAsset', 'Asset'],
    ['depthSoftening', 'number'],
    ['depthWrite', 'boolean'],
    ['emitterExtents', 'Vec3'],
    ['emitterExtentsInner', 'Vec3'],
    ['emitterRadius', 'number'],
    ['emitterRadiusInner', 'number'],
    ['emitterShape', 'number'],
    ['halfLambert', 'boolean'],
    ['initialVelocity', 'number'],
    ['intensity', 'number'],
    ['layers', 'number[]'],
    ['lifetime', 'number'],
    ['lighting', 'boolean'],
    ['localSpace', 'boolean'],
    ['localVelocityGraph', 'CurveSet'],
    ['localVelocityGraph2', 'CurveSet'],
    ['loop', 'boolean'],
    ['noFog', 'boolean'],
    ['normalMapAsset', 'Asset'],
    ['numParticles', 'number'],
    ['orientation', 'number'],
    ['particleNormal', 'Vec3'],
    ['preWarm', 'boolean'],
    ['radialSpeedGraph', 'Curve'],
    ['radialSpeedGraph2', 'Curve'],
    ['randomizeAnimIndex', 'number'],
    ['rate', 'number'],
    ['rate2', 'number'],
    ['renderAsset', 'Asset'],
    ['rotationSpeedGraph', 'Curve'],
    ['rotationSpeedGraph2', 'Curve'],
    ['scaleGraph', 'Curve'],
    ['scaleGraph2', 'Curve'],
    ['screenSpace', 'boolean'],
    ['sort', 'number'],
    ['startAngle', 'number'],
    ['startAngle2', 'number'],
    ['stretch', 'number'],
    ['velocityGraph', 'CurveSet'],
    ['velocityGraph2', 'CurveSet'],
    ['wrapBounds', 'Vec3']
];

path = './types/framework/components/particle-system/component.d.ts';
dts = fs.readFileSync(path, 'utf8');
// TypeScript compiler is defining enabled in ParticleSystemComponent because it doesn't
// know about the declaration in the Component base class, so remove it.
dts = dts.replace(regexConstructor, '$&\n' + getDeclarations(particleSystemComponentProps));
dts = dts.replace('enabled: any;', '');
// We need to import types that are newly introduced in the property list above
dts += `
import { Vec3 } from '../../../core/math/vec3.js';
import { Curve } from '../../../core/math/curve.js';
import { CurveSet } from '../../../core/math/curve-set.js';
import { Asset } from '../../../framework/asset/asset.js';
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

path = './types/framework/handlers/handler.d.ts';
dts = fs.readFileSync(path, 'utf8');
dts = dts.replace('export class ResourceHandler', 'export interface ResourceHandler');
dts = dts.replace('patch(', 'patch?(');
fs.writeFileSync(path, dts);
