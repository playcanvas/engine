module("pc.ScriptComponent", {
    setup: function () {
        this.app = new pc.Application(document.createElement("canvas"));

        window.initializeCalls = [];

        stop();

        var app = this.app;

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
                    "url": "scriptA.js"
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
                    "url": "scriptB.js"
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
                    "url": "cloner.js"
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
                    "url": "enabler.js"
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
                    "url": "disabler.js"
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
                    "url": "scriptWithAttributes.js"
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
                    "url": "loadedLater.js"
                },
                "region": "eu-west-1",
                "id": "7"
            }
        });

        app.preload(function (err) {
            if (err) {
                console.error(err);
            }

            app.loadScene('scene1.json', function () {
                app.start();
                start();
            });
        });
    },

    teardown: function () {
        this.app.destroy();

        delete window.initializeCalls;
    }
});

var checkInitCall = function (entity, index, text) {
    equal(window.initializeCalls[index], entity.getGuid() + ' ' + text);
}

test("script assets are loaded", function () {
    ok(pc.app.assets.get(1));
    ok(pc.app.scripts.get('scriptA'));
    ok(pc.app.assets.get(2));
    ok(pc.app.scripts.get('scriptB'));
});

test("initialize and postInitialize are called on new entity", function () {
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

    ok(e.script.scriptA);
    equal(window.initializeCalls.length, 0);

    this.app.root.addChild(e);

    equal(window.initializeCalls.length, 2);
    checkInitCall(e, 0, 'initialize scriptA');
    checkInitCall(e, 1, 'postInitialize scriptA');
});

test("all initialize calls are before all postInitialize calls on new entity", function () {
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

    ok(e.script.scriptA);
    ok(e.script.scriptB);

    equal(window.initializeCalls.length, 0);

    this.app.root.addChild(e);

    equal(window.initializeCalls.length, 4);
    checkInitCall(e, 0, 'initialize scriptA');
    checkInitCall(e, 1, 'initialize scriptB');
    checkInitCall(e, 2, 'postInitialize scriptA');
    checkInitCall(e, 3, 'postInitialize scriptB');
});

test("initialize and postInitialize are called on entity that is enabled later", function () {
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

    ok(e.script.scriptA);
    equal(window.initializeCalls.length, 0);

    this.app.root.addChild(e);
    equal(window.initializeCalls.length, 0);

    e.enabled = true;
    equal(window.initializeCalls.length, 2);
    checkInitCall(e, 0, 'initialize scriptA');
    checkInitCall(e, 1, 'postInitialize scriptA');
});

test("initialize and postInitialize are called on script component that is enabled later", function () {
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

    ok(e.script.scriptA);
    equal(window.initializeCalls.length, 0);

    this.app.root.addChild(e);
    equal(window.initializeCalls.length, 0);

    e.script.enabled = true;
    equal(window.initializeCalls.length, 2);
    checkInitCall(e, 0, 'initialize scriptA');
    checkInitCall(e, 1, 'postInitialize scriptA');
});

test("initialize and postInitialize are called on script instance that is enabled later", function () {
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

    ok(e.script.scriptA);
    equal(window.initializeCalls.length, 0);

    this.app.root.addChild(e);
    equal(window.initializeCalls.length, 0);

    e.script.scriptA.enabled = true;
    equal(window.initializeCalls.length, 2);
    checkInitCall(e, 0, 'initialize scriptA');
    checkInitCall(e, 1, 'postInitialize scriptA');
});

test("initialize and postInitialize are called on script instance that is created later", function () {
    var e = new pc.Entity();
    this.app.root.addChild(e);
    e.addComponent('script');
    e.script.create('scriptA');
    ok(e.script.scriptA);
    equal(window.initializeCalls.length, 2);
    checkInitCall(e, 0, 'initialize scriptA');
    checkInitCall(e, 1, 'postInitialize scriptA');
});

