import { expect } from 'chai';

import { INTERPOLATION_LINEAR } from '../../../../src/framework/anim/constants.js';
import {
    ANIM_LAYER_ADDITIVE, ANIM_LAYER_OVERWRITE, OFFSCREENUPDATE_FULL, OFFSCREENUPDATE_NONE, OFFSCREENUPDATE_STATE
} from '../../../../src/framework/anim/controller/constants.js';
import { AnimCurve } from '../../../../src/framework/anim/evaluator/anim-curve.js';
import { AnimData } from '../../../../src/framework/anim/evaluator/anim-data.js';
import { AnimEvents } from '../../../../src/framework/anim/evaluator/anim-events.js';
import { AnimTrack } from '../../../../src/framework/anim/evaluator/anim-track.js';
import { Entity } from '../../../../src/framework/entity.js';
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
});
