import { Application } from '../../../../src/framework/application.js';
import { Debug } from '../../../../src/core/debug.js';
import { Entity } from '../../../../src/framework/entity.js';
import { Color } from '../../../../src/core/math/color.js';
import { createGraphicsDevice } from '../../../../src/platform/graphics/graphics-device-create.js';
import sceneData from '../../../test-assets/esm-scripts/scene1.json' assert { type: 'json' };
import { DEVICETYPE_WEBGL2 } from '../../../../src/platform/graphics/constants.js';

import { HTMLCanvasElement } from '@playcanvas/canvas-mock';
import { expect } from 'chai';
import { reset, calls, expectCall, INITIALIZE, waitForNextFrame, ACTIVE, UPDATE, POST_UPDATE } from './method-util.mjs';
import createOptions from './basic-app-options.mjs';

describe('EsmScriptComponent', function (done) {
    let app;

    beforeEach(async function () {

         // Override the debug to remove console mess
        Debug.warn = warning => null;

        reset();
        const canvas = new HTMLCanvasElement(500, 500);
        app = new Application(canvas);

        const handler = app.loader.getHandler('scene');

        const gfxOpts = { deviceTypes: [DEVICETYPE_WEBGL2] };
        createOptions.graphicsDevice = await createGraphicsDevice(canvas, gfxOpts);
        app.init(createOptions);

        const scene = handler.open(null, sceneData);
        app.root.addChild(scene.root);
        app.start();

    });

    afterEach(function () {
        app.destroy();
    });

    describe('#initialize', function () {

        it('expects `entity` and `app` to be set on a new ESM Script', async function () {

            const e = new Entity();
            const component = e.addComponent('esmscript');
            await component.system.initializeComponentData(component, {
                enabled: true,
                modules: [{
                    enabled: true,
                    moduleSpecifier: '../../../test/test-assets/esm-scripts/esm-scriptA.mjs'
                }]
            });

            app.root.addChild(e);

            const script = component.get('ScriptA');

            expect(script).to.exist;
            expect(script.entity).to.equal(e);
            expect(script.app).to.equal(component.system.app);

        });

        it('expects `initialize` to be called on a new ESM Script', async function () {

            const e = new Entity();
            const component = e.addComponent('esmscript');
            await component.system.initializeComponentData(component, {
                enabled: true,
                modules: [{
                    enabled: true,
                    moduleSpecifier: '../../../test/test-assets/esm-scripts/esm-scriptA.mjs'
                }]
            });

            app.root.addChild(e);
            expect(e.esmscript).to.exist;

            const script = e.esmscript.get('ScriptA');
            expect(script).to.exist;

            expect(calls.length).to.equal(1);
            expectCall(0, INITIALIZE(script));

        });

        it('expects `initialize` to be called on an entity that is enabled later', async function () {

            const e = new Entity();
            e.enabled = false;
            const component = e.addComponent('esmscript');
            await component.system.initializeComponentData(component, {
                enabled: true,
                modules: [{
                    enabled: true,
                    moduleSpecifier: '../../../test/test-assets/esm-scripts/esm-scriptA.mjs'
                }]
            });

            app.root.addChild(e);
            expect(e.esmscript).to.exist;

            const script = e.esmscript.get('ScriptA');
            expect(script).to.exist;

            e.enabled = true;

            expectCall(0, INITIALIZE(script));

        });

        it('expects `initialize()` to be called on a component that is enabled later', async function () {
            const e = new Entity();
            const component = e.addComponent('esmscript');
            await component.system.initializeComponentData(component, {
                enabled: false,
                modules: [{
                    enabled: true,
                    moduleSpecifier: '../../../test/test-assets/esm-scripts/esm-scriptA.mjs'
                }]
            });

            app.root.addChild(e);

            const script = e.esmscript.get('ScriptA');
            expect(script).to.exist;

            expect(calls).to.have.a.lengthOf(0);

            e.esmscript.enabled = true;

            expectCall(0, INITIALIZE(script));

        });

        it('expects `initialize` to be called on an ESM Script that is enabled later', async function () {
            const e = new Entity();
            const component = e.addComponent('esmscript');
            await component.system.initializeComponentData(component, {
                enabled: true,
                modules: [{
                    enabled: false,
                    moduleSpecifier: '../../../test/test-assets/esm-scripts/esm-scriptA.mjs'
                }]
            });

            app.root.addChild(e);

            // module is not active
            expect(calls).to.have.a.lengthOf(0);

            const script = e.esmscript.get('ScriptA');

            e.esmscript.enableModule(script);

            // Node doesn't have `requestAnimationFrame` so manually trigger a tick
            app.update(16.6);

            expect(e.esmscript.isModuleEnabled(script)).to.be.true;
            expectCall(0, INITIALIZE(script));
            expectCall(1, ACTIVE(script));
            expectCall(2, UPDATE(script));
            expectCall(3, POST_UPDATE(script));
        });
    });


    it('expects `initialize`, `active`, `update` and `postUpdate` to be called on a script instance that is created later', async function () {
        const e = new Entity();
        app.root.addChild(e);
        e.addComponent('esmscript');
        const ScriptA = await import('../../../test-assets/esm-scripts/esm-scriptA.mjs');
        e.esmscript.add(ScriptA);

        const script = e.esmscript.get('ScriptA');

        // Node doesn't have `requestAnimationFrame` so manually trigger a tick
        app.update(16.6);

        expectCall(0, INITIALIZE(script));
        expectCall(1, ACTIVE(script));
        expectCall(2, UPDATE(script));
        expectCall(3, POST_UPDATE(script));
    });

    it('expects `initialize`, `active`, `update` and `postUpdate` to be called on cloned enabled entity', async function () {
        const e = new Entity();
        const component = e.addComponent('esmscript');
        await component.system.initializeComponentData(component, {
            enabled: true,
            modules: [{
                moduleSpecifier: '../../../test/test-assets/esm-scripts/esm-scriptA.mjs',
                enabled: true,
                attributes: {}
            }, {
                moduleSpecifier: '../../../test/test-assets/esm-scripts/esm-scriptB.mjs',
                enabled: true,
                attributes: {}
            }]
        });

        app.root.addChild(e);

        const ScriptA = e.esmscript.get('ScriptA');
        const ScriptB = e.esmscript.get('ScriptB');

        let n = 0;
        expectCall(n++, INITIALIZE(ScriptA));
        expectCall(n++, INITIALIZE(ScriptB));

        // Node doesn't have `requestAnimationFrame` so manually trigger a tick
        app.update(16.6);

        expectCall(n++, ACTIVE(ScriptA));
        expectCall(n++, ACTIVE(ScriptB));

        expectCall(n++, UPDATE(ScriptA));
        expectCall(n++, UPDATE(ScriptB));

        expectCall(n++, POST_UPDATE(ScriptA));
        expectCall(n++, POST_UPDATE(ScriptB));

        // reset calls
        reset();

        const clone = e.clone();
        app.root.addChild(clone);

        // clone is initialized
        const cloneScriptA = clone.esmscript.get('ScriptA');
        const cloneScriptB = clone.esmscript.get('ScriptB');

        n = 0;
        expectCall(n++, INITIALIZE(cloneScriptA));
        expectCall(n++, INITIALIZE(cloneScriptB));

        // Node doesn't have `requestAnimationFrame` so manually trigger a tick
        app.update(16.6);

        // The clone becomes active in the next game step
        expectCall(n++, ACTIVE(cloneScriptA));
        expectCall(n++, ACTIVE(cloneScriptB));

        // existing scripts then clones updated
        expectCall(n++, UPDATE(ScriptA));
        expectCall(n++, UPDATE(ScriptB));
        expectCall(n++, UPDATE(cloneScriptA));
        expectCall(n++, UPDATE(cloneScriptB));

        // existing scripts then clones post-updated
        expectCall(n++, POST_UPDATE(ScriptA));
        expectCall(n++, POST_UPDATE(ScriptB));
        expectCall(n++, POST_UPDATE(cloneScriptA));
        expectCall(n++, POST_UPDATE(cloneScriptB));

    });

    it('expects `update` not to be called when a script disables itself', async function () {
        const e = new Entity();
        app.root.addChild(e);
        e.addComponent('esmscript');
        const Disabler = await import('../../../test-assets/esm-scripts/esm-disabler.mjs');
        e.esmscript.add(Disabler);

        const DisablerScript = e.esmscript.get('Disabler');

        // Node doesn't have `requestAnimationFrame` so manually trigger a tick
        app.update(16.6);

        expectCall(0, INITIALIZE(DisablerScript));
    });

    it('expects that all `initialize` calls are before `update` calls when enabling entity from inside a separate `initialize` call', async function () {

        const e = new Entity('entity to enable');
        e.enabled = false;
        const component = e.addComponent('esmscript');
        await component.system.initializeComponentData(component, {
            enabled: true,
            modules: [{
                moduleSpecifier: '../../../test/test-assets/esm-scripts/esm-scriptA.mjs',
                enabled: true,
                attributes: {}
            }, {
                moduleSpecifier: '../../../test/test-assets/esm-scripts/esm-scriptB.mjs',
                enabled: true,
                attributes: {}
            }]
        });

        app.root.addChild(e);

        expect(calls).to.have.lengthOf(0);

        const enabler = new Entity('enabler');
        const enablerComponent = enabler.addComponent('esmscript');
        await enablerComponent.system.initializeComponentData(enablerComponent, {
            enabled: true,
            modules: [{
                moduleSpecifier: '../../../test/test-assets/esm-scripts/esm-enabler.mjs',
                enabled: true,
                attributes: {
                    entityToEnable: e
                }
            }]
        });

        app.root.addChild(enabler);

        const enablerScript = enabler.esmscript.get('Enabler');
        const scriptA = e.esmscript.get('ScriptA');


        const scriptB = e.esmscript.get('ScriptB');

        // scripts should exist
        expect(enablerScript).to.exist;
        expect(scriptA).to.exist;
        expect(scriptB).to.exist;

        expect(calls).to.have.lengthOf(3);

        // Node doesn't have `requestAnimationFrame` so manually trigger a tick
        app.update(16.6);

        expect(calls).to.have.lengthOf(9);

        let n = 0;
        expectCall(n++, INITIALIZE(enablerScript)); // 'initialize enabler');
        expectCall(n++, INITIALIZE(scriptA)); // 'initialize scriptA');
        expectCall(n++, INITIALIZE(scriptB)); // 'initialize scriptB');
        expectCall(n++, ACTIVE(scriptA)); // 'active scriptA');
        expectCall(n++, ACTIVE(scriptB)); // 'active scriptB');
        expectCall(n++, UPDATE(scriptA)); // 'update scriptA');
        expectCall(n++, UPDATE(scriptB)); // 'update scriptB');
        expectCall(n++, POST_UPDATE(scriptA)); // 'post-update scriptA');
        expectCall(n++, POST_UPDATE(scriptB)); // 'post-update scriptB');

    });

    it('expects all `active` calls are called before `update` for an entity whose script component is enabled inside a separate `initialize` call', async function () {

        // Create a disabled entity, awaiting to be enabled
        const e = new Entity('entity to enable');
        const component = e.addComponent('esmscript');
        await component.system.initializeComponentData(component, {
            enabled: false,
            modules: [{
                moduleSpecifier: '../../../test/test-assets/esm-scripts/esm-scriptA.mjs',
                enabled: true,
                attributes: {}
            }, {
                moduleSpecifier: '../../../test/test-assets/esm-scripts/esm-scriptB.mjs',
                enabled: true,
                attributes: {}
            }]
        });

        app.root.addChild(e);

        expect(calls).to.have.lengthOf(0);

        // Create an entity/script that enables the previous entity
        const enabler = new Entity('enabler');
        const enablerComponent = enabler.addComponent('esmscript');
        await enablerComponent.system.initializeComponentData(enablerComponent, {
            enabled: true,
            modules: [{
                moduleSpecifier: '../../../test/test-assets/esm-scripts/esm-enabler.mjs',
                enabled: true,
                attributes: {
                    entityToEnable: e
                }
            }]
        });

        app.root.addChild(enabler);

        expect(calls).to.have.lengthOf(3);

        const enablerScript = enabler.esmscript.get('Enabler');
        const scriptA = e.esmscript.get('ScriptA');
        const scriptB = e.esmscript.get('ScriptB');

        // Node doesn't have `requestAnimationFrame` so manually trigger a tick
        app.update(16.6);

        expect(calls).to.have.lengthOf(9);

        let n = 0;
        expectCall(n++, INITIALIZE(enablerScript)); // 'initialize enabler');
        expectCall(n++, INITIALIZE(scriptA)); // 'initialize scriptA');
        expectCall(n++, INITIALIZE(scriptB)); // 'initialize scriptB');
        expectCall(n++, ACTIVE(scriptA)); // 'active scriptA');
        expectCall(n++, ACTIVE(scriptB)); // 'active scriptB');
        expectCall(n++, UPDATE(scriptA)); // 'update scriptA');
        expectCall(n++, UPDATE(scriptB)); // 'update scriptB');
        expectCall(n++, POST_UPDATE(scriptA)); // 'post-update scriptA');
        expectCall(n++, POST_UPDATE(scriptB)); // 'post-update scriptB');

    });

    it('expects `initialize` is called together for script instance that when during the initialize stage', async function () {
        // Create a disabled entity, awaiting to be enabled
        const e = new Entity('entity to enable');
        const component = e.addComponent('esmscript');
        await component.system.initializeComponentData(component, {
            enabled: true,
            modules: [{
                moduleSpecifier: '../../../test/test-assets/esm-scripts/esm-scriptA.mjs',
                enabled: false,
                attributes: {}
            }, {
                moduleSpecifier: '../../../test/test-assets/esm-scripts/esm-scriptB.mjs',
                enabled: false,
                attributes: {}
            }]
        });

        app.root.addChild(e);

        expect(calls).to.have.lengthOf(0);

        // Create an entity/script that enables the previous entity
        const enabler = new Entity('enabler');
        const enablerComponent = enabler.addComponent('esmscript');
        await enablerComponent.system.initializeComponentData(enablerComponent, {
            enabled: true,
            modules: [{
                moduleSpecifier: '../../../test/test-assets/esm-scripts/esm-enabler.mjs',
                enabled: true,
                attributes: {
                    entityToEnable: e
                }
            }]
        });

        app.root.addChild(enabler);

        expect(calls).to.have.lengthOf(1);

        const enablerScript = enabler.esmscript.get('Enabler');
        const scriptA = e.esmscript.get('ScriptA');
        const scriptB = e.esmscript.get('ScriptB');

        // Node doesn't have `requestAnimationFrame` so manually trigger a tick
        app.update(16.6);

        let n = 0;
        expectCall(n++, INITIALIZE(enablerScript)); // 'initialize enabler');
        expectCall(n++, INITIALIZE(scriptA)); // 'initialize scriptA');
        expectCall(n++, INITIALIZE(scriptB)); // 'initialize scriptB');
        expectCall(n++, ACTIVE(scriptA)); // 'active scriptA');
        expectCall(n++, ACTIVE(scriptB)); // 'active scriptB');
        expectCall(n++, UPDATE(scriptA)); // 'update scriptA');
        expectCall(n++, UPDATE(scriptB)); // 'update scriptB');
        expectCall(n++, POST_UPDATE(scriptA)); // 'post-update scriptA');
        expectCall(n++, POST_UPDATE(scriptB)); // 'post-update scriptB');

    });

    it('expects `initialize` is called for entity and all children before `active` and `update`', async function () {
        const e = new Entity();
        const component = e.addComponent('esmscript');
        await component.system.initializeComponentData(component, {
            enabled: true,
            modules: [{
                moduleSpecifier: '../../../test/test-assets/esm-scripts/esm-scriptA.mjs',
                enabled: true,
                attributes: {}
            }, {
                moduleSpecifier: '../../../test/test-assets/esm-scripts/esm-scriptB.mjs',
                enabled: true,
                attributes: {}
            }]
        });

        const eScriptA = e.esmscript.get('ScriptA');
        const eScriptB = e.esmscript.get('ScriptB');

        const c1 = new Entity('c1');
        const child1component = c1.addComponent('esmscript');
        await child1component.system.initializeComponentData(child1component, {
            enabled: true,
            modules: [{
                moduleSpecifier: '../../../test/test-assets/esm-scripts/esm-scriptA.mjs',
                enabled: true,
                attributes: {}
            }, {
                moduleSpecifier: '../../../test/test-assets/esm-scripts/esm-scriptB.mjs',
                enabled: true,
                attributes: {}
            }]
        });

        const c1ScriptA = c1.esmscript.get('ScriptA');
        const c1ScriptB = c1.esmscript.get('ScriptB');

        e.addChild(c1);

        const c2 = new Entity('c2');
        const child2component = c2.addComponent('esmscript');
        await child2component.system.initializeComponentData(child2component, {
            enabled: true,
            modules: [{
                moduleSpecifier: '../../../test/test-assets/esm-scripts/esm-scriptA.mjs',
                enabled: true,
                attributes: {}
            }, {
                moduleSpecifier: '../../../test/test-assets/esm-scripts/esm-scriptB.mjs',
                enabled: true,
                attributes: {}
            }]
        });

        const c2ScriptA = c2.esmscript.get('ScriptA');
        const c2ScriptB = c2.esmscript.get('ScriptB');

        e.addChild(c2);

        const c3 = new Entity('c3');
        const child3component = c3.addComponent('esmscript');
        await child3component.system.initializeComponentData(child3component, {
            enabled: true,
            modules: [{
                moduleSpecifier: '../../../test/test-assets/esm-scripts/esm-scriptA.mjs',
                enabled: true,
                attributes: {}
            }, {
                moduleSpecifier: '../../../test/test-assets/esm-scripts/esm-scriptB.mjs',
                enabled: true,
                attributes: {}
            }]
        });

        const c3ScriptA = c3.esmscript.get('ScriptA');
        const c3ScriptB = c3.esmscript.get('ScriptB');

        c1.addChild(c3);
        app.root.addChild(e);

        expect(calls).to.have.lengthOf(8);

        // Node doesn't have `requestAnimationFrame` so manually trigger a tick
        app.update(16.6);

        expect(calls).to.have.lengthOf(32);
        // expect(initializeCalls.length).to.equal(32);

        let idx = -1;
        expectCall(++idx, INITIALIZE(eScriptA));
        expectCall(++idx, INITIALIZE(eScriptB));
        expectCall(++idx, INITIALIZE(c1ScriptA)); // , ++idx, 'initialize scriptA');
        expectCall(++idx, INITIALIZE(c1ScriptB)); // , ++idx, 'initialize scriptB');
        expectCall(++idx, INITIALIZE(c3ScriptA)); // , ++idx, 'initialize scriptA');
        expectCall(++idx, INITIALIZE(c3ScriptB)); // , ++idx, 'initialize scriptB');
        expectCall(++idx, INITIALIZE(c2ScriptA)); // , ++idx, 'initialize scriptA');
        expectCall(++idx, INITIALIZE(c2ScriptB)); // , ++idx, 'initialize scriptB');

        expectCall(++idx, ACTIVE(eScriptA)); //  ++idx, 'active scriptA');
        expectCall(++idx, ACTIVE(eScriptB)); //  ++idx, 'active scriptB');
        expectCall(++idx, ACTIVE(c1ScriptA)); // , ++idx, 'active scriptA');
        expectCall(++idx, ACTIVE(c1ScriptB)); // , ++idx, 'active scriptB');
        expectCall(++idx, ACTIVE(c2ScriptA)); // , ++idx, 'active scriptA');
        expectCall(++idx, ACTIVE(c2ScriptB)); // , ++idx, 'active scriptB');
        expectCall(++idx, ACTIVE(c3ScriptA)); // , ++idx, 'active scriptA');
        expectCall(++idx, ACTIVE(c3ScriptB)); // , ++idx, 'active scriptB');

        expectCall(++idx, UPDATE(eScriptA)); //  ++idx, 'update scriptA');
        expectCall(++idx, UPDATE(eScriptB)); //  ++idx, 'update scriptB');
        expectCall(++idx, UPDATE(c1ScriptA)); // , ++idx, 'update scriptA');
        expectCall(++idx, UPDATE(c1ScriptB)); // , ++idx, 'update scriptB');
        expectCall(++idx, UPDATE(c2ScriptA)); // , ++idx, 'update scriptA');
        expectCall(++idx, UPDATE(c2ScriptB)); // , ++idx, 'update scriptB');
        expectCall(++idx, UPDATE(c3ScriptA)); // , ++idx, 'update scriptA');
        expectCall(++idx, UPDATE(c3ScriptB)); // , ++idx, 'update scriptB');

    });

    it('should initialize script attributes for an enabled entity', async function () {
        const e2 = new Entity();
        app.root.addChild(e2);

        expect(e2).to.exist;

        const e = new Entity();
        const component = e.addComponent('esmscript');
        await component.system.initializeComponentData(component, {
            enabled: true,
            modules: [{
                moduleSpecifier: '../../../test/test-assets/esm-scripts/esm-scriptWithAttributes.mjs',
                enabled: true,
                attributes: {
                    attribute1: e2
                }
            }]
        });

        app.root.addChild(e);

        const script = e.esmscript.get('ScriptWithAttributes');

        expect(script.attribute1).to.equal(e2);
        expect(script.attribute2).to.equal(2);
    });

    it('should initialize a script with attributes on a disabled entity', async function () {
        const e2 = new Entity();
        app.root.addChild(e2);

        expect(e2).to.exist;

        const e = new Entity();
        e.enabled = false;
        const component = e.addComponent('esmscript');
        await component.system.initializeComponentData(component, {
            enabled: true,
            modules: [{
                moduleSpecifier: '../../../test/test-assets/esm-scripts/esm-scriptWithAttributes.mjs',
                enabled: true,
                attributes: {
                    attribute1: e2
                }
            }]
        });

        app.root.addChild(e);

        const script = e.esmscript.get('ScriptWithAttributes');

        expect(script.attribute1).to.equal(e2);
        expect(script.attribute2).to.equal(2);
    });

    it('should initialize script with attributes on a disabled script component', async function () {
        const e2 = new Entity();
        app.root.addChild(e2);

        expect(e2).to.exist;

        const e = new Entity();
        const component = e.addComponent('esmscript');
        await component.system.initializeComponentData(component, {
            enabled: false,
            modules: [{
                moduleSpecifier: '../../../test/test-assets/esm-scripts/esm-scriptWithAttributes.mjs',
                enabled: true,
                attributes: {
                    attribute1: e2
                }
            }]
        });

        app.root.addChild(e);

        const script = e.esmscript.get('ScriptWithAttributes');

        expect(script.attribute1).to.equal(e2);
        expect(script.attribute2).to.equal(2);
    });

    it('should initiailize a script with attributes on a disabled script instance', async function () {
        const e2 = new Entity();
        app.root.addChild(e2);

        expect(e2).to.exist;

        const e = new Entity();
        const component = e.addComponent('esmscript');
        await component.system.initializeComponentData(component, {
            enabled: true,
            modules: [{
                moduleSpecifier: '../../../test/test-assets/esm-scripts/esm-scriptWithAttributes.mjs',
                enabled: false,
                attributes: {
                    attribute1: e2
                }
            }]
        });

        app.root.addChild(e);

        const script = e.esmscript.get('ScriptWithAttributes');

        expect(script.attribute1).to.equal(e2);
        expect(script.attribute2).to.equal(2);
    });

    it('should initialize a script with attributes when cloning an enabled entity', async function () {
        const e2 = new Entity();
        app.root.addChild(e2);

        expect(e2).to.exist;

        const e = new Entity();
        const component = e.addComponent('esmscript');
        await component.system.initializeComponentData(component, {
            enabled: true,
            modules: [{
                moduleSpecifier: '../../../test/test-assets/esm-scripts/esm-scriptWithAttributes.mjs',
                enabled: true,
                attributes: {
                    attribute1: e2
                }
            }]
        });

        app.root.addChild(e);

        const script = e.esmscript.get('ScriptWithAttributes');

        expect(script.attribute1).to.equal(e2);
        expect(script.attribute2).to.equal(2);

        const clone = e.clone();
        app.root.addChild(clone);

        const clonedModule = clone.esmscript.get('ScriptWithAttributes');

        expect(clonedModule.attribute1).to.equal(e2);
        expect(clonedModule.attribute2).to.equal(2);

    });

    it('should initialize a script with attributes when cloning a disabled entity', async function () {
        const e2 = new Entity();
        app.root.addChild(e2);

        expect(e2).to.exist;

        const e = new Entity();
        e.enabled = false;
        const component = e.addComponent('esmscript');
        await component.system.initializeComponentData(component, {
            enabled: true,
            modules: [{
                moduleSpecifier: '../../../test/test-assets/esm-scripts/esm-scriptWithAttributes.mjs',
                enabled: true,
                attributes: {
                    attribute1: e2
                }
            }]
        });

        app.root.addChild(e);

        const script = e.esmscript.get('ScriptWithAttributes');

        expect(script.attribute1).to.equal(e2);
        expect(script.attribute2).to.equal(2);

        const clone = e.clone();
        app.root.addChild(clone);

        const clonedModule = clone.esmscript.get('ScriptWithAttributes');

        expect(clonedModule.attribute1).to.equal(e2);
        expect(clonedModule.attribute2).to.equal(2);
    });

    it('should initialize a script with attributes when cloning a disabled script component', async function () {
        const e2 = new Entity();
        app.root.addChild(e2);

        expect(e2).to.exist;

        const e = new Entity();
        const component = e.addComponent('esmscript');
        await component.system.initializeComponentData(component, {
            enabled: false,
            modules: [{
                moduleSpecifier: '../../../test/test-assets/esm-scripts/esm-scriptWithAttributes.mjs',
                enabled: true,
                attributes: {
                    attribute1: e2
                }
            }]
        });

        app.root.addChild(e);

        const script = e.esmscript.get('ScriptWithAttributes');

        expect(script.attribute1).to.equal(e2);
        expect(script.attribute2).to.equal(2);

        const clone = e.clone();
        app.root.addChild(clone);

        const clonedModule = clone.esmscript.get('ScriptWithAttributes');

        expect(clonedModule.attribute1).to.equal(e2);
        expect(clonedModule.attribute2).to.equal(2);
    });

    it('should initialize a script with attributes when cloning a disabled script instance', async function () {
        const e2 = new Entity();
        app.root.addChild(e2);

        expect(e2).to.exist;

        const e = new Entity();
        const component = e.addComponent('esmscript');
        await component.system.initializeComponentData(component, {
            enabled: true,
            modules: [{
                moduleSpecifier: '../../../test/test-assets/esm-scripts/esm-scriptWithAttributes.mjs',
                enabled: false,
                attributes: {
                    attribute1: e2
                }
            }]
        });

        app.root.addChild(e);

        const script = e.esmscript.get('ScriptWithAttributes');

        expect(script.attribute1).to.equal(e2);
        expect(script.attribute2).to.equal(2);

        const clone = e.clone();
        app.root.addChild(clone);

        const clonedModule = clone.esmscript.get('ScriptWithAttributes');

        expect(clonedModule.attribute1).to.equal(e2);
        expect(clonedModule.attribute2).to.equal(2);
    });

    it('should initialize a script with attributes when loading a scene with an enabled entity', async function () {
        const a = app.root.findByName('EnabledEntity');
        const b = app.root.findByName('ReferencedEntity');

        expect(a).to.exist;
        expect(b).to.exist;

        await waitForNextFrame();

        const scriptWithAttributes = a.esmscript.get('ScriptWithAttributes');

        expect(scriptWithAttributes).to.exist;
        expect(scriptWithAttributes.attribute1).to.equal(b);
        expect(scriptWithAttributes.attribute2).to.equal(2);
    });

    it('should initialize a script with attributes when loading a scene with a disabled entity', async function () {
        const a = app.root.findByName('DisabledEntity');
        const b = app.root.findByName('ReferencedEntity');

        expect(a).to.exist;
        expect(b).to.exist;

        await waitForNextFrame();

        const scriptWithAttributes = a.esmscript.get('ScriptWithAttributes');

        expect(scriptWithAttributes).to.exist;
        expect(scriptWithAttributes.attribute1).to.equal(b);
        expect(scriptWithAttributes.attribute2).to.equal(2);
    });

    it('should initialize a script with attributes when loading a scene for a disabled script component', async function () {
        const a = app.root.findByName('DisabledScriptComponent');
        const b = app.root.findByName('ReferencedEntity');

        expect(a).to.exist;
        expect(b).to.exist;

        await waitForNextFrame();

        const scriptWithAttributes = a.esmscript.get('ScriptWithAttributes');

        expect(scriptWithAttributes).to.exist;
        expect(scriptWithAttributes.attribute1).to.equal(b);
        expect(scriptWithAttributes.attribute2).to.equal(2);
    });

    it('should initialize a script with attributes when loading scene for disabled script instance', async function () {
        const a = app.root.findByName('DisabledScriptInstance');
        const b = app.root.findByName('ReferencedEntity');

        expect(a).to.exist;
        expect(b).to.exist;

        await waitForNextFrame();

        const scriptWithAttributes = a.esmscript.get('ScriptWithAttributes');

        expect(scriptWithAttributes).to.exist;
        expect(scriptWithAttributes.attribute1).to.equal(b);
        expect(scriptWithAttributes.attribute2).to.equal(2);
    });

    // it('should initialize a script with attributes when reloading a scene', function (done) {
    //     // destroy current scene
    //     app.root.children[0].destroy();

    //     expect(app.root.findByName('ReferencedEntity')).to.not.exist;

    //     // verify entities are not there anymore
    //     var names = ['EnabledEntity', 'DisabledEntity', 'DisabledScriptComponent', 'DisabledScriptInstance'];
    //     names.forEach(function (name) {
    //         expect(app.root.findByName(name)).to.not.exist;
    //     })

    //     app.loadSceneHierarchy('base/tests/framework/components/script/scene1.json', function () {

    //         // verify entities are loaded
    //         names.forEach(function (name) {
    //             expect(app.root.findByName(name)).to.exist;
    //         })

    //         var referenced = app.root.findByName('ReferencedEntity');

    //         // verify script attributes are initialized
    //         names.forEach(async function (name) {
    //             var e = app.root.findByName(name);
    //             await waitForNextFrame();

    //             expect(e.esmscript).to.exist;

    //             const scriptWithAttributes = e.esmscript.get('ScriptWithAttributes');

    //             expect(scriptWithAttributes).to.exist;
    //             expect(scriptWithAttributes.attribute1).to.equal(referenced);
    //             expect(scriptWithAttributes.attribute2).to.equal(2);
    //             done();
    //         });

    //     });
    // });

    describe('script attributes', function () {

        it('expects invalid or malformed script attributes to initialize correctly', async function () {
            const e = new Entity();
            const component = e.addComponent('esmscript');
            await component.system.initializeComponentData(component, {
                enabled: true,
                modules: [{
                    moduleSpecifier: '../../../test/test-assets/esm-scripts/esm-scriptWithAttributes.mjs',
                    enabled: true,
                    attributes: {
                        invalidAttribute: 'Should not instantiate',
                        invalidAttributeType: 'Should not instantiate',
                        invalidAttributeTypeWithDefault: 'Should not instantiate',
                        invalidAttributeTypeArray: ['Should not instantiate']
                    }
                }]
            });

            app.root.addChild(e);

            await waitForNextFrame();

            const script = e.esmscript.get('ScriptWithAttributes');

            // invalid attribute
            expect(script.invalidAttribute).to.equal(undefined);

            // invalid attribute type
            expect(script.invalidAttributeType).to.equal(undefined);

            // invalid attribute type with default
            expect(script.invalidAttributeTypeWithDefault).to.equal(undefined);

            // invalid attribute type with array
            expect(script.invalidAttributeTypeArray).to.be.an.instanceOf(Array);

        });

        it('should initialize simple script attributes with their correct defaults', async function () {
            const e = new Entity();
            const component = e.addComponent('esmscript');
            await component.system.initializeComponentData(component, {
                enabled: true,
                modules: [{
                    moduleSpecifier: '../../../test/test-assets/esm-scripts/esm-scriptWithAttributes.mjs',
                    enabled: true
                }]
            });

            app.root.addChild(e);

            const script = e.esmscript.get('ScriptWithAttributes');

            // simple attribute - No default
            expect(script.simpleAttributeNoDefault).to.equal(undefined);

            // simple attribute - No default
            expect(script.simpleAttributeWithFalsyDefault).to.equal(false);

            // simple attribute - w/ default
            expect(script.simpleAttribute).to.equal(10);

            // simple color attribute - w/ default
            expect(script.simpleColorHex).to.be.an.instanceof(Color);

            // simple attribute - w/ default
            expect(script.simpleColorAsArray).to.be.an.instanceof(Color);

            // simple attribute array - w/ default
            expect(script.simpleAttributeArray).to.be.an.instanceof(Array);
            expect(script.simpleAttributeArray).to.have.lengthOf(1);
            expect(script.simpleAttributeArray[0]).to.equal(10);

            // Simple attribute array with an invalid default
            expect(script.simpleAttributeArrayInvalidDefault).to.be.an.instanceOf(Array);
            expect(script.simpleAttributeArrayInvalidDefault).to.have.lengthOf(0);

            // simple attribute array - no default
            expect(script.simpleAttributeArrayNoDefault).to.be.an.instanceof(Array);
            expect(script.simpleAttributeArrayNoDefault).to.have.lengthOf(0);

            // simple attribute array - w/ default array
            expect(script.simpleAttributeArrayWithDefaultArray).to.be.an.instanceof(Array);
            expect(script.simpleAttributeArrayWithDefaultArray).to.have.lengthOf(3);
            expect(script.simpleAttributeArrayWithDefaultArray).to.deep.equal([10, 20, 30]);

        });

        it('should override simple script attributes with their correct values', async function () {
            const e = new Entity();
            const component = e.addComponent('esmscript');
            await component.system.initializeComponentData(component, {
                enabled: true,
                modules: [{
                    moduleSpecifier: '../../../test/test-assets/esm-scripts/esm-scriptWithAttributes.mjs',
                    enabled: true,
                    attributes: {
                        simpleAttributeNoDefault: 54321,
                        simpleAttributeWithFalsyDefault: true,
                        simpleAttribute: 1234,
                        simpleColorHex: [0.5, 0.5, 0.5, 0.5],
                        simpleColorAsArray: [0.9, 0.8, 0.7, 0.6],
                        simpleAttributeArray: [1, 2, 4, 5],
                        simpleAttributeArrayInvalidDefault: [123],
                        simpleAttributeArrayNoDefault: [1, 2, 3, 4],
                        simpleAttributeArrayWithDefaultArray: [9, 8, 7]
                    }
                }]
            });

            app.root.addChild(e);

            await waitForNextFrame();

            const script = e.esmscript.get('ScriptWithAttributes');

            // simple attribute - No default
            expect(script.simpleAttributeNoDefault).to.equal(54321);

            // // simple attribute - No default
            expect(script.simpleAttributeWithFalsyDefault).to.equal(true);

            // // simple attribute - w/ default
            expect(script.simpleAttribute).to.equal(1234);

            // simple color attribute - w/ default
            expect(script.simpleColorHex).to.be.an.instanceof(Color);
            expect({ ...script.simpleColorHex }).to.deep.equal({ r: 0.5, g: 0.5, b: 0.5, a: 0.5 });

            // simple attribute - w/ default
            expect(script.simpleColorAsArray).to.be.an.instanceof(Color);
            expect({ ...script.simpleColorAsArray }).to.deep.equal({ r: 0.9, g: 0.8, b: 0.7, a: 0.6 });

            // simple attribute array - w/ default
            expect(script.simpleAttributeArray).to.be.an.instanceof(Array);
            expect(script.simpleAttributeArray).to.have.lengthOf(4);
            expect(script.simpleAttributeArray).to.deep.equal([1, 2, 4, 5]);

            // Simple attribute array with an invalid default
            expect(script.simpleAttributeArrayInvalidDefault).to.be.an.instanceOf(Array);
            expect(script.simpleAttributeArrayInvalidDefault).to.have.lengthOf(1);
            expect(script.simpleAttributeArrayInvalidDefault).to.deep.equal([123]);

            // simple attribute array - no default
            expect(script.simpleAttributeArrayNoDefault).to.be.an.instanceof(Array);
            expect(script.simpleAttributeArrayNoDefault).to.have.lengthOf(4);
            expect(script.simpleAttributeArrayNoDefault).to.deep.equal([1, 2, 3, 4]);

            // simple attribute array - w/ default array
            expect(script.simpleAttributeArrayWithDefaultArray).to.be.an.instanceof(Array);
            expect(script.simpleAttributeArrayWithDefaultArray).to.have.lengthOf(3);
            expect(script.simpleAttributeArrayWithDefaultArray).to.deep.equal([9, 8, 7]);

        });

        it('should initialize complex script attributes with their correct values', async function () {
            const e = new Entity();
            const component = e.addComponent('esmscript');
            await component.system.initializeComponentData(component, {
                enabled: true,
                modules: [{
                    moduleSpecifier: '../../../test/test-assets/esm-scripts/esm-scriptWithAttributes.mjs',
                    enabled: true
                }]
            });

            app.root.addChild(e);

            await waitForNextFrame();

            const script = e.esmscript.get('ScriptWithAttributes');

            // complex attribute - no default
            expect(script.complexAttributeNoDefault).to.be.a('object');
            expect(script.complexAttributeNoDefault.internalNumberNoDefault).to.equal(undefined);
            expect(script.complexAttributeNoDefault.internalNumber).to.equal(1);
            expect(script.complexAttributeNoDefault.internalArrayNoDefault).to.deep.equal([]);
            expect(script.complexAttributeNoDefault.internalArray).to.deep.equal([1, 2, 3, 4]);
            expect(script.complexAttributeNoDefault.internalColor).to.be.an.instanceOf(Color);

            // complex attribute - w/ default
            expect(script.complexAttribute).to.be.a('object');
            expect(script.complexAttribute.internalNumberNoDefault).to.equal(10);
            expect(script.complexAttribute.internalNumber).to.equal(1);
            expect(script.complexAttribute.internalArrayNoDefault).to.deep.equal([]);
            expect(script.complexAttribute.internalArray).to.deep.equal([6, 7, 8, 9]);
            expect(script.complexAttribute.internalColor).to.be.an.instanceOf(Color);
            expect(script.complexAttribute.nonExistent).to.equal(undefined);

        });

        it('should override complex script attributes with their correct defaults', async function () {
            const e = new Entity();
            const component = e.addComponent('esmscript');
            await component.system.initializeComponentData(component, {
                enabled: true,
                modules: [{
                    moduleSpecifier: '../../../test/test-assets/esm-scripts/esm-scriptWithAttributes.mjs',
                    enabled: true,
                    attributes: {
                        complexAttributeNoDefault: {
                            internalNumberNoDefault: 20,
                            internalNumber: 10,
                            internalArrayNoDefault: [1, 2, 3],
                            internalArray: [9, 8, 7],
                            internalColor: '#ffffff'
                        },
                        complexAttribute: {
                            internalNumberNoDefault: 1,
                            internalNumber: 2,
                            internalArrayNoDefault: [1, 2, 3],
                            internalArray: [9, 8, 7],
                            internalColor: '#ffffff',
                            nonExistent: 'SHOULD NOT EXIST'
                        }
                    }
                }]
            });

            app.root.addChild(e);

            await waitForNextFrame();

            const script = e.esmscript.get('ScriptWithAttributes');

            // complex attribute - no default
            expect(script.complexAttributeNoDefault).to.be.a('object');
            expect(script.complexAttributeNoDefault.internalNumberNoDefault).to.equal(20);
            expect(script.complexAttributeNoDefault.internalNumber).to.equal(10);
            expect(script.complexAttributeNoDefault.internalArrayNoDefault).to.deep.equal([1, 2, 3]);
            expect(script.complexAttributeNoDefault.internalArray).to.deep.equal([9, 8, 7]);
            expect(script.complexAttributeNoDefault.internalColor).to.be.an.instanceOf(Color);
            expect({ ...script.complexAttributeNoDefault.internalColor }).to.deep.equal({ r: 1, g: 1, b: 1, a: 1 });

            // complex attribute - w/ default
            expect(script.complexAttribute).to.be.a('object');
            expect(script.complexAttribute.internalNumberNoDefault).to.equal(1);
            expect(script.complexAttribute.internalNumber).to.equal(2);
            expect(script.complexAttribute.internalArrayNoDefault).to.deep.equal([1, 2, 3]);
            expect(script.complexAttribute.internalArray).to.deep.equal([9, 8, 7]);
            expect(script.complexAttribute.internalColor).to.be.an.instanceOf(Color);
            expect({ ...script.complexAttribute.internalColor }).to.deep.equal({ r: 1, g: 1, b: 1, a: 1 });
            expect(script.complexAttribute.nonExistent).to.equal(undefined);

        });

        it('should initialize scripts with attributes with default values', async function () {
            const e = new Entity();
            const component = e.addComponent('esmscript');
            await component.system.initializeComponentData(component, {
                modules: [{
                    moduleSpecifier: '../../../test/test-assets/esm-scripts/esm-scriptWithAttributes.mjs',
                    enabled: true,
                    attributes: {
                        attribute2: 3,
                        attribute3: {
                            internalNumber: 10,
                            internalArrayNoDefault: [4]
                        }
                    }
                }]
            });

            app.root.addChild(e);

            const script = e.esmscript.get('ScriptWithAttributes');

            expect(script).to.exist;
            expect(script.attribute3.internalNumber).to.equal(10);

            expect(script.attribute3.internalArrayNoDefault).to.deep.equal([4]);
            expect(script.attribute3.internalArray).to.deep.equal([1, 2, 3, 4]);
        });
    });

    describe('Warnings and notifications', function () {

        it('should warn when attempting to assign values that aren\'t present in the attribute definition', async function () {

            const e = new Entity();
            app.root.addChild(e);
            e.addComponent('esmscript');
            const EsmScript = await import('../../../test-assets/esm-scripts/esm-scriptWithSimpleAttributes.mjs');

            // collect warnings
            const warnings = [];
            Debug.warn = (warning) => {
                console.error(warning)
                warnings.push(warning);
            };

            e.esmscript.add(EsmScript, {
                attribute3: 'This should warn that it hasn\'t been defined',
                attribute4: 'this too'
            });

            expect(warnings).to.have.a.lengthOf(2);
            expect(warnings[0]).to.equal('\'attribute3\' is not defined. Please see the attribute definition.');
            expect(warnings[1]).to.equal('\'attribute4\' is not defined. Please see the attribute definition.');

        })

        it('should warn when assigning an invalid value type to a attribute', async function () {

            const e = new Entity();
            app.root.addChild(e);
            e.addComponent('esmscript');
            const EsmScript = await import('../../../test-assets/esm-scripts/esm-scriptWithSimpleAttributes.mjs');

            // collect warnings
            const warnings = [];
            Debug.warn = (warning) => {
                warnings.push(warning);
            };

            e.esmscript.add(EsmScript, {
                simpleAttribute: 'This should warn',
                simpleAttributeNoDefault: 'Yep, another warning'
            });

            expect(warnings).to.have.a.lengthOf(2);
            expect(warnings[0]).to.equal('\'simpleAttributeNoDefault\' is a \'string\' but a \'number\' was expected. Please see the attribute definition.');
            expect(warnings[1]).to.equal('\'simpleAttribute\' is a \'string\' but a \'number\' was expected. Please see the attribute definition.');

        });

    });

});