test("initialize and postInitialize are called on cloned enabled entity", function () {
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

    this.app.root.addChild(e);

    var clone = e.clone();
    equal(window.initializeCalls.length, 4);

    this.app.root.addChild(clone);
    equal(window.initializeCalls.length, 8);

    checkInitCall(e, 0, 'initialize scriptA');
    checkInitCall(e, 1, 'initialize scriptB');
    checkInitCall(e, 2, 'postInitialize scriptA');
    checkInitCall(e, 3, 'postInitialize scriptB');

    checkInitCall(clone, 4, 'initialize scriptA');
    checkInitCall(clone, 5, 'initialize scriptB');
    checkInitCall(clone, 6, 'postInitialize scriptA');
    checkInitCall(clone, 7, 'postInitialize scriptB');
});

test("all initialize calls are before postInitialize calls when enabling entity from inside initilize function", function () {
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

    this.app.root.addChild(e);

    equal(window.initializeCalls.length, 0);

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

    this.app.root.addChild(enabler);

    equal(window.initializeCalls.length, 6);
    checkInitCall(enabler, 0, 'initialize enabler');
    checkInitCall(e, 1, 'initialize scriptA');
    checkInitCall(e, 2, 'initialize scriptB');
    checkInitCall(e, 3, 'postInitialize scriptA');
    checkInitCall(e, 4, 'postInitialize scriptB');
    checkInitCall(enabler, 5, 'postInitialize enabler');

});

test("all initialize calls are before postInitialize calls for entity whose script component is enabled inside initilize function", function () {
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

    this.app.root.addChild(e);

    equal(window.initializeCalls.length, 0);

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

    this.app.root.addChild(enabler);

    equal(window.initializeCalls.length, 6);
    checkInitCall(enabler, 0, 'initialize enabler');
    checkInitCall(e, 1, 'initialize scriptA');
    checkInitCall(e, 2, 'initialize scriptB');
    checkInitCall(e, 3, 'postInitialize scriptA');
    checkInitCall(e, 4, 'postInitialize scriptB');
    checkInitCall(enabler, 5, 'postInitialize enabler');

});

test("initialize and postInitialize are fired together for script instance that is enabled in initialize function", function () {
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

    this.app.root.addChild(e);

    equal(window.initializeCalls.length, 0);

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

    this.app.root.addChild(enabler);

    equal(window.initializeCalls.length, 6);
    var idx = -1;
    checkInitCall(enabler, ++idx, 'initialize enabler');
    checkInitCall(e, ++idx, 'initialize scriptA');
    checkInitCall(e, ++idx, 'postInitialize scriptA');
    checkInitCall(e, ++idx, 'initialize scriptB');
    checkInitCall(e, ++idx, 'postInitialize scriptB');
    checkInitCall(enabler, ++idx, 'postInitialize enabler');

});

