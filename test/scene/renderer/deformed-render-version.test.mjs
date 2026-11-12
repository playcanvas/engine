import { expect } from 'chai';

import { Mat4 } from '../../../src/core/math/mat4.js';
import { Vec3 } from '../../../src/core/math/vec3.js';
import { BoundingBox } from '../../../src/core/shape/bounding-box.js';
import { INTERPOLATION_LINEAR } from '../../../src/framework/anim/constants.js';
import { OFFSCREENUPDATE_STATE } from '../../../src/framework/anim/controller/constants.js';
import { AnimCurve } from '../../../src/framework/anim/evaluator/anim-curve.js';
import { AnimData } from '../../../src/framework/anim/evaluator/anim-data.js';
import { AnimTrack } from '../../../src/framework/anim/evaluator/anim-track.js';
import { Entity } from '../../../src/framework/entity.js';
import { MeshInstance } from '../../../src/scene/mesh-instance.js';
import { Mesh } from '../../../src/scene/mesh.js';
import { MorphInstance } from '../../../src/scene/morph-instance.js';
import { MorphTarget } from '../../../src/scene/morph-target.js';
import { Morph } from '../../../src/scene/morph.js';
import { SkinInstance } from '../../../src/scene/skin-instance.js';
import { Skin } from '../../../src/scene/skin.js';
import { createApp } from '../../app.mjs';
import { jsdomSetup, jsdomTeardown } from '../../jsdom.mjs';

describe('Deformed mesh render version', function () {
    let app;

    beforeEach(function () {
        jsdomSetup();
        app = createApp();

        // a camera at the origin looking down the negative z axis
        const camera = new Entity('Camera');
        camera.addComponent('camera');
        app.root.addChild(camera);
    });

    afterEach(function () {
        app.destroy();
        jsdomTeardown();
    });

    const renderVersion = () => app.graphicsDevice.renderVersion;

    // a single triangle mesh, with bounds of half extents 1 around its node. A skinned mesh has
    // all its vertices fully weighted to the first bone, as skinned shaders require the attributes
    const createMesh = (skinned = false) => {
        return Mesh.fromGeometry(app.graphicsDevice, {
            positions: [0, 0, 0, 1, 0, 0, 0, 1, 0],
            normals: [0, 0, 1, 0, 0, 1, 0, 0, 1],
            indices: [0, 1, 2],
            ...(skinned && {
                blendIndices: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
                blendWeights: [1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0]
            })
        });
    };

    const customAabb = new BoundingBox(new Vec3(0, 0, 0), new Vec3(1, 1, 1));

    // adds a render component to the entity, with a mesh instance skinned to the bone, whose skin
    // is resolved relative to the given skin root
    const addSkinnedRender = (entity, bone, skinRoot) => {
        const skin = new Skin(app.graphicsDevice, [new Mat4()], [bone.name]);
        const skinInstance = new SkinInstance(skin);
        skinInstance.bones = [bone];
        skinInstance.rootBone = skinRoot;

        const meshInstance = new MeshInstance(createMesh(true), app.systems.render.defaultMaterial, entity);
        meshInstance.skinInstance = skinInstance;

        entity.addComponent('render', { type: 'asset' });
        entity.render.meshInstances = [meshInstance];
        entity.render.customAabb = customAabb;
        return meshInstance;
    };

    // adds a render component to the entity, with a morphed mesh instance
    const addMorphedRender = (entity) => {
        const mesh = createMesh();
        mesh.morph = new Morph([new MorphTarget({
            name: 'Target',
            deltaPositions: new Float32Array([0, 0, 0, 0, 1, 0, 0, 0, 0])
        })], app.graphicsDevice);

        const meshInstance = new MeshInstance(mesh, app.systems.render.defaultMaterial, entity);
        meshInstance.morphInstance = new MorphInstance(mesh.morph);

        entity.addComponent('render', { type: 'asset' });
        entity.render.meshInstances = [meshInstance];
        entity.render.customAabb = customAabb;
        return meshInstance;
    };

    it('marks the hierarchy of a skinned mesh rendered below its skin root', function () {
        // the skin is resolved relative to the top of the model, while the mesh is in a subtree
        // below it, which an anim component can use as its root
        const top = new Entity('top');
        const subtree = new Entity('subtree');
        const bone = new Entity('bone');
        const mesh = new Entity('mesh');
        top.addChild(subtree);
        subtree.addChild(bone);
        subtree.addChild(mesh);
        top.setPosition(0, 0, -5);
        app.root.addChild(top);

        addSkinnedRender(mesh, bone, top);
        app.render();

        expect(mesh._deformedRenderVersion).to.equal(renderVersion());
        expect(subtree._deformedRenderVersion).to.equal(renderVersion());
        expect(top._deformedRenderVersion).to.equal(renderVersion());
    });

    it('evaluates the animation of an anim component rooted below the skin root when its mesh is rendered', function () {
        const top = new Entity('top');
        const subtree = new Entity('subtree');
        const bone = new Entity('bone');
        const mesh = new Entity('mesh');
        top.addChild(subtree);
        subtree.addChild(bone);
        subtree.addChild(mesh);
        top.setPosition(0, 0, -5);
        app.root.addChild(top);
        addSkinnedRender(mesh, bone, top);

        // scales the bone from 1 to 3 over one second
        const curve = new AnimCurve([{ entityPath: ['top', 'subtree', 'bone'], component: 'entity', propertyPath: ['localScale'] }], 0, 0, INTERPOLATION_LINEAR);
        const track = new AnimTrack('Scale', 1, [new AnimData(1, [0, 1])], [new AnimData(3, [1, 1, 1, 3, 3, 3])], [curve]);
        top.addComponent('anim', { activate: true, offscreenUpdate: OFFSCREENUPDATE_STATE, rootBone: subtree });
        top.anim.assignAnimation('Scale', track);

        app.render();
        app.systems.anim.onAnimationUpdate(0.5);

        expect(app.stats.frame.animEvaluated).to.equal(1);
        expect(bone.getLocalScale().x).to.be.closeTo(2, 1e-5);
    });

    it('marks a deformed mesh visible only in a shadow map, and updates its morphing', function () {
        // a directional light shining down, with shadow bounds covering the caster
        const light = new Entity('Light');
        light.addComponent('light', { type: 'directional', castShadows: true });
        light.setEulerAngles(90, 0, 0);
        app.root.addChild(light);
        light.light.light.shadowBounds = new BoundingBox(new Vec3(0, 0, 10), new Vec3(5, 5, 5));

        // a caster behind the camera, so it is not visible to it
        const caster = new Entity('caster');
        caster.setPosition(0, 0, 10);
        app.root.addChild(caster);
        const meshInstance = addMorphedRender(caster);

        meshInstance.morphInstance.setWeight(0, 1);
        app.render();

        // it was rendered into the shadow map, and not by the camera
        expect(meshInstance.visibleThisFrame).to.equal(true);
        expect(app.renderer.culler.processingMeshInstances.has(meshInstance)).to.equal(true);
        expect(caster._deformedRenderVersion).to.equal(renderVersion());

        // its morph was updated for the shadow map
        expect(meshInstance.morphInstance._dirty).to.equal(false);
    });

    it('does not mark a deformed mesh which is not rendered', function () {
        const caster = new Entity('caster');
        caster.setPosition(0, 0, 10);
        app.root.addChild(caster);
        addMorphedRender(caster);

        app.render();

        expect(caster._deformedRenderVersion).to.not.equal(renderVersion());
    });
});
