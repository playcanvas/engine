import { expect } from 'chai';
import sinon from 'sinon';

import { SEMANTIC_POSITION } from '../../../src/platform/graphics/constants.js';
import { QuadRender } from '../../../src/scene/graphics/quad-render.js';
import { RenderPassShaderQuad } from '../../../src/scene/graphics/render-pass-shader-quad.js';
import { ShaderUtils } from '../../../src/scene/shader-lib/shader-utils.js';
import { createApp } from '../../app.mjs';
import { jsdomSetup, jsdomTeardown } from '../../jsdom.mjs';

/**
 * @import { Application } from '../../../src/framework/application.js'
 */

describe('RenderPassShaderQuad', function () {
    /** @type {Application} */
    let app;

    beforeEach(function () {
        jsdomSetup();
        app = createApp();
    });

    afterEach(function () {
        sinon.restore();
        app?.destroy();
        app = null;
        jsdomTeardown();
    });

    const createShader = device => ShaderUtils.createShader(device, {
        uniqueName: 'RenderPassShaderQuadTest',
        attributes: { aPosition: SEMANTIC_POSITION },
        vertexChunk: 'quadVS',
        fragmentGLSL: 'void main() { gl_FragColor = vec4(1.0); }'
    });

    describe('#shader', function () {

        it('replaces the quad when the shader changes', function () {
            const device = app.graphicsDevice;
            const pass = new RenderPassShaderQuad(device);

            pass.shader = createShader(device);
            const quadRender = pass.quadRender;
            expect(quadRender).to.be.an.instanceof(QuadRender);
            const quadDestroy = sinon.spy(quadRender, 'destroy');

            pass.shader = null;
            expect(quadDestroy.calledOnce).to.equal(true);
            expect(pass.quadRender).to.equal(null);
        });

    });

    describe('#destroy', function () {

        it('releases the quad, but not the shader', function () {
            const device = app.graphicsDevice;
            const shader = createShader(device);
            const pass = new RenderPassShaderQuad(device);
            pass.shader = shader;

            const quadDestroy = sinon.spy(pass.quadRender, 'destroy');
            const shaderDestroy = sinon.spy(shader, 'destroy');

            pass.destroy();

            expect(quadDestroy.calledOnce).to.equal(true);
            expect(shaderDestroy.called).to.equal(false);
            expect(pass.quadRender).to.equal(null);
            expect(pass.shader).to.equal(null);
        });

        it('can destroy a pass without a shader', function () {
            const pass = new RenderPassShaderQuad(app.graphicsDevice);
            expect(() => pass.destroy()).to.not.throw();
        });

    });

});
