import { expect } from 'chai';
import sinon from 'sinon';

import { Debug } from '../../../src/core/debug.js';
import { SHADERLANGUAGE_GLSL, SHADERLANGUAGE_WGSL } from '../../../src/platform/graphics/constants.js';
import { NullGraphicsDevice } from '../../../src/platform/graphics/null/null-graphics-device.js';
import { getGsplatChunk } from '../../../src/scene/gsplat/gsplat-chunks.js';
import { gsplatChunksGLSL } from '../../../src/scene/shader-lib/glsl/collections/gsplat-chunks-glsl.js';
import { gsplatChunksWGSL } from '../../../src/scene/shader-lib/wgsl/collections/gsplat-chunks-wgsl.js';
import { installGsplatChunks } from '../../gsplat-chunks.mjs';

describe('getGsplatChunk', function () {

    let device;

    beforeEach(function () {
        device = new NullGraphicsDevice({ width: 1, height: 1 });
    });

    afterEach(function () {
        sinon.restore();
        device.destroy();
    });

    it('returns a chunk in the shader language of the device', function () {
        installGsplatChunks(device);

        expect(device.shaderLanguage).to.equal(SHADERLANGUAGE_GLSL);
        expect(getGsplatChunk(device, 'gsplatStreamDeclVS')).to.equal(gsplatChunksGLSL.gsplatStreamDeclVS);
    });

    it('returns a chunk in a given shader language', function () {
        device.shaderLanguage = SHADERLANGUAGE_WGSL;
        installGsplatChunks(device);

        expect(getGsplatChunk(device, 'gsplatComputeStreamDeclVS', SHADERLANGUAGE_WGSL)).to.equal(gsplatChunksWGSL.gsplatComputeStreamDeclVS);
    });

    it('asserts when the chunk is not installed for the language', function () {
        // the chunks of WebGL only, as the gsplat feature for WebGL installs
        installGsplatChunks(device);
        const assert = sinon.stub(Debug, 'assert');

        expect(getGsplatChunk(device, 'gsplatStreamDeclVS', SHADERLANGUAGE_WGSL)).to.be.undefined;
        expect(assert.calledWithMatch(false, sinon.match('gsplatStreamDeclVS is not installed for the wgsl shader language'))).to.equal(true);
    });
});
