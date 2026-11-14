import { expect } from 'chai';

import { Entity } from '../../../src/framework/entity.js';
import { Texture } from '../../../src/platform/graphics/texture.js';
import { StandardMaterial } from '../../../src/scene/materials/standard-material.js';
import { MeshInstance } from '../../../src/scene/mesh-instance.js';
import { Mesh } from '../../../src/scene/mesh.js';
import iridescenceGLSL from '../../../src/scene/shader-lib/glsl/chunks/lit/frag/iridescenceDiffraction.js';
import iridescenceWGSL from '../../../src/scene/shader-lib/wgsl/chunks/lit/frag/iridescenceDiffraction.js';
import { createApp } from '../../app.mjs';
import { jsdomSetup, jsdomTeardown } from '../../jsdom.mjs';

// Under `npm run test:webgpu` the WGSL of each shader is compiled by Dawn, and an error fails the
// test.
describe('StandardMaterial iridescence', function () {

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
        jsdomTeardown();
    });

    it('declares the sampler of the iridescence thickness map', function () {
        const mesh = new Mesh(app.graphicsDevice);
        mesh.setPositions([-1, -1, 0, 1, -1, 0, 0, 1, 0]);
        mesh.setNormals([0, 0, 1, 0, 0, 1, 0, 0, 1]);
        mesh.setUvs(0, [0, 0, 1, 0, 0.5, 1]);
        mesh.setIndices([0, 1, 2]);
        mesh.update();

        // iridescence is a specular effect, so the material uses the metalness workflow, as the
        // materials of glTF files do
        const material = new StandardMaterial();
        material.useMetalness = true;
        material.useIridescence = true;
        material.iridescence = 1;
        material.iridescenceThicknessMap = new Texture(app.graphicsDevice, {
            name: 'thickness',
            width: 4,
            height: 4
        });
        material.update();

        const meshInstance = new MeshInstance(mesh, material);
        const entity = new Entity();
        entity.addComponent('render', { meshInstances: [meshInstance] });
        app.root.addChild(entity);
        app.render();

        const shaders = Array.from(meshInstance._shaderCache.values(), entry => entry.shader);
        const shader = shaders.find(s => s.definition.fshader.includes('getIridescenceThickness'));
        expect(shader).to.exist;
        expect(shader.failed).to.equal(false);
        const declaration = /(uniform\s+sampler2D|var)\s+texture_iridescenceThicknessMap\b/;
        expect(shader.definition.fshader).to.match(declaration);
    });

    // the film's spectral response is converted from CIE XYZ to linear Rec. 709 by a matrix given
    // column by column, as scalars in GLSL and as column vectors in WGSL
    for (const [language, source] of [['GLSL', iridescenceGLSL], ['WGSL', iridescenceWGSL]]) {
        it(`maps the D65 white point to white in ${language}`, function () {
            const declaration = source.slice(source.indexOf('XYZ_TO_REC709'));
            const m = declaration.match(/-?\d+\.\d+/g).slice(0, 9).map(Number);
            const [x, y, z] = [0.95047, 1, 1.08883];
            const rgb = [0, 1, 2].map(row => m[row] * x + m[row + 3] * y + m[row + 6] * z);
            for (const channel of rgb) {
                expect(channel).to.be.closeTo(1, 1e-3);
            }
        });
    }
});
