import { createScript } from '../../src/framework/script/script-create.js';
import { Color } from '../../src/core/math/color.js';

import { AnimComponent } from '../../src/framework/components/anim/component.js';
import { AnimationComponent } from '../../src/framework/components/animation/component.js';
import { Application } from '../../src/framework/application.js';
import { AudioListenerComponent } from '../../src/framework/components/audio-listener/component.js';
import { ButtonComponent } from '../../src/framework/components/button/component.js';
import { CameraComponent } from '../../src/framework/components/camera/component.js';
import { CollisionComponent } from '../../src/framework/components/collision/component.js';
import { ElementComponent } from '../../src/framework/components/element/component.js';
import { Entity } from '../../src/framework/entity.js';
import { JointComponent } from '../../src/framework/components/joint/component.js';
import { LayoutChildComponent } from '../../src/framework/components/layout-child/component.js';
import { LayoutGroupComponent } from '../../src/framework/components/layout-group/component.js';
import { LightComponent } from '../../src/framework/components/light/component.js';
import { ModelComponent } from '../../src/framework/components/model/component.js';
import { ParticleSystemComponent } from '../../src/framework/components/particle-system/component.js';
import { RenderComponent } from '../../src/framework/components/render/component.js';
import { RigidBodyComponent } from '../../src/framework/components/rigid-body/component.js';
import { ScreenComponent } from '../../src/framework/components/screen/component.js';
import { ScriptComponent } from '../../src/framework/components/script/component.js';
import { ScrollbarComponent } from '../../src/framework/components/scrollbar/component.js';
import { ScrollViewComponent } from '../../src/framework/components/scroll-view/component.js';
import { SoundComponent } from '../../src/framework/components/sound/component.js';
import { SpriteComponent } from '../../src/framework/components/sprite/component.js';
import { ZoneComponent } from '../../src/framework/components/zone/component.js';
import { NullGraphicsDevice } from '../../src/platform/graphics/null/null-graphics-device.js';

import { DummyComponentSystem } from './test-component/system.mjs';

import { HTMLCanvasElement } from '@playcanvas/canvas-mock';

import { expect } from 'chai';
import { stub } from 'sinon';

