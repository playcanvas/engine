import { expect } from 'chai';
import sinon from 'sinon';

import { Debug } from '../../src/core/debug.js';
import { Entity } from '../../src/framework/entity.js';
import { SEMANTIC_TANGENT } from '../../src/platform/graphics/constants.js';
import { Texture } from '../../src/platform/graphics/texture.js';
import {
    SHADERDEF_TANGENTS, SHADERDEF_UV0, SHADERDEF_UV1, SHADERDEF_UV2, SHADERDEF_UV3, SHADERDEF_UV4,
    SHADERDEF_UV5, SHADERDEF_UV6, SHADERDEF_UV7, SHADERDEF_VCOLOR
} from '../../src/scene/constants.js';
import { StandardMaterial } from '../../src/scene/materials/standard-material.js';
import { MeshInstance } from '../../src/scene/mesh-instance.js';
import { Mesh } from '../../src/scene/mesh.js';
import { createApp } from '../app.mjs';
import { jsdomSetup, jsdomTeardown } from '../jsdom.mjs';

const uvDefs = [SHADERDEF_UV0, SHADERDEF_UV1, SHADERDEF_UV2, SHADERDEF_UV3, SHADERDEF_UV4, SHADERDEF_UV5, SHADERDEF_UV6, SHADERDEF_UV7];
const formatDefs = uvDefs.reduce((defs, def) => defs | def, SHADERDEF_VCOLOR | SHADERDEF_TANGENTS);

// a triangle with the given texture coordinate sets, and optionally colors and tangents
const fillMesh = (mesh, { uvSets = [], colors = false, tangents = false } = {}) => {
    mesh.setPositions([0, 0, 0, 1, 0, 0, 0, 1, 0]);
    mesh.setNormals([0, 0, 1, 0, 0, 1, 0, 0, 1]);
    for (const set of uvSets) {
        mesh.setUvs(set, [0, 0, 1, 0, 0, 1]);
    }
    if (colors) {
        mesh.setColors32([255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255]);
    }
    if (tangents) {
        mesh.setVertexStream(SEMANTIC_TANGENT, [1, 0, 0, 1, 1, 0, 0, 1, 1, 0, 0, 1], 4);
    }
    mesh.setIndices([0, 1, 2]);
    mesh.update();
    return mesh;
};

// The shader defines a mesh instance takes from the vertex format of its mesh pick its shader
// variants, the texture coordinate sets it provides deciding which maps a material samples.
describe('MeshInstance vertex format shader defines', function () {

    let app;

    beforeEach(function () {
        jsdomSetup();
        app = createApp();

        const camera = new Entity('camera');
        camera.addComponent('camera');
        camera.setPosition(0, 0, 5);
        app.root.addChild(camera);
    });

    afterEach(function () {
        sinon.restore();
        app.destroy();
        jsdomTeardown();
    });

    const render = (meshInstance) => {
        const entity = new Entity('mesh');
        entity.addComponent('render', { meshInstances: [meshInstance] });
        app.root.addChild(entity);
        app.render();
        return entity;
    };

    it('takes a define for each texture coordinate set of the mesh', function () {
        for (let set = 0; set < 8; set++) {
            const mesh = fillMesh(new Mesh(app.graphicsDevice), { uvSets: [set] });
            const meshInstance = new MeshInstance(mesh, new StandardMaterial());
            expect(meshInstance._shaderDefs & formatDefs).to.equal(uvDefs[set]);
        }
    });

    it('takes the defines of vertex colors and tangents', function () {
        const mesh = fillMesh(new Mesh(app.graphicsDevice), { uvSets: [0], colors: true, tangents: true });
        const meshInstance = new MeshInstance(mesh, new StandardMaterial());
        expect(meshInstance._shaderDefs & formatDefs).to.equal(SHADERDEF_UV0 | SHADERDEF_VCOLOR | SHADERDEF_TANGENTS);
    });

    it('follows a mesh assigned to the mesh instance', function () {
        const tangentMesh = fillMesh(new Mesh(app.graphicsDevice), { uvSets: [0, 2], tangents: true });
        const plainMesh = fillMesh(new Mesh(app.graphicsDevice), { uvSets: [1] });
        const meshInstance = new MeshInstance(tangentMesh, new StandardMaterial());
        expect(meshInstance._shaderDefs & formatDefs).to.equal(SHADERDEF_UV0 | SHADERDEF_UV2 | SHADERDEF_TANGENTS);

        meshInstance.mesh = plainMesh;
        expect(meshInstance._shaderDefs & formatDefs).to.equal(SHADERDEF_UV1);
    });

    it('takes a vertex buffer the mesh got later when the mesh is assigned again, and warns in debug builds until then', function () {
        const warnOnce = sinon.stub(Debug, 'warnOnce');
        const mesh = new Mesh(app.graphicsDevice);
        const meshInstance = new MeshInstance(mesh, new StandardMaterial());
        expect(meshInstance._shaderDefs & formatDefs).to.equal(0);

        fillMesh(mesh, { uvSets: [0, 3] });
        render(meshInstance);
        expect(meshInstance._shaderDefs & formatDefs).to.equal(0);
        expect(warnOnce.calledWithMatch('meshInstance.mesh = mesh')).to.equal(true);

        warnOnce.resetHistory();
        meshInstance.mesh = mesh;
        app.render();
        expect(meshInstance._shaderDefs & formatDefs).to.equal(SHADERDEF_UV0 | SHADERDEF_UV3);
        expect(warnOnce.calledWithMatch('meshInstance.mesh = mesh')).to.equal(false);
    });

    it('samples a map on a texture coordinate set only for the mesh that provides the set', function () {
        const material = new StandardMaterial();
        material.diffuseMap = new Texture(app.graphicsDevice, { width: 1, height: 1 });
        material.diffuseMapUv = 4;
        material.update();
        const withSet = new MeshInstance(fillMesh(new Mesh(app.graphicsDevice), { uvSets: [0, 4] }), material);
        const withoutSet = new MeshInstance(fillMesh(new Mesh(app.graphicsDevice), { uvSets: [0, 5] }), material);
        render(withSet);
        render(withoutSet);

        const shaderOf = mi => [...mi._shaderCache.values()][0].shader;
        expect(shaderOf(withSet)).to.not.equal(shaderOf(withoutSet));
        expect(shaderOf(withSet).definition.vshader).to.contain('vertex_texCoord4');
        expect(shaderOf(withoutSet).definition.vshader).to.not.contain('vertex_texCoord4');
    });
});
