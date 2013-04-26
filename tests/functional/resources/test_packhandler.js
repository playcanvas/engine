module("pc.resources.PackResourceHandler", {
    setup: function () {
        var canvas = document.createElement('canvas');

        // Create the graphics device
        var device = new pc.gfx.Device(canvas);

        // Activate the graphics device
        pc.gfx.Device.setCurrent(device);

        
        pc.content = new pc.fw.ContentFile({
            application_properties: {

            },
            toc: {
                default: {
                    assets: {},
                    packs: ['12341234-1234-1234-123412341234']
                }
            },
            packs: {
                '12341234-1234-1234-123412341234': {
                    'hierarchy': {
                        resource_id: '12341234-1234-1234-123412341234',
                        name: 'root',
                        position: [0,0,0],
                        rotation: [0,0,0],
                        scale: [1,1,1],
                        components: {},
                        children: []
                    }
                }
            }
        });        
    },

    teardown: function () {

    } 
});

test("Load pack", function () {
    var loader = new pc.resources.ResourceLoader();
    var registry = new pc.fw.ComponentSystemRegistry();

    loader.registerHandler(pc.resources.PackRequest, new pc.resources.PackResourceHandler(registry));

    var promise = loader.request(new pc.resources.PackRequest("12341234-1234-1234-123412341234"));
    promise.then(function (resources) {
        ok(resources[0] instanceof pc.fw.Pack);
        ok(resources[0].hierarchy instanceof pc.fw.Entity);
        start();
    });

    stop();
});

test("Load pack with script", function () {
     pc.content = new pc.fw.ContentFile({
        application_properties: {

        },
        toc: {
            default: {
                assets: {},
                packs: ['12341234-1234-1234-123412341234']
            }
        },
        packs: {
            '12341234-1234-1234-123412341234': {
                'hierarchy': {
                    resource_id: '12341234-1234-1234-123412341234',
                    name: 'root',
                    position: [0,0,0],
                    rotation: [0,0,0],
                    scale: [1,1,1],
                    components: {
                        script: {
                            urls: [
                                '/engine/tests/functional/resources/resources/script.js'
                            ]
                        }
                    },
                    children: []
                }
            }
        }
    });

    var loader = new pc.resources.ResourceLoader();
    var registry = new pc.fw.ComponentSystemRegistry();
    var context = new pc.fw.ApplicationContext(loader, new pc.scene.Scene(), registry, {});
        
    new pc.fw.ScriptComponentSystem(context);

    loader.registerHandler(pc.resources.PackRequest, new pc.resources.PackResourceHandler(registry));
    loader.registerHandler(pc.resources.ScriptRequest, new pc.resources.ScriptResourceHandler(registry));

    var promise = loader.request(new pc.resources.PackRequest("12341234-1234-1234-123412341234"));
    promise.then(function (resources) {
        ok(resources[0] instanceof pc.fw.Pack);
        ok(resources[0].hierarchy instanceof pc.fw.Entity);

        // Initialize script component system then check that script instance was created
        pc.fw.ComponentSystem.initialize(resources[0].hierarchy)
        ok(resources[0].hierarchy.script.instances['script'].instance);

        start();
    }, function (error) {
        ok(false, error);
        start();
    });

    stop();
});
