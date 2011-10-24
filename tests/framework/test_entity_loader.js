module("pc.fw.loader.json", {
    setup: function () {
            pc.content = {};
            registry = new pc.fw.ComponentSystemRegistry();
        },
    
    teardown: function () {
        delete pc.content;
        delete registry;
    }
});



test("load, from pc.content.data", 2, function () {
    pc.content.data = {
        "A123": {
            "_id": "ABC",
            "resource_id": "A123",
            "transform": [1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1],
            "parent": null,
            "children": [],
            "components": {
                "header": {
                    "name": "NAME",
                    "description": "DESCRIPTION"
                }
            }
        }
    };
    
    jack(function () {
        var gm = jack.create("GraphManager", ["create", "addNode", "removeNode"])
        jack.expect("GraphManager.create")
            .mock(function () {
                return new pc.fw.Entity();
            });

        var loader = new pc.fw.EntityLoader(gm);    
        loader.load("A123", null, registry, function (entity) {
            ok(entity);
            equal("A123", entity.getGuid());
        });
    });
});

test("load, from pc.content.data with children", 4, function () {
    pc.content.data = {
        "A123": {
            "_id": "ABC",
            "resource_id": "A123",
            "transform": [1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1],
            "parent": null,
            "children": ["B123"],
            "components": {
                "header": {
                    "name": "NAME",
                    "description": "DESCRIPTION"
                }
            }
        },
        "B123": {
            "_id": "DEF",
            "resource_id": "B123",
            "transform": [1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1],
            "parent": "A123",
            "children": [],
            "components": {
                "header": {
                    "name": "NAME2",
                    "description": "DESCRIPTION2"
                }
            }
            
        }
        
    };
    
    jack(function () {
        var gm = jack.create("GraphManager", ["create", "addNode", "removeNode"])
        jack.expect("GraphManager.create")
            .exactly("2 times")
            .mock(function () {
                return new pc.fw.Entity();
            });

        var loader = new pc.fw.EntityLoader(gm);
        loader.load("A123", null, registry, function (entity) {
            ok(entity);
            equal("A123", entity.getGuid());
            equal(1, entity.getChildren().length);
            equal("B123", entity.getChildren()[0].getGuid());
        });

    })
});

test("open", function () {
    pc.content.data = {
        "A123": {
            "_id": "ABC",
            "resource_id": "A123",
            "transform": [1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1],
            "parent": null,
            "children": ["B123"],
            "components": {
                "header": {
                    "name": "NAME",
                    "description": "DESCRIPTION"
                }
            }
        },
        "B123": {
            "_id": "DEF",
            "resource_id": "B123",
            "transform": [1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1],
            "parent": "A123",
            "children": [],
            "components": {
                "header": {
                    "name": "NAME2",
                    "description": "DESCRIPTION2"
                }
            }
            
        }
    };

    jack(function () {
        var gm = jack.create("GraphManager", ["create", "addNode", "removeNode"])
        jack.expect("GraphManager.create")
            .exactly("1 times")
            .mock(function () {
                return new pc.fw.Entity();
            });
        var loader = new pc.fw.EntityLoader(gm);    
        var entity = loader.open(pc.content.data["A123"], registry);
        
        ok(entity);
        equal("A123", entity.getGuid());
        equal(0, entity.getChildren().length);

    })    
});

test("close", function () {
    pc.content.data = {
        "A123": {
            "_id": "ABC",
            "resource_id": "A123",
            "transform": [1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1],
            "parent": null,
            "children": ["B123"],
            "components": {
                "header": {
                    "name": "NAME",
                    "description": "DESCRIPTION"
                }
            }
        },
        "B123": {
            "_id": "DEF",
            "resource_id": "B123",
            "transform": [1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1],
            "parent": "A123",
            "children": [],
            "components": {
                "header": {
                    "name": "NAME2",
                    "description": "DESCRIPTION2"
                }
            }
            
        }
    };
    
    jack(function () {
        var gm = jack.create("GraphManager", ["create", "addNode", "removeNode", "findByGuid"])
        jack.expect("GraphManager.create")
            .exactly("2 times")
            .mock(function () {
                return new pc.fw.Entity();
            });

        var parent = new pc.scene.GraphNode();
        var loader = new pc.fw.EntityLoader(gm);    
        
        loader.load("A123", null, registry, function (entity) {
            parent.addChild(entity);
            jack.expect("GraphManager.findByGuid")
                .exactly("2 time")
                .mock(function (guid) {
                    if(guid == "A123") {
                        return entity;
                    } else {
                        return entity.getChildren()[0];
                    }
                });

            loader.close("A123", parent, registry);
            
            equal(0, parent.getChildren().length);
            equal(0, entity.getChildren().length);
        });
        
    });
});

test("patchChildren", function () {
    
});

