import { expect } from 'chai';

import { Entity } from '../../../src/framework/entity.js';
import { StandardMaterial } from '../../../src/scene/materials/standard-material.js';
import { createApp } from '../../app.mjs';
import { jsdomSetup, jsdomTeardown } from '../../jsdom.mjs';

// KHR_materials_sheen scales the base layer below the sheen by 1 - max3(sheenColor) * E, where E is
// the directional albedo of the sheen BRDF: by the scaling for the view direction under all lighting,
// and for a light by the smaller of the scalings for the view and the light direction. The tests read
// the generated forward shader: GLSL on the null device, and WGSL compiled by Dawn under
// `npm run test:webgpu`, where a compile error fails the test.
describe('Lit shader sheen albedo scaling', function () {

    let app;

    beforeEach(function () {
        jsdomSetup();
        app = createApp();

        const camera = new Entity('camera');
        camera.addComponent('camera');
        camera.setPosition(0, 0, 8);
        app.root.addChild(camera);
    });

    afterEach(function () {
        app.destroy();
        app = null;
        jsdomTeardown();
    });

    /**
     * Renders a sphere lit by a single light and returns the source of its forward shader. A
     * directional light is evaluated on its own, and an omni light by the clustered lighting.
     *
     * @param {object} options - The options.
     * @param {boolean} [options.useSheen] - Whether the material has a sheen layer.
     * @param {string} [options.lightType] - The type of the light.
     * @returns {string} The fragment shader source.
     */
    const forwardSource = ({ useSheen = true, lightType = 'directional' } = {}) => {
        const light = new Entity('light');
        light.addComponent('light', { type: lightType, range: 20 });
        light.setPosition(0, 4, 4);
        app.root.addChild(light);

        // the sheen layer needs the specular lighting of a metalness workflow
        const material = new StandardMaterial();
        material.useMetalness = true;
        material.useSheen = useSheen;
        material.sheenGloss = 0.2;
        material.update();

        const entity = new Entity();
        entity.addComponent('render', { type: 'sphere', material });
        app.root.addChild(entity);
        app.render();

        const cache = entity.render.meshInstances[0]._shaderCache;
        const shaders = Array.from(cache.values()).map(instance => instance.shader);
        const shader = shaders.find(s => s.definition.fshader.includes('combineColor'));
        expect(shader).to.exist;
        expect(shader.failed).to.equal(false);
        return shader.definition.fshader;
    };

    /**
     * The body of a function in GLSL or WGSL source.
     *
     * @param {string} source - The shader source.
     * @param {string} name - The function name.
     * @returns {string} The function body, or an empty string if the function is not present.
     */
    const functionBody = (source, name) => {
        const match = new RegExp(`(?:void|vec3|fn) ${name}\\(`).exec(source);
        if (!match) return '';
        const open = source.indexOf('{', match.index);
        let depth = 0;
        for (let i = open; i < source.length; i++) {
            if (source[i] === '{') depth++;
            else if (source[i] === '}' && --depth === 0) return source.substring(open, i + 1);
        }
        return '';
    };

    // the statements of a function body which accumulate into the given variable
    const accumulations = (body, name) => body.split(';').filter(statement => new RegExp(`\\b${name} (?:\\+=|= ${name} \\+)`).test(statement));

    it('scales the base layer by the sheen albedo for the view direction', function () {
        const source = forwardSource();

        // the scaling is set up before the lights are evaluated, and applied when combining
        const backend = functionBody(source, 'evaluateBackend');
        const setup = backend.indexOf('calcSheenAlbedoScaling(');
        expect(setup).to.not.equal(-1);
        expect(setup).to.be.below(backend.indexOf('evaluateLight0('));

        const combine = functionBody(source, 'combineColor');
        expect(combine).to.include('ret * sAlbedoScaling');
        expect(combine).to.not.include('0.157');
    });

    it('scales the base layer lit by a light by the sheen albedo for the light direction', function () {
        const light = functionBody(forwardSource(), 'evaluateLight0');
        expect(light).to.match(/baseAtten(?:: f32)? = dAtten \* getSheenLightScaling\(litArgs_worldNormal, dLightDirNormW\)/);

        // the base layer is scaled, but not the sheen layer itself
        const diffuse = accumulations(light, 'dDiffuseLight');
        const specular = accumulations(light, 'dSpecularLight');
        expect(diffuse).to.have.length.above(0);
        diffuse.forEach(statement => expect(statement).to.include('baseAtten'));
        expect(light).to.match(/lightSpecular(?:: vec3f)? = getLightSpecular\([^;]*\* baseAtten \* lightColor/);
        specular.forEach(statement => expect(statement).to.not.include('dAtten'));
        accumulations(light, 'sSpecularLight').forEach((statement) => {
            expect(statement).to.include('dAtten');
            expect(statement).to.not.include('baseAtten');
        });
    });

    it('scales the base layer lit by a clustered light by the sheen albedo for the light direction', function () {
        const light = functionBody(forwardSource({ lightType: 'omni' }), 'evaluateLight');
        expect(light).to.match(/baseAttenuation(?:: f32)? = falloffAttenuation \* getSheenLightScaling\(worldNormal, lightDirNormW\)/);
        expect(light).to.match(/punctualDiffuse(?:: vec3f)? = baseAttenuation \*/);
        accumulations(light, 'dSpecularLight').forEach((statement) => {
            expect(statement).to.include('baseAttenuation');
            expect(statement).to.not.include('falloffAttenuation');
        });
        accumulations(light, 'sSpecularLight').forEach((statement) => {
            expect(statement).to.include('falloffAttenuation');
            expect(statement).to.not.include('baseAttenuation');
        });
    });

    it('leaves the base layer of a material without sheen unscaled', function () {
        const source = forwardSource({ useSheen: false });
        expect(source).to.not.include('calcSheenAlbedoScaling');
        expect(source).to.not.include('getSheenLightScaling');
        expect(functionBody(source, 'evaluateLight0')).to.match(/baseAtten(?:: f32)? = dAtten;/);
    });
});
