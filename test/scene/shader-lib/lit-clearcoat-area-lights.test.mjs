import { expect } from 'chai';
import sinon from 'sinon';

import { Entity } from '../../../src/framework/entity.js';
import { LIGHTSHAPE_DISK, LIGHTSHAPE_RECT, LIGHTSHAPE_SPHERE } from '../../../src/scene/constants.js';
import { StandardMaterial } from '../../../src/scene/materials/standard-material.js';
import { createApp } from '../../app.mjs';
import { jsdomSetup, jsdomTeardown } from '../../jsdom.mjs';

// The clear coat specular of area lights is evaluated with the LTC matrix of the clear coat gloss
// and normal (ccLTCUV), not the one of the base specular layer (dLTCUV).
describe('Lit shader clear coat of area lights', function () {

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

    const addLight = (shape) => {
        const entity = new Entity('light');
        entity.addComponent('light', { type: 'spot', shape });
        app.root.addChild(entity);
    };

    // renders a frame and returns the forward shader of a box, the one combining the lighting
    const forwardShader = (clearCoat) => {
        const material = new StandardMaterial();
        material.clearCoat = clearCoat;
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

    // the clear coat specular functions use the clear coat LTC matrix
    const expectClearcoatLTC = (source) => {
        expect(source).to.contain('calcRectLightSpecular(worldNormal, viewDir, ccLTCUV)');
        expect(source).to.contain('calcDiskLightSpecular(worldNormal, viewDir, ccLTCUV)');
    };

    it('uses the clear coat LTC matrix for clustered area lights', function () {
        app.scene.clusteredLightingEnabled = true;
        app.scene.lighting.areaLightsEnabled = true;
        addLight(LIGHTSHAPE_RECT);
        const source = forwardShader(1);

        expect(source).to.contain('getRectLightSpecularCC(clearcoat_worldNormal, viewDir)');
        expect(source).to.contain('getDiskLightSpecularCC(clearcoat_worldNormal, viewDir)');
        expect(source).to.contain('getSphereLightSpecularCC(clearcoat_worldNormal, viewDir)');
        expect(source).not.to.contain('LightSpecular(clearcoat_worldNormal');
        expectClearcoatLTC(source);
    });

    it('uses the clear coat LTC matrix for area lights of every shape', function () {
        // WebGPU clusters every local light
        if (app.graphicsDevice.isWebGPU) {
            this.skip();
        }
        app.scene.clusteredLightingEnabled = false;
        addLight(LIGHTSHAPE_RECT);
        addLight(LIGHTSHAPE_DISK);
        addLight(LIGHTSHAPE_SPHERE);
        const source = forwardShader(1);

        expect(source).to.contain('getRectLightSpecularCC(litArgs_clearcoat_worldNormal');
        expect(source).to.contain('getDiskLightSpecularCC(litArgs_clearcoat_worldNormal');
        expect(source).to.contain('getSphereLightSpecularCC(litArgs_clearcoat_worldNormal');
        expect(source).not.to.contain('LightSpecular(litArgs_clearcoat_worldNormal');
        expectClearcoatLTC(source);
    });

    it('leaves the clear coat LTC matrix out without clear coat', function () {
        app.scene.clusteredLightingEnabled = true;
        app.scene.lighting.areaLightsEnabled = true;
        addLight(LIGHTSHAPE_RECT);
        const source = forwardShader(0);

        expect(source).not.to.contain('ccLTCUV');
    });
});
