import { expect } from 'chai';

import { Entity } from '../../../src/framework/entity.js';
import { CULLFACE_NONE } from '../../../src/platform/graphics/constants.js';
import { Texture } from '../../../src/platform/graphics/texture.js';
import { StandardMaterial } from '../../../src/scene/materials/standard-material.js';
import { createApp } from '../../app.mjs';
import { jsdomSetup, jsdomTeardown } from '../../jsdom.mjs';

// Two sided lighting flips the normals of back faces to face the viewer, so that they are lit on
// the side that is seen. The tests read the generated forward shader: GLSL on the null device, and
// WGSL compiled by Dawn under `npm run test:webgpu`, where a compile error fails the test.
describe('Lit shader two sided lighting', function () {

    let app;

    beforeEach(function () {
        jsdomSetup();
        app = createApp();

        const camera = new Entity('camera');
        camera.addComponent('camera');
        camera.setPosition(0, 0, 8);
        app.root.addChild(camera);

        const light = new Entity('light');
        light.addComponent('light', { type: 'directional' });
        app.root.addChild(light);
    });

    afterEach(function () {
        app.destroy();
        app = null;
        jsdomTeardown();
    });

    const texture = () => new Texture(app.graphicsDevice, { name: 'test', width: 4, height: 4 });

    /**
     * Renders a double sided plane and returns the source of its forward shader.
     *
     * @param {(material: StandardMaterial) => void} [setup] - Configures the material.
     * @param {boolean} [twoSidedLighting] - The two sided lighting setting of the material.
     * @returns {string} The fragment shader source.
     */
    const forwardSource = (setup, twoSidedLighting = true) => {
        const material = new StandardMaterial();
        material.cull = CULLFACE_NONE;
        material.twoSidedLighting = twoSidedLighting;
        setup?.(material);
        material.update();

        const entity = new Entity();
        entity.addComponent('render', { type: 'plane', material });
        entity.setEulerAngles(90, 0, 0);
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
     * @param {string} name - The function name, a regular expression.
     * @returns {string} The function body, or an empty string if the function is not present.
     */
    const functionBody = (source, name) => {
        const match = new RegExp(`(?:void|fn) ${name}\\(`).exec(source);
        if (!match) return '';
        const open = source.indexOf('{', match.index);
        let depth = 0;
        for (let i = open; i < source.length; i++) {
            if (source[i] === '{') depth++;
            else if (source[i] === '}' && --depth === 0) return source.substring(open, i + 1);
        }
        return '';
    };

    // the entry point, which sets up the normals before the front end runs
    const mainBody = source => functionBody(source, '(?:main|fragmentMain)');

    const expectInOrder = (source, ...snippets) => {
        let from = 0;
        snippets.forEach((snippet, i) => {
            const index = source.indexOf(snippet, from);
            const after = i > 0 ? ` after '${snippets[i - 1]}'` : '';
            expect(index, `'${snippet}'${after}`).to.not.equal(-1);
            from = index + snippet.length;
        });
    };

    const flipCall = 'handleTwoSidedLighting();';
    const frontEndCall = 'evaluateFrontend();';
    const vertexNormalFlip = 'dVertexNormalW = -dVertexNormalW;';

    // the front facing builtin, which the flips are conditional on
    const frontFacing = /\b(?:gl_FrontFacing|pcFrontFacing)\b/;

    it('flips the vertex normal of back faces when no TBN matrix is built', function () {
        // without a normal map the vertex normal is the shading normal, and so a back face was lit
        // from behind, receiving no direct light on the side that is seen
        const source = forwardSource();
        const main = mainBody(source);
        expect(main).to.not.include('getTBN(');
        expectInOrder(main, 'dVertexNormalW = normalize(vNormalW);', flipCall, frontEndCall);
        expect(main.split(flipCall)).to.have.length(2);

        const flip = functionBody(source, 'handleTwoSidedLighting');
        expect(flip).to.match(frontFacing);
        expect(flip).to.include(vertexNormalFlip);
        expect(flip).to.not.include('dTBN');
        expect(functionBody(source, 'getNormal')).to.include('dNormalW = dVertexNormalW;');
    });

    it('flips the TBN normal after building the matrix from the unflipped normal', function () {
        // flipping the vertex normal before the TBN matrix is built would also flip the tangent
        // and binormal of a derivative based frame, which would change normal mapped back faces
        const source = forwardSource((material) => {
            material.normalMap = texture();
        });
        expectInOrder(mainBody(source), 'getTBN(', flipCall, frontEndCall);

        // the vertex normal also offsets the shadow lookup, which pointed into the surface
        const flip = functionBody(source, 'handleTwoSidedLighting');
        expect(flip).to.include(vertexNormalFlip);
        expect(flip).to.include('dTBN[2] = -dTBN[2];');
        expect(flip).to.match(frontFacing);
    });

    it('flips the vertex normal when a TBN matrix is built without a normal map', function () {
        // these build a TBN matrix, but the front end still shades with the vertex normal
        const setups = {
            'GGX specular': (material) => {
                material.enableGGXSpecular = true;
            },
            'height map': (material) => {
                material.heightMap = texture();
            },
            'clear coat normal map': (material) => {
                material.clearCoat = 1;
                material.clearCoatNormalMap = texture();
            }
        };
        for (const [name, setup] of Object.entries(setups)) {
            const source = forwardSource(setup);
            expectInOrder(mainBody(source), 'getTBN(', flipCall, frontEndCall);

            const getNormal = functionBody(source, 'getNormal');
            const flip = functionBody(source, 'handleTwoSidedLighting');
            expect(getNormal, name).to.include('dNormalW = dVertexNormalW;');
            expect(flip, name).to.include(vertexNormalFlip);
        }
    });

    it('flips the flat shading normal of back faces', function () {
        // the flat normal follows the winding like a vertex normal, and so needs the same flip
        const source = forwardSource((material) => {
            material.flatShading = true;
        });
        const flatNormal = 'dVertexNormalW = getFlatNormal(vPositionW);';
        expectInOrder(mainBody(source), flatNormal, flipCall, frontEndCall);
    });

    it('leaves the normals of a one sided material alone', function () {
        const normalMapped = (material) => {
            material.normalMap = texture();
        };
        for (const setup of [undefined, normalMapped]) {
            expect(forwardSource(setup, false)).to.not.include('handleTwoSidedLighting');
        }
    });
});
