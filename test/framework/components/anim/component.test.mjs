import { expect } from 'chai';

import { INTERPOLATION_LINEAR } from '../../../../src/framework/anim/constants.js';
import {
    ANIM_BLEND_1D, ANIM_LAYER_ADDITIVE, ANIM_LAYER_OVERWRITE, ANIM_PARAMETER_FLOAT,
    OFFSCREENUPDATE_FULL, OFFSCREENUPDATE_NONE, OFFSCREENUPDATE_STATE
} from '../../../../src/framework/anim/controller/constants.js';
import { AnimCurve } from '../../../../src/framework/anim/evaluator/anim-curve.js';
import { AnimData } from '../../../../src/framework/anim/evaluator/anim-data.js';
import { AnimEvents } from '../../../../src/framework/anim/evaluator/anim-events.js';
import { AnimTrack } from '../../../../src/framework/anim/evaluator/anim-track.js';
import { Entity } from '../../../../src/framework/entity.js';
import { GraphNode } from '../../../../src/scene/graph-node.js';
import { MeshInstance } from '../../../../src/scene/mesh-instance.js';
import { Mesh } from '../../../../src/scene/mesh.js';
import { MorphInstance } from '../../../../src/scene/morph-instance.js';
import { MorphTarget } from '../../../../src/scene/morph-target.js';
import { Morph } from '../../../../src/scene/morph.js';
import { createApp } from '../../../app.mjs';
import { jsdomSetup, jsdomTeardown } from '../../../jsdom.mjs';

