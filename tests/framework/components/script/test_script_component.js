describe("pc.ScriptComponent", function () {
    var app;

    beforeEach(function (done) {
        app = new pc.Application(document.createElement("canvas"));

        window.initializeCalls = [];

        // add script assets
        app._parseAssets({
            "1": {
                "tags": [],
                "name": "scriptA.js",
                "revision": 1,
                "preload": true,
                "meta": null,
                "data": {
                    "scripts": {
                        "scriptA": {
                            "attributesOrder": [],
                            "attributes": {}
                        }
                    },
                    "loading": false
                },
                "type": "script",
                "file": {
                    "filename": "scriptA.js",
                    "size": 1,
                    "hash": "script a hash",
                    "url": "base/tests/framework/components/script/scriptA.js"
                },
                "region": "eu-west-1",
                "id": "1"
            },
            "2": {
                "tags": [],
                "name": "scriptB.js",
                "revision": 1,
                "preload": true,
                "meta": null,
                "data": {
                    "scripts": {
                        "scriptB": {
                            "attributesOrder": [],
                            "attributes": {}
                        }
                    },
                    "loading": false
                },
                "type": "script",
                "file": {
                    "filename": "scriptB.js",
                    "size": 1,
                    "hash": "script b hash",
                    "url": "base/tests/framework/components/script/scriptB.js"
                },
                "region": "eu-west-1",
                "id": "2"
            },
            "3": {
                "tags": [],
                "name": "cloner.js",
                "revision": 1,
                "preload": true,
                "meta": null,
                "data": {
                    "scripts": {
                    "cloner": {
                        "attributesOrder": [],
                        "attributes": {}
                      }
                    },
                    "loading": false
                },
                "type": "script",
                "file": {
                    "filename": "cloner.js",
                    "size": 1,
                    "hash": "cloner hash",
                    "url": "base/tests/framework/components/script/cloner.js"
                },
                "region": "eu-west-1",
                "id": "3"
            },
            "4": {
                "tags": [],
                "name": "enabler.js",
                "revision": 1,
                "preload": true,
                "meta": null,
                "data": {
                    "scripts": {
                        "enabler": {
                            "attributesOrder": [],
                            "attributes": {}
                        }
                    },
                    "loading": false
                },
                "type": "script",
                "file": {
                    "filename": "enabler.js",
                    "size": 1,
                    "hash": "enabler hash",
                    "url": "base/tests/framework/components/script/enabler.js"
                },
                "region": "eu-west-1",
                "id": "4"
            },
            "5": {
                "tags": [],
                "name": "disabler.js",
                "revision": 1,
                "preload": true,
                "meta": null,
                "data": {
                    "scripts": {
                        "disabler": {
                            "attributesOrder": [],
                            "attributes": {}
                        }
                    },
                    "loading": false
                },
                "type": "script",
                "file": {
                    "filename": "disabler.js",
                    "size": 1,
                    "hash": "disabler hash",
                    "url": "base/tests/framework/components/script/disabler.js"
                },
                "region": "eu-west-1",
                "id": "5"
            },
            "6": {
                "tags": [],
                "name": "scriptWithAttributes.js",
                "revision": 1,
                "preload": true,
                "meta": null,
                "data": {
                    "scripts": {
                        "scriptWithAttributes": {
                            "attributesOrder": ["attribute1", "attribute2"],
                            "attributes": {
                                "attribute1": {
                                    "type": "entity"
                                },
                                "attribute2": {
                                    "type": "number",
                                    "default": 2
                                }
                            }
                      }
                    },
                    "loading": false
                },
                "type": "script",
                "file": {
                    "filename": "scriptWithAttributes.js",
                    "size": 1,
                    "hash": "scriptWithAttributes hash",
                    "url": "base/tests/framework/components/script/scriptWithAttributes.js"
                },
                "region": "eu-west-1",
                "id": "6"
            },
            "7": {
                "tags": [],
                "name": "loadedLater.js",
                "revision": 1,
                "preload": false,
                "meta": null,
                "data": {
                    "scripts": {
                        "loadedLater": {
                            "attributesOrder": [],
                            "attributes": {}
                      }
                    },
                    "loading": false
                },
                "type": "script",
                "file": {
                    "filename": "loadedLater.js",
                    "size": 1,
                    "hash": "loadedLater hash",
                    "url": "base/tests/framework/components/script/loadedLater.js"
                },
                "region": "eu-west-1",
                "id": "7"
            },
            "8": {
                "tags": [],
                "name": "destroyer.js",
                "revision": 1,
                "preload": true,
                "meta": null,
                "data": {
                    "scripts": {
                        "destroyer": {
                            "attributesOrder": [],
                            "attributes": {}
                      }
                    },
                    "loading": false
                },
                "type": "script",
                "file": {
                    "filename": "destroyer.js",
                    "size": 1,
                    "hash": "destroyer hash",
                    "url": "base/tests/framework/components/script/destroyer.js"
                },
                "region": "eu-west-1",
                "id": "8"
            }
        });

        app.preload(function (err) {
            if (err) {
                console.error(err);
            }

            app.loadScene('base/tests/framework/components/script/scene1.json', function () {
                app.start();
                done();
            });
        });
    });

    afterEach(function () {
        app.destroy();
        delete window.initializeCalls;
    });

    var checkInitCall = function (entity, index, text) {
        expect(window.initializeCalls[index]).to.equal(entity.getGuid() + ' ' + text);
    };

    it("script assets are loaded", function () {
        expect(app.assets.get(1)).to.exist;
        expect(app.scripts.get('scriptA')).to.exist;
        expect(app.assets.get(2)).to.exist;
        expect(app.scripts.get('scriptB')).to.exist;
    });

    it("initialize and postInitialize are called on new entity", function () {
        var e = new pc.Entity();

        e.addComponent('script', {
            "enabled": true,
            "order": [
                "scriptA"
            ],
            "scripts": {
                "scriptA": {
                    "enabled": true,
                    "attributes": {}
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

    it("all initialize calls are before all postInitialize calls on new entity", function () {
        var e = new pc.Entity();

        e.addComponent('script', {
            "enabled": true,
            "order": [
                "scriptA",
                "scriptB",
            ],
            "scripts": {
                "scriptA": {
                    "enabled": true,
                    "attributes": {}
                },
                "scriptB": {
                    "enabled": true,
                    "attributes": {}
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

    it("initialize and postInitialize are called on entity that is enabled later", function () {
        var e = new pc.Entity();
        e.enabled = false;
        e.addComponent('script', {
            "enabled": true,
            "order": [
                "scriptA"
            ],
            "scripts": {
                "scriptA": {
                    "enabled": true,
                    "attributes": {}
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

    it("initialize and postInitialize are called on script component that is enabled later", function () {
        var e = new pc.Entity();
        e.addComponent('script', {
            "enabled": false,
            "order": [
                "scriptA"
            ],
            "scripts": {
                "scriptA": {
                    "enabled": true,
                    "attributes": {}
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

    it("initialize and postInitialize are called on script instance that is enabled later", function () {
        var e = new pc.Entity();
        e.addComponent('script', {
            "enabled": true,
            "order": [
                "scriptA"
            ],
            "scripts": {
                "scriptA": {
                    "enabled": false,
                    "attributes": {}
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

    it("initialize and postInitialize are called on script instance that is created later", function () {
        var e = new pc.Entity();
        app.root.addChild(e);
        e.addComponent('script');
        e.script.create('scriptA');
        expect(e.script.scriptA).to.exist;
        expect(window.initializeCalls.length).to.equal(2);
        checkInitCall(e, 0, 'initialize scriptA');
        checkInitCall(e, 1, 'postInitialize scriptA');
    });

    it("initialize and postInitialize are called on cloned enabled entity", function () {
        var e = new pc.Entity();

        e.addComponent('script', {
            "enabled": true,
            "order": [
                "scriptA",
                "scriptB",
            ],
            "scripts": {
                "scriptA": {
                    "enabled": true,
                    "attributes": {}
                },
                "scriptB": {
                    "enabled": true,
                    "attributes": {}
                }
            }
        });

        app.root.addChild(e);

        var clone = e.clone();
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

    it("all initialize calls are before postInitialize calls when enabling entity from inside initilize function", function () {
        var e = new pc.Entity('entity to enable');
        e.enabled = false;

        e.addComponent('script', {
            "enabled": true,
            "order": [
                "scriptA",
                "scriptB",
            ],
            "scripts": {
                "scriptA": {
                    "enabled": true,
                    "attributes": {}
                },
                "scriptB": {
                    "enabled": true,
                    "attributes": {}
                }
            }
        });

        app.root.addChild(e);

        expect(window.initializeCalls.length).to.equal(0);

        var enabler = new pc.Entity('enabler');

        enabler.addComponent('script', {
            "enabled": true,
            "order": [
                "enabler",
            ],
            "scripts": {
                "enabler": {
                    "enabled": true,
                    "attributes": {
                        "entityToEnable": e.getGuid()
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

    it("all initialize calls are before postInitialize calls for entity whose script component is enabled inside initilize function", function () {
        var e = new pc.Entity('entity to enable');

        e.addComponent('script', {
            "enabled": false,
            "order": [
                "scriptA",
                "scriptB",
            ],
            "scripts": {
                "scriptA": {
                    "enabled": true,
                    "attributes": {}
                },
                "scriptB": {
                    "enabled": true,
                    "attributes": {}
                }
            }
        });

        app.root.addChild(e);

        expect(window.initializeCalls.length).to.equal(0);

        var enabler = new pc.Entity();

        enabler.addComponent('script', {
            "enabled": true,
            "order": [
                "enabler",
            ],
            "scripts": {
                "enabler": {
                    "enabled": true,
                    "attributes": {
                        "entityToEnable": e.getGuid()
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

    it("initialize and postInitialize are fired together for script instance that is enabled in initialize function", function () {
        var e = new pc.Entity('entity to enable');

        e.addComponent('script', {
            "enabled": true,
            "order": [
                "scriptA",
                "scriptB",
            ],
            "scripts": {
                "scriptA": {
                    "enabled": false,
                    "attributes": {}
                },
                "scriptB": {
                    "enabled": false,
                    "attributes": {}
                }
            }
        });

        app.root.addChild(e);

        expect(window.initializeCalls.length).to.equal(0);

        var enabler = new pc.Entity();

        enabler.addComponent('script', {
            "enabled": true,
            "order": [
                "enabler",
            ],
            "scripts": {
                "enabler": {
                    "enabled": true,
                    "attributes": {
                        "entityToEnable": e.getGuid()
                    }
                }
            }
        });

        app.root.addChild(enabler);

        expect(window.initializeCalls.length).to.equal(6);
        var idx = -1;
        checkInitCall(enabler, ++idx, 'initialize enabler');
        checkInitCall(e, ++idx, 'initialize scriptA');
        checkInitCall(e, ++idx, 'postInitialize scriptA');
        checkInitCall(e, ++idx, 'initialize scriptB');
        checkInitCall(e, ++idx, 'postInitialize scriptB');
        checkInitCall(enabler, ++idx, 'postInitialize enabler');

    });

    it("initialize is called for entity and all children before postInitialize", function () {
        var e = new pc.Entity();

        e.addComponent('script', {
            "enabled": true,
            "order": [
                "scriptA",
                "scriptB",
            ],
            "scripts": {
                "scriptA": {
                    "enabled": true,
                    "attributes": {}
                },
                "scriptB": {
                    "enabled": true,
                    "attributes": {}
                }
            }
        });

        var c1 = new pc.Entity();
        c1.addComponent('script', {
            "enabled": true,
            "order": [
                "scriptA",
                "scriptB",
            ],
            "scripts": {
                "scriptA": {
                    "enabled": true,
                    "attributes": {}
                },
                "scriptB": {
                    "enabled": true,
                    "attributes": {}
                }
            }
        });
        e.addChild(c1);

        var c2 = new pc.Entity();
        c2.addComponent('script', {
            "enabled": true,
            "order": [
                "scriptA",
                "scriptB",
            ],
            "scripts": {
                "scriptA": {
                    "enabled": true,
                    "attributes": {}
                },
                "scriptB": {
                    "enabled": true,
                    "attributes": {}
                }
            }
        });
        e.addChild(c2);

        var c3 = new pc.Entity();
        c3.addComponent('script', {
            "enabled": true,
            "order": [
                "scriptA",
                "scriptB",
            ],
            "scripts": {
                "scriptA": {
                    "enabled": true,
                    "attributes": {}
                },
                "scriptB": {
                    "enabled": true,
                    "attributes": {}
                }
            }
        });

        c1.addChild(c3);

        expect(window.initializeCalls.length).to.equal(0);

        app.root.addChild(e);

        expect(window.initializeCalls.length).to.equal(16);
        var idx = -1;
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

    it("script attributes are initialized for enabled entity", function () {
        var e2 = new pc.Entity();
        app.root.addChild(e2);

        expect(e2).to.exist;

        var e = new pc.Entity();
        e.addComponent('script', {
            "enabled": true,
            "order": [
                "scriptWithAttributes"
            ],
            "scripts": {
                "scriptWithAttributes": {
                    "enabled": true,
                    "attributes": {
                        "attribute1": e2.getGuid()
                    }
                }
            }
        });

        app.root.addChild(e);
        expect(e.script.scriptWithAttributes.attribute1).to.equal(e2);
        expect(e.script.scriptWithAttributes.attribute2).to.equal(2);
    });

    it("script attributes are initialized with disabled entity", function () {
        var e2 = new pc.Entity();
        app.root.addChild(e2);
        expect(e2).to.exist;

        var e = new pc.Entity();
        e.enabled = false;
        e.addComponent('script', {
            "enabled": true,
            "order": [
                "scriptWithAttributes"
            ],
            "scripts": {
                "scriptWithAttributes": {
                    "enabled": true,
                    "attributes": {
                        "attribute1": e2.getGuid()
                    }
                }
            }
        });

        app.root.addChild(e);
        expect(e.script.scriptWithAttributes.attribute1).to.equal(e2);
        expect(e.script.scriptWithAttributes.attribute2).to.equal(2);
    });


    it("script attributes are initialized for disabled script component", function () {
        var e2 = new pc.Entity();
        app.root.addChild(e2);
        expect(e2).to.exist;

        var e = new pc.Entity();
        e.addComponent('script', {
            "enabled": false,
            "order": [
                "scriptWithAttributes"
            ],
            "scripts": {
                "scriptWithAttributes": {
                    "enabled": true,
                    "attributes": {
                        "attribute1": e2.getGuid()
                    }
                }
            }
        });

        app.root.addChild(e);
        expect(e.script.scriptWithAttributes.attribute1).to.equal(e2);
        expect(e.script.scriptWithAttributes.attribute2).to.equal(2);
    });

    it("script attributes are initialized for disabled script instance", function () {
        var e2 = new pc.Entity();
        app.root.addChild(e2);
        expect(e2).to.exist;

        var e = new pc.Entity();
        e.addComponent('script', {
            "enabled": true,
            "order": [
                "scriptWithAttributes"
            ],
            "scripts": {
                "scriptWithAttributes": {
                    "enabled": false,
                    "attributes": {
                        "attribute1": e2.getGuid()
                    }
                }
            }
        });

        app.root.addChild(e);
        expect(e.script.scriptWithAttributes.attribute1).to.equal(e2);
        expect(e.script.scriptWithAttributes.attribute2).to.equal(2);
    });

    it("script attributes are initialized when cloning enabled entity", function () {
        var e2 = new pc.Entity();
        app.root.addChild(e2);
        expect(e2).to.exist;

        var e = new pc.Entity();
        e.addComponent('script', {
            "enabled": true,
            "order": [
                "scriptWithAttributes"
            ],
            "scripts": {
                "scriptWithAttributes": {
                    "enabled": true,
                    "attributes": {
                        "attribute1": e2.getGuid()
                    }
                }
            }
        });

        app.root.addChild(e);

        var clone = e.clone();
        app.root.addChild(clone);

        expect(clone.script.scriptWithAttributes.attribute1).to.equal(e2);
        expect(clone.script.scriptWithAttributes.attribute2).to.equal(2);
    });

    it("script attributes are initialized when cloning disabled entity", function () {
        var e2 = new pc.Entity();
        app.root.addChild(e2);
        expect(e2).to.exist;

        var e = new pc.Entity();
        e.enabled = false;
        e.addComponent('script', {
            "enabled": true,
            "order": [
                "scriptWithAttributes"
            ],
            "scripts": {
                "scriptWithAttributes": {
                    "enabled": true,
                    "attributes": {
                        "attribute1": e2.getGuid()
                    }
                }
            }
        });

        app.root.addChild(e);

        var clone = e.clone();
        app.root.addChild(clone);

        expect(clone.script.scriptWithAttributes.attribute1).to.equal(e2);
        expect(clone.script.scriptWithAttributes.attribute2).to.equal(2);
    });

    it("script attributes are initialized when cloning disabled script component", function () {
        var e2 = new pc.Entity();
        app.root.addChild(e2);
        expect(e2).to.exist;

        var e = new pc.Entity();
        e.addComponent('script', {
            "enabled": false,
            "order": [
                "scriptWithAttributes"
            ],
            "scripts": {
                "scriptWithAttributes": {
                    "enabled": true,
                    "attributes": {
                        "attribute1": e2.getGuid()
                    }
                }
            }
        });

        app.root.addChild(e);

        var clone = e.clone();
        app.root.addChild(clone);

        expect(clone.script.scriptWithAttributes.attribute1).to.equal(e2);
        expect(clone.script.scriptWithAttributes.attribute2).to.equal(2);
    });

    it("script attributes are initialized when cloning disabled script instance", function () {
        var e2 = new pc.Entity();
        app.root.addChild(e2);
        expect(e2).to.exist;

        var e = new pc.Entity();
        e.addComponent('script', {
            "enabled": true,
            "order": [
                "scriptWithAttributes"
            ],
            "scripts": {
                "scriptWithAttributes": {
                    "enabled": false,
                    "attributes": {
                        "attribute1": e2.getGuid()
                    }
                }
            }
        });

        app.root.addChild(e);

        var clone = e.clone();
        app.root.addChild(clone);

        expect(clone.script.scriptWithAttributes.attribute1).to.equal(e2);
        expect(clone.script.scriptWithAttributes.attribute2).to.equal(2);
    });


    it("script attributes are initialized when loading scene for enabled entity", function () {
        var a = app.root.findByName('EnabledEntity');
        expect(a).to.exist;

        var b = app.root.findByName('ReferencedEntity');
        expect(b).to.exist;

        expect(a.script.scriptWithAttributes.attribute1).to.equal(b);
        expect(a.script.scriptWithAttributes.attribute2).to.equal(2);
    });

    it("script attributes are initialized when loading scene for disabled entity", function () {
        var a = app.root.findByName('DisabledEntity');

        var b = app.root.findByName('ReferencedEntity');

        expect(a).to.exist;
        expect(b).to.exist;

        expect(a.script.scriptWithAttributes.attribute1).to.equal(b);
        expect(a.script.scriptWithAttributes.attribute2).to.equal(2);
    });

    it("script attributes are initialized when loading scene for disabled script component", function () {
        var a = app.root.findByName('DisabledScriptComponent');
        expect(a).to.exist;

        var b = app.root.findByName('ReferencedEntity');
        expect(b).to.exist;

        expect(a.script.scriptWithAttributes.attribute1).to.equal(b);
        expect(a.script.scriptWithAttributes.attribute2).to.equal(2);
    });

    it("script attributes are initialized when loading scene for disabled script instance", function () {
        var a = app.root.findByName('DisabledScriptInstance');
        expect(a).to.exist;

        var b = app.root.findByName('ReferencedEntity');
        expect(b).to.exist;

        expect(a.script.scriptWithAttributes.attribute1).to.equal(b);
        expect(a.script.scriptWithAttributes.attribute2).to.equal(2);
    });

    it('script attributes are initialized when reloading scene', function (done) {
        // destroy current scene
        app.root.children[0].destroy();

        expect(app.root.findByName('ReferencedEntity')).to.not.exist;

        // verify entities are not there anymore
        var names = ['EnabledEntity', 'DisabledEntity', 'DisabledScriptComponent', 'DisabledScriptInstance'];
        names.forEach(function (name) {
            expect(app.root.findByName(name)).to.not.exist;
        })

        app.loadSceneHierarchy('base/tests/framework/components/script/scene1.json', function () {

            // verify entities are loaded
            names.forEach(function (name) {
                expect(app.root.findByName(name)).to.exist;
            })

            var referenced = app.root.findByName('ReferencedEntity');

            // verify script attributes are initialized
            names.forEach(function (name) {
                var e = app.root.findByName(name);
                expect(e.script).to.exist;
                expect(e.script.scriptWithAttributes.attribute1).to.equal(referenced);
                expect(e.script.scriptWithAttributes.attribute2).to.equal(2);
            });

            done();
        });
    });

    it('enable is fired when entity becomes enabled', function () {
        var e = new pc.Entity();
        e.addComponent('script', {
            "enabled": true,
            "order": [
                "scriptA"
            ],
            "scripts": {
                "scriptA": {
                    "enabled": true,
                    "attributes": {}
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
        var e = new pc.Entity();
        e.addComponent('script', {
            "enabled": true,
            "order": [
                "scriptA"
            ],
            "scripts": {
                "scriptA": {
                    "enabled": true,
                    "attributes": {}
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
        var e = new pc.Entity();
        e.addComponent('script', {
            "enabled": true,
            "order": [
                "scriptA"
            ],
            "scripts": {
                "scriptA": {
                    "enabled": true,
                    "attributes": {}
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
        var e = new pc.Entity();
        e.addComponent('script', {
            "enabled": false,
            "order": [
                "scriptA"
            ],
            "scripts": {
                "scriptA": {
                    "enabled": true,
                    "attributes": {}
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
        var e = new pc.Entity();
        e.addComponent('script', {
            "enabled": true,
            "order": [
                "scriptA"
            ],
            "scripts": {
                "scriptA": {
                    "enabled": true,
                    "attributes": {}
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
        var e = new pc.Entity();
        e.addComponent('script', {
            "enabled": true,
            "order": [
                "disabler",
                "scriptA"
            ],
            "scripts": {
                "disabler": {
                    "enabled": true,
                    "attributes": {
                        "disableEntity": true
                    }
                },
                "scriptA": {
                    "enabled": true,
                    "attributes": {}
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
        var e = new pc.Entity();
        e.addComponent('script', {
            "enabled": true,
            "order": [
                "disabler",
                "scriptA"
            ],
            "scripts": {
                "disabler": {
                    "enabled": true,
                    "attributes": {
                        "disableScriptComponent": true
                    }
                },
                "scriptA": {
                    "enabled": true,
                    "attributes": {}
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
        var e = new pc.Entity();
        e.addComponent('script', {
            "enabled": true,
            "order": [
                "disabler",
                "scriptA"
            ],
            "scripts": {
                "disabler": {
                    "enabled": true,
                    "attributes": {
                        "disableScriptInstance": true
                    }
                },
                "scriptA": {
                    "enabled": true,
                    "attributes": {}
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
        var e = new pc.Entity();
        e.addComponent('script', {
            "enabled": true,
            "order": ["loadedLater"],
            "scripts": {
                "loadedLater": {
                    "enabled": true,
                    "attributes": {}
                }
            }
        });

        app.root.addChild(e);

        expect(window.initializeCalls.length).to.equal(0);

        var asset = app.assets.get(7);
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

    it('initialize and postInitialize are called if script is added to the script registry later', function (done) {
        var e = new pc.Entity();
        e.addComponent('script', {
            "enabled": true,
            "order": ["loadedLater"],
            "scripts": {
                "loadedLater": {
                    "enabled": true,
                    "attributes": {}
                }
            }
        });

        app.root.addChild(e);

        expect(window.initializeCalls.length).to.equal(0);

        var asset = app.assets.get(7);
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
        var e = new pc.Entity();
        e.addComponent('script', {
            "enabled": true,
            "order": ["loadedLater"],
            "scripts": {
                "loadedLater": {
                    "enabled": true,
                    "attributes": {
                        "disableEntity": true
                    }
                }
            }
        });

        app.root.addChild(e);

        expect(window.initializeCalls.length).to.equal(0);

        var asset = app.assets.get(7);
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
        var e = new pc.Entity();
        e.addComponent('script', {
            "enabled": true,
            "order": ["loadedLater"],
            "scripts": {
                "loadedLater": {
                    "enabled": true,
                    "attributes": {
                        "disableScriptComponent": true
                    }
                }
            }
        });

        app.root.addChild(e);

        expect(window.initializeCalls.length).to.equal(0);

        var asset = app.assets.get(7);
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
        var e = new pc.Entity();
        e.addComponent('script', {
            "enabled": true,
            "order": ["loadedLater"],
            "scripts": {
                "loadedLater": {
                    "enabled": true,
                    "attributes": {
                        "disableScriptInstance": true
                    }
                }
            }
        });

        app.root.addChild(e);

        expect(window.initializeCalls.length).to.equal(0);

        var asset = app.assets.get(7);
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
        var e = new pc.Entity();
        e.addComponent('script', {
            "enabled": true,
            "order": ["loadedLater"],
            "scripts": {
                "loadedLater": {
                    "enabled": true,
                    "attributes": {
                        "disableEntity": true,
                        "disableScriptComponent": true,
                        "disableScriptInstance": true,
                    }
                }
            }
        });

        app.root.addChild(e);

        expect(e.script.loadedLater).to.not.exist;

        var asset = app.assets.get(7);
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
        var e = new pc.Entity();
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

        var updatesFound = 0;
        for (var i = 2; i < window.initializeCalls.length; i++) {
            if (window.initializeCalls[i].indexOf('update') >= 0) {
                updatesFound++;
            }
        }

        expect(updatesFound).to.equal(0);
    });

    it('remove script component from entity during update stops updating the rest of the entity\'s scripts', function () {
        var e = new pc.Entity();
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

        var updatesFound = 0;
        for (var i = 2; i < window.initializeCalls.length; i++) {
            if (window.initializeCalls[i].indexOf('update') >= 0) {
                updatesFound++;
            }
        }

        expect(updatesFound).to.equal(0);
    });

    it('remove script instance from script component during update keeps updating the rest of the entity\s scripts', function () {
        var e = new pc.Entity();
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

        var idx = 0;
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
        var e = new pc.Entity();
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
        var e = new pc.Entity();
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
        var e = new pc.Entity();
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
        var e = new pc.Entity('destroyer');
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

        var other = new pc.Entity('scriptA');
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
        var e = new pc.Entity();
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

        var other = new pc.Entity();
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
        var idx = 0;
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
        app.loadScene('base/tests/framework/components/script/scene2.json', function () {
            var e = app.root.findByName('A');
            var other = app.root.findByName('B');

            app.start();

            expect(window.initializeCalls.length).to.equal(8);
            var idx = 0;
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
        var root = new pc.Entity();

        var e = new pc.Entity();
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

        var other = new pc.Entity();
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
        var idx = 0;
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
        var e = new pc.Entity();
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

        var other = new pc.Entity();
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
        app.loadSceneHierarchy('base/tests/framework/components/script/scene3.json', function () {
            window.initializeCalls.length = 0;
            app.update();

            expect(window.initializeCalls.length).to.equal(16);

            // hierarchy looks like so:
            // Root
            // -- A
            //    -- B
            // -- C
            var root = app.root.findByName('Root');
            var a = app.root.findByName('A');
            var b = app.root.findByName('B');
            var c = app.root.findByName('C');

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
        var a = new pc.Entity();
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
        var a = new pc.Entity();
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
        var a = new pc.Entity();
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
        var DisableDuringUpdateLoop = pc.createScript('disableDuringUpdateLoop');
        DisableDuringUpdateLoop.prototype.update = function () {
            window.initializeCalls.push(this.entity.getGuid() + ' update disableDuringUpdateLoop');
            this.entity.script.scriptA.enabled = false;
        };
        DisableDuringUpdateLoop.prototype.postUpdate = function () {
            window.initializeCalls.push(this.entity.getGuid() + ' postUpdate disableDuringUpdateLoop');
        };

        var a = new pc.Entity();
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
        var DisableDuringUpdateLoop = pc.createScript('disableDuringUpdateLoop');
        DisableDuringUpdateLoop.prototype.update = function () {
            window.initializeCalls.push(this.entity.getGuid() + ' update disableDuringUpdateLoop');
            this.entity.script.enabled = false;
        };
        DisableDuringUpdateLoop.prototype.postUpdate = function () {
            window.initializeCalls.push(this.entity.getGuid() + ' postUpdate disableDuringUpdateLoop');
        };

        var a = new pc.Entity();
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
        var DisableDuringUpdateLoop = pc.createScript('disableDuringUpdateLoop');
        DisableDuringUpdateLoop.prototype.update = function () {
            window.initializeCalls.push(this.entity.getGuid() + ' update disableDuringUpdateLoop');
            this.entity.enabled = false;
        };
        DisableDuringUpdateLoop.prototype.postUpdate = function () {
            window.initializeCalls.push(this.entity.getGuid() + ' postUpdate disableDuringUpdateLoop');
        };

        var a = new pc.Entity();
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
        var DisableDuringUpdateLoop = pc.createScript('disableDuringUpdateLoop');
        DisableDuringUpdateLoop.prototype.postUpdate = function () {
            window.initializeCalls.push(this.entity.getGuid() + ' postUpdate disableDuringUpdateLoop');
            this.entity.script.scriptA.enabled = false;
        };

        var a = new pc.Entity();
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
        var DisableDuringUpdateLoop = pc.createScript('disableDuringUpdateLoop');
        DisableDuringUpdateLoop.prototype.postUpdate = function () {
            window.initializeCalls.push(this.entity.getGuid() + ' postUpdate disableDuringUpdateLoop');
            this.entity.script.enabled = false;
        };

        var a = new pc.Entity();
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
        var DisableDuringUpdateLoop = pc.createScript('disableDuringUpdateLoop');
        DisableDuringUpdateLoop.prototype.postUpdate = function () {
            window.initializeCalls.push(this.entity.getGuid() + ' postUpdate disableDuringUpdateLoop');
            this.entity.enabled = false;
        };

        var a = new pc.Entity();
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
        var DisableDuringUpdateLoop = pc.createScript('disableDuringUpdateLoop');
        DisableDuringUpdateLoop.prototype.update = function () {
            window.initializeCalls.push(this.entity.getGuid() + ' update disableDuringUpdateLoop');
            this.entity.script.disableDuringUpdateLoop.enabled = false;
        };

        var EnableDuringUpdateLoop = pc.createScript('enableDuringUpdateLoop');
        EnableDuringUpdateLoop.prototype.update = function () {
            window.initializeCalls.push(this.entity.getGuid() + ' update enableDuringUpdateLoop');
            this.entity.script.disableDuringUpdateLoop.enabled = true; // enable first script back
        };

        var a = new pc.Entity();
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
        var DisableDuringUpdateLoop = pc.createScript('disableDuringUpdateLoop');
        DisableDuringUpdateLoop.prototype.postUpdate = function () {
            window.initializeCalls.push(this.entity.getGuid() + ' postUpdate disableDuringUpdateLoop');
            this.entity.script.disableDuringUpdateLoop.enabled = false;
        };

        var EnableDuringUpdateLoop = pc.createScript('enableDuringUpdateLoop');
        EnableDuringUpdateLoop.prototype.postUpdate = function () {
            window.initializeCalls.push(this.entity.getGuid() + ' postUpdate enableDuringUpdateLoop');
            this.entity.script.disableDuringUpdateLoop.enabled = true; // enable first script back
        };

        var a = new pc.Entity();
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
        var DisableDuringUpdateLoop = pc.createScript('disableDuringUpdateLoop');
        DisableDuringUpdateLoop.prototype.update = function () {
            window.initializeCalls.push(this.entity.getGuid() + ' update disableDuringUpdateLoop');
            this.entity.script.enabled = false;
        };

        var EnableDuringUpdateLoop = pc.createScript('enableDuringUpdateLoop');
        EnableDuringUpdateLoop.prototype.update = function () {
            window.initializeCalls.push(this.entity.getGuid() + ' update enableDuringUpdateLoop');
            var e = app.root.findByName('a');
            e.script.enabled = true; // enable first script component back
        };

        var a = new pc.Entity('a');
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

        var b = new pc.Entity('b');
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
        var DisableDuringUpdateLoop = pc.createScript('disableDuringUpdateLoop');
        DisableDuringUpdateLoop.prototype.postUpdate = function () {
            window.initializeCalls.push(this.entity.getGuid() + ' postUpdate disableDuringUpdateLoop');
            this.entity.script.enabled = false;
        };

        var EnableDuringUpdateLoop = pc.createScript('enableDuringUpdateLoop');
        EnableDuringUpdateLoop.prototype.postUpdate = function () {
            window.initializeCalls.push(this.entity.getGuid() + ' postUpdate enableDuringUpdateLoop');
            var e = app.root.findByName('a');
            e.script.enabled = true; // enable first script component back
        };

        var a = new pc.Entity('a');
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

        var b = new pc.Entity('b');
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
        var a = new pc.Entity();
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
        var b = new pc.Entity();
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
        var c = new pc.Entity();
        app.root.addChild(c);

        // insert entity in the beginning of the hierarchy
        // (should not make a difference)
        var d = new pc.Entity();
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
        var EnableDuringUpdateLoop = pc.createScript('enableDuringUpdateLoop');
        EnableDuringUpdateLoop.prototype.update = function () {
            window.initializeCalls.push(this.entity.getGuid() + ' update enableDuringUpdateLoop');
            var e = app.root.findByName('b');
            e.enabled = true;
        };

        // parent entity
        var a = new pc.Entity('a');
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
        var b = new pc.Entity('b');
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
        var EnableDuringUpdateLoop = pc.createScript('enableDuringUpdateLoop');
        EnableDuringUpdateLoop.prototype.update = function () {
            window.initializeCalls.push(this.entity.getGuid() + ' update enableDuringUpdateLoop');
            var e = app.root.findByName('a');
            e.script.enabled = true;
        };

        // parent entity (note there doesn't have to be a parent-child relationship
        // what really matters is which script component is created first by calling addComponent)
        var a = new pc.Entity('a');
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
        var b = new pc.Entity('b');
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
        var EnableDuringUpdateLoop = pc.createScript('enableDuringUpdateLoop');
        EnableDuringUpdateLoop.prototype.update = function () {
            window.initializeCalls.push(this.entity.getGuid() + ' update enableDuringUpdateLoop');
            this.entity.script.scriptB.enabled = true;
        };

        // parent entity (note there doesn't have to be a parent-child relationship
        // what really matters is which script component is created first by calling addComponent)
        var a = new pc.Entity('a');
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
        var EnableDuringUpdateLoop = pc.createScript('enableDuringUpdateLoop');
        EnableDuringUpdateLoop.prototype.update = function () {
            window.initializeCalls.push(this.entity.getGuid() + ' update enableDuringUpdateLoop');
            this.entity.script.scriptB.enabled = true;
        };

        // parent entity (note there doesn't have to be a parent-child relationship
        // what really matters is which script component is created first by calling addComponent)
        var a = new pc.Entity('a');
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
        var EnableDuringUpdateLoop = pc.createScript('enableDuringUpdateLoop');
        EnableDuringUpdateLoop.prototype.postUpdate = function () {
            window.initializeCalls.push(this.entity.getGuid() + ' post update enableDuringUpdateLoop');
            this.entity.script.scriptB.enabled = true;
        };

        // parent entity (note there doesn't have to be a parent-child relationship
        // what really matters is which script component is created first by calling addComponent)
        var a = new pc.Entity('a');
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
        var EnableDuringUpdateLoop = pc.createScript('enableDuringUpdateLoop');
        EnableDuringUpdateLoop.prototype.postUpdate = function () {
            window.initializeCalls.push(this.entity.getGuid() + ' post update enableDuringUpdateLoop');
            this.entity.script.scriptB.enabled = true;
        };

        // parent entity (note there doesn't have to be a parent-child relationship
        // what really matters is which script component is created first by calling addComponent)
        var a = new pc.Entity('a');
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
        var e;
        var entities = [];

        // make 3 entities with scriptA
        for (var i = 0; i < 3; i++) {
            e = new pc.Entity();
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
        e = new pc.Entity();
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
        var e = new pc.Entity();
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
        var e = new pc.Entity();
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
        var e = new pc.Entity();
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
        var Move = pc.createScript('mover');
        Move.prototype.update = function () {
            this.entity.script.move('scriptA', 2);
        };

        var e = new pc.Entity();
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
        var Move = pc.createScript('mover');
        Move.prototype.update = function () {
            this.entity.script.move('scriptB', 0);
        };

        var e = new pc.Entity();
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
        var e = new pc.Entity();
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
        var NewScriptA = pc.createScript('scriptA');
        NewScriptA.prototype.update = function () {
            window.initializeCalls.push(this.entity.getGuid() + ' update new scriptA');
        };
        NewScriptA.prototype.postUpdate = function () {
            window.initializeCalls.push(this.entity.getGuid() + ' postUpdate new scriptA');
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
});
