module('pc.resources.EntityHandler', {
    setup: function () {
        _http = pc.net.http;
    },
    teardown: function () {
        pc.content.data = {};
        pc.net.http = _http;
    }
});

test('new EntityHandler', function () {
    var handler = new pc.resources.EntityResourceHandler();
	var loader = new pc.resources.ResourceLoader();
	handler.setLoader(loader);

    ok(handler);    
});

asyncTest('EntityHandler: request', 3, function () {
    jack(function () {
        var data = {
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
        var guid = 'A123';
        var registry = new pc.fw.ComponentSystemRegistry();
        var manager = new pc.scene.GraphManager();
        var depot = {};
        depot.entities = jack.create('depot.entities', ['getOne']);
        jack.expect('depot.entities.getOne')
            .exactly("1 times")
            .whereArgument(0).is("A123")
            .whereArgument(1).isType("function")
            .whereArgument(2).isType("function")
            .mock(function (guid, success, error) {
                setTimeout(function () {
                    success(data[guid]);
                }, 100);
            });
        var handler = new pc.resources.EntityResourceHandler(manager, registry, depot);
        var loader = new pc.resources.ResourceLoader();
        loader.registerHandler(pc.resources.EntityRequest, handler);
        
        loader.request([new pc.resources.EntityRequest("A123")], 1, function (resources) {
            var entity = resources["A123"];
            ok(entity);
            equal(entity.getGuid(), guid);
            equal(entity.getChildren().length, 0);
            start();
        });
        
    });
});

asyncTest('EntityHandler: multiple requests', 6, function () {
    jack(function () {
        var data = {
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
            },
            "B123": {
                "_id": "BBC",
                "resource_id": "B123",
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
        var guid = 'A123';
        var registry = new pc.fw.ComponentSystemRegistry();
        var manager = new pc.scene.GraphManager();
        var depot = {};
        depot.entities = jack.create('depot.entities', ['getOne']);
        jack.expect('depot.entities.getOne')
            .exactly("2 times")
            .whereArgument(0).isOneOf("A123", "B123")
            .whereArgument(1).isType("function")
            .whereArgument(2).isType("function")
            .mock(function (guid, success, error) {
                setTimeout(function () {
                    success(data[guid]);
                }, 100);
            })  
        var handler = new pc.resources.EntityResourceHandler(manager, registry, depot);
        var loader = new pc.resources.ResourceLoader();
        loader.registerHandler(pc.resources.EntityRequest, handler);
        
        loader.request([new pc.resources.EntityRequest("A123"), new pc.resources.EntityRequest("B123")], 1, function (resources) {

            var entity = resources["A123"];
            ok(entity);
            equal(entity.getGuid(), "A123");
            equal(entity.getChildren().length, 0);

            var entity = resources["B123"];
            ok(entity);
            equal(entity.getGuid(), "B123");
            equal(entity.getChildren().length, 0);

            start();

        });
        
    });
});

asyncTest('EntityHandler: request with children', 4, function () {
	jack(function () {
		var data = {
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
		var guid = 'A123';
		var registry = new pc.fw.ComponentSystemRegistry();
		var manager = new pc.scene.GraphManager();
		var depot = {};
		depot.entities = jack.create('depot.entities', ['getOne']);
		jack.expect('depot.entities.getOne')
			.exactly("2 times")
			.whereArgument(0).isOneOf("A123", "B123")
			.whereArgument(1).isType("function")
			.whereArgument(2).isType("function")
			.mock(function (guid, success, error) {
                success(data[guid]);
			});
		var handler = new pc.resources.EntityResourceHandler(manager, registry, depot);
		var loader = new pc.resources.ResourceLoader();
		loader.registerHandler(pc.resources.EntityRequest, handler);
		
	    loader.request([new pc.resources.EntityRequest("A123")], 1, function (resources) {
	    	var entity = resources["A123"];
	    	ok(entity);
	    	equal(entity.getGuid(), guid);
	    	equal(entity.getChildren().length, 1);
	    	equal(entity.getChildren()[0].getGuid(), "B123");
            start();
	    });
		
	});
});

asyncTest('EntityHandler: multiple request with children', 4, function () {
    jack(function () {
        var data = {
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
                
            },
            "C123": {
                "_id": "DEF",
                "resource_id": "C123",
                "transform": [1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1],
                "parent": null,
                "children": [],
                "components": {
                    "header": {
                        "name": "NAME3",
                        "description": "DESCRIPTION3"
                    }
                }
                
            }
        };
        var guid = 'A123';
        var registry = new pc.fw.ComponentSystemRegistry();
        var manager = new pc.scene.GraphManager();
        /*
        var corazon = {};
        corazon.entity = jack.create('corazon.entity', ['getOne']);
        jack.expect('corazon.entity.getOne')
            .exactly("3 times")
            .whereArgument(0).isOneOf("A123", "B123", "C123")
            .whereArgument(1).isType("function")
            .whereArgument(2).isType("function")
            .mock(function (guid, success, error) {
                if(guid == "A123") {
                    setTimeout(function () {
                        success(data[guid]);                
                    }, 100);
                    
                } else {
                    success(data[guid]);
                }
            });*/
        depot = {};
        depot.entities = {};
        depot.entities.getOne = function (guid, success, error) {
            if(guid == "B123") {
                setTimeout(function () {
                    success(data[guid]);                
                }, 1000);
                
            } else {
                success(data[guid]);
            }            
        }
        var handler = new pc.resources.EntityResourceHandler(manager, registry, depot);
        var loader = new pc.resources.ResourceLoader();
        loader.registerHandler(pc.resources.EntityRequest, handler);
        
        loader.request([new pc.resources.EntityRequest("C123"), new pc.resources.EntityRequest("A123")], 1, function (resources) {
            var entity = resources["A123"];
            ok(entity);
            equal(entity.getGuid(), guid);
            equal(entity.getChildren().length, 1);
            equal(entity.getChildren()[0].getGuid(), "B123");
            start();
        });
        
    });
});

var aaa = function () {};
aaa('EntityHandler: request with children, including asset', 4, function () {
    jack(function () {
        var data = {
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
                    },
                    "model": {
                        "asset": "ASSET1"
                    } 
                    
                }
                
            },
            "C123": {
                "_id": "DEF",
                "resource_id": "C123",
                "transform": [1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1],
                "parent": null,
                "children": [],
                "components": {
                    "header": {
                        "name": "NAME3",
                        "description": "DESCRIPTION3"
                    }
                }
            },
            "ASSET1": {
                "_id": "1",
                "resource_id": "ASSET1",
                "file": {
                    "url": "/resource/1"
                }
            }
            
        };
        var guid = 'A123';
        var registry = new pc.fw.ComponentSystemRegistry();
        var manager = new pc.scene.GraphManager();
        
        var depot = {};
        depot.entities = jack.create('depot.entities', ['getOne']);
        depot.assets = jack.create('depot.assets', ['getOne']);
        pc.net.http = jack.create('pc.net.http', ['get']);
        
        jack.expect('depot.entities.getOne')
            .exactly("3 times")
            .whereArgument(0).isOneOf("A123", "B123", "C123")
            .whereArgument(1).isType("function")
            .whereArgument(2).isType("function")
            .mock(function (guid, success, error) {
                success(data[guid]);
            });

        jack.expect('depot.assets.getOne')
            .exactly("1 times")
            .whereArgument(0).is("ASSET1")
            .whereArgument(1).isType("function")
            .mock(function (guid, success, error) {
                success(data[guid]);
            });
        
        jack.expect('pc.net.http.get')
            .exactly("1 time")
            .mock(function (url, success, o) {
                success({});
            });
        
        var entityhandler = new pc.resources.EntityResourceHandler(manager, registry, depot);
        var assethandler = new pc.resources.AssetResourceHandler(depot);
        var modelhandler = new pc.resources.ModelResourceHandler(manager);
        
        var loader = new pc.resources.ResourceLoader();
        loader.registerHandler(pc.resources.EntityRequest, entityhandler);
        loader.registerHandler(pc.resources.AssetRequest, assethandler);
        loader.registerHandler(pc.resources.ModelRequest, modelhandler);
        
        var context = {systems: registry, manager: manager, loader:loader};
        
        var headersys = new pc.fw.HeaderComponentSystem(context);
        var modelsys = new pc.fw.ModelComponentSystem(context);
        
        
        loader.request([new pc.resources.EntityRequest("C123"), new pc.resources.EntityRequest("A123")], 1, function (resources) {
            var entity = resources["A123"];
            ok(entity);
            equal(entity.getGuid(), guid);
            equal(entity.getChildren().length, 1);
            equal(entity.getChildren()[0].getGuid(), "B123");
            
            var child = entity.getChildren()[0];
            
            ok(child.components);
            
            start();
        });
        
    });
});

asyncTest('EntityHandler: request from pc.content.data with children', 4, function () {
    jack(function () {
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
        
        var manager = new pc.scene.GraphManager();
        var registry = new pc.fw.ComponentSystemRegistry();
        var handler = new pc.resources.EntityResourceHandler(manager, registry, {});
    
        var loader = new pc.resources.ResourceLoader();
        loader.registerHandler(pc.resources.EntityRequest, handler);
    
        loader.request([new pc.resources.EntityRequest("A123")], 1, function (resources) {
            var entity = resources['A123']
            ok(entity);
            equal(entity.getGuid(), "A123");
            equal(entity.getChildren().length, 1);
            equal(entity.getChildren()[0].getGuid(), "B123");
            start();
        }, function (errors) {}, function (progress) {});        
    });
})