describe('AnimComponent', function () {

    let app;

    beforeEach(function () {
        jsdomSetup();
        app = createApp();
    });

    afterEach(function () {
        app.destroy();
        app = null;
        jsdomTeardown();
    });

    const track = name => new AnimTrack(name, 1, [], [], []);

    describe('#speed', function () {
        const moveTrack = (name = 'Move', offset = 0) => {
            const curve = new AnimCurve([{
                entityPath: ['root'],
                component: 'graph',
                propertyPath: ['localPosition']
            }], 0, 0, INTERPOLATION_LINEAR);
            const events = new AnimEvents([{ time: 0.25, name: 'early' }, { time: 0.75, name: 'late' }]);
            return new AnimTrack(name, 1, [new AnimData(1, [0, 1])],
                [new AnimData(3, [offset, 0, 0, offset + 10, 0, 0])], [curve], events);
        };

        const createAnimated = (componentSpeed = 1, stateSpeed = 1, loop = true) => {
            const root = new Entity('root', app);
            app.root.addChild(root);
            root.addComponent('anim', { activate: true, speed: componentSpeed });
            root.anim.assignAnimation('Move', moveTrack(), undefined, stateSpeed, loop);
            return root;
        };

        [1, -1].forEach((componentSpeed) => {
            [1, -1].forEach((stateSpeed) => {
                [true, false].forEach((loop) => {
                    it(`plays and fires events at component speed ${componentSpeed}, state speed ${stateSpeed}, loop ${loop}`, function () {
                        const root = createAnimated(componentSpeed, stateSpeed, loop);
                        const events = [];
                        root.anim.on('early', () => events.push('early'));
                        root.anim.on('late', () => events.push('late'));
                        const reverse = componentSpeed * stateSpeed < 0;

                        app.systems.anim.onAnimationUpdate(0);
                        expect(root.getLocalPosition().x).to.be.closeTo(reverse ? 10 : 0, 1e-5);

                        app.systems.anim.onAnimationUpdate(0.375);
                        expect(root.getLocalPosition().x).to.be.closeTo(reverse ? 6.25 : 3.75, 1e-5);
                        expect(root.anim.baseLayer.activeStateCurrentTime).to.equal(reverse ? -0.375 : 0.375);
                        expect(root.anim.baseLayer.activeStateProgress).to.equal(0.375);

                        app.systems.anim.onAnimationUpdate(0.5);
                        app.systems.anim.onAnimationUpdate(0.5);
                        const expected = reverse ? ['late', 'early'] : ['early', 'late'];
                        if (loop) expected.push(reverse ? 'late' : 'early');
                        expect(events).to.deep.equal(expected);
                        expect(root.getLocalPosition().x).to.be.closeTo(loop ? (reverse ? 6.25 : 3.75) : (reverse ? 0 : 10), 1e-5);
                    });
                });
            });
        });

        it('changes direction and realigns events on clips that are already playing', function () {
            const root = createAnimated();
            const events = [];
            root.anim.on('early', () => events.push('early'));
            root.anim.on('late', () => events.push('late'));
            app.systems.anim.onAnimationUpdate(0.375);

            root.anim.speed = -1;
            app.systems.anim.onAnimationUpdate(0.25);
            expect(root.getLocalPosition().x).to.be.closeTo(1.25, 1e-5);
            expect(events).to.deep.equal(['early', 'early']);

            app.systems.anim.onAnimationUpdate(0.5);
            expect(root.getLocalPosition().x).to.be.closeTo(6.25, 1e-5);
            expect(events).to.deep.equal(['early', 'early', 'late']);

            root.anim.speed = 1;
            app.systems.anim.onAnimationUpdate(0.25);
            expect(root.getLocalPosition().x).to.be.closeTo(8.75, 1e-5);
            expect(events).to.deep.equal(['early', 'early', 'late', 'late']);
        });

        it('pauses and resumes reverse playback without compounding the speed multiplier', function () {
            const root = createAnimated(-1);
            const events = [];
            root.anim.on('late', () => events.push('late'));
            app.systems.anim.onAnimationUpdate(0.375);

            root.anim.speed = 0;
            app.systems.anim.onAnimationUpdate(0.5);
            app.systems.anim.onAnimationUpdate(0.5);
            expect(root.getLocalPosition().x).to.be.closeTo(6.25, 1e-5);
            expect(events).to.deep.equal(['late']);

            root.anim.speed = -2;
            app.systems.anim.onAnimationUpdate(0.125);
            expect(root.getLocalPosition().x).to.be.closeTo(3.75, 1e-5);
            expect(root.anim.speed).to.equal(-2);
        });

        it('uses the component direction for a layer added after setting its speed', function () {
            const root = createAnimated();
            root.anim.speed = -2;
            const upper = root.anim.addLayer('Upper');
            upper.assignAnimation('Move', moveTrack(), 0.5);

            app.systems.anim.onAnimationUpdate(0.25);

            expect(root.getLocalPosition().x).to.be.closeTo(7.5, 1e-5);
        });

        it('finishes state transitions while playing backwards', function () {
            const root = createAnimated(-1);
            root.anim.assignAnimation('Other', moveTrack('Other', 10));
            app.systems.anim.onAnimationUpdate(0);
            root.anim.baseLayer.transition('Other', 0.5);

            app.systems.anim.onAnimationUpdate(0.25);
            expect(root.getLocalPosition().x).to.be.closeTo(12.5, 1e-5);
            app.systems.anim.onAnimationUpdate(0.375);

            expect(root.anim.baseLayer.transitioning).to.equal(false);
            expect(root.getLocalPosition().x).to.be.closeTo(13.75, 1e-5);
        });

        it('finishes layer weight blends while playing backwards', function () {
            const root = createAnimated(-1);
            root.anim.baseLayer.weight = 0;
            root.anim.baseLayer.blendToWeight(1, 0.5);

            for (let i = 0; i < 4; i++) app.systems.anim.onAnimationUpdate(0.25);

            expect(root.anim.baseLayer.weight).to.equal(1);
        });

        [1, -1].forEach((stateSpeed) => {
            it(`takes an exit-time transition at negative component speed and state speed ${stateSpeed}`, function () {
                const root = createAnimated(-1, stateSpeed);
                root.anim.loadStateGraph({
                    layers: [{
                        name: 'Base',
                        states: [{ name: 'START' }, { name: 'Move', speed: stateSpeed }, { name: 'Other' }],
                        transitions: [{ from: 'START', to: 'Move' }, { from: 'Move', to: 'Other', exitTime: 1 }]
                    }],
                    parameters: {}
                });
                root.anim.assignAnimation('Move', moveTrack(), undefined, stateSpeed);
                root.anim.assignAnimation('Other', moveTrack('Other'));
                app.systems.anim.onAnimationUpdate(0);

                for (let i = 0; i < 7; i++) app.systems.anim.onAnimationUpdate(0.125);
                expect(root.anim.baseLayer.activeState).to.equal('Move');
                app.systems.anim.onAnimationUpdate(0.125);
                expect(root.anim.baseLayer.activeState).to.equal('Other');
            });
        });

        it('keeps synchronized blend tree clips playing backwards across updates', function () {
            const root = createAnimated(-1);
            root.anim.loadStateGraph({
                layers: [{
                    name: 'Base',
                    states: [{ name: 'START' }, {
                        name: 'Move',
                        blendTree: {
                            type: ANIM_BLEND_1D,
                            parameter: 'blend',
                            syncAnimations: true,
                            children: [{ name: 'A', point: 0, speed: 1 }, { name: 'B', point: 1, speed: 1 }]
                        }
                    }],
                    transitions: [{ from: 'START', to: 'Move' }]
                }],
                parameters: { blend: { type: ANIM_PARAMETER_FLOAT, value: 0.5 } }
            });
            root.anim.assignAnimation('Move.A', moveTrack('A'));
            root.anim.assignAnimation('Move.B', moveTrack('B'));

            app.systems.anim.onAnimationUpdate(0);
            app.systems.anim.onAnimationUpdate(0.125);
            app.systems.anim.onAnimationUpdate(0.125);

            expect(root.getLocalPosition().x).to.be.closeTo(7.5, 1e-5);
        });

        it('uses the cloned playback speed when assigning an animation', function () {
            const root = createAnimated(-1);
            const clone = root.clone();
            app.root.addChild(clone);
            clone.anim.assignAnimation('Move', moveTrack());
            app.systems.anim.onAnimationUpdate(0.25);
            expect(clone.getLocalPosition().x).to.be.closeTo(7.5, 1e-5);

            root.anim.speed = 1;
            app.systems.anim.onAnimationUpdate(0.25);
            expect(root.getLocalPosition().x).to.be.closeTo(10, 1e-5);
            expect(clone.getLocalPosition().x).to.be.closeTo(5, 1e-5);
        });
    });

    describe('#clone', function () {

        // Regression test for https://github.com/playcanvas/engine/issues/6395
        it('clones a component with a layer added dynamically after the base layer', function () {
            const entity = new Entity('model', app);
            app.root.addChild(entity);
            entity.addComponent('anim', { activate: true });

            // base layer, created implicitly by the first assignAnimation call
            entity.anim.assignAnimation('Idle', track('Idle'));
            entity.anim.assignAnimation('Walk', track('Walk'));

            // second layer added dynamically with an additive blend type
            const upperBody = entity.anim.addLayer('UpperBody', 0.5, null, ANIM_LAYER_ADDITIVE);
            upperBody.assignAnimation('Eager', track('Eager'));
            upperBody.assignAnimation('Dance', track('Dance'));

            let clone;
            expect(() => {
                clone = entity.clone();
            }).to.not.throw();
            app.root.addChild(clone);

            // both layers are reproduced on the clone
            expect(clone.anim.layers.length).to.equal(2);
            expect(clone.anim.findLayer('Base')).to.not.equal(null);
            expect(clone.anim.findLayer('UpperBody')).to.not.equal(null);

            // the dynamically-added layer keeps its blend type
            expect(clone.anim.findLayer('Base').blendType).to.equal(ANIM_LAYER_OVERWRITE);
            expect(clone.anim.findLayer('UpperBody').blendType).to.equal(ANIM_LAYER_ADDITIVE);

            // states (and their assigned animations) are reproduced on both layers
            expect(clone.anim.findLayer('Base').states).to.have.members(['START', 'Idle', 'Walk']);
            expect(clone.anim.findLayer('UpperBody').states).to.have.members(['START', 'Eager', 'Dance']);
            expect(clone.anim.playable).to.equal(true);

            // the clone owns independent layer instances
            expect(clone.anim.layers[1]).to.not.equal(entity.anim.layers[1]);
        });

        it('clones a single-layer component', function () {
            const entity = new Entity('model', app);
            app.root.addChild(entity);
            entity.addComponent('anim', { activate: true });
            entity.anim.assignAnimation('Idle', track('Idle'));

            let clone;
            expect(() => {
                clone = entity.clone();
            }).to.not.throw();

            expect(clone.anim.layers.length).to.equal(1);
            expect(clone.anim.findLayer('Base').states).to.have.members(['START', 'Idle']);
            expect(clone.anim.playable).to.equal(true);
        });
    });

    describe('#findLayer', function () {

        it('returns the named layer, or null when there is none', function () {
            const entity = new Entity('model', app);
            app.root.addChild(entity);
            entity.addComponent('anim', { activate: true });
            const upperBody = entity.anim.addLayer('UpperBody');

            expect(entity.anim.findLayer('UpperBody')).to.equal(upperBody);
            expect(entity.anim.findLayer('Missing')).to.equal(null);
        });

        it('forwards the deprecated findAnimationLayer to findLayer', function () {
            const entity = new Entity('model', app);
            app.root.addChild(entity);
            entity.addComponent('anim', { activate: true });
            const upperBody = entity.anim.addLayer('UpperBody');

            expect(entity.anim.findAnimationLayer('UpperBody')).to.equal(upperBody);
        });

    });

    describe('morph target weights', function () {

        const MORPH_TARGET = 'Blink';

        // mesh instances carrying a single named morph target, as a loaded render asset produces
        const createMeshInstances = (entity) => {
            const mesh = Mesh.fromGeometry(app.graphicsDevice, {
                positions: [0, 0, 0, 1, 0, 0, 0, 1, 0],
                indices: [0, 1, 2]
            });
            mesh.morph = new Morph([new MorphTarget({
                name: MORPH_TARGET,
                deltaPositions: new Float32Array([0, 0, 0, 0, 1, 0, 0, 0, 0]),
                defaultWeight: 0
            })], app.graphicsDevice);

            const meshInstance = new MeshInstance(mesh, app.systems.render.defaultMaterial, entity);
            meshInstance.morphInstance = new MorphInstance(mesh.morph);
            return [meshInstance];
        };

        // a track with a single morph weight curve ramping from 0 to 1 over its duration, encoded
        // the way the glb parser encodes them
        const morphTrack = (entityPath) => {
            const curve = new AnimCurve([{
                entityPath,
                component: 'graph',
                propertyPath: [`weight.name.${MORPH_TARGET}`]
            }], 0, 0, INTERPOLATION_LINEAR);

            return new AnimTrack('Morph', 1, [new AnimData(1, [0, 1])], [new AnimData(1, [0, 1])], [curve]);
        };

        const weight = entity => entity.render.meshInstances[0].morphInstance.getWeight(MORPH_TARGET);

        it('blend from the weight before the animation when the layer weight is lowered', function () {
            const entity = new Entity('model', app);
            app.root.addChild(entity);
            entity.addComponent('render', { type: 'asset' });
            entity.render.meshInstances = createMeshInstances(entity);
            entity.addComponent('anim', { activate: true });
            entity.anim.assignAnimation('Morph', morphTrack(['model']));

            // a single layer at full weight
            app.systems.anim.onAnimationUpdate(0.25);
            expect(weight(entity)).to.be.closeTo(0.25, 1e-5);

            // at half weight, the animated weight of 0.45 is blended with the weight of 0 before
            // the animation
            entity.anim.baseLayer.weight = 0.5;
            app.systems.anim.onAnimationUpdate(0.2);
            expect(weight(entity)).to.be.closeTo(0.225, 1e-5);
        });

        // Regression test for https://github.com/playcanvas/engine/issues/5225
        it('are animated when mesh instances are created after the animation is bound', function () {
            const entity = new Entity('model', app);
            app.root.addChild(entity);

            // a render component whose asset has not loaded yet, so it has no mesh instances
            entity.addComponent('render', { type: 'asset' });
            entity.addComponent('anim', { activate: true });
            entity.anim.assignAnimation('Morph', morphTrack(['model']));

            // frames tick while the asset is still loading - the anim controller binds its curves
            // here, when there is no morph instance to bind the weight curve to
            app.systems.anim.onAnimationUpdate(0.1);

            // the asset arrives and mesh instances are created
            entity.render.meshInstances = createMeshInstances(entity);

            app.systems.anim.onAnimationUpdate(0.4);

            expect(weight(entity)).to.be.closeTo(0.5, 1e-5);
        });

        // Regression test for https://github.com/playcanvas/engine/issues/5225
        it('are animated after mesh instances are replaced', function () {
            const entity = new Entity('model', app);
            app.root.addChild(entity);

            entity.addComponent('render', { type: 'asset' });
            entity.render.meshInstances = createMeshInstances(entity);
            entity.addComponent('anim', { activate: true });
            entity.anim.assignAnimation('Morph', morphTrack(['model']));

            app.systems.anim.onAnimationUpdate(0.5);
            expect(weight(entity)).to.be.closeTo(0.5, 1e-5);

            // an asset unload and reload destroys the morph instances the animation was bound to
            // and creates replacements
            entity.render.destroyMeshInstances();
            entity.render.meshInstances = createMeshInstances(entity);

            // clip time is cumulative, so this samples the track at 0.75
            expect(() => app.systems.anim.onAnimationUpdate(0.25)).to.not.throw();
            expect(weight(entity)).to.be.closeTo(0.75, 1e-5);
        });

        // The layout instantiateRenderEntity produces for an imported character: the anim component
        // on the root, render components on mesh descendants. The binder resolves targets throughout
        // the animated hierarchy, so a descendant's mesh instances must reach the owning component.
        const createHierarchy = (rootBone) => {
            const root = new Entity('root', app);
            const child = new Entity('model', app);
            root.addChild(child);
            app.root.addChild(root);

            child.addComponent('render', { type: 'asset' });
            root.addComponent('anim', { activate: true, rootBone });
            root.anim.assignAnimation('Morph', morphTrack(['root', 'model']));

            return child;
        };

        // Regression test for https://github.com/playcanvas/engine/issues/5225
        it('are animated when a descendant creates mesh instances after the animation is bound', function () {
            const child = createHierarchy();

            app.systems.anim.onAnimationUpdate(0.1);
            child.render.meshInstances = createMeshInstances(child);
            app.systems.anim.onAnimationUpdate(0.4);

            expect(weight(child)).to.be.closeTo(0.5, 1e-5);
        });

        // Regression test for https://github.com/playcanvas/engine/issues/5225
        it('are animated after a descendant replaces its mesh instances', function () {
            const child = createHierarchy();
            child.render.meshInstances = createMeshInstances(child);

            app.systems.anim.onAnimationUpdate(0.5);
            expect(weight(child)).to.be.closeTo(0.5, 1e-5);

            child.render.destroyMeshInstances();
            child.render.meshInstances = createMeshInstances(child);

            expect(() => app.systems.anim.onAnimationUpdate(0.25)).to.not.throw();
            expect(weight(child)).to.be.closeTo(0.75, 1e-5);
        });

        it('are animated when the animated hierarchy is a root bone', function () {
            // the root bone is resolved by guid, so the entity has to be in the scene already
            const root = new Entity('root', app);
            const bones = new Entity('bones', app);
            const child = new Entity('model', app);
            bones.addChild(child);
            root.addChild(bones);
            app.root.addChild(root);

            child.addComponent('render', { type: 'asset' });
            root.addComponent('anim', { activate: true, rootBone: bones });
            root.anim.assignAnimation('Morph', morphTrack(['bones', 'model']));

            app.systems.anim.onAnimationUpdate(0.1);
            child.render.meshInstances = createMeshInstances(child);
            app.systems.anim.onAnimationUpdate(0.4);

            expect(weight(child)).to.be.closeTo(0.5, 1e-5);
        });

        it('are left alone when the changed entity is outside the animated hierarchy', function () {
            const animated = new Entity('animated', app);
            const unrelated = new Entity('unrelated', app);
            app.root.addChild(animated);
            app.root.addChild(unrelated);

            animated.addComponent('anim', { activate: true });
            animated.anim.assignAnimation('Morph', morphTrack(['animated']));
            unrelated.addComponent('render', { type: 'asset' });

            let rebinds = 0;
            const rebind = animated.anim.rebind.bind(animated.anim);
            animated.anim.rebind = () => {
                rebinds++;
                rebind();
            };

            unrelated.render.meshInstances = createMeshInstances(unrelated);

            expect(rebinds).to.equal(0);
        });
    });

    describe('property track binding', function () {

        // a track with a single curve ramping the given property from its first to its second
        // keyframe over the track duration, the way anim clip JSON encodes property curves
        const propertyTrack = (entityPath, component, propertyPath, components, keyframes) => {
            const curve = new AnimCurve([{
                entityPath,
                component,
                propertyPath
            }], 0, 0, INTERPOLATION_LINEAR);

            return new AnimTrack('Property', 1, [new AnimData(1, [0, 1])], [new AnimData(components, keyframes)], [curve]);
        };

        const scaleTrack = entityPath => propertyTrack(entityPath, 'entity', ['localScale'], 3, [1, 1, 1, 3, 3, 3]);

        it('resolves entity paths rooted at the anim component entity', function () {
            const root = new Entity('root', app);
            const child = new Entity('child', app);
            root.addChild(child);
            app.root.addChild(root);

            root.addComponent('anim', { activate: true });
            root.anim.assignAnimation('Scale', scaleTrack(['root', 'child']));

            app.systems.anim.onAnimationUpdate(0.5);

            expect(child.getLocalScale().x).to.be.closeTo(2, 1e-5);
        });

        it('resolves component properties on descendants', function () {
            const root = new Entity('root', app);
            const lamp = new Entity('lamp', app);
            root.addChild(lamp);
            app.root.addChild(root);

            lamp.addComponent('light', { type: 'spot', intensity: 0 });
            root.addComponent('anim', { activate: true });
            root.anim.assignAnimation('Intensity', propertyTrack(['root', 'lamp'], 'light', ['intensity'], 1, [0, 1]));

            app.systems.anim.onAnimationUpdate(0.5);

            expect(lamp.light.intensity).to.be.closeTo(0.5, 1e-5);
        });

        it('binds single element paths to the anim component entity regardless of the root name', function () {
            const root = new Entity('root', app);
            app.root.addChild(root);

            root.addComponent('anim', { activate: true });
            root.anim.assignAnimation('Scale', scaleTrack(['other']));

            app.systems.anim.onAnimationUpdate(0.5);

            expect(root.getLocalScale().x).to.be.closeTo(2, 1e-5);
        });

        it('leaves curves unbound instead of resolving into sibling hierarchies', function () {
            const root = new Entity('root', app);
            const sibling = new Entity('other', app);
            const target = new Entity('target', app);
            sibling.addChild(target);
            app.root.addChild(root);
            app.root.addChild(sibling);

            root.addComponent('anim', { activate: true });
            root.anim.assignAnimation('Scale', scaleTrack(['other', 'target']));

            expect(() => app.systems.anim.onAnimationUpdate(0.5)).to.not.throw();

            expect(target.getLocalScale().x).to.equal(1);
        });

        it('leaves curves unbound when the path names a missing descendant', function () {
            const root = new Entity('root', app);
            app.root.addChild(root);

            root.addComponent('anim', { activate: true });
            root.anim.assignAnimation('Scale', scaleTrack(['root', 'missing']));

            expect(() => app.systems.anim.onAnimationUpdate(0.5)).to.not.throw();
        });
    });

    describe('#offscreenUpdate', function () {

        // a track scaling the anim component entity from 1 to 3 over one second, with an event at
        // 0.4 seconds
        const scaleTrack = () => {
            const curve = new AnimCurve([{
                entityPath: ['root'],
                component: 'entity',
                propertyPath: ['localScale']
            }], 0, 0, INTERPOLATION_LINEAR);

            return new AnimTrack('Scale', 1, [new AnimData(1, [0, 1])], [new AnimData(3, [1, 1, 1, 3, 3, 3])],
                [curve], new AnimEvents([{ name: 'step', time: 0.4 }]));
        };

        // an entity with an anim component playing the scale track, counting its events
        const createAnimated = (offscreenUpdate) => {
            const root = new Entity('root', app);
            app.root.addChild(root);
            root.addComponent('anim', offscreenUpdate ? { activate: true, offscreenUpdate } : { activate: true });
            root.anim.assignAnimation('Scale', scaleTrack());

            const counter = { events: 0 };
            root.anim.on('step', () => counter.events++);
            return { root, counter };
        };

        // marks the entity as rendered in the last frame, as the renderer does for an entity with a
        // visible skinned or morphed mesh instance
        const markRendered = (entity) => {
            entity.markDeformedRendered(app.graphicsDevice.renderVersion);
        };

        it('defaults to a full update', function () {
            const { root } = createAnimated();
            expect(root.anim.offscreenUpdate).to.equal(OFFSCREENUPDATE_FULL);
        });

        it('falls back to a full update when set to undefined', function () {
            const root = new Entity('root', app);
            app.root.addChild(root);
            root.addComponent('anim', { activate: true, offscreenUpdate: undefined });

            expect(root.anim.offscreenUpdate).to.equal(OFFSCREENUPDATE_FULL);
        });

        it('updates fully when not visible with OFFSCREENUPDATE_FULL', function () {
            const { root, counter } = createAnimated(OFFSCREENUPDATE_FULL);

            app.systems.anim.onAnimationUpdate(0.5);

            expect(root.getLocalScale().x).to.be.closeTo(2, 1e-5);
            expect(counter.events).to.equal(1);
            expect(app.stats.frame.animEvaluated).to.equal(1);
            expect(app.stats.frame.animOffscreen).to.equal(0);
        });

        it('advances time and fires events, but skips the evaluation, when not visible with OFFSCREENUPDATE_STATE', function () {
            const { root, counter } = createAnimated(OFFSCREENUPDATE_STATE);

            app.systems.anim.onAnimationUpdate(0.5);

            expect(root.getLocalScale().x).to.equal(1);
            expect(counter.events).to.equal(1);
            expect(app.stats.frame.animEvaluated).to.equal(0);
            expect(app.stats.frame.animOffscreen).to.equal(1);

            // once visible, the animation is evaluated at the time which advanced while not visible
            markRendered(root);
            app.systems.anim.onAnimationUpdate(0.25);

            expect(root.getLocalScale().x).to.be.closeTo(2.5, 1e-5);
            expect(app.stats.frame.animEvaluated).to.equal(1);
        });

        it('does not update at all when not visible with OFFSCREENUPDATE_NONE', function () {
            const { root, counter } = createAnimated(OFFSCREENUPDATE_NONE);

            app.systems.anim.onAnimationUpdate(0.5);

            expect(root.getLocalScale().x).to.equal(1);
            expect(counter.events).to.equal(0);
            expect(app.stats.frame.animOffscreen).to.equal(1);

            // once visible, the animation resumes from where it stopped
            markRendered(root);
            app.systems.anim.onAnimationUpdate(0.25);

            expect(root.getLocalScale().x).to.be.closeTo(1.5, 1e-5);
            expect(counter.events).to.equal(0);
        });

        it('updates fully when visible, whatever the off-screen update mode', function () {
            const { root, counter } = createAnimated(OFFSCREENUPDATE_NONE);

            markRendered(root);
            app.systems.anim.onAnimationUpdate(0.5);

            expect(root.getLocalScale().x).to.be.closeTo(2, 1e-5);
            expect(counter.events).to.equal(1);
        });

        it('is not visible when rendered in an older frame', function () {
            const { root } = createAnimated(OFFSCREENUPDATE_STATE);

            root._deformedRenderVersion = app.graphicsDevice.renderVersion - 1;
            app.systems.anim.onAnimationUpdate(0.5);

            expect(root.getLocalScale().x).to.equal(1);
        });

        it('takes the visibility from the root bone when set', function () {
            const root = new Entity('root', app);
            const rig = new Entity('rig', app);
            root.addChild(rig);
            app.root.addChild(root);

            root.addComponent('anim', { activate: true, offscreenUpdate: OFFSCREENUPDATE_STATE, rootBone: rig });
            root.anim.assignAnimation('Scale', scaleTrack());

            // marking only the root entity does not make the anim component visible
            markRendered(root);
            rig._deformedRenderVersion = -1;
            app.systems.anim.onAnimationUpdate(0.5);
            expect(app.stats.frame.animEvaluated).to.equal(0);

            // a deformed mesh instance rendered under the root bone marks it, and its ancestors
            markRendered(rig);
            app.systems.anim.onAnimationUpdate(0.5);
            expect(app.stats.frame.animEvaluated).to.equal(1);
        });

        it('is kept when the entity is cloned', function () {
            const { root } = createAnimated(OFFSCREENUPDATE_STATE);

            const clone = root.clone();

            expect(clone.anim.offscreenUpdate).to.equal(OFFSCREENUPDATE_STATE);
        });
    });

    describe('#evaluationInterval', function () {

        // a track scaling the anim component entity from 1 to 3 over one second, with an event at
        // 0.4 seconds
        const scaleTrack = () => {
            const curve = new AnimCurve([{
                entityPath: ['root'],
                component: 'entity',
                propertyPath: ['localScale']
            }], 0, 0, INTERPOLATION_LINEAR);

            return new AnimTrack('Scale', 1, [new AnimData(1, [0, 1])], [new AnimData(3, [1, 1, 1, 3, 3, 3])],
                [curve], new AnimEvents([{ name: 'step', time: 0.4 }]));
        };

        const createAnimated = (data = {}) => {
            const root = new Entity('root', app);
            app.root.addChild(root);
            root.addComponent('anim', { activate: true, ...data });
            root.anim.assignAnimation('Scale', scaleTrack());

            const counter = { events: 0 };
            root.anim.on('step', () => counter.events++);
            return { root, counter };
        };

        it('defaults to evaluating the animation every frame', function () {
            const { root } = createAnimated();
            expect(root.anim.evaluationInterval).to.equal(1);
        });

        it('clamps the interval to a whole number of at least 1', function () {
            const { root } = createAnimated();

            root.anim.evaluationInterval = 0;
            expect(root.anim.evaluationInterval).to.equal(1);

            root.anim.evaluationInterval = 2.7;
            expect(root.anim.evaluationInterval).to.equal(2);

            root.anim.evaluationInterval = undefined;
            expect(root.anim.evaluationInterval).to.equal(1);
        });

        it('evaluates the animation once per interval, at the current animation time', function () {
            const { root } = createAnimated({ evaluationInterval: 3 });

            // over 6 updates of 0.1 seconds, the animation is evaluated twice
            let evaluated = 0;
            for (let i = 0; i < 6; i++) {
                app.systems.anim.onAnimationUpdate(0.1);
                evaluated += app.stats.frame.animEvaluated;
            }
            expect(evaluated).to.equal(2);

            // the animation was last evaluated within the last 3 updates, at a time of 0.4 to 0.6
            // seconds, which is a scale of 1.8 to 2.2
            const scale = root.getLocalScale().x;
            expect(scale).to.be.within(1.8 - 1e-5, 2.2 + 1e-5);
        });

        it('fires animation events on the frames the animation is not evaluated', function () {
            const { counter } = createAnimated({ evaluationInterval: 4 });

            for (let i = 0; i < 5; i++) {
                app.systems.anim.onAnimationUpdate(0.1);
            }

            expect(counter.events).to.equal(1);
        });

        it('counts the skipped evaluations in the stats', function () {
            createAnimated({ evaluationInterval: 2 });

            let evaluated = 0;
            let skipped = 0;
            for (let i = 0; i < 4; i++) {
                app.systems.anim.onAnimationUpdate(0.1);
                evaluated += app.stats.frame.animEvaluated;
                skipped += app.stats.frame.animIntervalSkipped;
            }

            expect(evaluated).to.equal(2);
            expect(skipped).to.equal(2);
        });

        it('evaluates the animation immediately when the anim component becomes visible', function () {
            const { root } = createAnimated({ offscreenUpdate: OFFSCREENUPDATE_STATE, evaluationInterval: 4 });

            // not visible
            app.systems.anim.onAnimationUpdate(0.5);
            expect(app.stats.frame.animOffscreen).to.equal(1);

            // visible again, the animation is evaluated in this frame, whatever the interval
            root.markDeformedRendered(app.graphicsDevice.renderVersion);
            app.systems.anim.onAnimationUpdate(0.25);

            expect(app.stats.frame.animEvaluated).to.equal(1);
            expect(root.getLocalScale().x).to.be.closeTo(2.5, 1e-5);
        });

        // the number of anim components evaluated in each of the given number of updates
        const evaluatedPerUpdate = (updates) => {
            const counts = [];
            for (let i = 0; i < updates; i++) {
                app.systems.anim.onAnimationUpdate(0.01);
                counts.push(app.stats.frame.animEvaluated);
            }
            return counts;
        };

        it('spreads the anim components with the same interval over its frames', function () {
            for (let i = 0; i < 16; i++) {
                createAnimated({ evaluationInterval: 4 });
            }

            expect(evaluatedPerUpdate(4)).to.deep.equal([4, 4, 4, 4]);
        });

        it('spreads each interval over its frames when intervals are mixed', function () {
            // alternating intervals 2 and 3, 16 anim components each
            for (let i = 0; i < 16; i++) {
                createAnimated({ evaluationInterval: 2 });
                createAnimated({ evaluationInterval: 3 });
            }

            // 8 of interval 2 and 5 or 6 of interval 3 in each update
            const counts = evaluatedPerUpdate(6);
            counts.forEach((count) => {
                expect(count).to.be.within(13, 14);
            });
        });

        it('keeps the anim components spread after they become visible together', function () {
            const roots = [];
            for (let i = 0; i < 16; i++) {
                roots.push(createAnimated({ offscreenUpdate: OFFSCREENUPDATE_STATE, evaluationInterval: 4 }).root);
            }

            // not visible for an update, then all visible again
            app.systems.anim.onAnimationUpdate(0.01);
            roots.forEach(root => root.markDeformedRendered(app.graphicsDevice.renderVersion));

            // all are evaluated when they become visible, and then spread over the frames again
            expect(evaluatedPerUpdate(5)).to.deep.equal([16, 4, 4, 4, 4]);
        });

        it('is kept when the entity is cloned', function () {
            const { root } = createAnimated({ evaluationInterval: 3 });

            const clone = root.clone();

            expect(clone.anim.evaluationInterval).to.equal(3);
        });
    });

    describe('applying values', function () {

        // a track scaling the anim component entity from 1 to 3 over one second
        const scaleTrack = () => {
            const curve = new AnimCurve([{
                entityPath: ['root'],
                component: 'entity',
                propertyPath: ['localScale']
            }], 0, 0, INTERPOLATION_LINEAR);

            return new AnimTrack('Scale', 1, [new AnimData(1, [0, 1])], [new AnimData(3, [1, 1, 1, 3, 3, 3])], [curve]);
        };

        it('applies a single layer at full weight', function () {
            const root = new Entity('root', app);
            app.root.addChild(root);
            root.addComponent('anim', { activate: true });
            root.anim.assignAnimation('Scale', scaleTrack());

            app.systems.anim.onAnimationUpdate(0.5);

            expect(root.getLocalScale().x).to.be.closeTo(2, 1e-5);
        });

        it('blends a single layer below full weight with the base value', function () {
            const root = new Entity('root', app);
            app.root.addChild(root);
            root.addComponent('anim', { activate: true });
            root.anim.assignAnimation('Scale', scaleTrack());
            root.anim.baseLayer.weight = 0.5;

            app.systems.anim.onAnimationUpdate(0.5);

            // halfway between the base scale of 1 and the animated scale of 2
            expect(root.getLocalScale().x).to.be.closeTo(1.5, 1e-5);
        });

        it('restores the values before the animation when the state graph is removed', function () {
            const root = new Entity('root', app);
            app.root.addChild(root);
            root.addComponent('anim', { activate: true });
            root.anim.assignAnimation('Scale', scaleTrack());

            app.systems.anim.onAnimationUpdate(0.5);
            expect(root.getLocalScale().x).to.be.closeTo(2, 1e-5);

            root.anim.removeStateGraph();
            expect(root.getLocalScale().x).to.be.closeTo(1, 1e-5);
        });

        it('uses a setter which replaces the setter of the graph node', function () {
            const root = new Entity('root', app);
            app.root.addChild(root);

            // a setter replaced the way an element component replaces the setters of its entity
            let calls = 0;
            root.setLocalScale = function (...args) {
                calls++;
                return GraphNode.prototype.setLocalScale.apply(this, args);
            };

            root.addComponent('anim', { activate: true });
            root.anim.assignAnimation('Scale', scaleTrack());
            app.systems.anim.onAnimationUpdate(0.5);

            expect(calls).to.be.above(0);
            expect(root.getLocalScale().x).to.be.closeTo(2, 1e-5);
        });
    });
});
