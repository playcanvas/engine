import { CUBEPROJ_NONE, DETAILMODE_MUL, DITHER_NONE, FRESNEL_SCHLICK, SPECOCC_AO } from '../../../src/scene/constants.js';
import { Color } from '../../../src/core/math/color.js';
import { Material } from '../../../src/scene/materials/material.js';
import { StandardMaterial } from '../../../src/scene/materials/standard-material.js';
import { Vec2 } from '../../../src/core/math/vec2.js';

import { expect } from 'chai';

describe('StandardMaterial', function () {

    function checkDefaultMaterial(material) {
        expect(material).to.be.an.instanceof(StandardMaterial);
        expect(material).to.be.an.instanceof(Material);
        expect(material.alphaFade).to.equal(1);
        expect(material.ambient).to.be.an.instanceof(Color);
        expect(material.ambient.r).to.equal(0.7);
        expect(material.ambient.g).to.equal(0.7);
        expect(material.ambient.b).to.equal(0.7);
        expect(material.ambientTint).to.equal(false);
        expect(material.anisotropy).to.equal(0);

        expect(material.aoDetailMap).to.be.null;
        expect(material.aoDetailMapChannel).to.equal('g');
        expect(material.aoDetailMapOffset).to.be.an.instanceof(Vec2);
        expect(material.aoDetailMapOffset.x).to.equal(0);
        expect(material.aoDetailMapOffset.y).to.equal(0);
        expect(material.aoDetailMapRotation).to.equal(0);
        expect(material.aoDetailMapTiling).to.be.an.instanceof(Vec2);
        expect(material.aoDetailMapTiling.x).to.equal(1);
        expect(material.aoDetailMapTiling.y).to.equal(1);
        expect(material.aoDetailMapUv).to.equal(0);
        expect(material.aoDetailMode).to.equal(DETAILMODE_MUL);
        expect(material.aoMap).to.be.null;
        expect(material.aoMapChannel).to.equal('g');
        expect(material.aoMapOffset).to.be.an.instanceof(Vec2);
        expect(material.aoMapOffset.x).to.equal(0);
        expect(material.aoMapOffset.y).to.equal(0);
        expect(material.aoMapRotation).to.equal(0);
        expect(material.aoMapTiling).to.be.an.instanceof(Vec2);
        expect(material.aoMapTiling.x).to.equal(1);
        expect(material.aoMapTiling.y).to.equal(1);
        expect(material.aoMapUv).to.equal(0);
        expect(material.aoVertexColor).to.equal(false);
        expect(material.aoVertexColorChannel).to.equal('g');

        expect(material.bumpiness).to.equal(1);
        expect(material.chunks).to.be.empty;

        expect(material.clearCoat).to.equal(0);
        expect(material.clearCoatBumpiness).to.equal(1);
        expect(material.clearCoatGlossMap).to.be.null;
        expect(material.clearCoatGlossMapChannel).to.equal('g');
        expect(material.clearCoatGlossMapOffset).to.be.an.instanceof(Vec2);
        expect(material.clearCoatGlossMapOffset.x).to.equal(0);
        expect(material.clearCoatGlossMapOffset.y).to.equal(0);
        expect(material.clearCoatGlossMapRotation).to.equal(0);
        expect(material.clearCoatGlossMapTiling).to.be.an.instanceof(Vec2);
        expect(material.clearCoatGlossMapTiling.x).to.equal(1);
        expect(material.clearCoatGlossMapTiling.y).to.equal(1);
        expect(material.clearCoatGlossMapUv).to.equal(0);
        expect(material.clearCoatGlossVertexColor).to.equal(false);
        expect(material.clearCoatGlossVertexColorChannel).to.equal('g');
        expect(material.clearCoatGloss).to.equal(1);
        expect(material.clearCoatMap).to.be.null;
        expect(material.clearCoatMapChannel).to.equal('g');
        expect(material.clearCoatMapOffset).to.be.an.instanceof(Vec2);
        expect(material.clearCoatMapOffset.x).to.equal(0);
        expect(material.clearCoatMapOffset.y).to.equal(0);
        expect(material.clearCoatMapRotation).to.equal(0);
        expect(material.clearCoatMapTiling).to.be.an.instanceof(Vec2);
        expect(material.clearCoatMapTiling.x).to.equal(1);
        expect(material.clearCoatMapTiling.y).to.equal(1);
        expect(material.clearCoatMapUv).to.equal(0);
        expect(material.clearCoatNormalMap).to.be.null;
        expect(material.clearCoatNormalMapOffset).to.be.an.instanceof(Vec2);
        expect(material.clearCoatNormalMapOffset.x).to.equal(0);
        expect(material.clearCoatNormalMapOffset.y).to.equal(0);
        expect(material.clearCoatNormalMapRotation).to.equal(0);
        expect(material.clearCoatNormalMapTiling).to.be.an.instanceof(Vec2);
        expect(material.clearCoatNormalMapTiling.x).to.equal(1);
        expect(material.clearCoatNormalMapTiling.y).to.equal(1);
        expect(material.clearCoatNormalMapUv).to.equal(0);
        expect(material.clearCoatVertexColor).to.equal(false);
        expect(material.clearCoatVertexColorChannel).to.equal('g');

        expect(material.cubeMap).to.be.null;
        expect(material.cubeMapProjection).to.equal(CUBEPROJ_NONE);
        expect(material.cubeMapProjectionBox).to.be.null;

        expect(material.diffuse).to.be.an.instanceof(Color);
        expect(material.diffuse.r).to.equal(1);
        expect(material.diffuse.g).to.equal(1);
        expect(material.diffuse.b).to.equal(1);
        expect(material.diffuseDetailMap).to.be.null;
        expect(material.diffuseDetailMapChannel).to.equal('rgb');
        expect(material.diffuseDetailMapOffset).to.be.an.instanceof(Vec2);
        expect(material.diffuseDetailMapOffset.x).to.equal(0);
        expect(material.diffuseDetailMapOffset.y).to.equal(0);
        expect(material.diffuseDetailMapRotation).to.equal(0);
        expect(material.diffuseDetailMapTiling).to.be.an.instanceof(Vec2);
        expect(material.diffuseDetailMapTiling.x).to.equal(1);
        expect(material.diffuseDetailMapTiling.y).to.equal(1);
        expect(material.diffuseDetailMapUv).to.equal(0);
        expect(material.diffuseDetailMode).to.equal(DETAILMODE_MUL);
        expect(material.diffuseMap).to.be.null;
        expect(material.diffuseMapChannel).to.equal('rgb');
        expect(material.diffuseMapOffset).to.be.an.instanceof(Vec2);
        expect(material.diffuseMapOffset.x).to.equal(0);
        expect(material.diffuseMapOffset.y).to.equal(0);
        expect(material.diffuseMapRotation).to.equal(0);
        expect(material.diffuseMapTiling).to.be.an.instanceof(Vec2);
        expect(material.diffuseMapTiling.x).to.equal(1);
        expect(material.diffuseMapTiling.y).to.equal(1);
        expect(material.diffuseMapUv).to.equal(0);
        expect(material.diffuseVertexColor).to.equal(false);
        expect(material.diffuseVertexColorChannel).to.equal('rgb');

        expect(material.emissive).to.be.an.instanceof(Color);
        expect(material.emissive.r).to.equal(0);
        expect(material.emissive.g).to.equal(0);
        expect(material.emissive.b).to.equal(0);
        expect(material.emissiveIntensity).to.equal(1);
        expect(material.emissiveMap).to.be.null;
        expect(material.emissiveMapChannel).to.equal('rgb');
        expect(material.emissiveMapOffset).to.be.an.instanceof(Vec2);
        expect(material.emissiveMapOffset.x).to.equal(0);
        expect(material.emissiveMapOffset.y).to.equal(0);
        expect(material.emissiveMapRotation).to.equal(0);
        expect(material.emissiveMapTiling).to.be.an.instanceof(Vec2);
        expect(material.emissiveMapTiling.x).to.equal(1);
        expect(material.emissiveMapTiling.y).to.equal(1);
        expect(material.emissiveMapUv).to.equal(0);
        expect(material.emissiveTint).to.equal(false);
        expect(material.emissiveVertexColor).to.equal(false);
        expect(material.emissiveVertexColorChannel).to.equal('rgb');

        expect(material.enableGGXSpecular).to.equal(false);
        expect(material.fresnelModel).to.equal(FRESNEL_SCHLICK);

        expect(material.gloss).to.equal(0.25);
        expect(material.glossMap).to.be.null;
        expect(material.glossMapChannel).to.equal('g');
        expect(material.glossMapOffset).to.be.an.instanceof(Vec2);
        expect(material.glossMapOffset.x).to.equal(0);
        expect(material.glossMapOffset.y).to.equal(0);
        expect(material.glossMapRotation).to.equal(0);
        expect(material.glossMapTiling).to.be.an.instanceof(Vec2);
        expect(material.glossMapTiling.x).to.equal(1);
        expect(material.glossMapTiling.y).to.equal(1);
        expect(material.glossMapUv).to.equal(0);
        expect(material.glossVertexColor).to.equal(false);
        expect(material.glossVertexColorChannel).to.equal('g');

        expect(material.heightMap).to.be.null;
        expect(material.heightMapChannel).to.equal('g');
        expect(material.heightMapFactor).to.equal(1);
        expect(material.heightMapOffset).to.be.an.instanceof(Vec2);
        expect(material.heightMapOffset.x).to.equal(0);
        expect(material.heightMapOffset.y).to.equal(0);
        expect(material.heightMapRotation).to.equal(0);
        expect(material.heightMapTiling).to.be.an.instanceof(Vec2);
        expect(material.heightMapTiling.x).to.equal(1);
        expect(material.heightMapTiling.y).to.equal(1);
        expect(material.heightMapUv).to.equal(0);

        expect(material.lightMap).to.be.null;
        expect(material.lightMapChannel).to.equal('rgb');
        expect(material.lightMapOffset).to.be.an.instanceof(Vec2);
        expect(material.lightMapOffset.x).to.equal(0);
        expect(material.lightMapOffset.y).to.equal(0);
        expect(material.lightMapRotation).to.equal(0);
        expect(material.lightMapTiling).to.be.an.instanceof(Vec2);
        expect(material.lightMapTiling.x).to.equal(1);
        expect(material.lightMapTiling.y).to.equal(1);
        expect(material.lightMapUv).to.equal(1);
        expect(material.lightVertexColor).to.equal(false);
        expect(material.lightVertexColorChannel).to.equal('rgb');

        expect(material.metalness).to.equal(1);
        expect(material.metalnessMap).to.be.null;
        expect(material.metalnessMapChannel).to.equal('g');
        expect(material.metalnessMapOffset).to.be.an.instanceof(Vec2);
        expect(material.metalnessMapOffset.x).to.equal(0);
        expect(material.metalnessMapOffset.y).to.equal(0);
        expect(material.metalnessMapRotation).to.equal(0);
        expect(material.metalnessMapTiling).to.be.an.instanceof(Vec2);
        expect(material.metalnessMapTiling.x).to.equal(1);
        expect(material.metalnessMapTiling.y).to.equal(1);
        expect(material.metalnessMapUv).to.equal(0);
        expect(material.metalnessVertexColor).to.equal(false);
        expect(material.metalnessVertexColorChannel).to.equal('g');

        expect(material.normalDetailMap).to.be.null;
        expect(material.normalDetailMapBumpiness).to.equal(1);
        expect(material.normalDetailMapOffset).to.be.an.instanceof(Vec2);
        expect(material.normalDetailMapOffset.x).to.equal(0);
        expect(material.normalDetailMapOffset.y).to.equal(0);
        expect(material.normalDetailMapRotation).to.equal(0);
        expect(material.normalDetailMapTiling).to.be.an.instanceof(Vec2);
        expect(material.normalDetailMapTiling.x).to.equal(1);
        expect(material.normalDetailMapTiling.y).to.equal(1);
        expect(material.normalDetailMapUv).to.equal(0);
        expect(material.normalMap).to.be.null;
        expect(material.normalMapOffset).to.be.an.instanceof(Vec2);
        expect(material.normalMapOffset.x).to.equal(0);
        expect(material.normalMapOffset.y).to.equal(0);
        expect(material.normalMapRotation).to.equal(0);
        expect(material.normalMapTiling).to.be.an.instanceof(Vec2);
        expect(material.normalMapTiling.x).to.equal(1);
        expect(material.normalMapTiling.y).to.equal(1);
        expect(material.normalMapUv).to.equal(0);

        expect(material.occludeDirect).to.equal(false);
        expect(material.occludeSpecular).to.equal(SPECOCC_AO);
        expect(material.occludeSpecularIntensity).to.equal(1);

        expect(material.onUpdateShader).to.be.undefined;

        expect(material.opacity).to.equal(1);
        expect(material.opacityFadesSpecular).to.equal(true);
        expect(material.opacityDither).to.equal(DITHER_NONE);
        expect(material.opacityShadowDither).to.equal(DITHER_NONE);
        expect(material.opacityMap).to.be.null;
        expect(material.opacityMapChannel).to.equal('a');
        expect(material.opacityMapOffset).to.be.an.instanceof(Vec2);
        expect(material.opacityMapOffset.x).to.equal(0);
        expect(material.opacityMapOffset.y).to.equal(0);
        expect(material.opacityMapRotation).to.equal(0);
        expect(material.opacityMapTiling).to.be.an.instanceof(Vec2);
        expect(material.opacityMapTiling.x).to.equal(1);
        expect(material.opacityMapTiling.y).to.equal(1);
        expect(material.opacityMapUv).to.equal(0);
        expect(material.opacityVertexColor).to.equal(false);
        expect(material.opacityVertexColorChannel).to.equal('a');

        expect(material.pixelSnap).to.equal(false);

        expect(material.reflectivity).to.equal(1);
        expect(material.refraction).to.equal(0);
        expect(material.refractionIndex).to.equal(1.0 / 1.5);
        expect(material.dispersion).to.equal(0);

        expect(material.specular).to.be.instanceof(Color);
        expect(material.specular.r).to.equal(0);
        expect(material.specular.g).to.equal(0);
        expect(material.specular.b).to.equal(0);
        expect(material.specularMap).to.be.null;
        expect(material.specularMapChannel).to.equal('rgb');
        expect(material.specularMapOffset).to.be.an.instanceof(Vec2);
        expect(material.specularMapOffset.x).to.equal(0);
        expect(material.specularMapOffset.y).to.equal(0);
        expect(material.specularMapRotation).to.equal(0);
        expect(material.specularMapTiling).to.be.an.instanceof(Vec2);
        expect(material.specularMapTiling.x).to.equal(1);
        expect(material.specularMapTiling.y).to.equal(1);
        expect(material.specularMapUv).to.equal(0);
        expect(material.specularTint).to.equal(false);
        expect(material.specularVertexColor).to.equal(false);
        expect(material.specularVertexColorChannel).to.equal('rgb');

        expect(material.specularityFactor).to.be.equal(1);
        expect(material.specularityFactorMap).to.be.null;
        expect(material.specularityFactorMapChannel).to.equal('g');
        expect(material.specularityFactorMapOffset).to.be.an.instanceof(Vec2);
        expect(material.specularityFactorMapOffset.x).to.equal(0);
        expect(material.specularityFactorMapOffset.y).to.equal(0);
        expect(material.specularityFactorMapRotation).to.equal(0);
        expect(material.specularityFactorMapTiling).to.be.an.instanceof(Vec2);
        expect(material.specularityFactorMapTiling.x).to.equal(1);
        expect(material.specularityFactorMapTiling.y).to.equal(1);
        expect(material.specularityFactorMapUv).to.equal(0);
        expect(material.specularityFactorTint).to.equal(false);
        expect(material.specularityFactorVertexColor).to.equal(false);
        expect(material.specularityFactorVertexColorChannel).to.equal('g');

        expect(material.sphereMap).to.be.null;
        expect(material.twoSidedLighting).to.equal(false);

        expect(material.useFog).to.equal(true);
        expect(material.useTonemap).to.equal(true);
        expect(material.useLighting).to.equal(true);
        expect(material.useMetalness).to.equal(false);
        expect(material.useMetalnessSpecularColor).to.equal(false);
        expect(material.useSkybox).to.equal(true);
    }

    describe('#constructor()', function () {

        it('should create a new instance', function () {
            const material = new StandardMaterial();
            checkDefaultMaterial(material);
        });

    });

    describe('#clone()', function () {

        it('should clone a material', function () {
            const material = new StandardMaterial();
            const clone = material.clone();
            checkDefaultMaterial(clone);
        });

    });

    describe('#copy()', function () {

        it('should copy a material', function () {
            const src = new StandardMaterial();
            const dst = new StandardMaterial();
            dst.copy(src);
            checkDefaultMaterial(dst);
        });

    });

});
