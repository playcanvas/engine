import fs from 'fs';

// Create a regex that matches any string starting with Class< and ending with >
const regex = /Class<(.*?)>/g;
const paths = [
    './types/framework/components/script/component.d.ts',
    './types/script/script-attributes.d.ts',
    './types/script/script-registry.d.ts',
    './types/script/script.d.ts'
];

paths.forEach(path => {
    let dts = fs.readFileSync(path, 'utf8');
    dts = dts.replace(regex, 'typeof ScriptType');
    fs.writeFileSync(path, dts);
});

// Fix up description parameter for VertexFormat constructor because tsc
// doesn't recognize it as an array
let path = './types/graphics/vertex-format.d.ts';
let dts = fs.readFileSync(path, 'utf8');
dts = dts.replace('}, vertexCount?: number);', '}[], vertexCount?: number);');
fs.writeFileSync(path, dts);

const getDeclarations = (properties) => {
    let declarations = '';

    properties.forEach(prop => {
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
dts = dts.replace('get data(): any;', 'get data(): any;\n' + getDeclarations(componentProps));
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
dts = dts.replace('constructor(system: ButtonComponentSystem, entity: Entity);', 'constructor(system: ButtonComponentSystem, entity: Entity);\n' + getDeclarations(buttonComponentProps));
fs.writeFileSync(path, dts);

const cameraComponentProps = [
    ['aspectRatio', 'number'],
    ['aspectRatioMode', 'number'],
    ['calculateProjection', 'calculateMatrixCallback'],
    ['calculateTransform', 'calculateTransformCallback'],
    ['clearColor', 'Color'],
    ['cullFaces', 'boolean'],
    ['farClip', 'number'],
    ['flipFaces', 'boolean'],
    ['fov', 'number'],
    ['frustumCulling', 'boolean'],
    ['horizontalFov', 'boolean'],
    ['nearClip', 'number'],
    ['orthoHeight', 'number'],
    ['projection', 'number'],
    ['scissorRect', 'Vec4']
];

path = './types/framework/components/camera/component.d.ts';
dts = fs.readFileSync(path, 'utf8');
dts = dts.replace('_postEffects: PostEffectQueue;', '_postEffects: PostEffectQueue;\n' + getDeclarations(cameraComponentProps));
fs.writeFileSync(path, dts);

const elementComponentProps = [
    ['alignment', 'Vec2'],
    ['autoFitHeight', 'boolean'],
    ['autoFitWidth', 'boolean'],
    ['autoHeight', 'boolean'],
    ['autoWidth', 'boolean'],
    ['color', 'Color'],
    ['enableMarkup', 'boolean'],
    ['font', 'Font'],
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
dts = dts.replace('_maskedBy: any;', '_maskedBy: any;\n' + getDeclarations(elementComponentProps));
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
    ['isStatic', 'boolean'],
    ['layers', 'number[]'],
    ['mask', 'number'],
    ['normalOffsetBias', 'number'],
    ['numCascades', 'number'],
    ['outerConeAngle', 'number'],
    ['range', 'number'],
    ['shadowBias', 'number'],
    ['shadowDistance', 'number'],
    ['shadowResolution', 'number'],
    ['shadowType', 'number'],
    ['shadowUpdateMode', 'number'],
    ['shape', 'number'],
    ['type', 'string'],
    ['vsmBlurMode', 'number'],
    ['vsmBlurSize', 'number']
];

path = './types/framework/components/light/component.d.ts';
dts = fs.readFileSync(path, 'utf8');
dts = dts.replace('entity: Entity);', 'entity: Entity);\n' + getDeclarations(lightComponentProps));
fs.writeFileSync(path, dts);

const standarMaterialProps = [
    ['alphaFade', 'boolean'],
    ['ambient', 'Color'],
    ['ambientTint', 'boolean'],
    ['anisotropy', 'number'],
    ['aoMap', 'Texture'],
    ['aoMapChannel', 'string'],
    ['aoMapOffset', 'Vec2'],
    ['aoMapRotation', 'number'],
    ['aoMapTiling', 'Vec2'],
    ['aoMapUv', 'number'],
    ['aoVertexColor', 'boolean'],
    ['aoVertexColorChannel', 'string'],
    ['bumpiness', 'number'],
    ['clearCoat', 'number'],
    ['clearCoatBumpiness', 'number'],
    ['clearCoatGlossMap', 'Texture'],
    ['clearCoatGlossMapChannel', 'string'],
    ['clearCoatGlossMapOffset', 'Vec2'],
    ['clearCoatGlossMapRotation', 'number'],
    ['clearCoatGlossMapTiling', 'Vec2'],
    ['clearCoatGlossMapUv', 'number'],
    ['clearCoatGlossVertexColor', 'boolean'],
    ['clearCoatGlossVertexColorChannel', 'string'],
    ['clearCoatGlossiness', 'number'],
    ['clearCoatMap', 'Texture'],
    ['clearCoatMapChannel', 'string'],
    ['clearCoatMapOffset', 'Vec2'],
    ['clearCoatMapRotation', 'number'],
    ['clearCoatMapTiling', 'Vec2'],
    ['clearCoatMapUv', 'number'],
    ['clearCoatNormalMap', 'Texture'],
    ['clearCoatNormalMapOffset', 'Vec2'],
    ['clearCoatNormalMapRotation', 'number'],
    ['clearCoatNormalMapTiling', 'Vec2'],
    ['clearCoatNormalMapUv', 'number'],
    ['clearCoatVertexColor', 'boolean'],
    ['clearCoatVertexColorChannel', 'string'],
    ['conserveEnergy', 'boolean'],
    ['cubeMap', 'Texture'],
    ['cubeMapProjection', 'number'],
    ['cubeMapProjectionBox', 'BoundingBox'],
    ['diffuse', 'Color'],
    ['diffuseDetailMap', 'Texture'],
    ['diffuseDetailMapChannel', 'string'],
    ['diffuseDetailMapOffset', 'Vec2'],
    ['diffuseDetailMapRotation', 'number'],
    ['diffuseDetailMapTiling', 'Vec2'],
    ['diffuseDetailMapUv', 'number'],
    ['diffuseDetailMode', 'string'],
    ['diffuseMap', 'Texture'],
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
    ['emissiveMap', 'Texture'],
    ['emissiveMapChannel', 'string'],
    ['emissiveMapOffset', 'Vec2'],
    ['emissiveMapRotation', 'number'],
    ['emissiveMapTiling', 'Vec2'],
    ['emissiveMapUv', 'number'],
    ['emissiveTint', 'boolean'],
    ['emissiveVertexColor', 'boolean'],
    ['emissiveVertexColorChannel', 'string'],
    ['enableGGXSpecular', 'boolean'],
    ['fresnelModel', 'number'],
    ['glossMap', 'Texture'],
    ['glossMapChannel', 'string'],
    ['glossMapOffset', 'Vec2'],
    ['glossMapRotation', 'number'],
    ['glossMapTiling', 'Vec2'],
    ['glossMapUv', 'number'],
    ['glossVertexColor', 'boolean'],
    ['glossVertexColorChannel', 'string'],
    ['heightMap', 'Texture'],
    ['heightMapChannel', 'string'],
    ['heightMapFactor', 'number'],
    ['heightMapOffset', 'Vec2'],
    ['heightMapRotation', 'number'],
    ['heightMapTiling', 'Vec2'],
    ['heightMapUv', 'number'],
    ['lightMap', 'Texture'],
    ['lightMapChannel', 'string'],
    ['lightMapOffset', 'Vec2'],
    ['lightMapRotation', 'number'],
    ['lightMapTiling', 'Vec2'],
    ['lightMapUv', 'number'],
    ['lightVertexColor', 'boolean'],
    ['lightVertexColorChannel', 'string'],
    ['metalness', 'number'],
    ['metalnessMap', 'Texture'],
    ['metalnessMapChannel', 'string'],
    ['metalnessMapOffset', 'Vec2'],
    ['metalnessMapRotation', 'number'],
    ['metalnessMapTiling', 'Vec2'],
    ['metalnessMapUv', 'number'],
    ['metalnessVertexColor', 'boolean'],
    ['metalnessVertexColorChannel', 'string'],
    ['normalDetailMap', 'Texture'],
    ['normalDetailMapBumpiness', 'number'],
    ['normalDetailMapOffset', 'Vec2'],
    ['normalDetailMapRotation', 'number'],
    ['normalDetailMapTiling', 'Vec2'],
    ['normalDetailMapUv', 'number'],
    ['normalMap', 'Texture'],
    ['normalMapOffset', 'Vec2'],
    ['normalMapRotation', 'number'],
    ['normalMapTiling', 'Vec2'],
    ['normalMapUv', 'number'],
    ['occludeDirect', 'number'],
    ['occludeSpecular', 'number'],
    ['occludeSpecularIntensity', 'number'],
    ['onUpdateShader', 'updateShaderCallback'],
    ['opacity', 'number'],
    ['opacityFadesSpecular', 'boolean'],
    ['opacityMap', 'Texture'],
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
    ['shininess', 'number'],
    ['specular', 'Color'],
    ['specularAntialias', 'boolean'],
    ['specularMap', 'Texture'],
    ['specularMapChannel', 'string'],
    ['specularMapOffset', 'Vec2'],
    ['specularMapRotation', 'number'],
    ['specularMapTiling', 'Vec2'],
    ['specularMapUv', 'number'],
    ['specularTint', 'boolean'],
    ['specularVertexColor', 'boolean'],
    ['specularVertexColorChannel', 'string'],
    ['sphereMap', 'Texture'],
    ['twoSidedLighting', 'boolean'],
    ['useFog', 'boolean'],
    ['useGammaTonemap', 'boolean'],
    ['useLighting', 'boolean'],
    ['useMetalness', 'boolean'],
    ['useSkybox', 'boolean']
];

path = './types/scene/materials/standard-material.d.ts';
dts = fs.readFileSync(path, 'utf8');
dts = dts.replace('reset(): void;', 'reset(): void;\n' + getDeclarations(standarMaterialProps));
fs.writeFileSync(path, dts);
