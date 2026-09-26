import { expect } from 'chai';
import sinon from 'sinon';

import { Color } from '../../../src/core/math/color.js';
import { Entity } from '../../../src/framework/entity.js';
import { PIXELFORMAT_RGBA8, PIXELFORMAT_SRGBA8 } from '../../../src/platform/graphics/constants.js';
import { Texture } from '../../../src/platform/graphics/texture.js';
import { FRESNEL_NONE, LIGHTSHAPE_RECT } from '../../../src/scene/constants.js';
import { LitMaterial } from '../../../src/scene/materials/lit-material.js';
import { StandardMaterial } from '../../../src/scene/materials/standard-material.js';
import { MeshInstance } from '../../../src/scene/mesh-instance.js';
import { Mesh } from '../../../src/scene/mesh.js';
import { createApp } from '../../app.mjs';
import { jsdomSetup, jsdomTeardown } from '../../jsdom.mjs';

// The diffuse transmission lobe lets part of the diffuse light through the surface: the light and
// the ambient arriving at the back of the surface are gathered separately, and combined with the
// transmission color. Under `npm run test:webgpu` the WGSL of each shader is compiled by Dawn, and
// an error fails the test.
describe('Lit shader diffuse transmission', function () {

    let app;
    let consoleError;

    beforeEach(function () {
        jsdomSetup();
        app = createApp();
        consoleError = sinon.spy(console, 'error');

        const camera = new Entity('camera');
        camera.addComponent('camera');
        camera.setPosition(0, 0, 8);
        app.root.addChild(camera);
    });

    afterEach(function () {
        sinon.restore();
        app.destroy();
        jsdomTeardown();
    });

    const addLight = (options) => {
        const light = new Entity('light');
        light.addComponent('light', options);
        app.root.addChild(light);
        return light;
    };

    const addBox = (material) => {
        material.update();
        const entity = new Entity();
        entity.addComponent('render', { type: 'box', material });
        app.root.addChild(entity);
        return entity.render.meshInstances[0];
    };

    // a triangle with vertex colors
    const addColoredTriangle = (material) => {
        material.update();
        const mesh = new Mesh(app.graphicsDevice);
        mesh.setPositions([0, 0, 0, 1, 0, 0, 0, 1, 0]);
        mesh.setNormals([0, 0, 1, 0, 0, 1, 0, 0, 1]);
        mesh.setColors32([255, 0, 0, 255, 0, 255, 0, 255, 0, 0, 255, 255]);
        mesh.setIndices([0, 1, 2]);
        mesh.update();
        const meshInstance = new MeshInstance(mesh, material);
        const entity = new Entity();
        entity.addComponent('render', { meshInstances: [meshInstance] });
        app.root.addChild(entity);
        return meshInstance;
    };

    // renders a frame and returns the forward shader of a mesh instance, the one combining the
    // lighting
    const forwardShader = (meshInstance) => {
        app.render();
        const shaders = Array.from(meshInstance._shaderCache.values(), entry => entry.shader);
        const shader = shaders.find(s => s.definition.fshader.includes('combineColor'));
        expect(shader).to.exist;
        expect(shader.failed).to.equal(false);
        expect(consoleError.called, consoleError.args.join('\n')).to.equal(false);
        return shader.definition.fshader;
    };

    const transmissive = (value = 0.5) => {
        const material = new StandardMaterial();
        material.diffuseTransmission = value;
        return material;
    };

    const texture = (format = PIXELFORMAT_RGBA8) => {
        return new Texture(app.graphicsDevice, { width: 4, height: 4, format, mipmaps: false });
    };

    // a LitMaterial front end setting the diffuse transmission arguments, and optionally specular
    const litMaterial = (specular = false) => {
        const material = new LitMaterial();
        material.hasDiffuseTransmission = true;
        material.hasSpecular = specular;
        material.shaderChunkGLSL = `
            #include "litShaderCorePS"
            void evaluateFrontend() {
                litArgs_albedo = vec3(0.5);
                litArgs_opacity = 1.0;
                litArgs_worldNormal = dVertexNormalW;
                litArgs_diffuseTransmission_intensity = 0.5;
                litArgs_diffuseTransmission_color = vec3(1.0, 0.5, 0.25);
                ${specular ? 'litArgs_specularity = vec3(0.5); litArgs_gloss = 0.5;' : ''}
            }`;
        material.shaderChunkWGSL = `
            #include "litShaderCorePS"
            fn evaluateFrontend() {
                litArgs_albedo = vec3f(0.5);
                litArgs_opacity = 1.0;
                litArgs_worldNormal = dVertexNormalW;
                litArgs_diffuseTransmission_intensity = 0.5;
                litArgs_diffuseTransmission_color = vec3f(1.0, 0.5, 0.25);
                ${specular ? 'litArgs_specularity = vec3f(0.5); litArgs_gloss = 0.5;' : ''}
            }`;
        return material;
    };

    it('reads the transmission and its color from the material uniform buffer', function () {
        addLight({ type: 'directional' });
        const material = transmissive();
        material.diffuseTransmissionColor = new Color(1, 0.5, 0.25);
        const source = forwardShader(addBox(material));

        expect(source).to.contain('getDiffuseTransmission()');
        expect(source).to.contain('getDiffuseTransmissionColor()');
        expect(source).to.contain('litArgs_diffuseTransmission_intensity = dDiffuseTransmission;');
        expect(source).to.contain('litArgs_diffuseTransmission_color = dDiffuseTransmissionColor;');
        expect(source).to.contain('litArgs_diffuseTransmission_color * dDiffuseTransmissionLight');

        const format = material._layout.uniformBufferFormat;
        expect(format.get('material_diffuseTransmission')).to.exist;
        expect(format.get('material_diffuseTransmissionColor')).to.exist;
    });

    it('leaves the transmission out of the shader when diffuseTransmission is 0', function () {
        addLight({ type: 'directional', castShadows: true });
        const source = forwardShader(addBox(new StandardMaterial()));

        expect(source).not.to.contain('DiffuseTransmission');
        expect(source).not.to.contain('attenTransmission');
        expect(source).not.to.contain('faceforward');
    });

    it('gathers the ambient light arriving at the back of the surface', function () {
        const source = forwardShader(addBox(transmissive()));

        expect(source).to.contain('addAmbient(-litArgs_worldNormal);');
        expect(source).to.contain('dDiffuseTransmissionLight = dDiffuseLight;');
    });

    it('splits the diffuse light, then lets refraction override both parts', function () {
        // the refraction of the environment of the material
        const material = transmissive();
        material.refraction = 0.5;
        material.envAtlas = texture();
        const source = forwardShader(addBox(material));

        // the split happens in the backend, followed by the call of the refraction
        const splitCode = 'dDiffuseTransmissionLight *= litArgs_diffuseTransmission_intensity;';
        const overrideCode = 'dDiffuseTransmissionLight *= 1.0 - litArgs_transmission;';
        const split = source.indexOf(splitCode);
        const refraction = source.indexOf('addRefraction(', split);
        expect(split).to.be.greaterThan(-1);
        expect(refraction).to.be.greaterThan(split);
        expect(source.indexOf(overrideCode)).to.be.greaterThan(refraction);
    });

    it('shadows the transmission of punctual lights, offset towards the light', function () {
        app.scene.clusteredLightingEnabled = false;
        addLight({ type: 'directional', castShadows: true });
        addLight({ type: 'omni', castShadows: true });
        addLight({ type: 'spot', castShadows: true });
        const source = forwardShader(addBox(transmissive()));

        // each light gathers its transmission, shadows it with the offset flipped to its side
        const patterns = [
            /attenTransmission = dAtten \* getLightDiffuse\(-litArgs_worldNormal/g,
            /attenTransmission \*= shadow;/g,
            /dDiffuseTransmissionLight \+= attenTransmission \* lightColor;/g,
            /faceforward\(dVertexNormalW, dLightDirNormW, dVertexNormalW\)/g
        ];
        for (const pattern of patterns) {
            expect(source.match(pattern), String(pattern)).to.have.lengthOf(3);
        }
    });

    it('evaluates the transmission of area lights with the flipped normal', function () {
        app.scene.clusteredLightingEnabled = false;
        addLight({ type: 'spot', shape: LIGHTSHAPE_RECT });
        const material = transmissive();
        material.useMetalness = true;
        const source = forwardShader(addBox(material));

        const accumulation = '(attenTransmission * lightColor) * (1.0 - dLTCSpecFres);';
        expect(source).to.contain('getRectLightDiffuse(-litArgs_worldNormal');
        expect(source).to.contain(`dDiffuseTransmissionLight += ${accumulation}`);
    });

    it('evaluates the transmission of clustered lights', function () {
        app.scene.clusteredLightingEnabled = true;
        app.scene.lighting.shadowsEnabled = true;
        addLight({ type: 'omni', castShadows: true });
        const source = forwardShader(addBox(transmissive()));

        expect(source).to.contain('= falloffAttenuation * getLightDiffuse(-worldNormal');
        expect(source).to.contain('max(falloffAttenuation, transmissionAttenuation) > 0.00001');
        expect(source).to.contain('faceforward(geometricNormal, lightDirNormW, geometricNormal)');
        expect(source).to.contain('dDiffuseTransmissionLight += punctualTransmission;');
    });

    it('modulates the transmission color by the metalness', function () {
        addLight({ type: 'directional' });
        const material = transmissive();
        material.useMetalness = true;
        material.metalness = 0.5;
        const source = forwardShader(addBox(material));

        const modulate = 'getAlbedoModulate(litArgs_diffuseTransmission_color, litArgs_metalness)';
        expect(source).to.contain(modulate);
    });

    it('does not use the legacy ambient combine', function () {
        addLight({ type: 'directional' });
        const material = litMaterial(true);
        material.fresnelModel = FRESNEL_NONE;
        const source = forwardShader(addBox(material));

        // the legacy combine has no room for the transmission
        expect(source).not.to.contain('light_globalAmbient) * albedo');
        expect(source).to.contain('ret += albedo * dDiffuseLight;');
    });

    it('samples the transmission from its map and the color from its map', function () {
        addLight({ type: 'directional' });
        const material = transmissive();
        material.diffuseTransmissionMap = texture();
        material.diffuseTransmissionMapChannel = 'a';
        material.diffuseTransmissionColorMap = texture(PIXELFORMAT_SRGBA8);
        const source = forwardShader(addBox(material));

        expect(source).to.match(/texture2DBias\(texture_diffuseTransmissionMap, [^)]*\)\.a;/);
        expect(source).to.match(/texture_diffuseTransmissionColorMap, [^)]*\)\)\.rgb;/);
        expect(source).not.to.contain('{STD_DIFFUSETRANSMISSION');
    });

    it('multiplies the transmission and its color by the vertex colors', function () {
        addLight({ type: 'directional' });
        const material = transmissive();
        material.diffuseTransmissionVertexColor = true;
        material.diffuseTransmissionVertexColorChannel = 'r';
        material.diffuseTransmissionColorVertexColor = true;
        const source = forwardShader(addColoredTriangle(material));

        expect(source).to.contain('diffuseTransmission *= saturate(vVertexColor.r);');
        expect(source).to.contain('diffuseTransmissionColor *= saturate(vVertexColor.rgb);');
    });

    it('supports a LitMaterial front end', function () {
        addLight({ type: 'directional' });
        const source = forwardShader(addBox(litMaterial()));

        expect(source).to.contain('litArgs_diffuseTransmission_color * dDiffuseTransmissionLight');
        expect(source).not.to.contain('material_diffuseTransmission');
    });
});
