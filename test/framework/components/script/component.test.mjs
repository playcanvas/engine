import { expect } from 'chai';

import { Debug } from '../../../../src/core/debug.js';
import { Asset } from '../../../../src/framework/asset/asset.js';
import { Entity } from '../../../../src/framework/entity.js';
import { createScript } from '../../../../src/framework/script/script-create.js';
import { Script } from '../../../../src/framework/script/script.js';
import { createApp } from '../../../app.mjs';
import { jsdomSetup, jsdomTeardown } from '../../../jsdom.mjs';

describe('ScriptComponent', function () {

    const scripts = ['cloner', 'destroyer', 'disabler', 'enabler', 'loadedLater', 'postCloner', 'postInitializeReporter', 'scriptA', 'scriptB', 'scriptWithAttributes'];

    let app;

    beforeEach(function (done) {
        jsdomSetup();
        app = createApp();

        window.initializeCalls = [];

        const assets = scripts.map(script => new Asset(`${script}.js`, 'script', {
            url: `http://localhost:3000/test/assets/scripts/${script}.js`
        }));
        assets.forEach((asset) => {
            asset.preload = asset.name !== 'loadedLater.js';
            app.assets.add(asset);
        });
        app.preload(function () {
            app.scenes.loadScene('http://localhost:3000/test/assets/scenes/scene1.json', function () {
                app.start();
                done();
            });
        });
    });

    afterEach(function () {
        app?.destroy();
        app = null;
        jsdomTeardown();
    });

    function checkInitCall(entity, index, text) {
        expect(window.initializeCalls[index]).to.equal(`${entity.getGuid()} ${text}`);
    }

    it('script assets are loaded', function () {
        for (const script of scripts) {
            if (script !== 'loadedLater') {
                expect(app.scripts.get(script)).to.exist;
            }
        }
    });

    it('initialize and postInitialize are called on new entity', function () {
        const e = new Entity();

        e.addComponent('script', {
            enabled: true,
            order: ['scriptA'],
            scripts: {
                scriptA: {
                    enabled: true,
                    attributes: {}
                }
            }
        });

        expect(e.script.scriptA).to.exist;
        expect(window.initializeCalls.length).to.equal(0);

        app.root.addChild(e);

        expect(window.initializeCalls.length).to.equal(2);
        checkInitCall(e, 0, 'initialize scriptA');
        checkInitCall(e, 1, 'postInitialize scriptA');
    });

    it('all initialize calls are before all postInitialize calls on new entity', function () {
        const e = new Entity();

        e.addComponent('script', {
            enabled: true,
            order: ['scriptA', 'scriptB'],
            scripts: {
                scriptA: {
                    enabled: true,
                    attributes: {}
                },
                scriptB: {
                    enabled: true,
                    attributes: {}
                }
            }
        });

        expect(e.script.scriptA).to.exist;
        expect(e.script.scriptB).to.exist;

        expect(window.initializeCalls.length).to.equal(0);

        app.root.addChild(e);

        expect(window.initializeCalls.length).to.equal(4);
        checkInitCall(e, 0, 'initialize scriptA');
        checkInitCall(e, 1, 'initialize scriptB');
        checkInitCall(e, 2, 'postInitialize scriptA');
        checkInitCall(e, 3, 'postInitialize scriptB');
    });

    it('initialize and postInitialize are called on entity that is enabled later', function () {
        const e = new Entity();
        e.enabled = false;
        e.addComponent('script', {
            enabled: true,
            order: ['scriptA'],
            scripts: {
                scriptA: {
                    enabled: true,
                    attributes: {}
                }
            }
        });

        expect(e.script.scriptA).to.exist;
        expect(window.initializeCalls.length).to.equal(0);

        app.root.addChild(e);
        expect(window.initializeCalls.length).to.equal(0);

        e.enabled = true;
        expect(window.initializeCalls.length).to.equal(2);
        checkInitCall(e, 0, 'initialize scriptA');
        checkInitCall(e, 1, 'postInitialize scriptA');
    });

    it('initialize and postInitialize are called on script component that is enabled later', function () {
        const e = new Entity();
        e.addComponent('script', {
            enabled: false,
            order: ['scriptA'],
            scripts: {
                scriptA: {
                    enabled: true,
                    attributes: {}
                }
            }
        });

        expect(e.script.scriptA).to.exist;
        expect(window.initializeCalls.length).to.equal(0);

        app.root.addChild(e);
        expect(window.initializeCalls.length).to.equal(0);

        e.script.enabled = true;
        expect(window.initializeCalls.length).to.equal(2);
        checkInitCall(e, 0, 'initialize scriptA');
        checkInitCall(e, 1, 'postInitialize scriptA');
    });

    it('initialize and postInitialize are called on script instance that is enabled later', function () {
        const e = new Entity();
        e.addComponent('script', {
            enabled: true,
            order: ['scriptA'],
            scripts: {
                scriptA: {
                    enabled: false,
                    attributes: {}
                }
            }
        });

        expect(e.script.scriptA).to.exist;
        expect(window.initializeCalls.length).to.equal(0);

        app.root.addChild(e);
        expect(window.initializeCalls.length).to.equal(0);

        e.script.scriptA.enabled = true;
        expect(window.initializeCalls.length).to.equal(2);
        checkInitCall(e, 0, 'initialize scriptA');
        checkInitCall(e, 1, 'postInitialize scriptA');
    });

    it('initialize and postInitialize are called on script instance that is created later', function () {
        const e = new Entity();
        app.root.addChild(e);
        e.addComponent('script');
        e.script.create('scriptA');
        expect(e.script.scriptA).to.exist;
        expect(window.initializeCalls.length).to.equal(2);
        checkInitCall(e, 0, 'initialize scriptA');
        checkInitCall(e, 1, 'postInitialize scriptA');
    });

    it('initialize and postInitialize are called on cloned enabled entity', function () {
        const e = new Entity();

        e.addComponent('script', {
            enabled: true,
            order: ['scriptA', 'scriptB'],
            scripts: {
                scriptA: {
                    enabled: true,
                    attributes: {}
                },
                scriptB: {
                    enabled: true,
                    attributes: {}
                }
            }
        });

        app.root.addChild(e);

        const clone = e.clone();
        expect(window.initializeCalls.length).to.equal(4);

        app.root.addChild(clone);
        expect(window.initializeCalls.length).to.equal(8);

        checkInitCall(e, 0, 'initialize scriptA');
        checkInitCall(e, 1, 'initialize scriptB');
        checkInitCall(e, 2, 'postInitialize scriptA');
        checkInitCall(e, 3, 'postInitialize scriptB');

        checkInitCall(clone, 4, 'initialize scriptA');
        checkInitCall(clone, 5, 'initialize scriptB');
        checkInitCall(clone, 6, 'postInitialize scriptA');
        checkInitCall(clone, 7, 'postInitialize scriptB');
    });

    it('all initialize calls are before postInitialize calls when enabling entity from inside initilize function', function () {
        const e = new Entity('entity to enable');
        e.enabled = false;

        e.addComponent('script', {
            enabled: true,
            order: ['scriptA', 'scriptB'],
            scripts: {
                scriptA: {
                    enabled: true,
                    attributes: {}
                },
                scriptB: {
                    enabled: true,
                    attributes: {}
                }
            }
        });

        app.root.addChild(e);

        expect(window.initializeCalls.length).to.equal(0);

        const enabler = new Entity('enabler');

        enabler.addComponent('script', {
            enabled: true,
            order: ['enabler'],
            scripts: {
                enabler: {
                    enabled: true,
                    attributes: {
                        entityToEnable: e.getGuid()
                    }
                }
            }
        });

        app.root.addChild(enabler);

        expect(window.initializeCalls.length).to.equal(6);
        checkInitCall(enabler, 0, 'initialize enabler');
        checkInitCall(e, 1, 'initialize scriptA');
        checkInitCall(e, 2, 'initialize scriptB');
        checkInitCall(e, 3, 'postInitialize scriptA');
        checkInitCall(e, 4, 'postInitialize scriptB');
        checkInitCall(enabler, 5, 'postInitialize enabler');
    });

    it('all initialize calls are before postInitialize calls for entity whose script component is enabled inside initilize function', function () {
        const e = new Entity('entity to enable');

        e.addComponent('script', {
            enabled: false,
            order: ['scriptA', 'scriptB'],
            scripts: {
                scriptA: {
                    enabled: true,
                    attributes: {}
                },
                scriptB: {
                    enabled: true,
                    attributes: {}
                }
            }
        });

        app.root.addChild(e);

        expect(window.initializeCalls.length).to.equal(0);

        const enabler = new Entity();

        enabler.addComponent('script', {
            enabled: true,
            order: ['enabler'],
            scripts: {
                enabler: {
                    enabled: true,
                    attributes: {
                        entityToEnable: e.getGuid()
                    }
                }
            }
        });

        app.root.addChild(enabler);

        expect(window.initializeCalls.length).to.equal(6);
        checkInitCall(enabler, 0, 'initialize enabler');
        checkInitCall(e, 1, 'initialize scriptA');
        checkInitCall(e, 2, 'initialize scriptB');
        checkInitCall(e, 3, 'postInitialize scriptA');
        checkInitCall(e, 4, 'postInitialize scriptB');
        checkInitCall(enabler, 5, 'postInitialize enabler');

    });

    it('initialize and postInitialize are fired together for script instance that is enabled in initialize function', function () {
        const e = new Entity('entity to enable');

        e.addComponent('script', {
            enabled: true,
            order: ['scriptA', 'scriptB'],
            scripts: {
                scriptA: {
                    enabled: false,
                    attributes: {}
                },
                scriptB: {
                    enabled: false,
                    attributes: {}
                }
            }
        });

        app.root.addChild(e);

        expect(window.initializeCalls.length).to.equal(0);

        const enabler = new Entity();

        enabler.addComponent('script', {
            enabled: true,
            order: ['enabler'],
            scripts: {
                enabler: {
                    enabled: true,
                    attributes: {
                        entityToEnable: e.getGuid()
                    }
                }
            }
        });

        app.root.addChild(enabler);

        expect(window.initializeCalls.length).to.equal(6);
        let idx = -1;
        checkInitCall(enabler, ++idx, 'initialize enabler');
        checkInitCall(e, ++idx, 'initialize scriptA');
        checkInitCall(e, ++idx, 'postInitialize scriptA');
        checkInitCall(e, ++idx, 'initialize scriptB');
        checkInitCall(e, ++idx, 'postInitialize scriptB');
        checkInitCall(enabler, ++idx, 'postInitialize enabler');

    });

    it('initialize is called for entity and all children before postInitialize', function () {
        const e = new Entity();

        e.addComponent('script', {
            enabled: true,
            order: ['scriptA', 'scriptB'],
            scripts: {
                scriptA: {
                    enabled: true,
                    attributes: {}
                },
                scriptB: {
                    enabled: true,
                    attributes: {}
                }
            }
        });

        const c1 = new Entity();
        c1.addComponent('script', {
            enabled: true,
            order: ['scriptA', 'scriptB'],
            scripts: {
                scriptA: {
                    enabled: true,
                    attributes: {}
                },
                scriptB: {
                    enabled: true,
                    attributes: {}
                }
            }
        });
        e.addChild(c1);

        const c2 = new Entity();
        c2.addComponent('script', {
            enabled: true,
            order: ['scriptA', 'scriptB'],
            scripts: {
                scriptA: {
                    enabled: true,
                    attributes: {}
                },
                scriptB: {
                    enabled: true,
                    attributes: {}
                }
            }
        });
        e.addChild(c2);

        const c3 = new Entity();
        c3.addComponent('script', {
            enabled: true,
            order: ['scriptA', 'scriptB'],
            scripts: {
                scriptA: {
                    enabled: true,
                    attributes: {}
                },
                scriptB: {
                    enabled: true,
                    attributes: {}
                }
            }
        });

        c1.addChild(c3);

        expect(window.initializeCalls.length).to.equal(0);

        app.root.addChild(e);

        expect(window.initializeCalls.length).to.equal(16);
        let idx = -1;
        checkInitCall(e, ++idx, 'initialize scriptA');
        checkInitCall(e, ++idx, 'initialize scriptB');
        checkInitCall(c1, ++idx, 'initialize scriptA');
        checkInitCall(c1, ++idx, 'initialize scriptB');
        checkInitCall(c3, ++idx, 'initialize scriptA');
        checkInitCall(c3, ++idx, 'initialize scriptB');
        checkInitCall(c2, ++idx, 'initialize scriptA');
        checkInitCall(c2, ++idx, 'initialize scriptB');

        checkInitCall(e, ++idx, 'postInitialize scriptA');
        checkInitCall(e, ++idx, 'postInitialize scriptB');
        checkInitCall(c1, ++idx, 'postInitialize scriptA');
        checkInitCall(c1, ++idx, 'postInitialize scriptB');
        checkInitCall(c3, ++idx, 'postInitialize scriptA');
        checkInitCall(c3, ++idx, 'postInitialize scriptB');
        checkInitCall(c2, ++idx, 'postInitialize scriptA');
        checkInitCall(c2, ++idx, 'postInitialize scriptB');
    });

    it('postInitialize is called for entities that are cloned in another postInitialize', function () {
        const src = new Entity();
        src.enabled = false;
        src.addComponent('script', {
            enabled: true,
            order: ['postInitializeReporter'],
            'scripts': {
                postInitializeReporter: {
                    enabled: true,
                    attributes: {}
                }
            }
        });

        app.root.addChild(src);

        const e = new Entity();
        e.addComponent('script', {
            enabled: true,
            order: ['postCloner'],
            scripts: {
                postCloner: {
                    enabled: true,
                    attributes: {
                        entityToClone: src.getGuid()
                    }
                }
            }
        });

        app.root.addChild(e);

        expect(window.initializeCalls.length).to.equal(1);
    });

    it('script attributes are initialized for enabled entity', function () {
        const e2 = new Entity();
        app.root.addChild(e2);

        expect(e2).to.exist;

        const e = new Entity();
        e.addComponent('script', {
            enabled: true,
            order: ['scriptWithAttributes'],
            scripts: {
                scriptWithAttributes: {
                    enabled: true,
                    attributes: {
                        attribute1: e2.getGuid()
                    }
                }
            }
        });

        app.root.addChild(e);

        expect(e.script.scriptWithAttributes.attribute1).to.equal(e2);
        expect(e.script.scriptWithAttributes.attribute2).to.equal(2);
    });


    it('script attributes are initialized with disabled entity', function () {
        const e2 = new Entity();
        app.root.addChild(e2);
        expect(e2).to.exist;

        const e = new Entity();
        e.enabled = false;
        e.addComponent('script', {
            enabled: true,
            order: ['scriptWithAttributes'],
            scripts: {
                scriptWithAttributes: {
                    enabled: true,
                    attributes: {
                        attribute1: e2.getGuid()
                    }
                }
            }
        });

        app.root.addChild(e);
        expect(e.script.scriptWithAttributes.attribute1).to.equal(e2);
        expect(e.script.scriptWithAttributes.attribute2).to.equal(2);
    });


    it('script attributes are initialized for disabled script component', function () {
        const e2 = new Entity();
        app.root.addChild(e2);
        expect(e2).to.exist;

        const e = new Entity();
        e.addComponent('script', {
            enabled: false,
            order: ['scriptWithAttributes'],
            scripts: {
                scriptWithAttributes: {
                    enabled: true,
                    attributes: {
                        attribute1: e2.getGuid()
                    }
                }
            }
        });

        app.root.addChild(e);
        expect(e.script.scriptWithAttributes.attribute1).to.equal(e2);
        expect(e.script.scriptWithAttributes.attribute2).to.equal(2);
    });

    it('script attributes are initialized for disabled script instance', function () {
        const e2 = new Entity();
        app.root.addChild(e2);
        expect(e2).to.exist;

        const e = new Entity();
        e.addComponent('script', {
            enabled: true,
            order: ['scriptWithAttributes'],
            scripts: {
                scriptWithAttributes: {
                    enabled: false,
                    attributes: {
                        attribute1: e2.getGuid()
                    }
                }
            }
        });

        app.root.addChild(e);
        expect(e.script.scriptWithAttributes.attribute1).to.equal(e2);
        expect(e.script.scriptWithAttributes.attribute2).to.equal(2);
    });

    it('script attributes are initialized when cloning enabled entity', function () {
        const e2 = new Entity();
        app.root.addChild(e2);
        expect(e2).to.exist;

        const e = new Entity();
        e.addComponent('script', {
            enabled: true,
            order: ['scriptWithAttributes'],
            scripts: {
                scriptWithAttributes: {
                    enabled: true,
                    attributes: {
                        attribute1: e2.getGuid()
                    }
                }
            }
        });

        app.root.addChild(e);

        const clone = e.clone();
        app.root.addChild(clone);

        expect(clone.script.scriptWithAttributes.attribute1).to.equal(e2);
        expect(clone.script.scriptWithAttributes.attribute2).to.equal(2);
    });

    it('script attributes are initialized when cloning disabled entity', function () {
        const e2 = new Entity();
        app.root.addChild(e2);
        expect(e2).to.exist;

        const e = new Entity();
        e.enabled = false;
        e.addComponent('script', {
            enabled: true,
            order: ['scriptWithAttributes'],
            scripts: {
                scriptWithAttributes: {
                    enabled: true,
                    attributes: {
                        attribute1: e2.getGuid()
                    }
                }
            }
        });

        app.root.addChild(e);

        const clone = e.clone();
        app.root.addChild(clone);

        expect(clone.script.scriptWithAttributes.attribute1).to.equal(e2);
        expect(clone.script.scriptWithAttributes.attribute2).to.equal(2);
    });

    it('script attributes are initialized when cloning disabled script component', function () {
        const e2 = new Entity();
        app.root.addChild(e2);
        expect(e2).to.exist;

        const e = new Entity();
        e.addComponent('script', {
            enabled: false,
            order: ['scriptWithAttributes'],
            scripts: {
                scriptWithAttributes: {
                    enabled: true,
                    attributes: {
                        attribute1: e2.getGuid()
                    }
                }
            }
        });

        app.root.addChild(e);

        const clone = e.clone();
        app.root.addChild(clone);

        expect(clone.script.scriptWithAttributes.attribute1).to.equal(e2);
        expect(clone.script.scriptWithAttributes.attribute2).to.equal(2);
    });

    it('script attributes are initialized when cloning disabled script instance', function () {
        const e2 = new Entity();
        app.root.addChild(e2);
        expect(e2).to.exist;

        const e = new Entity();
        e.addComponent('script', {
            enabled: true,
            order: ['scriptWithAttributes'],
            scripts: {
                scriptWithAttributes: {
                    enabled: false,
                    attributes: {
                        attribute1: e2.getGuid()
                    }
                }
            }
        });

        app.root.addChild(e);

        const clone = e.clone();
        app.root.addChild(clone);

        expect(clone.script.scriptWithAttributes.attribute1).to.equal(e2);
        expect(clone.script.scriptWithAttributes.attribute2).to.equal(2);
    });


    it('script attributes are initialized when loading scene for enabled entity', function () {
        const a = app.root.findByName('EnabledEntity');
        expect(a).to.exist;

        const b = app.root.findByName('ReferencedEntity');
        expect(b).to.exist;

        expect(a.script.scriptWithAttributes.attribute1).to.equal(b);
        expect(a.script.scriptWithAttributes.attribute2).to.equal(2);
    });

    it('script attributes are initialized when loading scene for disabled entity', function () {
        const a = app.root.findByName('DisabledEntity');

        const b = app.root.findByName('ReferencedEntity');

        expect(a).to.exist;
        expect(b).to.exist;

        expect(a.script.scriptWithAttributes.attribute1).to.equal(b);
        expect(a.script.scriptWithAttributes.attribute2).to.equal(2);
    });

    it('script attributes are initialized when loading scene for disabled script component', function () {
        const a = app.root.findByName('DisabledScriptComponent');
        expect(a).to.exist;

        const b = app.root.findByName('ReferencedEntity');
        expect(b).to.exist;

        expect(a.script.scriptWithAttributes.attribute1).to.equal(b);
        expect(a.script.scriptWithAttributes.attribute2).to.equal(2);
    });

    it('script attributes are initialized when loading scene for disabled script instance', function () {
        const a = app.root.findByName('DisabledScriptInstance');
        expect(a).to.exist;

        const b = app.root.findByName('ReferencedEntity');
        expect(b).to.exist;

        expect(a.script.scriptWithAttributes.attribute1).to.equal(b);
        expect(a.script.scriptWithAttributes.attribute2).to.equal(2);
    });

    it('script attributes are initialized when reloading scene', function (done) {
        // destroy current scene
        app.root.children[0].destroy();

        expect(app.root.findByName('ReferencedEntity')).to.not.exist;

        // verify entities are not there anymore
        const names = ['EnabledEntity', 'DisabledEntity', 'DisabledScriptComponent', 'DisabledScriptInstance'];
        names.forEach(function (name) {
            expect(app.root.findByName(name)).to.not.exist;
        });

        app.loadSceneHierarchy('http://localhost:3000/test/assets/scenes/scene1.json', function () {

            // verify entities are loaded
            names.forEach(function (name) {
                expect(app.root.findByName(name)).to.exist;
            });

            const referenced = app.root.findByName('ReferencedEntity');

            // verify script attributes are initialized
            names.forEach(function (name) {
                const e = app.root.findByName(name);
                expect(e.script).to.exist;
                expect(e.script.scriptWithAttributes.attribute1).to.equal(referenced);
                expect(e.script.scriptWithAttributes.attribute2).to.equal(2);
            });

            done();
        });
    });

    it('json script attributes are initialized correctly', function () {
        const e = new Entity();
        e.addComponent('script', {
            enabled: true,
            order: ['scriptWithAttributes'],
            scripts: {
                scriptWithAttributes: {
                    enabled: true,
                    attributes: {
                        attribute3: {
                            fieldNumber: 1
                        },
                        attribute4: [{
                            fieldNumber: 2
                        }, {
                            fieldNumber: 'shouldBeNull'
                        }, {
                            missing: true,
                            fieldNumberArray: ['shouldBecomeNull']
                        }, {
                            fieldNumberArray: [1, 2, 3]
                        }]
                    }
                }
            }
        });

        app.root.addChild(e);
        expect(e.script.scriptWithAttributes.attribute3).to.be.an('object');
        expect(e.script.scriptWithAttributes.attribute3.fieldNumber).to.equal(1);
        expect(e.script.scriptWithAttributes.attribute4).to.be.an.instanceof(Array);

        expect(e.script.scriptWithAttributes.attribute4[0]).to.be.an('object');
        expect(e.script.scriptWithAttributes.attribute4[0].fieldNumber).to.equal(2);

        expect(e.script.scriptWithAttributes.attribute4[1].fieldNumber).to.equal(null);

        expect(e.script.scriptWithAttributes.attribute4[2].fieldNumber).to.equal(1);
        expect(e.script.scriptWithAttributes.attribute4[2].missing).to.equal(undefined);
        expect(e.script.scriptWithAttributes.attribute4[2].fieldNumberArray).to.deep.equal([null]);

        expect(e.script.scriptWithAttributes.attribute4[3].fieldNumberArray).to.deep.equal([1, 2, 3]);
    });

    it('json script attributes are cloned correctly', function () {
        const e = new Entity();
        const child = new Entity('child');
        e.addChild(child);

        e.addComponent('script', {
            enabled: true,
            order: ['scriptWithAttributes'],
            scripts: {
                scriptWithAttributes: {
                    enabled: true,
                    attributes: {
                        attribute3: {
                            fieldNumber: 1,
                            fieldEntity: child.getGuid()
                        },
                        attribute4: [{
                            fieldNumber: 2,
                            fieldEntity: child.getGuid()
                        }]
                    }
                }
            }
        });

        app.root.addChild(e);

        const e2 = e.clone();
        app.root.addChild(e2);

        expect(e2.script.scriptWithAttributes.attribute3).to.be.an('object');
        expect(e2.script.scriptWithAttributes.attribute3.fieldNumber).to.equal(1);
        expect(e2.script.scriptWithAttributes.attribute4).to.be.an.instanceof(Array);

        expect(e2.script.scriptWithAttributes.attribute4[0]).to.be.an('object');
        expect(e2.script.scriptWithAttributes.attribute4[0].fieldNumber).to.equal(2);
        expect(e2.script.scriptWithAttributes.attribute4).to.not.equal(e.script.scriptWithAttributes.attribute4);

        const clonedChild = e2.findByName('child');
        expect(clonedChild).to.not.equal(null);

        // check for 'true' instead of perform actual equals test because when it's false it's terribly slow
        expect(e2.script.scriptWithAttributes.attribute3.fieldEntity === clonedChild).to.equal(true);
        expect(e2.script.scriptWithAttributes.attribute4[0].fieldEntity === clonedChild).to.equal(true);

        e2.script.scriptWithAttributes.attribute3.fieldNumber = 4;
        expect(e2.script.scriptWithAttributes.attribute3.fieldNumber).to.equal(4);
        expect(e.script.scriptWithAttributes.attribute3.fieldNumber).to.equal(1);


        e2.script.scriptWithAttributes.attribute4 = [{
            fieldNumber: 3
        }, {
            fieldNumber: 4
        }];

        expect(e2.script.scriptWithAttributes.attribute4.length).to.equal(2);
        expect(e2.script.scriptWithAttributes.attribute4[0].fieldNumber).to.equal(3);
        expect(e2.script.scriptWithAttributes.attribute4[1].fieldNumber).to.equal(4);

        expect(e.script.scriptWithAttributes.attribute4.length).to.equal(1);
        expect(e.script.scriptWithAttributes.attribute4[0].fieldNumber).to.equal(2);
    });

    it('default values work for script attributes', function () {
        const e = new Entity();
        e.addComponent('script');
        e.script.create('scriptWithAttributes');

        app.root.addChild(e);

        expect(e.script.scriptWithAttributes.attribute2).to.equal(2);
        expect(e.script.scriptWithAttributes.attribute3).to.exist;
        expect(e.script.scriptWithAttributes.attribute3.fieldNumber).to.equal(1);
    });

    it('default values work for partially initialized script attributes', function () {
        const e = new Entity();
        e.addComponent('script');
        e.script.create('scriptWithAttributes', {
            attributes: {
                attribute2: 3,
                attribute4: [{
                    fieldEntity: null
                }]
            }
        });

        app.root.addChild(e);

        expect(e.script.scriptWithAttributes.attribute2).to.equal(3);
        expect(e.script.scriptWithAttributes.attribute4[0].fieldNumber).to.equal(1);
        expect(e.script.scriptWithAttributes.attribute4[0].fieldNumberArray).to.deep.equal([]);
    });

    it('enable is fired when entity becomes enabled', function () {
        const e = new Entity();
        e.addComponent('script', {
            enabled: true,
            order: ['scriptA'],
            scripts: {
                scriptA: {
                    enabled: true,
                    attributes: {}
                }
            }
        });

        app.root.addChild(e);

        expect(window.initializeCalls.length).to.equal(2);
        checkInitCall(e, 0, 'initialize scriptA');
        checkInitCall(e, 1, 'postInitialize scriptA');

        e.enabled = false;

        window.initializeCalls.length = 0;

        e.enabled = true;

        expect(window.initializeCalls.length).to.equal(4);
        checkInitCall(e, 0, 'enable scriptComponent scriptA');
        checkInitCall(e, 1, 'state scriptComponent true scriptA');
        checkInitCall(e, 2, 'enable scriptA');
        checkInitCall(e, 3, 'state true scriptA');
    });

    it('disable is fired when entity becomes disabled', function () {
        const e = new Entity();
        e.addComponent('script', {
            enabled: true,
            order: ['scriptA'],
            scripts: {
                scriptA: {
                    enabled: true,
                    attributes: {}
                }
            }
        });

        app.root.addChild(e);

        window.initializeCalls.length = 0;

        e.enabled = false;

        expect(window.initializeCalls.length).to.equal(4);
        checkInitCall(e, 0, 'disable scriptComponent scriptA');
        checkInitCall(e, 1, 'state scriptComponent false scriptA');
        checkInitCall(e, 2, 'disable scriptA');
        checkInitCall(e, 3, 'state false scriptA');
    });

    it('enable is fired when script component becomes enabled', function () {
        const e = new Entity();
        e.addComponent('script', {
            enabled: true,
            order: ['scriptA'],
            scripts: {
                scriptA: {
                    enabled: true,
                    attributes: {}
                }
            }
        });

        app.root.addChild(e);

        e.script.enabled = false;

        window.initializeCalls.length = 0;

        e.script.enabled = true;

        expect(window.initializeCalls.length).to.equal(4);
        checkInitCall(e, 0, 'enable scriptComponent scriptA');
        checkInitCall(e, 1, 'state scriptComponent true scriptA');
        checkInitCall(e, 2, 'enable scriptA');
        checkInitCall(e, 3, 'state true scriptA');
    });

    it('enable is not fired if script component started disabled', function () {
        const e = new Entity();
        e.addComponent('script', {
            enabled: false,
            order: ['scriptA'],
            scripts: {
                scriptA: {
                    enabled: true,
                    attributes: {}
                }
            }
        });

        app.root.addChild(e);

        e.script.enabled = true;

        expect(window.initializeCalls.length).to.equal(2);
        checkInitCall(e, 0, 'initialize scriptA');
        checkInitCall(e, 1, 'postInitialize scriptA');
    });

    it('disable is fired when script component becomes disabled', function () {
        const e = new Entity();
        e.addComponent('script', {
            enabled: true,
            order: ['scriptA'],
            scripts: {
                scriptA: {
                    enabled: true,
                    attributes: {}
                }
            }
        });

        app.root.addChild(e);

        window.initializeCalls.length = 0;

        e.script.enabled = false;

        expect(window.initializeCalls.length).to.equal(4);
        checkInitCall(e, 0, 'disable scriptComponent scriptA');
        checkInitCall(e, 1, 'state scriptComponent false scriptA');
        checkInitCall(e, 2, 'disable scriptA');
        checkInitCall(e, 3, 'state false scriptA');
    });


    it('if entity is disabled in initialize call and enabled later, postInitialize is called only later', function () {
        const e = new Entity();
        e.addComponent('script', {
            enabled: true,
            order: ['disabler', 'scriptA'],
            scripts: {
                disabler: {
                    enabled: true,
                    attributes: {
                        disableEntity: true
                    }
                },
                scriptA: {
                    enabled: true,
                    attributes: {}
                }
            }
        });

        app.root.addChild(e);

        expect(window.initializeCalls.length).to.equal(1);
        checkInitCall(e, 0, 'initialize disabler');

        window.initializeCalls.length = 0;

        e.enabled = true;

        expect(window.initializeCalls.length).to.equal(3);
        checkInitCall(e, 0, 'initialize scriptA');
        checkInitCall(e, 1, 'postInitialize disabler');
        checkInitCall(e, 2, 'postInitialize scriptA');
    });

    it('if script component is disabled in initialize call and enabled later, postInitialize is called only later', function () {
        const e = new Entity();
        e.addComponent('script', {
            enabled: true,
            order: ['disabler', 'scriptA'],
            scripts: {
                disabler: {
                    enabled: true,
                    attributes: {
                        disableScriptComponent: true
                    }
                },
                scriptA: {
                    enabled: true,
                    attributes: {}
                }
            }
        });

        app.root.addChild(e);

        expect(window.initializeCalls.length).to.equal(1);
        checkInitCall(e, 0, 'initialize disabler');

        window.initializeCalls.length = 0;

        e.script.enabled = true;

        expect(window.initializeCalls.length).to.equal(3);
        checkInitCall(e, 0, 'initialize scriptA');
        checkInitCall(e, 1, 'postInitialize disabler');
        checkInitCall(e, 2, 'postInitialize scriptA');
    });

    it('if script instance is disabled in initialize call and enabled later, postInitialize is called only later', function () {
        const e = new Entity();
        e.addComponent('script', {
            enabled: true,
            order: ['disabler', 'scriptA'],
            scripts: {
                disabler: {
                    enabled: true,
                    attributes: {
                        disableScriptInstance: true
                    }
                },
                scriptA: {
                    enabled: true,
                    attributes: {}
                }
            }
        });

        app.root.addChild(e);

        expect(window.initializeCalls.length).to.equal(2);
        checkInitCall(e, 0, 'initialize disabler');
        checkInitCall(e, 1, 'postInitialize disabler');

        window.initializeCalls.length = 0;

        e.script.scriptA.enabled = true;

        expect(window.initializeCalls.length).to.equal(2);
        checkInitCall(e, 0, 'initialize scriptA');
        checkInitCall(e, 1, 'postInitialize scriptA');
    });

    it('initialize and postInitialize are called if script is added to the script registry later', function (done) {
        const e = new Entity();
        e.addComponent('script', {
            enabled: true,
            order: ['loadedLater'],
            scripts: {
                loadedLater: {
                    enabled: true,
                    attributes: {}
                }
            }
        });

        app.root.addChild(e);

        expect(window.initializeCalls.length).to.equal(0);

        const asset = app.assets.find('loadedLater.js', 'script');
        app.scripts.on('add:loadedLater', function () {
            setTimeout(function () {
                expect(window.initializeCalls.length).to.equal(2);
                checkInitCall(e, 0, 'initialize loadedLater');
                checkInitCall(e, 1, 'postInitialize loadedLater');
                done();
            }, 100);
        });

        app.assets.load(asset);
    });

    it('if entity is disabled in initialize call of script that is added to the registry later, postInitialize is called only when it becomes enabled again', function (done) {
        const e = new Entity();
        e.addComponent('script', {
            enabled: true,
            order: ['loadedLater'],
            scripts: {
                loadedLater: {
                    enabled: true,
                    attributes: {
                        disableEntity: true
                    }
                }
            }
        });

        app.root.addChild(e);

        expect(window.initializeCalls.length).to.equal(0);

        const asset = app.assets.find('loadedLater.js', 'script');
        app.scripts.on('add:loadedLater', function () {
            setTimeout(function () {
                expect(window.initializeCalls.length).to.equal(1);
                checkInitCall(e, 0, 'initialize loadedLater');
                window.initializeCalls.length = 0;

                e.enabled = true;
                expect(window.initializeCalls.length).to.equal(1);
                checkInitCall(e, 0, 'postInitialize loadedLater');
                done();
            }, 100);
        });

        app.assets.load(asset);
    });

    it('if script component is disabled in initialize call of script that is added to the registry later, postInitialize is called only when it becomes enabled again', function (done) {
        const e = new Entity();
        e.addComponent('script', {
            enabled: true,
            order: ['loadedLater'],
            scripts: {
                loadedLater: {
                    enabled: true,
                    attributes: {
                        disableScriptComponent: true
                    }
                }
            }
        });

        app.root.addChild(e);

        expect(window.initializeCalls.length).to.equal(0);

        const asset = app.assets.find('loadedLater.js', 'script');
        app.scripts.on('add:loadedLater', function () {
            setTimeout(function () {
                expect(window.initializeCalls.length).to.equal(1);
                checkInitCall(e, 0, 'initialize loadedLater');
                window.initializeCalls.length = 0;

                e.script.enabled = true;
                expect(window.initializeCalls.length).to.equal(1);
                checkInitCall(e, 0, 'postInitialize loadedLater');
                done();
            }, 100);
        });

        app.assets.load(asset);
    });

    it('if script instance is disabled in initialize call of script that is added to the registry later, postInitialize is called only when it becomes enabled again', function (done) {
        const e = new Entity();
        e.addComponent('script', {
            enabled: true,
            order: ['loadedLater'],
            scripts: {
                loadedLater: {
                    enabled: true,
                    attributes: {
                        disableScriptInstance: true
                    }
                }
            }
        });

        app.root.addChild(e);

        expect(window.initializeCalls.length).to.equal(0);

        const asset = app.assets.find('loadedLater.js', 'script');
        app.scripts.on('add:loadedLater', function () {
            setTimeout(function () {
                expect(window.initializeCalls.length).to.equal(1);
                checkInitCall(e, 0, 'initialize loadedLater');
                window.initializeCalls.length = 0;

                e.script.loadedLater.enabled = true;
                expect(window.initializeCalls.length).to.equal(1);
                checkInitCall(e, 0, 'postInitialize loadedLater');

                done();
            }, 100);
        });

        app.assets.load(asset);
    });

    it('script attributes are initialized when script is added to the registry later', function (done) {
        const e = new Entity();
        e.addComponent('script', {
            enabled: true,
            order: ['loadedLater'],
            scripts: {
                loadedLater: {
                    enabled: true,
                    attributes: {
                        disableEntity: true,
                        disableScriptComponent: true,
                        disableScriptInstance: true
                    }
                }
            }
        });

        app.root.addChild(e);

        expect(e.script.loadedLater).to.not.exist;

        const asset = app.assets.find('loadedLater.js', 'script');
        app.scripts.on('add:loadedLater', function () {
            setTimeout(function () {
                expect(e.script.loadedLater).to.exist;
                expect(e.script.loadedLater.disableEntity).to.equal(true);
                expect(e.script.loadedLater.disableScriptComponent).to.equal(true);
                expect(e.script.loadedLater.disableScriptInstance).to.equal(true);
                done();
            }, 100);
        });

        app.assets.load(asset);
    });

    it('destroying entity during update stops updating the rest of the entity\'s scripts', function () {
        const e = new Entity();
        e.addComponent('script', {
            enabled: true,
            order: ['scriptA', 'destroyer', 'scriptB'],
            scripts: {
                scriptA: {
                    enabled: true
                },
                destroyer: {
                    enabled: true,
                    attributes: {
                        destroyEntity: true
                    }
                },
                scriptB: {
                    enabled: true
                }
            }
        });

        app.root.addChild(e);

        expect(window.initializeCalls.length).to.equal(6);
        checkInitCall(e, 0, 'initialize scriptA');
        checkInitCall(e, 1, 'initialize destroyer');
        checkInitCall(e, 2, 'initialize scriptB');
        checkInitCall(e, 3, 'postInitialize scriptA');
        checkInitCall(e, 4, 'postInitialize destroyer');
        checkInitCall(e, 5, 'postInitialize scriptB');
        window.initializeCalls.length = 0;

        app.update();

        checkInitCall(e, 0, 'update scriptA');
        checkInitCall(e, 1, 'update destroyer');

        let updatesFound = 0;
        for (let i = 2; i < window.initializeCalls.length; i++) {
            if (window.initializeCalls[i].indexOf('update') >= 0) {
                updatesFound++;
            }
        }

        expect(updatesFound).to.equal(0);
    });

    it('remove script component from entity during update stops updating the rest of the entity\'s scripts', function () {
        const e = new Entity();
        e.addComponent('script', {
            enabled: true,
            order: ['scriptA', 'destroyer', 'scriptB'],
            scripts: {
                scriptA: {
                    enabled: true
                },
                destroyer: {
                    enabled: true,
                    attributes: {
                        destroyScriptComponent: true
                    }
                },
                scriptB: {
                    enabled: true
                }
            }
        });

        app.root.addChild(e);

        expect(window.initializeCalls.length).to.equal(6);
        checkInitCall(e, 0, 'initialize scriptA');
        checkInitCall(e, 1, 'initialize destroyer');
        checkInitCall(e, 2, 'initialize scriptB');
        checkInitCall(e, 3, 'postInitialize scriptA');
        checkInitCall(e, 4, 'postInitialize destroyer');
        checkInitCall(e, 5, 'postInitialize scriptB');
        window.initializeCalls.length = 0;

        app.update();

        checkInitCall(e, 0, 'update scriptA');
        checkInitCall(e, 1, 'update destroyer');

        let updatesFound = 0;
        for (let i = 2; i < window.initializeCalls.length; i++) {
            if (window.initializeCalls[i].indexOf('update') >= 0) {
                updatesFound++;
            }
        }

        expect(updatesFound).to.equal(0);
    });

    it('remove script instance from script component during update keeps updating the rest of the entity\s scripts', function () {
        const e = new Entity();
        e.addComponent('script', {
            enabled: true,
            order: ['scriptA', 'destroyer', 'scriptB'],
            scripts: {
                scriptA: {
                    enabled: true
                },
                destroyer: {
                    enabled: true,
                    attributes: {
                        destroyScriptInstance: true
                    }
                },
                scriptB: {
                    enabled: true
                }
            }
        });

        app.root.addChild(e);

        expect(window.initializeCalls.length).to.equal(6);
        checkInitCall(e, 0, 'initialize scriptA');
        checkInitCall(e, 1, 'initialize destroyer');
        checkInitCall(e, 2, 'initialize scriptB');
        checkInitCall(e, 3, 'postInitialize scriptA');
        checkInitCall(e, 4, 'postInitialize destroyer');
        checkInitCall(e, 5, 'postInitialize scriptB');
        window.initializeCalls.length = 0;

        app.update();

        expect(window.initializeCalls.length).to.equal(8);

        let idx = 0;
        checkInitCall(e, idx++, 'update scriptA');
        checkInitCall(e, idx++, 'update destroyer');
        checkInitCall(e, idx++, 'disable scriptA');
        checkInitCall(e, idx++, 'state false scriptA');
        checkInitCall(e, idx++, 'destroy scriptA');
        checkInitCall(e, idx++, 'update scriptB');
        checkInitCall(e, idx++, 'postUpdate destroyer');
        checkInitCall(e, idx++, 'postUpdate scriptB');

    });

    it('destroying entity fires disable and destroy events on script instances', function () {
        const e = new Entity();
        e.addComponent('script', {
            enabled: true,
            order: ['scriptA'],
            scripts: {
                scriptA: {
                    enabled: true
                }
            }
        });

        app.root.addChild(e);

        window.initializeCalls.length = 0;

        e.destroy();

        expect(window.initializeCalls.length).to.equal(5);
        checkInitCall(e, 0, 'disable scriptComponent scriptA');
        checkInitCall(e, 1, 'state scriptComponent false scriptA');
        checkInitCall(e, 2, 'disable scriptA');
        checkInitCall(e, 3, 'state false scriptA');
        checkInitCall(e, 4, 'destroy scriptA');
    });

    it('removing script component fires disable and destroy events on script instances', function () {
        const e = new Entity();
        e.addComponent('script', {
            enabled: true,
            order: ['scriptA'],
            scripts: {
                scriptA: {
                    enabled: true
                }
            }
        });

        app.root.addChild(e);

        window.initializeCalls.length = 0;

        e.removeComponent('script');

        expect(window.initializeCalls.length).to.equal(3);
        checkInitCall(e, 0, 'disable scriptA');
        checkInitCall(e, 1, 'state false scriptA');
        checkInitCall(e, 2, 'destroy scriptA');
    });

    it('destroying script instance disable and destroy event on the destroyed script instance', function () {
        const e = new Entity();
        e.addComponent('script', {
            enabled: true,
            order: ['scriptA'],
            scripts: {
                scriptA: {
                    enabled: true
                }
            }
        });

        app.root.addChild(e);

        window.initializeCalls.length = 0;

        e.script.destroy('scriptA');

        expect(window.initializeCalls.length).to.equal(3);
        checkInitCall(e, 0, 'disable scriptA');
        checkInitCall(e, 1, 'state false scriptA');
        checkInitCall(e, 2, 'destroy scriptA');
    });

    it('destroying entity during update does not skip updating any other script components on other entities', function () {
        const e = new Entity('destroyer');
        e.addComponent('script', {
            enabled: true,
            order: ['destroyer'],
            scripts: {
                destroyer: {
                    enabled: true,
                    attributes: {
                        destroyEntity: true
                    }
                }
            }
        });

        const other = new Entity('scriptA');
        other.addComponent('script', {
            enabled: true,
            order: ['scriptA'],
            scripts: {
                scriptA: {
                    enabled: true
                }
            }
        });

        app.root.addChild(e);
        app.root.addChild(other);

        window.initializeCalls.length = 0;

        app.update();

        expect(window.initializeCalls.length).to.equal(6);
        checkInitCall(e, 0, 'update destroyer');
        checkInitCall(e, 1, 'disable destroyer');
        checkInitCall(e, 2, 'state false destroyer');
        checkInitCall(e, 3, 'destroy destroyer');
        checkInitCall(other, 4, 'update scriptA');
        checkInitCall(other, 5, 'postUpdate scriptA');
    });

    it('destroying entity during postUpdate does not skip updating any other script components on other entities', function () {
        const e = new Entity();
        e.addComponent('script', {
            enabled: true,
            order: ['destroyer'],
            scripts: {
                destroyer: {
                    enabled: true,
                    attributes: {
                        methodName: 'postUpdate',
                        destroyEntity: true
                    }
                }
            }
        });

        const other = new Entity();
        other.addComponent('script', {
            enabled: true,
            order: ['scriptA'],
            scripts: {
                scriptA: {
                    enabled: true
                }
            }
        });

        app.root.addChild(e);
        app.root.addChild(other);


        window.initializeCalls.length = 0;

        app.update();

        expect(window.initializeCalls.length).to.equal(7);
        let idx = 0;
        checkInitCall(e, idx++, 'update destroyer');
        checkInitCall(other, idx++, 'update scriptA');
        checkInitCall(e, idx++, 'postUpdate destroyer');
        checkInitCall(e, idx++, 'disable destroyer');
        checkInitCall(e, idx++, 'state false destroyer');
        checkInitCall(e, idx++, 'destroy destroyer');
        checkInitCall(other, idx++, 'postUpdate scriptA');
    });

    it('destroying entity during initialize does not skip updating any other script components on other entities', function (done) {
        app.root.children[0].destroy();

        window.initializeCalls.length = 0;
        app.scenes.loadScene('http://localhost:3000/test/assets/scenes/scene2.json', function () {
            const e = app.root.findByName('A');
            const other = app.root.findByName('B');

            app.start();

            expect(window.initializeCalls.length).to.equal(8);
            let idx = 0;
            checkInitCall(e, idx++, 'initialize destroyer');
            checkInitCall(e, idx++, 'disable destroyer');
            checkInitCall(e, idx++, 'state false destroyer');
            checkInitCall(e, idx++, 'destroy destroyer');
            checkInitCall(other, idx++, 'initialize scriptA');
            checkInitCall(other, idx++, 'postInitialize scriptA');
            checkInitCall(other, idx++, 'update scriptA');
            checkInitCall(other, idx++, 'postUpdate scriptA');

            done();
        });
    });

    it('destroying entity during postInitialize does not skip updating any other script components on other entities', function () {
        const root = new Entity();

        const e = new Entity();
        e.addComponent('script', {
            enabled: true,
            order: ['destroyer'],
            scripts: {
                destroyer: {
                    enabled: true,
                    attributes: {
                        methodName: 'postInitialize',
                        destroyEntity: true
                    }
                }
            }
        });

        root.addChild(e);

        const other = new Entity();
        other.addComponent('script', {
            enabled: true,
            order: ['scriptA'],
            scripts: {
                scriptA: {
                    enabled: true
                }
            }
        });

        root.addChild(other);

        app.root.addChild(root);

        app.update();

        expect(window.initializeCalls.length).to.equal(9);
        let idx = 0;
        checkInitCall(e, idx++, 'initialize destroyer');
        checkInitCall(other, idx++, 'initialize scriptA');
        checkInitCall(e, idx++, 'postInitialize destroyer');
        checkInitCall(e, idx++, 'disable destroyer');
        checkInitCall(e, idx++, 'state false destroyer');
        checkInitCall(e, idx++, 'destroy destroyer');
        checkInitCall(other, idx++, 'postInitialize scriptA');
        checkInitCall(other, idx++, 'update scriptA');
        checkInitCall(other, idx++, 'postUpdate scriptA');
    });

    it('removing script component during update does not skip updating any other script components on other entities', function () {
        const e = new Entity();
        e.addComponent('script', {
            enabled: true,
            order: ['destroyer'],
            scripts: {
                destroyer: {
                    enabled: true,
                    attributes: {
                        destroyScriptComponent: true
                    }
                }
            }
        });

        const other = new Entity();
        other.addComponent('script', {
            enabled: true,
            order: ['scriptA'],
            scripts: {
                scriptA: {
                    enabled: true
                }
            }
        });

        app.root.addChild(e);
        app.root.addChild(other);

        window.initializeCalls.length = 0;

        app.update();

        expect(window.initializeCalls.length).to.equal(6);
        checkInitCall(e, 0, 'update destroyer');
        checkInitCall(e, 1, 'disable destroyer');
        checkInitCall(e, 2, 'state false destroyer');
        checkInitCall(e, 3, 'destroy destroyer');
        checkInitCall(other, 4, 'update scriptA');
        checkInitCall(other, 5, 'postUpdate scriptA');
    });

    it('update and postUpdate order follows the order in which entities have been created in the scene hierarchy', function (done) {
        // destroy current scene
        app.root.children[0].destroy();

        // load scene
        app.loadSceneHierarchy('http://localhost:3000/test/assets/scenes/scene3.json', function () {
            window.initializeCalls.length = 0;
            app.update();

            expect(window.initializeCalls.length).to.equal(16);

            // hierarchy looks like so:
            // Root
            // -- A
            //    -- B
            // -- C
            const root = app.root.findByName('Root');
            const a = app.root.findByName('A');
            const b = app.root.findByName('B');
            const c = app.root.findByName('C');

            checkInitCall(root, 0, 'update scriptA');
            checkInitCall(root, 1, 'update scriptB');
            checkInitCall(a, 2, 'update scriptA');
            checkInitCall(a, 3, 'update scriptB');
            checkInitCall(b, 4, 'update scriptA');
            checkInitCall(b, 5, 'update scriptB');
            checkInitCall(c, 6, 'update scriptA');
            checkInitCall(c, 7, 'update scriptB');

            checkInitCall(root, 8, 'postUpdate scriptA');
            checkInitCall(root, 9, 'postUpdate scriptB');
            checkInitCall(a, 10, 'postUpdate scriptA');
            checkInitCall(a, 11, 'postUpdate scriptB');
            checkInitCall(b, 12, 'postUpdate scriptA');
            checkInitCall(b, 13, 'postUpdate scriptB');
            checkInitCall(c, 14, 'postUpdate scriptA');
            checkInitCall(c, 15, 'postUpdate scriptB');

            done();
        });
    });

    it('update and postUpdate are not called on disabled script instances', function () {
        const a = new Entity();
        a.addComponent('script', {
            enabled: true,
            order: ['scriptA', 'scriptB'],
            scripts: {
                scriptA: {
                    enabled: false
                },
                scriptB: {
                    enabled: true
                }
            }
        });
        app.root.addChild(a);

        window.initializeCalls.length = 0;

        app.update();

        expect(window.initializeCalls.length).to.equal(2);

        checkInitCall(a, 0, 'update scriptB');
        checkInitCall(a, 1, 'postUpdate scriptB');
    });

    it('update and postUpdate are not called on disabled script components', function () {
        const a = new Entity();
        a.addComponent('script', {
            enabled: false,
            order: ['scriptA'],
            scripts: {
                scriptA: {
                    enabled: true
                }
            }
        });
        app.root.addChild(a);

        window.initializeCalls.length = 0;

        app.update();

        expect(window.initializeCalls.length).to.equal(0);
    });

    it('update and postUpdate are not called on disabled entities', function () {
        const a = new Entity();
        a.addComponent('script', {
            enabled: true,
            order: ['scriptA'],
            scripts: {
                scriptA: {
                    enabled: true
                }
            }
        });
        app.root.addChild(a);

        a.enabled = false;

        window.initializeCalls.length = 0;

        app.update();

        expect(window.initializeCalls.length).to.equal(0);
    });

    it('update and postUpdate are not called on script instance that was disabled during update loop', function () {
        const DisableDuringUpdateLoop = createScript('disableDuringUpdateLoop');
        DisableDuringUpdateLoop.prototype.update = function () {
            window.initializeCalls.push(`${this.entity.getGuid()} update disableDuringUpdateLoop`);
            this.entity.script.scriptA.enabled = false;
        };
        DisableDuringUpdateLoop.prototype.postUpdate = function () {
            window.initializeCalls.push(`${this.entity.getGuid()} postUpdate disableDuringUpdateLoop`);
        };

        const a = new Entity();
        a.addComponent('script', {
            enabled: true,
            order: ['disableDuringUpdateLoop', 'scriptA'],
            scripts: {
                disableDuringUpdateLoop: {
                    enabled: true
                },
                scriptA: {
                    enabled: true
                }
            }
        });
        app.root.addChild(a);

        window.initializeCalls.length = 0;

        app.update();

        expect(window.initializeCalls.length).to.equal(4);
        checkInitCall(a, 0, 'update disableDuringUpdateLoop');
        checkInitCall(a, 1, 'disable scriptA');
        checkInitCall(a, 2, 'state false scriptA');
        checkInitCall(a, 3, 'postUpdate disableDuringUpdateLoop');
    });

    it('update and postUpdate are not called on script component that was disabled during update loop', function () {
        const DisableDuringUpdateLoop = createScript('disableDuringUpdateLoop');
        DisableDuringUpdateLoop.prototype.update = function () {
            window.initializeCalls.push(`${this.entity.getGuid()} update disableDuringUpdateLoop`);
            this.entity.script.enabled = false;
        };
        DisableDuringUpdateLoop.prototype.postUpdate = function () {
            window.initializeCalls.push(`${this.entity.getGuid()} postUpdate disableDuringUpdateLoop`);
        };

        const a = new Entity();
        a.addComponent('script', {
            enabled: true,
            order: ['disableDuringUpdateLoop', 'scriptA'],
            scripts: {
                disableDuringUpdateLoop: {
                    enabled: true
                },
                scriptA: {
                    enabled: true
                }
            }
        });
        app.root.addChild(a);

        window.initializeCalls.length = 0;

        app.update();

        expect(window.initializeCalls.length).to.equal(5);
        checkInitCall(a, 0, 'update disableDuringUpdateLoop');
        checkInitCall(a, 1, 'disable scriptComponent scriptA');
        checkInitCall(a, 2, 'state scriptComponent false scriptA');
        checkInitCall(a, 3, 'disable scriptA');
        checkInitCall(a, 4, 'state false scriptA');
    });

    it('update and postUpdate are not called on entity that was disabled during update loop', function () {
        const DisableDuringUpdateLoop = createScript('disableDuringUpdateLoop');
        DisableDuringUpdateLoop.prototype.update = function () {
            window.initializeCalls.push(`${this.entity.getGuid()} update disableDuringUpdateLoop`);
            this.entity.enabled = false;
        };
        DisableDuringUpdateLoop.prototype.postUpdate = function () {
            window.initializeCalls.push(`${this.entity.getGuid()} postUpdate disableDuringUpdateLoop`);
        };

        const a = new Entity();
        a.addComponent('script', {
            enabled: true,
            order: ['disableDuringUpdateLoop', 'scriptA'],
            scripts: {
                disableDuringUpdateLoop: {
                    enabled: true
                },
                scriptA: {
                    enabled: true
                }
            }
        });
        app.root.addChild(a);

        window.initializeCalls.length = 0;

        app.update();

        expect(window.initializeCalls.length).to.equal(5);
        checkInitCall(a, 0, 'update disableDuringUpdateLoop');
        checkInitCall(a, 1, 'disable scriptComponent scriptA');
        checkInitCall(a, 2, 'state scriptComponent false scriptA');
        checkInitCall(a, 3, 'disable scriptA');
        checkInitCall(a, 4, 'state false scriptA');
    });

    it('postUpdate not called on script instance that was disabled during post update loop', function () {
        const DisableDuringUpdateLoop = createScript('disableDuringUpdateLoop');
        DisableDuringUpdateLoop.prototype.postUpdate = function () {
            window.initializeCalls.push(`${this.entity.getGuid()} postUpdate disableDuringUpdateLoop`);
            this.entity.script.scriptA.enabled = false;
        };

        const a = new Entity();
        a.addComponent('script', {
            enabled: true,
            order: ['disableDuringUpdateLoop', 'scriptA'],
            scripts: {
                disableDuringUpdateLoop: {
                    enabled: true
                },
                scriptA: {
                    enabled: true
                }
            }
        });
        app.root.addChild(a);

        window.initializeCalls.length = 0;

        app.update();

        expect(window.initializeCalls.length).to.equal(4);
        checkInitCall(a, 0, 'update scriptA');
        checkInitCall(a, 1, 'postUpdate disableDuringUpdateLoop');
        checkInitCall(a, 2, 'disable scriptA');
        checkInitCall(a, 3, 'state false scriptA');
    });

    it('postUpdate not called on script component that was disabled during post update loop', function () {
        const DisableDuringUpdateLoop = createScript('disableDuringUpdateLoop');
        DisableDuringUpdateLoop.prototype.postUpdate = function () {
            window.initializeCalls.push(`${this.entity.getGuid()} postUpdate disableDuringUpdateLoop`);
            this.entity.script.enabled = false;
        };

        const a = new Entity();
        a.addComponent('script', {
            enabled: true,
            order: ['disableDuringUpdateLoop', 'scriptA'],
            scripts: {
                disableDuringUpdateLoop: {
                    enabled: true
                },
                scriptA: {
                    enabled: true
                }
            }
        });
        app.root.addChild(a);

        window.initializeCalls.length = 0;

        app.update();

        expect(window.initializeCalls.length).to.equal(6);
        checkInitCall(a, 0, 'update scriptA');
        checkInitCall(a, 1, 'postUpdate disableDuringUpdateLoop');
        checkInitCall(a, 2, 'disable scriptComponent scriptA');
        checkInitCall(a, 3, 'state scriptComponent false scriptA');
        checkInitCall(a, 4, 'disable scriptA');
        checkInitCall(a, 5, 'state false scriptA');
    });

    it('postUpdate not called on entity that was disabled during post update loop', function () {
        const DisableDuringUpdateLoop = createScript('disableDuringUpdateLoop');
        DisableDuringUpdateLoop.prototype.postUpdate = function () {
            window.initializeCalls.push(`${this.entity.getGuid()} postUpdate disableDuringUpdateLoop`);
            this.entity.enabled = false;
        };

        const a = new Entity();
        a.addComponent('script', {
            enabled: true,
            order: ['disableDuringUpdateLoop', 'scriptA'],
            scripts: {
                disableDuringUpdateLoop: {
                    enabled: true
                },
                scriptA: {
                    enabled: true
                }
            }
        });
        app.root.addChild(a);

        window.initializeCalls.length = 0;

        app.update();

        expect(window.initializeCalls.length).to.equal(6);
        checkInitCall(a, 0, 'update scriptA');
        checkInitCall(a, 1, 'postUpdate disableDuringUpdateLoop');
        checkInitCall(a, 2, 'disable scriptComponent scriptA');
        checkInitCall(a, 3, 'state scriptComponent false scriptA');
        checkInitCall(a, 4, 'disable scriptA');
        checkInitCall(a, 5, 'state false scriptA');
    });

    it('update not called second time on script instance that was re-enabled during the same frame', function () {
        const DisableDuringUpdateLoop = createScript('disableDuringUpdateLoop');
        DisableDuringUpdateLoop.prototype.update = function () {
            window.initializeCalls.push(`${this.entity.getGuid()} update disableDuringUpdateLoop`);
            this.entity.script.disableDuringUpdateLoop.enabled = false;
        };

        const EnableDuringUpdateLoop = createScript('enableDuringUpdateLoop');
        EnableDuringUpdateLoop.prototype.update = function () {
            window.initializeCalls.push(`${this.entity.getGuid()} update enableDuringUpdateLoop`);
            this.entity.script.disableDuringUpdateLoop.enabled = true; // enable first script back
        };

        const a = new Entity();
        a.addComponent('script', {
            enabled: true,
            order: ['disableDuringUpdateLoop', 'enableDuringUpdateLoop'],
            scripts: {
                disableDuringUpdateLoop: {
                    enabled: true
                },
                enableDuringUpdateLoop: {
                    enabled: true
                }
            }
        });
        app.root.addChild(a);

        window.initializeCalls.length = 0;

        app.update();

        expect(window.initializeCalls.length).to.equal(2);
        checkInitCall(a, 0, 'update disableDuringUpdateLoop');
        checkInitCall(a, 1, 'update enableDuringUpdateLoop');
    });

    it('post update not called second time on script instance that was re-enabled during the same frame', function () {
        const DisableDuringUpdateLoop = createScript('disableDuringUpdateLoop');
        DisableDuringUpdateLoop.prototype.postUpdate = function () {
            window.initializeCalls.push(`${this.entity.getGuid()} postUpdate disableDuringUpdateLoop`);
            this.entity.script.disableDuringUpdateLoop.enabled = false;
        };

        const EnableDuringUpdateLoop = createScript('enableDuringUpdateLoop');
        EnableDuringUpdateLoop.prototype.postUpdate = function () {
            window.initializeCalls.push(`${this.entity.getGuid()} postUpdate enableDuringUpdateLoop`);
            this.entity.script.disableDuringUpdateLoop.enabled = true; // enable first script back
        };

        const a = new Entity();
        a.addComponent('script', {
            enabled: true,
            order: ['disableDuringUpdateLoop', 'enableDuringUpdateLoop'],
            scripts: {
                disableDuringUpdateLoop: {
                    enabled: true
                },
                enableDuringUpdateLoop: {
                    enabled: true
                }
            }
        });
        app.root.addChild(a);

        window.initializeCalls.length = 0;

        app.update();

        expect(window.initializeCalls.length).to.equal(2);
        checkInitCall(a, 0, 'postUpdate disableDuringUpdateLoop');
        checkInitCall(a, 1, 'postUpdate enableDuringUpdateLoop');
    });

    it('update not called second time on script instance whose script component was re-enabled during the same frame', function () {
        const DisableDuringUpdateLoop = createScript('disableDuringUpdateLoop');
        DisableDuringUpdateLoop.prototype.update = function () {
            window.initializeCalls.push(`${this.entity.getGuid()} update disableDuringUpdateLoop`);
            this.entity.script.enabled = false;
        };

        const EnableDuringUpdateLoop = createScript('enableDuringUpdateLoop');
        EnableDuringUpdateLoop.prototype.update = function () {
            window.initializeCalls.push(`${this.entity.getGuid()} update enableDuringUpdateLoop`);
            const e = app.root.findByName('a');
            e.script.enabled = true; // enable first script component back
        };

        const a = new Entity('a');
        a.addComponent('script', {
            enabled: true,
            order: ['disableDuringUpdateLoop'],
            scripts: {
                disableDuringUpdateLoop: {
                    enabled: true
                }
            }
        });
        app.root.addChild(a);

        const b = new Entity('b');
        b.addComponent('script', {
            enabled: true,
            order: ['enableDuringUpdateLoop'],
            scripts: {
                enableDuringUpdateLoop: {
                    enabled: true
                }
            }
        });
        app.root.addChild(b);

        window.initializeCalls.length = 0;

        app.update();

        expect(window.initializeCalls.length).to.equal(2);
        checkInitCall(a, 0, 'update disableDuringUpdateLoop');
        checkInitCall(b, 1, 'update enableDuringUpdateLoop');
    });

    it('post update not called second time on script instance whose script component was re-enabled during the same frame', function () {
        const DisableDuringUpdateLoop = createScript('disableDuringUpdateLoop');
        DisableDuringUpdateLoop.prototype.postUpdate = function () {
            window.initializeCalls.push(`${this.entity.getGuid()} postUpdate disableDuringUpdateLoop`);
            this.entity.script.enabled = false;
        };

        const EnableDuringUpdateLoop = createScript('enableDuringUpdateLoop');
        EnableDuringUpdateLoop.prototype.postUpdate = function () {
            window.initializeCalls.push(`${this.entity.getGuid()} postUpdate enableDuringUpdateLoop`);
            const e = app.root.findByName('a');
            e.script.enabled = true; // enable first script component back
        };

        const a = new Entity('a');
        a.addComponent('script', {
            enabled: true,
            order: ['disableDuringUpdateLoop'],
            scripts: {
                disableDuringUpdateLoop: {
                    enabled: true
                }
            }
        });
        app.root.addChild(a);

        const b = new Entity('b');
        b.addComponent('script', {
            enabled: true,
            order: ['enableDuringUpdateLoop'],
            scripts: {
                enableDuringUpdateLoop: {
                    enabled: true
                }
            }
        });
        app.root.addChild(b);

        window.initializeCalls.length = 0;

        app.update();

        expect(window.initializeCalls.length).to.equal(2);
        checkInitCall(a, 0, 'postUpdate disableDuringUpdateLoop');
        checkInitCall(b, 1, 'postUpdate enableDuringUpdateLoop');
    });

    it('update and postUpdate order for dynamically created entities follows the order in which script components were created', function () {
        // regular entity
        const a = new Entity();
        a.addComponent('script', {
            enabled: true,
            order: ['scriptA', 'scriptB'],
            scripts: {
                scriptA: {
                    enabled: true
                },
                scriptB: {
                    enabled: true
                }
            }
        });
        app.root.addChild(a);

        // child of 'a'
        const b = new Entity();
        b.addComponent('script', {
            enabled: true,
            order: ['scriptA', 'scriptB'],
            scripts: {
                scriptA: {
                    enabled: true
                },
                scriptB: {
                    enabled: true
                }
            }
        });
        a.addChild(b);

        // create entity but add script component later
        const c = new Entity();
        app.root.addChild(c);

        // insert entity in the beginning of the hierarchy
        // (should not make a difference)
        const d = new Entity();
        d.addComponent('script', {
            enabled: true,
            order: ['scriptA', 'scriptB'],
            scripts: {
                scriptA: {
                    enabled: true
                },
                scriptB: {
                    enabled: true
                }
            }
        });
        app.root.insertChild(d, 0);

        // add script component for previously created entity
        c.addComponent('script', {
            enabled: true,
            order: ['scriptA', 'scriptB'],
            scripts: {
                scriptA: {
                    enabled: true
                },
                scriptB: {
                    enabled: true
                }
            }
        });

        window.initializeCalls.length = 0;

        app.update();

        expect(window.initializeCalls.length).to.equal(16);

        checkInitCall(a, 0, 'update scriptA');
        checkInitCall(a, 1, 'update scriptB');
        checkInitCall(b, 2, 'update scriptA');
        checkInitCall(b, 3, 'update scriptB');
        checkInitCall(d, 4, 'update scriptA');
        checkInitCall(d, 5, 'update scriptB');
        checkInitCall(c, 6, 'update scriptA');
        checkInitCall(c, 7, 'update scriptB');

        checkInitCall(a, 8, 'postUpdate scriptA');
        checkInitCall(a, 9, 'postUpdate scriptB');
        checkInitCall(b, 10, 'postUpdate scriptA');
        checkInitCall(b, 11, 'postUpdate scriptB');
        checkInitCall(d, 12, 'postUpdate scriptA');
        checkInitCall(d, 13, 'postUpdate scriptB');
        checkInitCall(c, 14, 'postUpdate scriptA');
        checkInitCall(c, 15, 'postUpdate scriptB');

    });

    it('update and post update are called on the same frame for child entities that become enabled during a parent\s update', function () {
        const EnableDuringUpdateLoop = createScript('enableDuringUpdateLoop');
        EnableDuringUpdateLoop.prototype.update = function () {
            window.initializeCalls.push(`${this.entity.getGuid()} update enableDuringUpdateLoop`);
            const e = app.root.findByName('b');
            e.enabled = true;
        };

        // parent entity
        const a = new Entity('a');
        a.addComponent('script', {
            enabled: true,
            order: ['enableDuringUpdateLoop'],
            scripts: {
                enableDuringUpdateLoop: {
                    enabled: true
                }
            }
        });
        app.root.addChild(a);

        // child of 'a'
        const b = new Entity('b');
        b.addComponent('script', {
            enabled: true,
            order: ['scriptA', 'scriptB'],
            scripts: {
                scriptA: {
                    enabled: true
                },
                scriptB: {
                    enabled: true
                }
            }
        });
        b.enabled = false;
        a.addChild(b);

        window.initializeCalls.length = 0;

        app.update();

        expect(window.initializeCalls.length).to.equal(9);

        checkInitCall(a, 0, 'update enableDuringUpdateLoop');
        checkInitCall(b, 1, 'initialize scriptA');
        checkInitCall(b, 2, 'initialize scriptB');
        checkInitCall(b, 3, 'postInitialize scriptA');
        checkInitCall(b, 4, 'postInitialize scriptB');
        checkInitCall(b, 5, 'update scriptA');
        checkInitCall(b, 6, 'update scriptB');
        checkInitCall(b, 7, 'postUpdate scriptA');
        checkInitCall(b, 8, 'postUpdate scriptB');
    });

    it('update is called on the next frame and post update on the same frame for parent entities whose script component becomes enabled during a child\s update', function () {
        const EnableDuringUpdateLoop = createScript('enableDuringUpdateLoop');
        EnableDuringUpdateLoop.prototype.update = function () {
            window.initializeCalls.push(`${this.entity.getGuid()} update enableDuringUpdateLoop`);
            const e = app.root.findByName('a');
            e.script.enabled = true;
        };

        // parent entity (note there doesn't have to be a parent-child relationship
        // what really matters is which script component is created first by calling addComponent)
        const a = new Entity('a');
        a.addComponent('script', {
            enabled: false,
            order: ['scriptA', 'scriptB'],
            scripts: {
                scriptA: {
                    enabled: true
                },
                scriptB: {
                    enabled: true
                }
            }
        });
        app.root.addChild(a);

        // child of 'a'
        const b = new Entity('b');
        b.addComponent('script', {
            enabled: true,
            order: ['enableDuringUpdateLoop'],
            scripts: {
                enableDuringUpdateLoop: {
                    enabled: true
                }
            }
        });
        a.addChild(b);

        window.initializeCalls.length = 0;
        app.update();

        expect(window.initializeCalls.length).to.equal(7);
        checkInitCall(b, 0, 'update enableDuringUpdateLoop');
        checkInitCall(a, 1, 'initialize scriptA');
        checkInitCall(a, 2, 'initialize scriptB');
        checkInitCall(a, 3, 'postInitialize scriptA');
        checkInitCall(a, 4, 'postInitialize scriptB');
        checkInitCall(a, 5, 'postUpdate scriptA');
        checkInitCall(a, 6, 'postUpdate scriptB');

        window.initializeCalls.length = 0;
        app.update();

        expect(window.initializeCalls.length).to.equal(5);
        checkInitCall(a, 0, 'update scriptA');
        checkInitCall(a, 1, 'update scriptB');
        checkInitCall(b, 2, 'update enableDuringUpdateLoop');
        checkInitCall(a, 3, 'postUpdate scriptA');
        checkInitCall(a, 4, 'postUpdate scriptB');
    });

    it('update is called on the same frame for subsequent script instance that gets enabled during update loop', function () {
        const EnableDuringUpdateLoop = createScript('enableDuringUpdateLoop');
        EnableDuringUpdateLoop.prototype.update = function () {
            window.initializeCalls.push(`${this.entity.getGuid()} update enableDuringUpdateLoop`);
            this.entity.script.scriptB.enabled = true;
        };

        // parent entity (note there doesn't have to be a parent-child relationship
        // what really matters is which script component is created first by calling addComponent)
        const a = new Entity('a');
        a.addComponent('script', {
            enabled: true,
            order: ['enableDuringUpdateLoop', 'scriptA', 'scriptB'],
            scripts: {
                enableDuringUpdateLoop: {
                    enabled: true
                },
                scriptA: {
                    enabled: true
                },
                scriptB: {
                    enabled: false
                }
            }
        });
        app.root.addChild(a);

        window.initializeCalls.length = 0;
        app.update();

        expect(window.initializeCalls.length).to.equal(7);
        checkInitCall(a, 0, 'update enableDuringUpdateLoop');
        checkInitCall(a, 1, 'initialize scriptB');
        checkInitCall(a, 2, 'postInitialize scriptB');
        checkInitCall(a, 3, 'update scriptA');
        checkInitCall(a, 4, 'update scriptB');
        checkInitCall(a, 5, 'postUpdate scriptA');
        checkInitCall(a, 6, 'postUpdate scriptB');
    });

    it('update is called on the next frame and post update on the same frame for previous script instance that gets enabled during update loop', function () {
        const EnableDuringUpdateLoop = createScript('enableDuringUpdateLoop');
        EnableDuringUpdateLoop.prototype.update = function () {
            window.initializeCalls.push(`${this.entity.getGuid()} update enableDuringUpdateLoop`);
            this.entity.script.scriptB.enabled = true;
        };

        // parent entity (note there doesn't have to be a parent-child relationship
        // what really matters is which script component is created first by calling addComponent)
        const a = new Entity('a');
        a.addComponent('script', {
            enabled: true,
            order: ['scriptB', 'enableDuringUpdateLoop', 'scriptA'],
            scripts: {
                enableDuringUpdateLoop: {
                    enabled: true
                },
                scriptA: {
                    enabled: true
                },
                scriptB: {
                    enabled: false
                }
            }
        });
        app.root.addChild(a);

        window.initializeCalls.length = 0;
        app.update();

        expect(window.initializeCalls.length).to.equal(6);
        checkInitCall(a, 0, 'update enableDuringUpdateLoop');
        checkInitCall(a, 1, 'initialize scriptB');
        checkInitCall(a, 2, 'postInitialize scriptB');
        checkInitCall(a, 3, 'update scriptA');
        checkInitCall(a, 4, 'postUpdate scriptB');
        checkInitCall(a, 5, 'postUpdate scriptA');

        window.initializeCalls.length = 0;
        app.update();
        expect(window.initializeCalls.length).to.equal(5);
        checkInitCall(a, 0, 'update scriptB');
        checkInitCall(a, 1, 'update enableDuringUpdateLoop');
        checkInitCall(a, 2, 'update scriptA');
        checkInitCall(a, 3, 'postUpdate scriptB');
        checkInitCall(a, 4, 'postUpdate scriptA');

    });

    it('post update is called on the same frame for subsequent script instance that gets enabled during post update loop', function () {
        const EnableDuringUpdateLoop = createScript('enableDuringUpdateLoop');
        EnableDuringUpdateLoop.prototype.postUpdate = function () {
            window.initializeCalls.push(`${this.entity.getGuid()} post update enableDuringUpdateLoop`);
            this.entity.script.scriptB.enabled = true;
        };

        // parent entity (note there doesn't have to be a parent-child relationship
        // what really matters is which script component is created first by calling addComponent)
        const a = new Entity('a');
        a.addComponent('script', {
            enabled: true,
            order: ['enableDuringUpdateLoop', 'scriptA', 'scriptB'],
            scripts: {
                enableDuringUpdateLoop: {
                    enabled: true
                },
                scriptA: {
                    enabled: true
                },
                scriptB: {
                    enabled: false
                }
            }
        });
        app.root.addChild(a);

        window.initializeCalls.length = 0;
        app.update();

        expect(window.initializeCalls.length).to.equal(6);
        checkInitCall(a, 0, 'update scriptA');
        checkInitCall(a, 1, 'post update enableDuringUpdateLoop');
        checkInitCall(a, 2, 'initialize scriptB');
        checkInitCall(a, 3, 'postInitialize scriptB');
        checkInitCall(a, 4, 'postUpdate scriptA');
        checkInitCall(a, 5, 'postUpdate scriptB');
    });

    it('post update is called on the next frame previous script instance that gets enabled during post update loop', function () {
        const EnableDuringUpdateLoop = createScript('enableDuringUpdateLoop');
        EnableDuringUpdateLoop.prototype.postUpdate = function () {
            window.initializeCalls.push(`${this.entity.getGuid()} post update enableDuringUpdateLoop`);
            this.entity.script.scriptB.enabled = true;
        };

        // parent entity (note there doesn't have to be a parent-child relationship
        // what really matters is which script component is created first by calling addComponent)
        const a = new Entity('a');
        a.addComponent('script', {
            enabled: true,
            order: ['scriptB', 'enableDuringUpdateLoop', 'scriptA'],
            scripts: {
                enableDuringUpdateLoop: {
                    enabled: true
                },
                scriptA: {
                    enabled: true
                },
                scriptB: {
                    enabled: false
                }
            }
        });
        app.root.addChild(a);

        window.initializeCalls.length = 0;
        app.update();

        expect(window.initializeCalls.length).to.equal(5);
        checkInitCall(a, 0, 'update scriptA');
        checkInitCall(a, 1, 'post update enableDuringUpdateLoop');
        checkInitCall(a, 2, 'initialize scriptB');
        checkInitCall(a, 3, 'postInitialize scriptB');
        checkInitCall(a, 4, 'postUpdate scriptA');

        window.initializeCalls.length = 0;
        app.update();
        expect(window.initializeCalls.length).to.equal(5);
        checkInitCall(a, 0, 'update scriptB');
        checkInitCall(a, 1, 'update scriptA');
        checkInitCall(a, 2, 'postUpdate scriptB');
        checkInitCall(a, 3, 'post update enableDuringUpdateLoop');
        checkInitCall(a, 4, 'postUpdate scriptA');
    });

    it('execution order remains consistent when components are destroyed', function () {
        let e;
        const entities = [];

        // make 3 entities with scriptA
        for (let i = 0; i < 3; i++) {
            e = new Entity();
            e.addComponent('script', {
                enabled: true,
                order: ['scriptA'],
                scripts: {
                    scriptA: {
                        enabled: true
                    }
                }
            });
            app.root.addChild(e);
            entities.push(e);
        }

        // destroy first 2 entities
        entities[0].destroy();
        entities[1].destroy();

        // make new entity
        e = new Entity();
        e.addComponent('script', {
            enabled: true,
            order: ['scriptA'],
            scripts: {
                scriptA: {
                    enabled: true
                }
            }
        });
        app.root.addChild(e);
        entities.push(e);

        // disable 3rd entity
        entities[2].enabled = false;

        // enable 3rd entity
        entities[2].enabled = true;

        window.initializeCalls.length = 0;
        app.update();

        // order of updates should remain consistent (3rd entity before 4th)
        expect(window.initializeCalls.length).to.equal(4);
        checkInitCall(entities[2], 0, 'update scriptA');
        checkInitCall(entities[3], 1, 'update scriptA');
        checkInitCall(entities[2], 2, 'postUpdate scriptA');
        checkInitCall(entities[3], 3, 'postUpdate scriptA');
    });

    it('move() moves script instance after others', function () {
        const e = new Entity();
        e.addComponent('script', {
            enabled: true,
            order: ['scriptA', 'scriptB'],
            scripts: {
                scriptA: {
                    enabled: true
                },
                scriptB: {
                    enabled: true
                }
            }
        });
        app.root.addChild(e);

        e.script.move('scriptA', 1);

        window.initializeCalls.length = 0;
        app.update();

        expect(window.initializeCalls.length).to.equal(4);
        checkInitCall(e, 0, 'update scriptB');
        checkInitCall(e, 1, 'update scriptA');
        checkInitCall(e, 2, 'postUpdate scriptB');
        checkInitCall(e, 3, 'postUpdate scriptA');
    });

    it('move() does not accept index larger than scripts array length', function () {
        const e = new Entity();
        e.addComponent('script', {
            enabled: true,
            order: ['scriptA', 'scriptB'],
            scripts: {
                scriptA: {
                    enabled: true
                },
                scriptB: {
                    enabled: true
                }
            }
        });
        app.root.addChild(e);

        e.script.move('scriptB', 2);

        window.initializeCalls.length = 0;
        app.update();

        expect(window.initializeCalls.length).to.equal(4);
        checkInitCall(e, 0, 'update scriptA');
        checkInitCall(e, 1, 'update scriptB');
        checkInitCall(e, 2, 'postUpdate scriptA');
        checkInitCall(e, 3, 'postUpdate scriptB');
    });

    it('move() does not accept negative index', function () {
        const e = new Entity();
        e.addComponent('script', {
            enabled: true,
            order: ['scriptA', 'scriptB'],
            scripts: {
                scriptA: {
                    enabled: true
                },
                scriptB: {
                    enabled: true
                }
            }
        });
        app.root.addChild(e);

        e.script.move('scriptB', -1);

        window.initializeCalls.length = 0;
        app.update();

        expect(window.initializeCalls.length).to.equal(4);
        checkInitCall(e, 0, 'update scriptA');
        checkInitCall(e, 1, 'update scriptB');
        checkInitCall(e, 2, 'postUpdate scriptA');
        checkInitCall(e, 3, 'postUpdate scriptB');
    });

    it('move() during update loop will update moved script again if new index is after the script who called move()', function () {
        const Move = createScript('mover');
        Move.prototype.update = function () {
            this.entity.script.move('scriptA', 2);
        };

        const e = new Entity();
        e.addComponent('script', {
            enabled: true,
            order: ['scriptA', 'mover', 'scriptB'],
            scripts: {
                scriptA: {
                    enabled: true
                },
                mover: {
                    enabled: true
                },
                scriptB: {
                    enabled: true
                }
            }
        });
        app.root.addChild(e);

        window.initializeCalls.length = 0;
        app.update();

        expect(window.initializeCalls.length).to.equal(5);
        checkInitCall(e, 0, 'update scriptA');
        checkInitCall(e, 1, 'update scriptB');
        checkInitCall(e, 2, 'update scriptA');
        checkInitCall(e, 3, 'postUpdate scriptB');
        checkInitCall(e, 4, 'postUpdate scriptA');
    });

    it('move() during update loop will not update moved script if new index is before the script who called move()', function () {
        const Move = createScript('mover');
        Move.prototype.update = function () {
            this.entity.script.move('scriptB', 0);
        };

        const e = new Entity();
        e.addComponent('script', {
            enabled: true,
            order: ['scriptA', 'mover', 'scriptB'],
            scripts: {
                scriptA: {
                    enabled: true
                },
                mover: {
                    enabled: true
                },
                scriptB: {
                    enabled: true
                }
            }
        });
        app.root.addChild(e);

        window.initializeCalls.length = 0;
        app.update();

        expect(window.initializeCalls.length).to.equal(3);
        checkInitCall(e, 0, 'update scriptA');
        checkInitCall(e, 1, 'postUpdate scriptB');
        checkInitCall(e, 2, 'postUpdate scriptA');
    });

    it('swap() uses the new script', function (done) {
        const e = new Entity();
        e.addComponent('script', {
            enabled: true,
            order: ['scriptA', 'scriptB'],
            scripts: {
                scriptA: {
                    enabled: true
                },
                scriptB: {
                    enabled: true
                }
            }
        });
        app.root.addChild(e);

        // create new script with the same name
        // so that 'swap' is triggered
        const NewScriptA = createScript('scriptA');
        NewScriptA.prototype.update = function () {
            window.initializeCalls.push(`${this.entity.getGuid()} update new scriptA`);
        };
        NewScriptA.prototype.postUpdate = function () {
            window.initializeCalls.push(`${this.entity.getGuid()} postUpdate new scriptA`);
        };
        NewScriptA.prototype.swap = function () {
        };

        app.scripts.on('swap', function () {
            setTimeout(function () {
                window.initializeCalls.length = 0;
                app.update();

                expect(window.initializeCalls.length).to.equal(4);
                checkInitCall(e, 0, 'update new scriptA');
                checkInitCall(e, 1, 'update scriptB');
                checkInitCall(e, 2, 'postUpdate new scriptA');
                checkInitCall(e, 3, 'postUpdate scriptB');

                done();
            });
        });
    });

    it('pc.ScriptComponent#has', function () {
        const e = new Entity();
        e.addComponent('script', {
            enabled: true,
            order: ['scriptA', 'scriptB'],
            scripts: {
                scriptA: {
                    enabled: true
                },
                scriptB: {
                    enabled: true
                }
            }
        });
        app.root.addChild(e);

        expect(e.script.has('scriptA')).to.equal(true);
        expect(e.script.has('scriptB')).to.equal(true);
        expect(e.script.has('scriptC')).to.equal(false);
        expect(e.script.has('')).to.equal(false);
        expect(e.script.has(undefined)).to.equal(false);
        expect(e.script.has(null)).to.equal(false);
    });

    it('warns when an ESM Script class does not have a static "scriptName" property', function () {
        class TestScript extends Script {}
        const a =  new Entity();
        a.addComponent('script', { enabled: true });
        a.script.create(TestScript);

        expect(Debug._loggedMessages.has(
            'The Script class "TestScript" must have a static "scriptName" property: `TestScript.scriptName = "testScript";`. This will be an error in future versions of PlayCanvas.'
        )).to.equal(true);
    });

    it('correctly registers an ESM script with its scriptName', function () {
        class TestScript extends Script {
            static scriptName = 'myTestScript';
        }
        const a = new Entity();
        a.addComponent('script', { enabled: true });
        a.script.create(TestScript);

        expect(a.script.has('testScript')).to.equal(false);
        expect(a.script.has('myTestScript')).to.equal(true);
    });

    it('falls back to camelCase script name if scriptName is not defined', function () {
        class TestScript extends Script {}
        const a = new Entity();
        a.addComponent('script', { enabled: true });
        a.script.create(TestScript);

        expect(a.script.has('testScript')).to.equal(true);
        expect(a.script.has('myTestScript')).to.equal(false);
    });

    it('does not warn when a ScriptType is used', function () {
        Debug._loggedMessages.clear();
        createScript('nullScript');
        const e = new Entity();
        e.addComponent('script', {
            enabled: true,
            order: ['nullScript'],
            scripts: {
                nullScript: {
                    enabled: true
                }
            }
        });
        app.root.addChild(e);

        expect(Debug._loggedMessages.size).to.equal(0);
        expect(e.script.has('nullScript')).to.equal(true);
    });

});
