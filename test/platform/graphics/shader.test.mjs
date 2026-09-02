import { expect } from 'chai';

import { SEMANTIC_POSITION, SHADERLANGUAGE_GLSL } from '../../../src/platform/graphics/constants.js';
import { NullGraphicsDevice } from '../../../src/platform/graphics/null/null-graphics-device.js';
import { Shader } from '../../../src/platform/graphics/shader.js';

describe('Shader', function () {

    // an #include is used to guarantee the pre-processor rewrites the supplied source
    const vshader = `
        #include "offsetVS"
        attribute vec3 aPosition;
        void main(void) {
            gl_Position = vec4(aPosition + offset(), 1.0);
        }
    `;

    const fshader = `
        void main(void) {
            gl_FragColor = vec4(1.0, 0.0, 0.0, 1.0);
        }
    `;

    const vincludes = new Map([['offsetVS', 'vec3 offset() { return vec3(0.0); }']]);

    const createDefinition = () => ({
        name: 'Test',
        attributes: { aPosition: SEMANTIC_POSITION },
        vshader,
        fshader,
        vincludes
    });

    /** @type {NullGraphicsDevice} */
    let device;

    beforeEach(function () {
        device = new NullGraphicsDevice({ id: 'mock' });
    });

    afterEach(function () {
        device.destroy();
        device = null;
    });

    describe('#constructor', function () {

        it('pre-processes the shader sources', function () {
            const shader = new Shader(device, createDefinition());

            // if this fails, the assertions below are vacuous
            expect(shader.definition.vshader).to.not.equal(vshader);
            expect(shader.definition.vshader).to.include('vec3 offset()');
        });

        it('does not replace the shader sources in the supplied definition', function () {
            const definition = createDefinition();

            const shader = new Shader(device, definition);

            // the shader gets the pre-processed sources, the supplied definition keeps the originals
            expect(shader.definition.vshader).to.not.equal(vshader);
            expect(definition.vshader).to.equal(vshader);
            expect(definition.fshader).to.equal(fshader);
        });

        it('does not add extracted attributes to the supplied definition', function () {
            const definition = createDefinition();
            delete definition.attributes;

            // attributes are only extracted for an explicitly declared GLSL shader
            definition.shaderLanguage = SHADERLANGUAGE_GLSL;

            const shader = new Shader(device, definition);

            // if this fails, the assertion below is vacuous
            expect(shader.definition.attributes).to.have.property('aPosition');

            expect(definition.attributes).to.be.undefined;
        });

        it('stores its own copy of the definition', function () {
            const definition = createDefinition();

            const shader = new Shader(device, definition);

            expect(shader.definition).to.not.equal(definition);
            expect(shader.definition.name).to.equal('Test');
        });

        it('pre-processes consistently when a definition is reused', function () {
            const definition = createDefinition();

            const first = new Shader(device, definition);
            const second = new Shader(device, definition);

            expect(second.definition.vshader).to.equal(first.definition.vshader);
            expect(second.definition.fshader).to.equal(first.definition.fshader);
        });

    });

});
