import { Application } from '../../../../src/framework/application.js';
import { Debug } from '../../../../src/core/debug.js';
import { Entity } from '../../../../src/framework/entity.js';
import { Color } from '../../../../src/core/math/color.js';


import { expect } from 'chai';

import { HTMLCanvasElement } from '@playcanvas/canvas-mock';
import { reset } from './method-util.js';

const initializeCalls = [];

describe('EsmScriptComponent', function () {
    let app;

    beforeEach(function () {
        reset();
        const canvas = new HTMLCanvasElement(500, 500);
        app = new Application(canvas);
    });

    afterEach(function () {
        app.destroy();
    });

    // beforeEach(function (done) {
    //     this.timeout(4000); // Double the default 2000ms timeout which often fails on CirclCI

    //     // Override the debug to remove console mess
    //     Debug.warn = warning => null;

    //     const canvas = new HTMLCanvasElement(500, 500);
    //     app = new Application(canvas);

    //     initializeCalls.length = 0;

    //     // add script assets
    //     // app._parseAssets({
    //     //     "1": {
    //     //         "tags": [],
    //     //         "name": "esm-scriptA.js",
    //     //         "revision": 1,
    //     //         "preload": true,
    //     //         "meta": null,
    //     //         "data": {
    //     //             "modules": [{
    //     //                 "moduleSpecifier": "/base/tests/framework/components/script/esm-scriptA.js",
    //     //                 "attributes": {

    //     //                 }
    //     //             }],
    //     //             "loading": false
    //     //         },
    //     //         "type": "esmscript",
    //     //         "file": {
    //     //             "filename": "esm=-scriptA.js",
    //     //             "size": 1,
    //     //             // "hash": "script a hash",
    //     //             "url": "/base/tests/framework/components/script/esm-scriptA.js"
    //     //         },
    //     //         "region": "eu-west-1",
    //     //         "id": "1"
    //     //     },
    //     //     "2": {
    //     //         "tags": [],
    //     //         "name": "esm-scriptB.js",
    //     //         "revision": 1,
    //     //         "preload": true,
    //     //         "meta": null,
    //     //         "data": {
    //     //             "modules": [{
    //     //                 "moduleSpecifier": "/base/tests/framework/components/script/esm-scriptB.js",
    //     //                 "attributes": {

    //     //                 }
    //     //             }],
    //     //             "loading": false
    //     //         },
    //     //         "type": "esmscript",
    //     //         "file": {
    //     //             "filename": "esm-scriptB.js",
    //     //             "size": 1,
    //     //             // "hash": "script b hash",
    //     //             "url": "/base/tests/framework/components/script/esm-scriptB.js"
    //     //         },
    //     //         "region": "eu-west-1",
    //     //         "id": "2"
    //     //     },
    //     //     "3": {
    //     //         "tags": [],
    //     //         "name": "esm-cloner.js",
    //     //         "revision": 1,
    //     //         "preload": true,
    //     //         "meta": null,
    //     //         "data": {
    //     //             "modules": [{
    //     //                 "moduleSpecifier": "/base/tests/framework/components/script/esm-cloner.js",
    //     //                 "attributes": {

    //     //                 }
    //     //             }],
    //     //             "loading": false
    //     //         },
    //     //         "type": "esmscript",
    //     //         "file": {
    //     //             "filename": "esm-cloner.js",
    //     //             "size": 1,
    //     //             // "hash": "cloner hash",
    //     //             "url": "/base/tests/framework/components/script/esm-cloner.js"
    //     //         },
    //     //         "region": "eu-west-1",
    //     //         "id": "3"
    //     //     },
    //     //     "4": {
    //     //         "tags": [],
    //     //         "name": "esm-enabler.js",
    //     //         "revision": 1,
    //     //         "preload": true,
    //     //         "meta": null,
    //     //         "data": {
    //     //             "modules": [{
    //     //                 "moduleSpecifier": "/base/tests/framework/components/script/esm-enabler.js",
    //     //                 "attributes": {

    //     //                 }
    //     //             }],
    //     //             "loading": false
    //     //         },
    //     //         "type": "esmscript",
    //     //         "file": {
    //     //             "filename": "esm-enabler.js",
    //     //             "size": 1,
    //     //             // "hash": "enabler hash",
    //     //             "url": "/base/tests/framework/components/script/esm-enabler.js"
    //     //         },
    //     //         "region": "eu-west-1",
    //     //         "id": "4"
    //     //     },
    //     //     "5": {
    //     //         "tags": [],
    //     //         "name": "esm-disabler.js",
    //     //         "revision": 1,
    //     //         "preload": true,
    //     //         "meta": null,
    //     //         "data": {
    //     //             "modules": [{
    //     //                 "moduleSpecifier": "/base/tests/framework/components/script/esm-disabler.js",
    //     //                 "attributes": {

    //     //                 }
    //     //             }],
    //     //             "loading": false
    //     //         },
    //     //         "type": "esmscript",
    //     //         "file": {
    //     //             "filename": "esm-disabler.js",
    //     //             "size": 1,
    //     //             // "hash": "disabler hash",
    //     //             "url": "/base/tests/framework/components/script/esm-disabler.js"
    //     //         },
    //     //         "region": "eu-west-1",
    //     //         "id": "5"
    //     //     },
    //     //     "6": {
    //     //         "tags": [],
    //     //         "name": "esm-scriptWithAttributes.js",
    //     //         "revision": 1,
    //     //         "preload": true,
    //     //         "meta": null,
    //     //         "data": {
    //     //             "modules": [{
    //     //                 "moduleSpecifier": "/base/tests/framework/components/script/esm-scriptWithAttributes.js",
    //     //                 "attributes": {
    //     //                     "attribute1": {
    //     //                         "type": "entity"
    //     //                     },
    //     //                     "attribute2": {
    //     //                         "type": "number",
    //     //                         "default": 2
    //     //                     },
    //     //                     "attribute3": {
    //     //                         "type": "json",
    //     //                         "schema": [{
    //     //                             "name": 'fieldNumber',
    //     //                             "type": 'number'
    //     //                         }]
    //     //                     },
    //     //                     "attribute4": {
    //     //                         "type": "json",
    //     //                         "array": true,
    //     //                         "schema": [{
    //     //                             "name": 'fieldNumber',
    //     //                             "type": 'number'
    //     //                         }]
    //     //                     }
    //     //                 }
    //     //             }],
    //     //             "loading": false
    //     //         },
    //     //         "type": "esmscript",
    //     //         "file": {
    //     //             "filename": "esm-scriptWithAttributes.js",
    //     //             "size": 1,
    //     //             // "hash": "scriptWithAttributes hash",
    //     //             "url": "/base/tests/framework/components/script/esm-scriptWithAttributes.js"
    //     //         },
    //     //         "region": "eu-west-1",
    //     //         "id": "6"
    //     //     },
    //     //     "7": {
    //     //         "tags": [],
    //     //         "name": "esm-loadedLater.js",
    //     //         "revision": 1,
    //     //         "preload": false,
    //     //         "meta": null,
    //     //         "data": {
    //     //             "modules": [{
    //     //                 "moduleSpecifier": "/base/tests/framework/components/script/esm-loadedLater.js",
    //     //                 "attributes": {

    //     //                 }
    //     //             }],
    //     //             "loading": false
    //     //         },
    //     //         "type": "esmscript",
    //     //         "file": {
    //     //             "filename": "esm-loadedLater.js",
    //     //             "size": 1,
    //     //             // "hash": "loadedLater hash",
    //     //             "url": "/base/tests/framework/components/script/esm-loadedLater.js"
    //     //         },
    //     //         "region": "eu-west-1",
    //     //         "id": "7"
    //     //     },
    //     //     "8": {
    //     //         "tags": [],
    //     //         "name": "esm-destroyer.js",
    //     //         "revision": 1,
    //     //         "preload": true,
    //     //         "meta": null,
    //     //         "data": {
    //     //             "modules": [{
    //     //                 "moduleSpecifier": "/base/tests/framework/components/script/esm-destroyer.js",
    //     //                 "attributes": {

    //     //                 }
    //     //             }],
    //     //             "loading": false
    //     //         },
    //     //         "type": "esmscript",
    //     //         "file": {
    //     //             "filename": "esm-destroyer.js",
    //     //             "size": 1,
    //     //             // "hash": "destroyer hash",
    //     //             "url": "/base/tests/framework/components/script/esm-destroyer.js"
    //     //         },
    //     //         "region": "eu-west-1",
    //     //         "id": "8"
    //     //     },
    //     //     "9": {
    //     //         "tags": [],
    //     //         "name": "esm-postCloner.js",
    //     //         "revision": 1,
    //     //         "preload": true,
    //     //         "meta": null,
    //     //         "data": {
    //     //             "modules": [{
    //     //                 "moduleSpecifier": "/base/tests/framework/components/script/esm-postCloner.js",
    //     //                 "attributes": {

    //     //                 }
    //     //             }],
    //     //             "loading": false
    //     //         },
    //     //         "type": "esmscript",
    //     //         "file": {
    //     //             "filename": "esm-postCloner.js",
    //     //             "size": 1,
    //     //             // "hash": "postCloner hash",
    //     //             "url": "/base/tests/framework/components/script/esm-postCloner.js"
    //     //         },
    //     //         "region": "eu-west-1",
    //     //         "id": "9"
    //     //     },
    //     //     "10": {
    //     //         "tags": [],
    //     //         "name": "esm-postInitializeReporter.js",
    //     //         "revision": 1,
    //     //         "preload": true,
    //     //         "meta": null,
    //     //         "data": {
    //     //             "modules": [{
    //     //                 "moduleSpecifier": "/base/tests/framework/components/script/esm-postInitializeReporter.js",
    //     //                 "attributes": {

    //     //                 }
    //     //             }],
    //     //             "loading": false
    //     //         },
    //     //         "type": "esmscript",
    //     //         "file": {
    //     //             "filename": "esm-postInitializeReporter.js",
    //     //             "size": 1,
    //     //             // "hash": "postInitializeReporter hash",
    //     //             "url": "/base/tests/framework/components/script/esm-postInitializeReporter.js"
    //     //         },
    //     //         "region": "eu-west-1",
    //     //         "id": "10"
    //     //     }
    //     // });

    //     app.preload(function (err) {
    //         if (err) {
    //             console.error(err);
    //         }

    //         app.scenes.loadScene('http://localhost:3000/test/test-assets/esmscripts/scene1.json', function () {
    //             app.start();
    //             done();
    //         });
    //     });
    // });

    // function waitForNextFrame() {
    //     return new Promise((resolve) => {
    //         requestAnimationFrame(() => resolve());
    //     });
    // }

    const checkInitCall = function (entity, index, text) {
        expect(initializeCalls[index]).to.equal(entity.getGuid() + ' ' + text);
    };

    it('`entity` and `app` are set on an esm script', async function () {

        const e = new Entity();
        const component = e.addComponent('esmscript');
        await component.system.initializeComponentData(component, {
            enabled: true,
            modules: [{
                enabled: true,
                moduleSpecifier: '../../../test/test-assets/esm-scripts/esm-scriptA.js'
            }]
        });

        app.root.addChild(e);

        const script = component.get('ScriptA');

        expect(script).to.exist;
        expect(script.entity).to.equal(e);
        expect(script.app).to.equal(component.system.app);

    });

    it("`initialize` is called on a new esm script", async function () {

        const e = new Entity();
        const component = e.addComponent('esmscript');
        await component.system.initializeComponentData(component, {
            "enabled": true,
            "modules": [{
                "enabled": "true",
                "moduleSpecifier": "/base/tests/framework/components/script/esm-scriptA.js"
            }]
        });

        app.root.addChild(e);

        expect(e.esmscript).to.exist;

        expect(initializeCalls.length).to.equal(1);
        checkInitCall(e, 0, 'initialize scriptA');

    });

    // it("`initialize` is called on an entity that is enabled later", async function () {
    //     const e = new Entity();
    //     e.enabled = false;

    //     const component = e.addComponent('esmscript');
    //     await component.system.initializeComponentData(component, {
    //         "enabled": true,
    //         "modules": [{
    //             "enabled": "false",
    //             "moduleSpecifier": "/base/tests/framework/components/script/esm-scriptA.js"
    //         }]
    //     });

    //     app.root.addChild(e);
    //     expect(initializeCalls.length).to.equal(0);

    //     e.enabled = true;

    //     expect(initializeCalls.length).to.equal(1);

    // });

    // it("`initialize` is called on a component that is enabled later", async function () {
    //     const e = new Entity();
    //     const component = e.addComponent('esmscript');
    //     await component.system.initializeComponentData(component, {
    //         "enabled": false,
    //         "modules": [{
    //             "enabled": "true",
    //             "moduleSpecifier": "/base/tests/framework/components/script/esm-scriptA.js"
    //         }]
    //     });

    //     app.root.addChild(e);

    //     // module is not active
    //     expect(initializeCalls.length).to.equal(0);

    //     e.esmscript.enabled = true;

    //     expect(initializeCalls.length).to.equal(1);

    // });

    // it("`initialize` is called on a script instance that is enabled later", async function () {
    //     const e = new Entity();
    //     const component = e.addComponent('esmscript');
    //     await component.system.initializeComponentData(component, {
    //         "enabled": true,
    //         "modules": [{
    //             "enabled": false,
    //             "moduleSpecifier": "/base/tests/framework/components/script/esm-scriptA.js"
    //         }]
    //     });

    //     app.root.addChild(e);

    //     // module is not active
    //     expect(initializeCalls.length).to.equal(0);

    //     const script = e.esmscript.get('ScriptA');

    //     e.esmscript.enableModule(script);

    //     await waitForNextFrame();

    //     expect(initializeCalls.length).to.equal(4);
    // });

    // it("`initialize`, `active`, `update` and `postUpdate` are called on a script instance that is created later", async function () {
    //     var e = new Entity();
    //     app.root.addChild(e);
    //     e.addComponent('esmscript');
    //     const ScriptA = await import('/base/tests/framework/components/script/esm-scriptA.js')
    //     e.esmscript.add(ScriptA);
    //     expect(initializeCalls.length).to.equal(1);

    //     checkInitCall(e, 0, 'initialize scriptA');
    //     await waitForNextFrame();

    //     checkInitCall(e, 1, 'active scriptA');
    //     checkInitCall(e, 2, 'update scriptA');
    //     checkInitCall(e, 3, 'post-update scriptA');
    // });

    // it("`initialize`,`active`, `update` and `postUpdate` are called on cloned enabled entity", async function () {
    //     const e = new Entity();
    //     const component = e.addComponent('esmscript');

    //     await component.system.initializeComponentData(component, {
    //         "enabled": true,
    //         "modules": [{
    //             "moduleSpecifier": "/base/tests/framework/components/script/esm-scriptA.js",
    //             "enabled": true,
    //             "attributes": {}
    //         }, {
    //             "moduleSpecifier": "/base/tests/framework/components/script/esm-scriptB.js",
    //             "enabled": true,
    //             "attributes": {}
    //         }]
    //     });

    //     app.root.addChild(e);
    //     expect(initializeCalls.length).to.equal(2);

    //     await waitForNextFrame();

    //     // both modules added
    //     expect(initializeCalls.length).to.equal(8);

    //     let n = 0;
    //     checkInitCall(e, n++, 'initialize scriptA');
    //     checkInitCall(e, n++, 'initialize scriptB');

    //     checkInitCall(e, n++, 'active scriptA');
    //     checkInitCall(e, n++, 'active scriptB');

    //     checkInitCall(e, n++, 'update scriptA');
    //     checkInitCall(e, n++, 'update scriptB');

    //     checkInitCall(e, n++, 'post-update scriptA');
    //     checkInitCall(e, n++, 'post-update scriptB');

    //     initializeCalls = [];

    //     const clone = e.clone();
    //     app.root.addChild(clone);

    //     // clone is initialized
    //     expect(initializeCalls.length).to.equal(2);

    //     await waitForNextFrame();

    //     // next frame update, postUpdate have triggered
    //     expect(initializeCalls.length).to.equal(12);

    //     // new clone active
    //     n = 0;
    //     checkInitCall(clone, n++, 'initialize scriptA');
    //     checkInitCall(clone, n++, 'initialize scriptB');
    //     checkInitCall(clone, n++, 'active scriptA');
    //     checkInitCall(clone, n++, 'active scriptB');

    //     // update
    //     checkInitCall(e, n++, 'update scriptA');
    //     checkInitCall(e, n++, 'update scriptB');
    //     checkInitCall(clone, n++, 'update scriptA');
    //     checkInitCall(clone, n++, 'update scriptB');

    //     // post update
    //     checkInitCall(e, n++, 'post-update scriptA');
    //     checkInitCall(e, n++, 'post-update scriptB');
    //     checkInitCall(clone, n++, 'post-update scriptA');
    //     checkInitCall(clone, n++, 'post-update scriptB');

    // });

    // it('`update` is _not_ called when a script disables itself', async function () {
    //     var e = new Entity();
    //     app.root.addChild(e);
    //     e.addComponent('esmscript');
    //     const Disabler = await import('/base/tests/framework/components/script/esm-disabler.js')
    //     e.esmscript.add(Disabler);
    //     await waitForNextFrame();
    //     expect(initializeCalls.length).to.equal(1);
    //     checkInitCall(e, 0, 'active disabler');
    // });

    // it("all `initialize` calls are before `update` calls when enabling entity from inside a separate `initialize` call", async function () {

    //     const e = new Entity('entity to enable');
    //     e.enabled = false;
    //     const component = e.addComponent('esmscript');
    //     await component.system.initializeComponentData(component, {
    //         "enabled": true,
    //         "modules": [{
    //             "moduleSpecifier": "/base/tests/framework/components/script/esm-scriptA.js",
    //             "enabled": true,
    //             "attributes": {}
    //         }, {
    //             "moduleSpecifier": "/base/tests/framework/components/script/esm-scriptB.js",
    //             "enabled": true,
    //             "attributes": {}
    //         }]
    //     });

    //     app.root.addChild(e);

    //     expect(initializeCalls.length).to.equal(0);

    //     const enabler = new Entity('enabler');
    //     const enablerComponent = enabler.addComponent('esmscript');
    //     await enablerComponent.system.initializeComponentData(enablerComponent, {
    //         "enabled": true,
    //         "modules": [{
    //             "moduleSpecifier": "/base/tests/framework/components/script/esm-enabler.js",
    //             "enabled": true,
    //             "attributes": {
    //                 "entityToEnable": e
    //             }
    //         }]
    //     });

    //     app.root.addChild(enabler);

    //     expect(initializeCalls.length).to.equal(3);

    //     await waitForNextFrame();

    //     expect(initializeCalls.length).to.equal(9);

    //     let n = 0;
    //     checkInitCall(enabler, n++, 'initialize enabler');
    //     checkInitCall(e, n++, 'initialize scriptA');
    //     checkInitCall(e, n++, 'initialize scriptB');
    //     checkInitCall(e, n++, 'active scriptA');
    //     checkInitCall(e, n++, 'active scriptB');
    //     checkInitCall(e, n++, 'update scriptA');
    //     checkInitCall(e, n++, 'update scriptB');
    //     checkInitCall(e, n++, 'post-update scriptA');
    //     checkInitCall(e, n++, 'post-update scriptB');

    // });

    // it("all `active` calls are before `update` calls for an entity whose script component is enabled inside a separate `active` call", async function () {
    //     const e = new Entity('entity to enable');
    //     const component = e.addComponent('esmscript');
    //     await component.system.initializeComponentData(component, {
    //         "enabled": false,
    //         "modules": [{
    //             "moduleSpecifier": "/base/tests/framework/components/script/esm-scriptA.js",
    //             "enabled": true,
    //             "attributes": {}
    //         }, {
    //             "moduleSpecifier": "/base/tests/framework/components/script/esm-scriptB.js",
    //             "enabled": true,
    //             "attributes": {}
    //         }]
    //     });

    //     app.root.addChild(e);

    //     expect(initializeCalls.length).to.equal(0);

    //     const enabler = new Entity('enabler');
    //     const enablerComponent = enabler.addComponent('esmscript');
    //     await enablerComponent.system.initializeComponentData(enablerComponent, {
    //         "enabled": true,
    //         "modules": [{
    //             "moduleSpecifier": "/base/tests/framework/components/script/esm-enabler.js",
    //             "enabled": true,
    //             "attributes": {
    //                 "entityToEnable": e
    //             }
    //         }]
    //     });

    //     app.root.addChild(enabler);

    //     expect(initializeCalls.length).to.equal(3);

    //     await waitForNextFrame();

    //     expect(initializeCalls.length).to.equal(9);

    //     let n = 0;
    //     checkInitCall(enabler, n++, 'initialize enabler');
    //     checkInitCall(e, n++, 'initialize scriptA');
    //     checkInitCall(e, n++, 'initialize scriptB');
    //     checkInitCall(e, n++, 'active scriptA');
    //     checkInitCall(e, n++, 'active scriptB');
    //     checkInitCall(e, n++, 'update scriptA');
    //     checkInitCall(e, n++, 'update scriptB');
    //     checkInitCall(e, n++, 'post-update scriptA');
    //     checkInitCall(e, n++, 'post-update scriptB');

    // });

    // // it("initialize and postInitialize are fired together for script instance that is enabled in initialize function", function () {
    // //     var e = new Entity('entity to enable');

    // //     e.addComponent('script', {
    // //         "enabled": true,
    // //         "order": [
    // //             "scriptA",
    // //             "scriptB",
    // //         ],
    // //         "scripts": {
    // //             "scriptA": {
    // //                 "enabled": false,
    // //                 "attributes": {}
    // //             },
    // //             "scriptB": {
    // //                 "enabled": false,
    // //                 "attributes": {}
    // //             }
    // //         }
    // //     });

    // //     app.root.addChild(e);

    // //     expect(initializeCalls.length).to.equal(0);

    // //     var enabler = new Entity();

    // //     enabler.addComponent('script', {
    // //         "enabled": true,
    // //         "order": [
    // //             "enabler",
    // //         ],
    // //         "scripts": {
    // //             "enabler": {
    // //                 "enabled": true,
    // //                 "attributes": {
    // //                     "entityToEnable": e.getGuid()
    // //                 }
    // //             }
    // //         }
    // //     });

    // //     app.root.addChild(enabler);

    // //     expect(initializeCalls.length).to.equal(6);
    // //     var idx = -1;
    // //     checkInitCall(enabler, ++idx, 'initialize enabler');
    // //     checkInitCall(e, ++idx, 'initialize scriptA');
    // //     checkInitCall(e, ++idx, 'postInitialize scriptA');
    // //     checkInitCall(e, ++idx, 'initialize scriptB');
    // //     checkInitCall(e, ++idx, 'postInitialize scriptB');
    // //     checkInitCall(enabler, ++idx, 'postInitialize enabler');

    // // });

    // it("initialize is called for entity and all children before `active` and `update`", async function () {
    //     const e = new Entity();
    //     const component = e.addComponent('esmscript');
    //     await component.system.initializeComponentData(component, {
    //         "enabled": true,
    //         "modules": [{
    //             "moduleSpecifier": "/base/tests/framework/components/script/esm-scriptA.js",
    //             "enabled": true,
    //             "attributes": {}
    //         }, {
    //             "moduleSpecifier": "/base/tests/framework/components/script/esm-scriptB.js",
    //             "enabled": true,
    //             "attributes": {}
    //         }]
    //     });

    //     const c1 = new Entity('c1');
    //     const child1component = c1.addComponent('esmscript');
    //     await child1component.system.initializeComponentData(child1component, {
    //         "enabled": true,
    //         "modules": [{
    //             "moduleSpecifier": "/base/tests/framework/components/script/esm-scriptA.js",
    //             "enabled": true,
    //             "attributes": {}
    //         }, {
    //             "moduleSpecifier": "/base/tests/framework/components/script/esm-scriptB.js",
    //             "enabled": true,
    //             "attributes": {}
    //         }]
    //     });

    //     e.addChild(c1);

    //     const c2 = new Entity('c2');
    //     const child2component = c2.addComponent('esmscript');
    //     await child2component.system.initializeComponentData(child2component, {
    //         "enabled": true,
    //         "modules": [{
    //             "moduleSpecifier": "/base/tests/framework/components/script/esm-scriptA.js",
    //             "enabled": true,
    //             "attributes": {}
    //         }, {
    //             "moduleSpecifier": "/base/tests/framework/components/script/esm-scriptB.js",
    //             "enabled": true,
    //             "attributes": {}
    //         }]
    //     });
    //     e.addChild(c2);

    //     const c3 = new Entity('c3');
    //     const child3component = c3.addComponent('esmscript');
    //     await child3component.system.initializeComponentData(child3component, {
    //         "enabled": true,
    //         "modules": [{
    //             "moduleSpecifier": "/base/tests/framework/components/script/esm-scriptA.js",
    //             "enabled": true,
    //             "attributes": {}
    //         }, {
    //             "moduleSpecifier": "/base/tests/framework/components/script/esm-scriptB.js",
    //             "enabled": true,
    //             "attributes": {}
    //         }]
    //     });
    //     c1.addChild(c3);

    //     app.root.addChild(e);

    //     expect(initializeCalls.length).to.equal(8);

    //     await waitForNextFrame();

    //     expect(initializeCalls.length).to.equal(32);
    //     var idx = -1;
    //     checkInitCall(e, ++idx, 'initialize scriptA');
    //     checkInitCall(e, ++idx, 'initialize scriptB');
    //     checkInitCall(c1, ++idx, 'initialize scriptA');
    //     checkInitCall(c1, ++idx, 'initialize scriptB');
    //     checkInitCall(c3, ++idx, 'initialize scriptA');
    //     checkInitCall(c3, ++idx, 'initialize scriptB');
    //     checkInitCall(c2, ++idx, 'initialize scriptA');
    //     checkInitCall(c2, ++idx, 'initialize scriptB');

    //     checkInitCall(e, ++idx, 'active scriptA');
    //     checkInitCall(e, ++idx, 'active scriptB');
    //     checkInitCall(c1, ++idx, 'active scriptA');
    //     checkInitCall(c1, ++idx, 'active scriptB');
    //     checkInitCall(c2, ++idx, 'active scriptA');
    //     checkInitCall(c2, ++idx, 'active scriptB');
    //     checkInitCall(c3, ++idx, 'active scriptA');
    //     checkInitCall(c3, ++idx, 'active scriptB');

    //     checkInitCall(e, ++idx, 'update scriptA');
    //     checkInitCall(e, ++idx, 'update scriptB');
    //     checkInitCall(c1, ++idx, 'update scriptA');
    //     checkInitCall(c1, ++idx, 'update scriptB');
    //     checkInitCall(c2, ++idx, 'update scriptA');
    //     checkInitCall(c2, ++idx, 'update scriptB');
    //     checkInitCall(c3, ++idx, 'update scriptA');
    //     checkInitCall(c3, ++idx, 'update scriptB');
    // });

    // it("script attributes are initialized for enabled entity", async function () {
    //     var e2 = new Entity();
    //     app.root.addChild(e2);

    //     expect(e2).to.exist;

    //     var e = new Entity();
    //     const component = e.addComponent('esmscript');
    //     await component.system.initializeComponentData(component, {
    //         "enabled": true,
    //         "modules": [{
    //             "moduleSpecifier": "/base/tests/framework/components/script/esm-scriptWithAttributes.js",
    //             "enabled": true,
    //             "attributes": {
    //                 "attribute1": e2
    //             }
    //         }]
    //     });

    //     app.root.addChild(e);

    //     const script = e.esmscript.get('ScriptWithAttributes');

    //     expect(script.attribute1).to.equal(e2);
    //     expect(script.attribute2).to.equal(2);
    // });


    // it("script attributes are initialized with disabled entity", async function () {
    //     var e2 = new Entity();
    //     app.root.addChild(e2);

    //     expect(e2).to.exist;

    //     var e = new Entity();
    //     e.enabled = false;
    //     const component = e.addComponent('esmscript');
    //     await component.system.initializeComponentData(component, {
    //         "enabled": true,
    //         "modules": [{
    //             "moduleSpecifier": "/base/tests/framework/components/script/esm-scriptWithAttributes.js",
    //             "enabled": true,
    //             "attributes": {
    //                 "attribute1": e2
    //             }
    //         }]
    //     });

    //     app.root.addChild(e);

    //     const script = e.esmscript.get('ScriptWithAttributes');

    //     expect(script.attribute1).to.equal(e2);
    //     expect(script.attribute2).to.equal(2);
    // });


    // it("script attributes are initialized for disabled script component", async function () {
    //     var e2 = new Entity();
    //     app.root.addChild(e2);

    //     expect(e2).to.exist;

    //     var e = new Entity();
    //     const component = e.addComponent('esmscript');
    //     await component.system.initializeComponentData(component, {
    //         "enabled": false,
    //         "modules": [{
    //             "moduleSpecifier": "/base/tests/framework/components/script/esm-scriptWithAttributes.js",
    //             "enabled": true,
    //             "attributes": {
    //                 "attribute1": e2
    //             }
    //         }]
    //     });

    //     app.root.addChild(e);

    //     const script = e.esmscript.get('ScriptWithAttributes');

    //     expect(script.attribute1).to.equal(e2);
    //     expect(script.attribute2).to.equal(2);
    // });

    // it("script attributes are initialized for disabled script instance", async function () {
    //     var e2 = new Entity();
    //     app.root.addChild(e2);

    //     expect(e2).to.exist;

    //     var e = new Entity();
    //     const component = e.addComponent('esmscript');
    //     await component.system.initializeComponentData(component, {
    //         "enabled": true,
    //         "modules": [{
    //             "moduleSpecifier": "/base/tests/framework/components/script/esm-scriptWithAttributes.js",
    //             "enabled": false,
    //             "attributes": {
    //                 "attribute1": e2
    //             }
    //         }]
    //     });

    //     app.root.addChild(e);

    //     const script = e.esmscript.get('ScriptWithAttributes');

    //     expect(script.attribute1).to.equal(e2);
    //     expect(script.attribute2).to.equal(2);
    // });

    // it("script attributes are initialized when cloning enabled entity", async function () {
    //     var e2 = new Entity();
    //     app.root.addChild(e2);

    //     expect(e2).to.exist;

    //     var e = new Entity();
    //     const component = e.addComponent('esmscript');
    //     await component.system.initializeComponentData(component, {
    //         "enabled": true,
    //         "modules": [{
    //             "moduleSpecifier": "/base/tests/framework/components/script/esm-scriptWithAttributes.js",
    //             "enabled": true,
    //             "attributes": {
    //                 "attribute1": e2
    //             }
    //         }]
    //     });

    //     app.root.addChild(e);

    //     const script = e.esmscript.get('ScriptWithAttributes');

    //     expect(script.attribute1).to.equal(e2);
    //     expect(script.attribute2).to.equal(2);

    //     var clone = e.clone();
    //     app.root.addChild(clone);

    //     const clonedModule = clone.esmscript.get('ScriptWithAttributes');

    //     expect(clonedModule.attribute1).to.equal(e2);
    //     expect(clonedModule.attribute2).to.equal(2);

    // });

    // it("script attributes are initialized when cloning disabled entity", async function () {
    //     var e2 = new Entity();
    //     app.root.addChild(e2);

    //     expect(e2).to.exist;

    //     var e = new Entity();
    //     e.enabled = false;
    //     const component = e.addComponent('esmscript');
    //     await component.system.initializeComponentData(component, {
    //         "enabled": true,
    //         "modules": [{
    //             "moduleSpecifier": "/base/tests/framework/components/script/esm-scriptWithAttributes.js",
    //             "enabled": true,
    //             "attributes": {
    //                 "attribute1": e2
    //             }
    //         }]
    //     });

    //     app.root.addChild(e);

    //     const script = e.esmscript.get('ScriptWithAttributes');

    //     expect(script.attribute1).to.equal(e2);
    //     expect(script.attribute2).to.equal(2);

    //     var clone = e.clone();
    //     app.root.addChild(clone);

    //     const clonedModule = clone.esmscript.get('ScriptWithAttributes');

    //     expect(clonedModule.attribute1).to.equal(e2);
    //     expect(clonedModule.attribute2).to.equal(2);
    // });

    // it("script attributes are initialized when cloning disabled script component", async function () {
    //     var e2 = new Entity();
    //     app.root.addChild(e2);

    //     expect(e2).to.exist;

    //     var e = new Entity();
    //     const component = e.addComponent('esmscript');
    //     await component.system.initializeComponentData(component, {
    //         "enabled": false,
    //         "modules": [{
    //             "moduleSpecifier": "/base/tests/framework/components/script/esm-scriptWithAttributes.js",
    //             "enabled": true,
    //             "attributes": {
    //                 "attribute1": e2
    //             }
    //         }]
    //     });

    //     app.root.addChild(e);

    //     const script = e.esmscript.get('ScriptWithAttributes');

    //     expect(script.attribute1).to.equal(e2);
    //     expect(script.attribute2).to.equal(2);

    //     var clone = e.clone();
    //     app.root.addChild(clone);

    //     const clonedModule = clone.esmscript.get('ScriptWithAttributes');

    //     expect(clonedModule.attribute1).to.equal(e2);
    //     expect(clonedModule.attribute2).to.equal(2);
    // });

    // it("script attributes are initialized when cloning disabled script instance", async function () {
    //     var e2 = new Entity();
    //     app.root.addChild(e2);

    //     expect(e2).to.exist;

    //     var e = new Entity();
    //     const component = e.addComponent('esmscript');
    //     await component.system.initializeComponentData(component, {
    //         "enabled": true,
    //         "modules": [{
    //             "moduleSpecifier": "/base/tests/framework/components/script/esm-scriptWithAttributes.js",
    //             "enabled": false,
    //             "attributes": {
    //                 "attribute1": e2
    //             }
    //         }]
    //     });

    //     app.root.addChild(e);

    //     const script = e.esmscript.get('ScriptWithAttributes');

    //     expect(script.attribute1).to.equal(e2);
    //     expect(script.attribute2).to.equal(2);

    //     var clone = e.clone();
    //     app.root.addChild(clone);

    //     const clonedModule = clone.esmscript.get('ScriptWithAttributes');

    //     expect(clonedModule.attribute1).to.equal(e2);
    //     expect(clonedModule.attribute2).to.equal(2);
    // });


    // it("script attributes are initialized when loading scene for enabled entity", async function () {
    //     var a = app.root.findByName('EnabledEntity');
    //     expect(a).to.exist;

    //     var b = app.root.findByName('ReferencedEntity');
    //     expect(b).to.exist;

    //     expect(a.esmscript).to.exist;

    //     await waitForNextFrame();

    //     const scriptWithAttributes = a.esmscript.get('ScriptWithAttributes');

    //     expect(scriptWithAttributes).to.exist;

    //     expect(scriptWithAttributes.attribute1).to.equal(b);
    //     expect(scriptWithAttributes.attribute2).to.equal(2);
    // });

    // it("script attributes are initialized when loading scene for disabled entity", async function () {
    //     var a = app.root.findByName('DisabledEntity');

    //     var b = app.root.findByName('ReferencedEntity');

    //     expect(a).to.exist;
    //     expect(b).to.exist;

    //     await waitForNextFrame();

    //     const scriptWithAttributes = a.esmscript.get('ScriptWithAttributes');

    //     expect(scriptWithAttributes).to.exist;

    //     expect(scriptWithAttributes.attribute1).to.equal(b);
    //     expect(scriptWithAttributes.attribute2).to.equal(2);
    // });

    // it("script attributes are initialized when loading scene for disabled script component", async function () {
    //     var a = app.root.findByName('DisabledScriptComponent');
    //     expect(a).to.exist;

    //     var b = app.root.findByName('ReferencedEntity');
    //     expect(b).to.exist;

    //     await waitForNextFrame();

    //     const scriptWithAttributes = a.esmscript.get('ScriptWithAttributes');

    //     expect(scriptWithAttributes).to.exist;

    //     expect(scriptWithAttributes.attribute1).to.equal(b);
    //     expect(scriptWithAttributes.attribute2).to.equal(2);
    // });

    // it("script attributes are initialized when loading scene for disabled script instance", async function () {
    //     var a = app.root.findByName('DisabledScriptInstance');
    //     expect(a).to.exist;

    //     var b = app.root.findByName('ReferencedEntity');
    //     expect(b).to.exist;

    //     await waitForNextFrame();

    //     const scriptWithAttributes = a.esmscript.get('ScriptWithAttributes');

    //     expect(scriptWithAttributes).to.exist;

    //     expect(scriptWithAttributes.attribute1).to.equal(b);
    //     expect(scriptWithAttributes.attribute2).to.equal(2);
    // });

    // it('script attributes are initialized when reloading scene', function (done) {
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

    // it('invalid or malformed script attributes initialize correctly', async function () {
    //     var e = new Entity();
    //     const component = e.addComponent('esmscript');
    //     await component.system.initializeComponentData(component, {
    //         "enabled": true,
    //         "modules": [{
    //             moduleSpecifier: "/base/tests/framework/components/script/esm-scriptWithAttributes.js",
    //             enabled: true,
    //             attributes: {
    //                 invalidAttribute: 'Should not instantiate',
    //                 invalidAttributeType: 'Should not instantiate',
    //                 invalidAttributeTypeWithDefault: 'Should not instantiate',
    //                 invalidAttributeTypeArray: ['Should not instantiate']
    //             }
    //         }]
    //     });

    //     app.root.addChild(e);

    //     await waitForNextFrame();

    //     const script = e.esmscript.get('ScriptWithAttributes');

    //     // invalid attribute
    //     expect(script.invalidAttribute).to.equal(undefined);

    //     // invalid attribute type
    //     expect(script.invalidAttributeType).to.equal(undefined);

    //     // invalid attribute type with default
    //     expect(script.invalidAttributeTypeWithDefault).to.equal(undefined);

    //     // invalid attribute type with array
    //     expect(script.invalidAttributeTypeArray).to.be.an.instanceOf(Array);

    // });

    // it('Defaults: simple script attributes initialize with correct defaults', async function () {
    //     var e = new Entity();
    //     const component = e.addComponent('esmscript');
    //     await component.system.initializeComponentData(component, {
    //         "enabled": true,
    //         "modules": [{
    //             moduleSpecifier: "/base/tests/framework/components/script/esm-scriptWithAttributes.js",
    //             enabled: true
    //         }]
    //     });

    //     app.root.addChild(e);

    //     const script = e.esmscript.get('ScriptWithAttributes');

    //     // simple attribute - No default
    //     expect(script.simpleAttributeNoDefault).to.equal(undefined);

    //     // simple attribute - No default
    //     expect(script.simpleAttributeWithFalsyDefault).to.equal(false);

    //     // simple attribute - w/ default
    //     expect(script.simpleAttribute).to.equal(10);

    //     // simple color attribute - w/ default
    //     expect(script.simpleColorHex).to.be.an.instanceof(Color);

    //     // simple attribute - w/ default
    //     expect(script.simpleColorAsArray).to.be.an.instanceof(Color);

    //     // simple attribute array - w/ default
    //     expect(script.simpleAttributeArray).to.be.an.instanceof(Array);
    //     expect(script.simpleAttributeArray).to.have.lengthOf(1);
    //     expect(script.simpleAttributeArray[0]).to.equal(10);

    //     // Simple attribute array with an invalid default
    //     expect(script.simpleAttributeArrayInvalidDefault).to.be.an.instanceOf(Array);
    //     expect(script.simpleAttributeArrayInvalidDefault).to.have.lengthOf(0);

    //     // simple attribute array - no default
    //     expect(script.simpleAttributeArrayNoDefault).to.be.an.instanceof(Array);
    //     expect(script.simpleAttributeArrayNoDefault).to.have.lengthOf(0);

    //     // simple attribute array - w/ default array
    //     expect(script.simpleAttributeArrayWithDefaultArray).to.be.an.instanceof(Array);
    //     expect(script.simpleAttributeArrayWithDefaultArray).to.have.lengthOf(3);
    //     expect(script.simpleAttributeArrayWithDefaultArray).to.deep.equal([10, 20, 30]);

    // });

    // it('Override: simple script attributes initialize with correct values', async function () {
    //     var e = new Entity();
    //     const component = e.addComponent('esmscript');
    //     await component.system.initializeComponentData(component, {
    //         "enabled": true,
    //         "modules": [{
    //             moduleSpecifier: "/base/tests/framework/components/script/esm-scriptWithAttributes.js",
    //             enabled: true,
    //             attributes: {
    //                 simpleAttributeNoDefault: 54321,
    //                 simpleAttributeWithFalsyDefault: true,
    //                 simpleAttribute: 1234,
    //                 simpleColorHex: [0.5, 0.5, 0.5, 0.5],
    //                 simpleColorAsArray: [0.9, 0.8, 0.7, 0.6],
    //                 simpleAttributeArray: [1, 2, 4, 5],
    //                 simpleAttributeArrayInvalidDefault: [123],
    //                 simpleAttributeArrayNoDefault: [1, 2, 3, 4],
    //                 simpleAttributeArrayWithDefaultArray: [9, 8, 7]
    //             }
    //         }]
    //     });

    //     app.root.addChild(e);

    //     await waitForNextFrame();

    //     const script = e.esmscript.get('ScriptWithAttributes');

    //     // simple attribute - No default
    //     expect(script.simpleAttributeNoDefault).to.equal(54321);

    //     // // simple attribute - No default
    //     expect(script.simpleAttributeWithFalsyDefault).to.equal(true);

    //     // // simple attribute - w/ default
    //     expect(script.simpleAttribute).to.equal(1234);

    //     // simple color attribute - w/ default
    //     expect(script.simpleColorHex).to.be.an.instanceof(Color);
    //     expect({ ...script.simpleColorHex }).to.deep.equal({ r: 0.5, g: 0.5, b: 0.5, a: 0.5 });

    //     // simple attribute - w/ default
    //     expect(script.simpleColorAsArray).to.be.an.instanceof(Color);
    //     expect({ ...script.simpleColorAsArray }).to.deep.equal({ r: 0.9, g: 0.8, b: 0.7, a: 0.6 });

    //     // simple attribute array - w/ default
    //     expect(script.simpleAttributeArray).to.be.an.instanceof(Array);
    //     expect(script.simpleAttributeArray).to.have.lengthOf(4);
    //     expect(script.simpleAttributeArray).to.deep.equal([1, 2, 4, 5]);

    //     // Simple attribute array with an invalid default
    //     expect(script.simpleAttributeArrayInvalidDefault).to.be.an.instanceOf(Array);
    //     expect(script.simpleAttributeArrayInvalidDefault).to.have.lengthOf(1);
    //     expect(script.simpleAttributeArrayInvalidDefault).to.deep.equal([123]);

    //     // simple attribute array - no default
    //     expect(script.simpleAttributeArrayNoDefault).to.be.an.instanceof(Array);
    //     expect(script.simpleAttributeArrayNoDefault).to.have.lengthOf(4);
    //     expect(script.simpleAttributeArrayNoDefault).to.deep.equal([1, 2, 3, 4]);

    //     // simple attribute array - w/ default array
    //     expect(script.simpleAttributeArrayWithDefaultArray).to.be.an.instanceof(Array);
    //     expect(script.simpleAttributeArrayWithDefaultArray).to.have.lengthOf(3);
    //     expect(script.simpleAttributeArrayWithDefaultArray).to.deep.equal([9, 8, 7]);

    // });

    // it('Defaults: complex script attributes initialize with correct defaults', async function () {
    //     var e = new Entity();
    //     const component = e.addComponent('esmscript');
    //     await component.system.initializeComponentData(component, {
    //         "enabled": true,
    //         "modules": [{
    //             moduleSpecifier: "/base/tests/framework/components/script/esm-scriptWithAttributes.js",
    //             enabled: true
    //         }]
    //     });

    //     app.root.addChild(e);

    //     await waitForNextFrame();

    //     const script = e.esmscript.get('ScriptWithAttributes');

    //     // complex attribute - no default
    //     expect(script.complexAttributeNoDefault).to.be.a('object');
    //     expect(script.complexAttributeNoDefault.internalNumberNoDefault).to.equal(undefined);
    //     expect(script.complexAttributeNoDefault.internalNumber).to.equal(1);
    //     expect(script.complexAttributeNoDefault.internalArrayNoDefault).to.deep.equal([]);
    //     expect(script.complexAttributeNoDefault.internalArray).to.deep.equal([1, 2, 3, 4]);
    //     expect(script.complexAttributeNoDefault.internalColor).to.be.an.instanceOf(Color);

    //     // complex attribute - w/ default
    //     expect(script.complexAttribute).to.be.a('object');
    //     expect(script.complexAttribute.internalNumberNoDefault).to.equal(10);
    //     expect(script.complexAttribute.internalNumber).to.equal(1);
    //     expect(script.complexAttribute.internalArrayNoDefault).to.deep.equal([]);
    //     expect(script.complexAttribute.internalArray).to.deep.equal([6, 7, 8, 9]);
    //     expect(script.complexAttribute.internalColor).to.be.an.instanceOf(Color);
    //     expect(script.complexAttribute.nonExistent).to.equal(undefined);

    // });

    // it('Overrides: complex script attributes initialize with correct defaults', async function () {
    //     var e = new Entity();
    //     const component = e.addComponent('esmscript');
    //     await component.system.initializeComponentData(component, {
    //         "enabled": true,
    //         "modules": [{
    //             moduleSpecifier: "/base/tests/framework/components/script/esm-scriptWithAttributes.js",
    //             enabled: true,
    //             attributes: {
    //                 complexAttributeNoDefault: {
    //                     internalNumberNoDefault: 20,
    //                     internalNumber: 10,
    //                     internalArrayNoDefault: [1, 2, 3],
    //                     internalArray: [9, 8, 7],
    //                     internalColor: '#ffffff'
    //                 },
    //                 complexAttribute: {
    //                     internalNumberNoDefault: 1,
    //                     internalNumber: 2,
    //                     internalArrayNoDefault: [1, 2, 3],
    //                     internalArray: [9, 8, 7],
    //                     internalColor: '#ffffff',
    //                     nonExistent: 'SHOULD NOT EXIST'
    //                 }
    //             }
    //         }]
    //     });

    //     app.root.addChild(e);

    //     await waitForNextFrame();

    //     const script = e.esmscript.get('ScriptWithAttributes');

    //     // complex attribute - no default
    //     expect(script.complexAttributeNoDefault).to.be.a('object');
    //     expect(script.complexAttributeNoDefault.internalNumberNoDefault).to.equal(20);
    //     expect(script.complexAttributeNoDefault.internalNumber).to.equal(10);
    //     expect(script.complexAttributeNoDefault.internalArrayNoDefault).to.deep.equal([1, 2, 3]);
    //     expect(script.complexAttributeNoDefault.internalArray).to.deep.equal([9, 8, 7]);
    //     expect(script.complexAttributeNoDefault.internalColor).to.be.an.instanceOf(Color);
    //     expect({ ...script.complexAttributeNoDefault.internalColor }).to.deep.equal({ r: 1, g: 1, b: 1, a: 1 });

    //     // complex attribute - w/ default
    //     expect(script.complexAttribute).to.be.a('object');
    //     expect(script.complexAttribute.internalNumberNoDefault).to.equal(1);
    //     expect(script.complexAttribute.internalNumber).to.equal(2);
    //     expect(script.complexAttribute.internalArrayNoDefault).to.deep.equal([1, 2, 3]);
    //     expect(script.complexAttribute.internalArray).to.deep.equal([9, 8, 7]);
    //     expect(script.complexAttribute.internalColor).to.be.an.instanceOf(Color);
    //     expect({ ...script.complexAttribute.internalColor }).to.deep.equal({ r: 1, g: 1, b: 1, a: 1 });
    //     expect(script.complexAttribute.nonExistent).to.equal(undefined);

    // });

    // it('default values work for partially initialized script attributes', async function () {
    //     var e = new Entity();
    //     const component = e.addComponent('esmscript');
    //     await component.system.initializeComponentData(component, {
    //         modules: [{
    //             moduleSpecifier: "/base/tests/framework/components/script/esm-scriptWithAttributes.js",
    //             enabled: true,
    //             attributes: {
    //                 attribute2: 3,
    //                 attribute3: {
    //                     internalNumber: 10,
    //                     internalArrayNoDefault: [4]
    //                 }
    //             }
    //         }]
    //     });

    //     app.root.addChild(e);

    //     const script = e.esmscript.get('ScriptWithAttributes');

    //     expect(script).to.exist;
    //     expect(script.attribute3.internalNumber).to.equal(10);

    //     expect(script.attribute3.internalArrayNoDefault).to.deep.equal([4]);
    //     expect(script.attribute3.internalArray).to.deep.equal([1, 2, 3, 4]);
    // });

    // describe('Warnings and notifications', function(){

    //     it('should warn when assigning an invalid value to a attribute', async function () {

    //         var e = new Entity();
    //         app.root.addChild(e);
    //         e.addComponent('esmscript');
    //         const EsmScript = await import('/base/tests/framework/components/script/esm-scriptWithSimpleAttributes.js')

    //         // collect warnings
    //         const warnings = [];
    //         Debug.warn = warning => warnings.push(warning);

    //         const module = e.esmscript.add(EsmScript, {
    //             simpleAttribute: 'This should warn',
    //             simpleAttributeNoDefault: 'Yep, another warning',
    //             attribute3: 'yep, more warnings',
    //         });

    //         expect(warnings).to.have.a.lengthOf(2);

    //     })
    // })

});