test("initialize is called for entity and all children before postInitialize", function () {
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

    equal(window.initializeCalls.length, 0);

    this.app.root.addChild(e);

    equal(window.initializeCalls.length, 16);
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

test("script attributes are initialized for enabled entity", function () {
    var e2 = new pc.Entity();
    this.app.root.addChild(e2);
    ok(e2);

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

    this.app.root.addChild(e);
    ok(e.script.scriptWithAttributes.attribute1 === e2);
    equal(e.script.scriptWithAttributes.attribute2, 2);
});

test("script attributes are initialized with disabled entity", function () {
    var e2 = new pc.Entity();
    this.app.root.addChild(e2);
    ok(e2);

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

    this.app.root.addChild(e);
    ok(e.script.scriptWithAttributes.attribute1 === e2);
    equal(e.script.scriptWithAttributes.attribute2, 2);
});


test("script attributes are initialized for disabled script component", function () {
    var e2 = new pc.Entity();
    this.app.root.addChild(e2);
    ok(e2);

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

    this.app.root.addChild(e);
    ok(e.script.scriptWithAttributes.attribute1 === e2);
    equal(e.script.scriptWithAttributes.attribute2, 2);
});

test("script attributes are initialized for disabled script instance", function () {
    var e2 = new pc.Entity();
    this.app.root.addChild(e2);
    ok(e2);

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

    this.app.root.addChild(e);
    ok(e.script.scriptWithAttributes.attribute1 === e2);
    equal(e.script.scriptWithAttributes.attribute2, 2);
});

test("script attributes are initialized when cloning enabled entity", function () {
    var e2 = new pc.Entity();
    this.app.root.addChild(e2);
    ok(e2);

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

    this.app.root.addChild(e);

    var clone = e.clone();
    this.app.root.addChild(clone);

    ok(clone.script.scriptWithAttributes.attribute1 === e2);
    equal(clone.script.scriptWithAttributes.attribute2, 2);
});

test("script attributes are initialized when cloning disabled entity", function () {
    var e2 = new pc.Entity();
    this.app.root.addChild(e2);
    ok(e2);

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

    this.app.root.addChild(e);

    var clone = e.clone();
    this.app.root.addChild(clone);

    ok(clone.script.scriptWithAttributes.attribute1 === e2);
    equal(clone.script.scriptWithAttributes.attribute2, 2);
});

test("script attributes are initialized when cloning disabled script component", function () {
    var e2 = new pc.Entity();
    this.app.root.addChild(e2);
    ok(e2);

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

    this.app.root.addChild(e);

    var clone = e.clone();
    this.app.root.addChild(clone);

    ok(clone.script.scriptWithAttributes.attribute1 === e2);
    equal(clone.script.scriptWithAttributes.attribute2, 2);
});

test("script attributes are initialized when cloning disabled script instance", function () {
    var e2 = new pc.Entity();
    this.app.root.addChild(e2);
    ok(e2);

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

    this.app.root.addChild(e);

    var clone = e.clone();
    this.app.root.addChild(clone);

    ok(clone.script.scriptWithAttributes.attribute1 === e2);
    equal(clone.script.scriptWithAttributes.attribute2, 2);
});


test("script attributes are initialized when loading scene for enabled entity", function () {
    var a = this.app.root.findByName('EnabledEntity');
    ok(a);

    var b = this.app.root.findByName('ReferencedEntity');
    ok(b);

    ok(a.script.scriptWithAttributes.attribute1 === b);
    equal(a.script.scriptWithAttributes.attribute2, 2);
});

test("script attributes are initialized when loading scene for disabled entity", function () {
    var a = this.app.root.findByName('DisabledEntity');
    ok(a);

    var b = this.app.root.findByName('ReferencedEntity');
    ok(b);

    ok(a.script.scriptWithAttributes.attribute1 === b);
    equal(a.script.scriptWithAttributes.attribute2, 2);
});

test("script attributes are initialized when loading scene for disabled script component", function () {
    var a = this.app.root.findByName('DisabledScriptComponent');
    ok(a);

    var b = this.app.root.findByName('ReferencedEntity');
    ok(b);

    ok(a.script.scriptWithAttributes.attribute1 === b);
    equal(a.script.scriptWithAttributes.attribute2, 2);
});

test("script attributes are initialized when loading scene for disabled script instance", function () {
    var a = this.app.root.findByName('DisabledScriptInstance');
    ok(a);

    var b = this.app.root.findByName('ReferencedEntity');
    ok(b);

    ok(a.script.scriptWithAttributes.attribute1 === b);
    equal(a.script.scriptWithAttributes.attribute2, 2);
});

test('script attributes are initialized when reloading scene', function () {
    var app = this.app;

    // destroy current scene
    app.root.children[0].destroy();

    ok(! app.root.findByName('ReferencedEntity'));

    // verify entities are not there anymore
    var names = ['EnabledEntity', 'DisabledEntity', 'DisabledScriptComponent', 'DisabledScriptInstance'];
    names.forEach(function (name) {
        ok(! app.root.findByName(name));
    })

    stop();

    app.loadSceneHierarchy('scene1.json', function () {
        start();

        // verify entities are loaded
        names.forEach(function (name) {
            ok(app.root.findByName(name));
        })

        var referenced = app.root.findByName('ReferencedEntity');

        // verify script attributes are initialized
        names.forEach(function (name) {
            var e = app.root.findByName(name);
            ok(e.script);
            ok(e.script.scriptWithAttributes.attribute1 === referenced);
            equal(e.script.scriptWithAttributes.attribute2, 2);
        })
    });
});

test('enable is fired when entity becomes enabled', function () {
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

    this.app.root.addChild(e);

    equal(window.initializeCalls.length, 2);
    checkInitCall(e, 0, 'initialize scriptA');
    checkInitCall(e, 1, 'postInitialize scriptA');

    e.enabled = false;

    window.initializeCalls.length = 0;

    e.enabled = true;

    equal(window.initializeCalls.length, 4);
    checkInitCall(e, 0, 'enable scriptComponent scriptA');
    checkInitCall(e, 1, 'state scriptComponent true scriptA');
    checkInitCall(e, 2, 'enable scriptA');
    checkInitCall(e, 3, 'state true scriptA');
});

test('disable is fired when entity becomes disabled', function () {
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

    this.app.root.addChild(e);

    window.initializeCalls.length = 0;

    e.enabled = false;

    equal(window.initializeCalls.length, 4);
    checkInitCall(e, 0, 'disable scriptComponent scriptA');
    checkInitCall(e, 1, 'state scriptComponent false scriptA');
    checkInitCall(e, 2, 'disable scriptA');
    checkInitCall(e, 3, 'state false scriptA');
});

test('enable is fired when script component becomes enabled', function () {
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

    this.app.root.addChild(e);

    e.script.enabled = false;

    window.initializeCalls.length = 0;

    e.script.enabled = true;

    equal(window.initializeCalls.length, 4);
    checkInitCall(e, 0, 'enable scriptComponent scriptA');
    checkInitCall(e, 1, 'state scriptComponent true scriptA');
    checkInitCall(e, 2, 'enable scriptA');
    checkInitCall(e, 3, 'state true scriptA');
});

test('enable is not fired if script component started disabled', function () {
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

    this.app.root.addChild(e);

    e.script.enabled = true;

    equal(window.initializeCalls.length, 2);
    checkInitCall(e, 0, 'initialize scriptA');
    checkInitCall(e, 1, 'postInitialize scriptA');
});

test('disable is fired when script component becomes disabled', function () {
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

    this.app.root.addChild(e);

    window.initializeCalls.length = 0;

    e.script.enabled = false;

    equal(window.initializeCalls.length, 4);
    checkInitCall(e, 0, 'disable scriptComponent scriptA');
    checkInitCall(e, 1, 'state scriptComponent false scriptA');
    checkInitCall(e, 2, 'disable scriptA');
    checkInitCall(e, 3, 'state false scriptA');
});


test('if entity is disabled in initialize call and enabled later, postInitialize is called only later', function () {
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

    this.app.root.addChild(e);

    equal(window.initializeCalls.length, 1);
    checkInitCall(e, 0, 'initialize disabler');

    window.initializeCalls.length = 0;

    e.enabled = true;

    equal(window.initializeCalls.length, 3);
    checkInitCall(e, 0, 'initialize scriptA');
    checkInitCall(e, 1, 'postInitialize disabler');
    checkInitCall(e, 2, 'postInitialize scriptA');
});

test('if script component is disabled in initialize call and enabled later, postInitialize is called only later', function () {
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

    this.app.root.addChild(e);

    equal(window.initializeCalls.length, 1);
    checkInitCall(e, 0, 'initialize disabler');

    window.initializeCalls.length = 0;

    e.script.enabled = true;

    equal(window.initializeCalls.length, 3);
    checkInitCall(e, 0, 'initialize scriptA');
    checkInitCall(e, 1, 'postInitialize disabler');
    checkInitCall(e, 2, 'postInitialize scriptA');
});

test('if script instance is disabled in initialize call and enabled later, postInitialize is called only later', function () {
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

    this.app.root.addChild(e);

    equal(window.initializeCalls.length, 2);
    checkInitCall(e, 0, 'initialize disabler');
    checkInitCall(e, 1, 'postInitialize disabler');

    window.initializeCalls.length = 0;

    e.script.scriptA.enabled = true;

    equal(window.initializeCalls.length, 2);
    checkInitCall(e, 0, 'initialize scriptA');
    checkInitCall(e, 1, 'postInitialize scriptA');
});

test('initialize and postInitialize are called if script is added to the script registry later', function () {
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

    this.app.root.addChild(e);

    equal(window.initializeCalls.length, 0);

    stop();

    var asset = this.app.assets.get(7);
    this.app.scripts.on('add:loadedLater', function () {
        setTimeout(function () {
            start();

            equal(window.initializeCalls.length, 2);
            checkInitCall(e, 0, 'initialize loadedLater');
            checkInitCall(e, 1, 'postInitialize loadedLater');
        }, 100);
    });

    this.app.assets.load(asset);
});

test('initialize and postInitialize are called if script is added to the script registry later', function () {
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

    this.app.root.addChild(e);

    equal(window.initializeCalls.length, 0);

    stop();

    var asset = this.app.assets.get(7);
    this.app.scripts.on('add:loadedLater', function () {
        setTimeout(function () {
            start();

            equal(window.initializeCalls.length, 2);
            checkInitCall(e, 0, 'initialize loadedLater');
            checkInitCall(e, 1, 'postInitialize loadedLater');
        }, 100);
    });

    this.app.assets.load(asset);
});

test('if entity is disabled in initialize call of script that is added later, postInitialize is called only when it becomes enabled again', function () {
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

    this.app.root.addChild(e);

    equal(window.initializeCalls.length, 0);

    stop();

    var asset = this.app.assets.get(7);
    this.app.scripts.on('add:loadedLater', function () {
        setTimeout(function () {
            start();

            equal(window.initializeCalls.length, 1);
            checkInitCall(e, 0, 'initialize loadedLater');
            window.initializeCalls.length = 0;

            e.enabled = true;
            equal(window.initializeCalls.length, 1);
            checkInitCall(e, 0, 'postInitialize loadedLater');
        }, 100);
    });

    this.app.assets.load(asset);
});

test('if script component is disabled in initialize call of script that is added later, postInitialize is called only when it becomes enabled again', function () {
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

    this.app.root.addChild(e);

    equal(window.initializeCalls.length, 0);

    stop();

    var asset = this.app.assets.get(7);
    this.app.scripts.on('add:loadedLater', function () {
        setTimeout(function () {
            start();

            equal(window.initializeCalls.length, 1);
            checkInitCall(e, 0, 'initialize loadedLater');
            window.initializeCalls.length = 0;

            e.script.enabled = true;
            equal(window.initializeCalls.length, 1);
            checkInitCall(e, 0, 'postInitialize loadedLater');
        }, 100);
    });

    this.app.assets.load(asset);
});

test('if script instance is disabled in initialize call of script that is added later, postInitialize is called only when it becomes enabled again', function () {
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

    this.app.root.addChild(e);

    equal(window.initializeCalls.length, 0);

    stop();

    var asset = this.app.assets.get(7);
    this.app.scripts.on('add:loadedLater', function () {
        setTimeout(function () {
            start();

            equal(window.initializeCalls.length, 1);
            checkInitCall(e, 0, 'initialize loadedLater');
            window.initializeCalls.length = 0;

            e.script.loadedLater.enabled = true;
            equal(window.initializeCalls.length, 1);
            checkInitCall(e, 0, 'postInitialize loadedLater');
        }, 100);
    });

    this.app.assets.load(asset);
});

