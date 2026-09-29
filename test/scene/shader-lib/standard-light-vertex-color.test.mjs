import { expect } from 'chai';

import { Entity } from '../../../src/framework/entity.js';
import { Texture } from '../../../src/platform/graphics/texture.js';
import { StandardMaterial } from '../../../src/scene/materials/standard-material.js';
import { MeshInstance } from '../../../src/scene/mesh-instance.js';
import { Mesh } from '../../../src/scene/mesh.js';
import { createApp } from '../../app.mjs';
import { jsdomSetup, jsdomTeardown } from '../../jsdom.mjs';

// lightVertexColor takes the baked lighting of a StandardMaterial from the vertex colors, on their
// own or multiplied into its lightMap. Under `npm run test:webgpu` the WGSL of each shader is
// compiled by Dawn, and an error fails the test.
describe('StandardMaterial lightVertexColor', function () {

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

    /**
     * @param {StandardMaterial} material - The material.
     * @param {boolean} [colors] - False to give the mesh no vertex colors.
     * @returns {MeshInstance} The mesh instance of a triangle drawn with the material.
     */
    const addTriangle = (material, colors = true) => {
        const mesh = new Mesh(app.graphicsDevice);
        mesh.setPositions([-1, -1, 0, 1, -1, 0, 0, 1, 0]);
        mesh.setNormals([0, 0, 1, 0, 0, 1, 0, 0, 1]);
        mesh.setUvs(1, [0, 0, 1, 0, 0.5, 1]);
        if (colors) {
            mesh.setColors32([255, 128, 64, 255, 255, 128, 64, 255, 255, 128, 64, 255]);
        }
        mesh.setIndices([0, 1, 2]);
        mesh.update();

        material.update();
        const meshInstance = new MeshInstance(mesh, material);
        const entity = new Entity();
        entity.addComponent('render', { meshInstances: [meshInstance] });
        app.root.addChild(entity);
        return meshInstance;
    };

    // the fragment source of the forward shader of a mesh instance, the one combining the lighting
    const forwardFragment = (meshInstance) => {
        const shaders = Array.from(meshInstance._shaderCache.values(), instance => instance.shader);
        const shader = shaders.find(s => s.definition.fshader.includes('combineColor'));
        expect(shader).to.exist;
        expect(shader.failed).to.equal(false);
        return shader.definition.fshader;
    };

    it('lights a mesh by its vertex colors without a lightMap', function () {
        const material = new StandardMaterial();
        material.lightVertexColor = true;
        const triangle = addTriangle(material);
        app.render();

        // the baked lighting is added to the diffuse light, and replaces the ambient light, as a
        // lightMap does
        const source = forwardFragment(triangle);
        expect(source).to.contain('vVertexColor.rgb');
        expect(source).to.match(/addLightMap\(\s*litArgs_lightmap,/);
        expect(source).not.to.contain('addAmbient(');
    });

    it('multiplies the lightMap by the vertex colors', function () {
        const material = new StandardMaterial();
        material.lightVertexColor = true;
        material.lightMap = new Texture(app.graphicsDevice, { name: 'light', width: 4, height: 4 });
        const triangle = addTriangle(material);
        app.render();

        const source = forwardFragment(triangle);
        expect(source).to.contain('texture_lightMap');
        expect(source).to.contain('vVertexColor.rgb');
        expect(source).to.match(/addLightMap\(\s*litArgs_lightmap,/);
    });

    it('reads a single vertex color channel into all three channels of the light', function () {
        const material = new StandardMaterial();
        material.lightVertexColor = true;
        material.lightVertexColorChannel = 'a';
        const triangle = addTriangle(material);
        app.render();

        expect(forwardFragment(triangle)).to.contain('vVertexColor.aaa');
    });

    it('keeps the ambient light of a mesh without vertex colors', function () {
        const material = new StandardMaterial();
        material.lightVertexColor = true;
        const triangle = addTriangle(material, false);
        app.render();

        const source = forwardFragment(triangle);
        expect(source).not.to.contain('vVertexColor');
        expect(source).not.to.contain('addLightMap(');
        expect(source).to.contain('addAmbient(');
    });
});