describe('Entity', function () {

    let app;

    beforeEach(function () {
        const canvas = new HTMLCanvasElement(500, 500);
        app = new Application(canvas, { graphicsDevice: new NullGraphicsDevice(canvas) });

        app.systems.add(new DummyComponentSystem(app));
    });

    afterEach(function () {
        app.destroy();
    });

    const components = {
        anim: AnimComponent,
        animation: AnimationComponent,
        audiolistener: AudioListenerComponent,
        button: ButtonComponent,
        camera: CameraComponent,
        collision: CollisionComponent,
        element: ElementComponent,
        joint: JointComponent,
        layoutchild: LayoutChildComponent,
        layoutgroup: LayoutGroupComponent,
        light: LightComponent,
        model: ModelComponent,
        particlesystem: ParticleSystemComponent,
        render: RenderComponent,
        rigidbody: RigidBodyComponent,
        screen: ScreenComponent,
        scrollview: ScrollViewComponent,
        scrollbar: ScrollbarComponent,
        script: ScriptComponent,
        sound: SoundComponent,
        sprite: SpriteComponent,
        zone: ZoneComponent
    };

    describe('#constructor', function () {

        it('supports zero arguments', function () {
            const entity = new Entity();
            expect(entity).to.be.an.instanceof(Entity);
            expect(entity.name).to.equal('Untitled');
        });

        it('supports one argument', function () {
            const entity = new Entity('Test');
            expect(entity).to.be.an.instanceof(Entity);
            expect(entity.name).to.equal('Test');
        });

        it('supports two arguments', function () {
            const entity = new Entity('Test', app);
            expect(entity).to.be.an.instanceof(Entity);
            expect(entity.name).to.equal('Test');
        });

    });

    describe('#addComponent', function () {

        for (const name in components) {
            it(`adds a ${name} component`, function () {
                // Create an entity and verify that it does not already have the component
                const entity = new Entity();
                expect(entity[name]).to.be.undefined;

                // Add the component
                let component = entity.addComponent(name);
                expect(component).to.be.an.instanceof(components[name]);
                expect(component).to.equal(entity[name]);
                expect(entity[name]).to.be.an.instanceof(components[name]);

                // Try to add the component again
                component = entity.addComponent(name);
                expect(component).to.be.null;
                expect(entity[name]).to.be.an.instanceof(components[name]);

                // Remove the component and destroy the entity
                entity.removeComponent(name);
                expect(entity[name]).to.be.undefined;
                entity.destroy();
            });
        }

        it('respects components order on disable', function () {
            const entity = new Entity();
            entity.enabled = true;

            entity.addComponent('collision');
            entity.addComponent('rigidbody');

            const colOnDisable = stub();
            const rbOnDisable = stub();
            let disableOrder = 0;

            entity.collision.onDisable = colOnDisable;
            entity.rigidbody.onDisable = rbOnDisable;

            colOnDisable.onFirstCall().callsFake(() => {
                disableOrder = 2;
            });
            rbOnDisable.onFirstCall().callsFake(() => {
                disableOrder = 1;
            });

            entity.enabled = false;

            expect(disableOrder).to.equal(2);

            entity.destroy();
        });

        it('respects components order on enable', function () {
            const entity = new Entity('Child');
            const parent = new Entity('Parent');

            parent.addChild(entity);
            parent._enabled = true;
            parent._enabledInHierarchy = true;

            entity.addComponent('collision');
            entity.addComponent('rigidbody');

            entity.enabled = false;

            const rbOnEnable = stub();
            const colOnEnable = stub();
            let enableOrder = 0;

            entity.collision.onEnable = colOnEnable;
            entity.rigidbody.onEnable = rbOnEnable;

            colOnEnable.onFirstCall().callsFake(() => {
                enableOrder = 2;
            });
            rbOnEnable.onFirstCall().callsFake(() => {
                enableOrder = 1;
            });

            entity.enabled = true;

            expect(enableOrder).to.equal(2);

            parent.destroy();
        });

    });

    const createSubtree = () => {
        // Naming indicates path within the tree, with underscores separating levels.
        const a = new Entity('a', app);
        const a_a = new Entity('a_a', app);
        const a_b = new Entity('a_b', app);
        const a_a_a = new Entity('a_a_a', app);
        const a_a_b = new Entity('a_a_b', app);

        a.addChild(a_a);
        a.addChild(a_b);

        a_a.addChild(a_a_a);
        a_a.addChild(a_a_b);

        // Add some components for testing clone behaviour
        a.addComponent('animation', { speed: 0.9, loop: true });
        a.addComponent('camera', { nearClip: 2, farClip: 3 });
        a_a.addComponent('rigidbody', { type: 'static' });
        a_a.addComponent('collision', { type: 'sphere', radius: 4 });
        a_a_b.addComponent('light', { type: 'point', color: Color.YELLOW, intensity: 0.5 });
        a_a_b.addComponent('sound', { volume: 0.5, pitch: 0.75 });

        return {
            a: a,
            a_a: a_a,
            a_b: a_b,
            a_a_a: a_a_a,
            a_a_b: a_a_b
        };
    };

    const cloneSubtree = (subtree) => {
        const a = subtree.a.clone();
        const a_a = a.children[0];
        const a_b = a.children[1];
        const a_a_a = a_a.children[0];
        const a_a_b = a_a.children[1];

        return {
            a: a,
            a_a: a_a,
            a_b: a_b,
            a_a_a: a_a_a,
            a_a_b: a_a_b
        };
    };

    describe('#clone', function () {

        it('clones an entity', function () {
            const entity = new Entity('Test');
            for (const name in components) {
                entity.addComponent(name);
            }

            const clone = entity.clone();
            expect(clone).to.be.an.instanceof(Entity);
            expect(clone.getGuid()).to.not.equal(entity.getGuid());
            expect(clone.name).to.equal('Test');
            for (const name in components) {
                expect(clone[name]).to.be.an.instanceof(components[name]);
            }
        });

        it('clones an entity hierarchy', function () {
            const root = new Entity('Test');
            const child = new Entity('Child');
            root.addChild(child);
            for (const name in components) {
                root.addComponent(name);
                child.addComponent(name);
            }

            const clone = root.clone();
            expect(clone).to.be.an.instanceof(Entity);
            expect(clone.getGuid()).to.not.equal(root.getGuid());
            expect(clone.name).to.equal('Test');
            for (const name in components) {
                expect(clone[name]).to.be.an.instanceof(components[name]);
            }
            expect(clone.children.length).to.equal(root.children.length);

            const cloneChild = clone.findByName('Child');
            expect(cloneChild.getGuid()).to.not.equal(child.getGuid());
            for (const name in components) {
                expect(cloneChild[name]).to.be.an.instanceof(components[name]);
            }

            root.destroy();
        });

        it('returns a deep clone of the entity\'s subtree, including all components', function () {
            const subtree1 = createSubtree();
            const subtree2 = cloneSubtree(subtree1);

            // Ensure structures are identical at every level
            expect(subtree2.a.name).to.equal('a');
            expect(subtree2.a.animation.speed).to.equal(0.9);
            expect(subtree2.a.animation.loop).to.equal(true);
            expect(subtree2.a.camera.nearClip).to.equal(2);
            expect(subtree2.a.camera.farClip).to.equal(3);

            expect(subtree2.a_a.name).to.equal('a_a');
            expect(subtree2.a_a.collision.radius).to.equal(4);
            expect(subtree2.a_a.collision.type).to.equal('sphere');
            expect(subtree2.a_a.rigidbody.type).to.equal('static');

            expect(subtree2.a_a_b.name).to.equal('a_a_b');
            expect(subtree2.a_a_b.light.intensity).to.equal(0.5);
            expect(subtree2.a_a_b.light.type).to.equal('point');
            expect(subtree2.a_a_b.light.color.equals(Color.YELLOW)).to.be.true;
            expect(subtree2.a_a_b.sound.pitch).to.equal(0.75);
            expect(subtree2.a_a_b.sound.volume).to.equal(0.5);

            expect(subtree2.a_b.name).to.equal('a_b');

            expect(subtree2.a_a_a.name).to.equal('a_a_a');

            // Ensure we only have the exact number of children that were expected
            expect(subtree2.a.children.length).to.equal(2);
            expect(subtree2.a_a.children.length).to.equal(2);
            expect(subtree2.a_b.children.length).to.equal(0);
            expect(subtree2.a_a_a.children.length).to.equal(0);
            expect(subtree2.a_a_b.children.length).to.equal(0);

            // Ensure copies were created, not references
            expect(subtree1.a).to.not.equal(subtree2.a);
            expect(subtree1.a.animation).to.not.equal(subtree2.a.animation);
            expect(subtree1.a.camera).to.not.equal(subtree2.a.camera);
            expect(subtree1.a_a).to.not.equal(subtree2.a_a);
            expect(subtree1.a_a.collision).to.not.equal(subtree2.a_a.collision);
            expect(subtree1.a_a.rigidbody).to.not.equal(subtree2.a_a.rigidbody);
            expect(subtree1.a_b).to.not.equal(subtree2.a_b);
            expect(subtree1.a_a_a).to.not.equal(subtree2.a_a_a);
            expect(subtree1.a_a_b).to.not.equal(subtree2.a_a_b);
            expect(subtree1.a_a_b.light).to.not.equal(subtree2.a_a_b.light);
            expect(subtree1.a_a_b.sound).to.not.equal(subtree2.a_a_b.sound);

            // Ensure new guids were created
            expect(subtree1.a.getGuid()).to.not.equal(subtree2.a.getGuid());
            expect(subtree1.a_a.getGuid()).to.not.equal(subtree2.a_a.getGuid());
            expect(subtree1.a_b.getGuid()).to.not.equal(subtree2.a_b.getGuid());
            expect(subtree1.a_a_a.getGuid()).to.not.equal(subtree2.a_a_a.getGuid());
            expect(subtree1.a_a_b.getGuid()).to.not.equal(subtree2.a_a_b.getGuid());
        });

        it('resolves entity property references that refer to entities within the duplicated subtree', function () {
            const subtree1 = createSubtree();
            subtree1.a.addComponent('dummy', { myEntity1: subtree1.a_a.getGuid(), myEntity2: subtree1.a_a_b.getGuid() });
            subtree1.a_a_a.addComponent('dummy', { myEntity1: subtree1.a.getGuid(), myEntity2: subtree1.a_b.getGuid() });

            const subtree2 = cloneSubtree(subtree1);
            expect(subtree2.a.dummy.myEntity1).to.equal(subtree2.a_a.getGuid());
            expect(subtree2.a.dummy.myEntity2).to.equal(subtree2.a_a_b.getGuid());
            expect(subtree2.a_a_a.dummy.myEntity1).to.equal(subtree2.a.getGuid());
            expect(subtree2.a_a_a.dummy.myEntity2).to.equal(subtree2.a_b.getGuid());
        });

        it('resolves entity property references that refer to the cloned entity itself', function () {
            const subtree1 = createSubtree();
            subtree1.a.addComponent('dummy', { myEntity1: subtree1.a.getGuid() });
            subtree1.a_a_a.addComponent('dummy', { myEntity1: subtree1.a_a_a.getGuid() });

            const subtree2 = cloneSubtree(subtree1);
            expect(subtree2.a.dummy.myEntity1).to.equal(subtree2.a.getGuid());
            expect(subtree2.a_a_a.dummy.myEntity1).to.equal(subtree2.a_a_a.getGuid());
        });

        it('does not attempt to resolve entity property references that refer to entities outside of the duplicated subtree', function () {
            const root = new Entity('root', app);
            const sibling = new Entity('sibling', app);

            const subtree1 = createSubtree();
            root.addChild(subtree1.a);
            root.addChild(sibling);

            subtree1.a.addComponent('dummy', { myEntity1: root.getGuid(), myEntity2: sibling.getGuid() });

            const subtree2 = cloneSubtree(subtree1);
            expect(subtree2.a.dummy.myEntity1).to.equal(root.getGuid());
            expect(subtree2.a.dummy.myEntity2).to.equal(sibling.getGuid());
        });

        it('ignores null and undefined entity property references', function () {
            const subtree1 = createSubtree();
            subtree1.a.addComponent('dummy', { myEntity1: null, myEntity2: undefined });

            const subtree2 = cloneSubtree(subtree1);
            expect(subtree2.a.dummy.myEntity1).to.be.null;
            expect(subtree2.a.dummy.myEntity2).to.be.undefined;
        });

        it('resolves entity script attributes that refer to entities within the duplicated subtree', function () {
            const TestScript = createScript('test');
            TestScript.attributes.add('entityAttr', { type: 'entity' });
            TestScript.attributes.add('entityArrayAttr', { type: 'entity', array: true });

            const subtree1 = createSubtree();
            app.root.addChild(subtree1.a);
            subtree1.a.addComponent('script');
            subtree1.a.script.create('test', {
                attributes: {
                    entityAttr: subtree1.a_a.getGuid(),
                    entityArrayAttr: [subtree1.a_a.getGuid()]
                }
            });
            expect(subtree1.a.script.test.entityAttr.getGuid()).to.equal(subtree1.a_a.getGuid());
            expect(subtree1.a.script.test.entityArrayAttr).to.be.an('array');
            expect(subtree1.a.script.test.entityArrayAttr.length).to.equal(1);
            expect(subtree1.a.script.test.entityArrayAttr[0].getGuid()).to.equal(subtree1.a_a.getGuid());

            subtree1.a_a.addComponent('script');
            subtree1.a_a.script.create('test', {
                attributes: {
                    entityAttr: subtree1.a.getGuid(),
                    entityArrayAttr: [subtree1.a.getGuid(), subtree1.a_a_a.getGuid()]
                }
            });

            expect(subtree1.a_a.script.test.entityAttr.getGuid()).to.equal(subtree1.a.getGuid());
            expect(subtree1.a_a.script.test.entityArrayAttr).to.be.an('array');
            expect(subtree1.a_a.script.test.entityArrayAttr.length).to.equal(2);
            expect(subtree1.a_a.script.test.entityArrayAttr[0].getGuid()).to.equal(subtree1.a.getGuid());
            expect(subtree1.a_a.script.test.entityArrayAttr[1].getGuid()).to.equal(subtree1.a_a_a.getGuid());

            const subtree2 = cloneSubtree(subtree1);
            app.root.addChild(subtree2.a);
            expect(subtree2.a.script.test.entityAttr.getGuid()).to.equal(subtree2.a_a.getGuid());
            expect(subtree2.a.script.test.entityArrayAttr).to.be.an('array');
            expect(subtree2.a.script.test.entityArrayAttr.length).to.equal(1);
            expect(subtree2.a.script.test.entityArrayAttr[0].getGuid()).to.equal(subtree2.a_a.getGuid());

            expect(subtree2.a_a.script.test.entityAttr.getGuid()).to.equal(subtree2.a.getGuid());
            expect(subtree2.a_a.script.test.entityArrayAttr).to.be.an('array');
            expect(subtree2.a_a.script.test.entityArrayAttr.length).to.equal(2);
            expect(subtree2.a_a.script.test.entityArrayAttr[0].getGuid()).to.equal(subtree2.a.getGuid());
            expect(subtree2.a_a.script.test.entityArrayAttr[1].getGuid()).to.equal(subtree2.a_a_a.getGuid());
        });

        it('resolves entity script attributes that refer to entities within the duplicated subtree after preloading has finished', function () {
            const TestScript = createScript('test');
            TestScript.attributes.add('entityAttr', { type: 'entity' });
            TestScript.attributes.add('entityArrayAttr', { type: 'entity', array: true });

            app.systems.script.preloading = false;

            const subtree1 = createSubtree();
            app.root.addChild(subtree1.a);
            subtree1.a.addComponent('script');
            subtree1.a.script.create('test', {
                attributes: {
                    entityAttr: subtree1.a_a.getGuid(),
                    entityArrayAttr: [subtree1.a_a.getGuid()]
                }
            });
            expect(subtree1.a.script.test.entityAttr.getGuid()).to.equal(subtree1.a_a.getGuid());
            expect(subtree1.a.script.test.entityArrayAttr).to.be.an('array');
            expect(subtree1.a.script.test.entityArrayAttr.length).to.equal(1);
            expect(subtree1.a.script.test.entityArrayAttr[0].getGuid()).to.equal(subtree1.a_a.getGuid());

            subtree1.a_a.addComponent('script');
            subtree1.a_a.script.create('test', {
                attributes: {
                    entityAttr: subtree1.a.getGuid(),
                    entityArrayAttr: [subtree1.a.getGuid(), subtree1.a_a_a.getGuid()]
                }
            });

            expect(subtree1.a_a.script.test.entityAttr.getGuid()).to.equal(subtree1.a.getGuid());
            expect(subtree1.a_a.script.test.entityArrayAttr).to.be.an('array');
            expect(subtree1.a_a.script.test.entityArrayAttr.length).to.equal(2);
            expect(subtree1.a_a.script.test.entityArrayAttr[0].getGuid()).to.equal(subtree1.a.getGuid());
            expect(subtree1.a_a.script.test.entityArrayAttr[1].getGuid()).to.equal(subtree1.a_a_a.getGuid());


            const subtree2 = cloneSubtree(subtree1);
            app.root.addChild(subtree2.a);
            expect(subtree2.a.script.test.entityAttr.getGuid()).to.equal(subtree2.a_a.getGuid());
            expect(subtree2.a.script.test.entityArrayAttr).to.be.an('array');
            expect(subtree2.a.script.test.entityArrayAttr.length).to.equal(1);
            expect(subtree2.a.script.test.entityArrayAttr[0].getGuid()).to.equal(subtree2.a_a.getGuid());

            expect(subtree2.a_a.script.test.entityAttr.getGuid()).to.equal(subtree2.a.getGuid());
            expect(subtree2.a_a.script.test.entityArrayAttr).to.be.an('array');
            expect(subtree2.a_a.script.test.entityArrayAttr.length).to.equal(2);
            expect(subtree2.a_a.script.test.entityArrayAttr[0].getGuid()).to.equal(subtree2.a.getGuid());
            expect(subtree2.a_a.script.test.entityArrayAttr[1].getGuid()).to.equal(subtree2.a_a_a.getGuid());
        });

        it('does not attempt to resolve entity script attributes that refer to entities outside of the duplicated subtree', function () {
            const TestScript = createScript('test');
            TestScript.attributes.add('entityAttr', { type: 'entity' });
            TestScript.attributes.add('entityArrayAttr', { type: 'entity', array: true });

            const subtree1 = createSubtree();
            app.root.addChild(subtree1.a);

            subtree1.a_a.addComponent('script');
            subtree1.a_a.script.create('test', {
                attributes: {
                    entityAttr: app.root.getGuid(),
                    entityArrayAttr: [subtree1.a.getGuid(), app.root.getGuid()]
                }
            });

            expect(subtree1.a_a.script.test.entityAttr.getGuid()).to.equal(app.root.getGuid());
            expect(subtree1.a_a.script.test.entityArrayAttr).to.be.an('array');
            expect(subtree1.a_a.script.test.entityArrayAttr.length).to.equal(2);
            expect(subtree1.a_a.script.test.entityArrayAttr[0].getGuid()).to.equal(subtree1.a.getGuid());
            expect(subtree1.a_a.script.test.entityArrayAttr[1].getGuid()).to.equal(app.root.getGuid());

            const subtree2 = cloneSubtree(subtree1);
            app.root.addChild(subtree2.a);
            expect(subtree2.a_a.script.test.entityAttr.getGuid()).to.equal(app.root.getGuid());
            expect(subtree2.a_a.script.test.entityArrayAttr).to.be.an('array');
            expect(subtree2.a_a.script.test.entityArrayAttr.length).to.equal(2);
            expect(subtree2.a_a.script.test.entityArrayAttr[0].getGuid()).to.equal(subtree2.a.getGuid());
            expect(subtree2.a_a.script.test.entityArrayAttr[1].getGuid()).to.equal(app.root.getGuid());
        });

        it('ensures that an instance of a subclass keeps its class prototype', function () {
            class UserEntity extends Entity {}
            const a = new UserEntity();
            const b = a.clone();
            expect(b).to.be.an.instanceof(UserEntity);
        });
    });

    describe('#destroy', function () {

        it('destroys the entity', function () {
            const entity = new Entity();

            let destroyed = false;
            entity.on('destroy', function () {
                destroyed = true;
            });
            entity.destroy();

            expect(destroyed).to.be.true;
        });

    });

    describe('#findByGuid', function () {

        it('returns same entity', function () {
            const e = new Entity();
            expect(e.findByGuid(e.getGuid())).to.equal(e);
        });

        it('returns direct child entity', function () {
            const e = new Entity();
            const c = new Entity();
            e.addChild(c);
            expect(e.findByGuid(c.getGuid())).to.equal(c);
        });

        it('returns child of child entity', function () {
            const e = new Entity();
            const c = new Entity();
            const c2 = new Entity();
            e.addChild(c);
            c.addChild(c2);
            expect(e.findByGuid(c2.getGuid())).to.equal(c2);
        });

        it('does not return parent', function () {
            const e = new Entity();
            const c = new Entity();
            e.addChild(c);
            expect(c.findByGuid(e.getGuid())).to.equal(null);
        });

        it('does not return destroyed entity', function () {
            const e = new Entity();
            const c = new Entity();
            e.addChild(c);
            c.destroy();
            expect(e.findByGuid(c.getGuid())).to.equal(null);
        });

        it('does not return entity that was removed from hierarchy', function () {
            const e = new Entity();
            const c = new Entity();
            e.addChild(c);
            e.removeChild(c);
            expect(e.findByGuid(c.getGuid())).to.equal(null);
        });

        it('does not return entity that does not exist', function () {
            expect(app.root.findByGuid('missing')).to.equal(null);
        });

    });

    describe('#findComponent', function () {

        it('finds component on single entity', function () {
            const e = new Entity();
            e.addComponent('anim');
            const component = e.findComponent('anim');
            expect(component).to.be.an.instanceof(AnimComponent);
        });

        it('returns null when component is not found', function () {
            const e = new Entity();
            e.addComponent('anim');
            const component = e.findComponent('render');
            expect(component).to.be.null;
        });

        it('finds component on child entity', function () {
            const root = new Entity();
            const child = new Entity();
            root.addChild(child);
            child.addComponent('anim');
            const component = root.findComponent('anim');
            expect(component).to.be.an.instanceof(AnimComponent);
        });

        it('finds component on grandchild entity', function () {
            const root = new Entity();
            const child = new Entity();
            const grandchild = new Entity();
            root.addChild(child);
            child.addChild(grandchild);
            grandchild.addComponent('anim');
            const component = root.findComponent('anim');
            expect(component).to.be.an.instanceof(AnimComponent);
        });

        it('does not find component on parent entity', function () {
            const root = new Entity();
            const child = new Entity();
            root.addChild(child);
            root.addComponent('anim');
            const component = child.findComponent('anim');
            expect(component).to.be.null;
        });

    });

    describe('#findComponents', function () {

        it('finds components on single entity', function () {
            const e = new Entity();
            e.addComponent('anim');
            const components = e.findComponents('anim');
            expect(components).to.be.an('array');
            expect(components.length).to.equal(1);
            expect(components[0]).to.be.an.instanceof(AnimComponent);
        });

        it('returns empty array when no components are found', function () {
            const e = new Entity();
            e.addComponent('anim');
            const components = e.findComponents('render');
            expect(components).to.be.an('array');
            expect(components.length).to.equal(0);
        });

        it('finds components on child entity', function () {
            const root = new Entity();
            const child = new Entity();
            root.addChild(child);
            child.addComponent('anim');
            const components = root.findComponents('anim');
            expect(components).to.be.an('array');
            expect(components.length).to.equal(1);
            expect(components[0]).to.be.an.instanceof(AnimComponent);
        });

        it('finds components on 3 entity hierarchy', function () {
            const root = new Entity();
            const child = new Entity();
            const grandchild = new Entity();
            root.addChild(child);
            child.addChild(grandchild);
            root.addComponent('anim');
            child.addComponent('anim');
            grandchild.addComponent('anim');
            const components = root.findComponents('anim');
            expect(components).to.be.an('array');
            expect(components.length).to.equal(3);
            expect(components[0]).to.be.an.instanceof(AnimComponent);
            expect(components[1]).to.be.an.instanceof(AnimComponent);
            expect(components[2]).to.be.an.instanceof(AnimComponent);
        });

        it('does not find components on parent entity', function () {
            const root = new Entity();
            const child = new Entity();
            root.addChild(child);
            root.addComponent('anim');
            const components = child.findComponents('anim');
            expect(components).to.be.an('array');
            expect(components.length).to.equal(0);
        });

    });

    describe('#findScript', function () {

        it('finds script on single entity', function () {
            const MyScript = createScript('myScript');
            const e = new Entity();
            e.addComponent('script');
            e.script.create('myScript');
            const script = e.findScript('myScript');
            expect(script).to.be.an.instanceof(MyScript);
        });

        it('returns undefined when script is not found', function () {
            const root = new Entity();
            const child = new Entity();
            root.addChild(child);
            child.addComponent('script');
            const script = root.findScript('myScript');
            expect(script).to.be.undefined;
        });

        it('returns undefined when script component is not found', function () {
            const root = new Entity();
            const child = new Entity();
            root.addChild(child);
            const script = root.findScript('myScript');
            expect(script).to.be.undefined;
        });

        it('finds script on child entity', function () {
            const MyScript = createScript('myScript');
            const root = new Entity();
            const child = new Entity();
            root.addChild(child);
            child.addComponent('script');
            child.script.create('myScript');
            const script = root.findScript('myScript');
            expect(script).to.be.an.instanceof(MyScript);
        });

        it('finds script on grandchild entity', function () {
            const MyScript = createScript('myScript');
            const root = new Entity();
            const child = new Entity();
            const grandchild = new Entity();
            root.addChild(child);
            child.addChild(grandchild);
            grandchild.addComponent('script');
            grandchild.script.create('myScript');
            const script = root.findScript('myScript');
            expect(script).to.be.an.instanceof(MyScript);
        });

        it('does not find script on parent entity', function () {
            createScript('myScript');
            const root = new Entity();
            const child = new Entity();
            root.addChild(child);
            root.addComponent('script');
            root.script.create('myScript');
            const script = child.findScript('myScript');
            expect(script).to.be.undefined;
        });

    });

    describe('#findScripts', function () {

        it('finds scripts on single entity', function () {
            const MyScript = createScript('myScript');
            const e = new Entity();
            e.addComponent('script');
            e.script.create('myScript');
            const scripts = e.findScripts('myScript');
            expect(scripts).to.be.an('array');
            expect(scripts.length).to.equal(1);
            expect(scripts[0]).to.be.an.instanceof(MyScript);
        });

        it('returns empty array when no scripts are found', function () {
            const root = new Entity();
            const child = new Entity();
            root.addChild(child);
            child.addComponent('script');
            const scripts = root.findScripts('myScript');
            expect(scripts).to.be.an('array');
            expect(scripts.length).to.equal(0);
        });

        it('returns empty array when no script component are found', function () {
            const root = new Entity();
            const child = new Entity();
            root.addChild(child);
            const scripts = root.findScripts('myScript');
            expect(scripts).to.be.an('array');
            expect(scripts.length).to.equal(0);
        });

        it('finds scripts on child entity', function () {
            const MyScript = createScript('myScript');
            const root = new Entity();
            const child = new Entity();
            root.addChild(child);
            child.addComponent('script');
            child.script.create('myScript');
            const scripts = root.findScripts('myScript');
            expect(scripts).to.be.an('array');
            expect(scripts.length).to.equal(1);
            expect(scripts[0]).to.be.an.instanceof(MyScript);
        });

        it('finds scripts on 3 entity hierarchy', function () {
            const MyScript = createScript('myScript');
            const root = new Entity();
            const child = new Entity();
            const grandchild = new Entity();
            root.addChild(child);
            child.addChild(grandchild);
            root.addComponent('script');
            root.script.create('myScript');
            child.addComponent('script');
            child.script.create('myScript');
            grandchild.addComponent('script');
            grandchild.script.create('myScript');
            const scripts = root.findScripts('myScript');
            expect(scripts).to.be.an('array');
            expect(scripts.length).to.equal(3);
            expect(scripts[0]).to.be.an.instanceof(MyScript);
            expect(scripts[1]).to.be.an.instanceof(MyScript);
            expect(scripts[2]).to.be.an.instanceof(MyScript);
        });

        it('does not find scripts on parent entity', function () {
            createScript('myScript');
            const root = new Entity();
            const child = new Entity();
            root.addChild(child);
            root.addComponent('script');
            root.script.create('myScript');
            const scripts = child.findScripts('myScript');
            expect(scripts).to.be.an('array');
            expect(scripts.length).to.equal(0);
        });

    });

    describe('#removeComponent', function () {

        it('removes a component from the entity', function () {
            const entity = new Entity();
            expect(entity.anim).to.be.undefined;
            entity.addComponent('anim');
            expect(entity.anim).to.be.an.instanceof(AnimComponent);
            entity.removeComponent('anim');
            expect(entity.anim).to.be.undefined;
            entity.destroy();
        });

    });

});
