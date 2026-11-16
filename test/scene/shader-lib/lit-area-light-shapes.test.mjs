import { expect } from 'chai';
import sinon from 'sinon';

import { Entity } from '../../../src/framework/entity.js';
import { LIGHTSHAPE_DISK, LIGHTSHAPE_RECT } from '../../../src/scene/constants.js';
import { LightsBuffer } from '../../../src/scene/lighting/lights-buffer.js';
import { StandardMaterial } from '../../../src/scene/materials/standard-material.js';
import { createApp } from '../../app.mjs';
import { jsdomSetup, jsdomTeardown } from '../../jsdom.mjs';

// The clustered lighting compiles the code of the area light shapes enabled in the LightingParams
// only, as each shape adds a large amount of code to the light loop, which is slow to compile
// mostly on Windows. Area lights of a disabled shape are rendered as punctual lights.
describe('Lit shader clustered area light shapes', function () {

    let app;
    let consoleError;

    beforeEach(function () {
        jsdomSetup();
        app = createApp();
        consoleError = sinon.spy(console, 'error');

        app.scene.clusteredLightingEnabled = true;
        app.scene.lighting.areaLightsEnabled = true;

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

    const addLight = (shape) => {
        const entity = new Entity('light');
        entity.addComponent('light', { type: 'spot', shape });
        app.root.addChild(entity);
        return entity.light.light;
    };

    // renders a frame and returns the forward shader of a box, the one combining the lighting
    const forwardShader = () => {
        const material = new StandardMaterial();
        material.update();
        const entity = new Entity();
        entity.addComponent('render', { type: 'box', material });
        app.root.addChild(entity);
        const meshInstance = entity.render.meshInstances[0];

        app.render();
        const shaders = Array.from(meshInstance._shaderCache.values(), entry => entry.shader);
        const shader = shaders.find(s => s.definition.fshader.includes('combineColor'));
        expect(shader).to.exist;
        expect(shader.failed).to.equal(false);
        expect(consoleError.called, consoleError.args.join('\n')).to.equal(false);
        return shader.definition.fshader;
    };

    it('compiles the code of all area light shapes by default', function () {
        addLight(LIGHTSHAPE_RECT);
        const source = forwardShader();

        expect(source).to.contain('LTC_EvaluateRect(lobeNormal');
        expect(source).to.contain('LTC_EvaluateDisk(lobeNormal');
        expect(source).to.contain('getSphereLightDiffuse(lobeNormal');
        expect(source).to.contain('calcSphereLightValues(light.position');
    });

    it('compiles only the code of the enabled area light shapes', function () {
        app.scene.lighting.areaLightDiskEnabled = false;
        app.scene.lighting.areaLightSphereEnabled = false;
        addLight(LIGHTSHAPE_RECT);
        const source = forwardShader();

        expect(source).to.contain('LTC_EvaluateRect(lobeNormal');
        expect(source).not.to.contain('LTC_EvaluateDisk(lobeNormal');
        expect(source).not.to.contain('getSphereLightDiffuse(lobeNormal');
        expect(source).not.to.contain('calcSphereLightValues(light.position');
    });

    it('compiles no area light code when all area light shapes are disabled', function () {
        app.scene.lighting.areaLightRectEnabled = false;
        app.scene.lighting.areaLightDiskEnabled = false;
        app.scene.lighting.areaLightSphereEnabled = false;
        addLight(LIGHTSHAPE_RECT);
        const source = forwardShader();

        expect(source).not.to.contain('lobeValue');
        expect(source).not.to.contain('LTC_EvaluateRect(lobeNormal');
    });

    it('encodes the lights of disabled area light shapes as punctual lights', function () {
        app.scene.lighting.areaLightDiskEnabled = false;
        const rect = addLight(LIGHTSHAPE_RECT);
        const disk = addLight(LIGHTSHAPE_DISK);

        const buffer = new LightsBuffer(app.graphicsDevice);
        buffer.areaLightShapes = app.scene.lighting.areaLightShapes;
        buffer.addLightData(rect, 1);
        buffer.addLightData(disk, 2);

        // the texels of a light, and its flags as encoded with the shape bits (29 - 28) cleared
        const texels = (index) => {
            const size = buffer.lightsTexture.width * 4;
            return Array.from(buffer.lightsUint.subarray(index * size, (index + 1) * size));
        };
        const flags = light => light.getClusteredFlags(false, false) >>> 0;
        const punctualFlags = light => (light.getClusteredFlags(false, false) & ~(0x3 << 28)) >>> 0;

        expect(flags(disk)).to.not.equal(punctualFlags(disk));
        expect(texels(1)).to.include(flags(rect));
        expect(texels(2)).to.include(punctualFlags(disk));
        expect(texels(2)).not.to.include(flags(disk));

        buffer.destroy();
    });
});
