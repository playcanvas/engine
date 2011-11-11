module('pc.fw.picking', {
    setup: function () {
    }, 
    teardown: function () {
    }
});


test("pick: created", function () {
    var canvas = document.getElementById("test-canvas");
    var graphicsDevice = new pc.gfx.Device(canvas);
    pc.gfx.Device.setCurrent(graphicsDevice);
    var p = new pc.fw.picking.Picker(canvas, null, null);

    ok(p);        
/*
    jack(function () {
        pc.gfx = jack.create("pc.gfx", ["FrameBuffer", "RenderTarget"]);
        var canvas = jack.create("canvas", ["width", "height"])
        pc.gfx.Device = jack.create("pc.gfx.Device", ["getCurrent"]);
        var device = jack.create("device", ["getProgramLibrary"]);
        var library = jack.create("library", ["getProgram"]);
        
        jack.expect("pc.gfx.Device.getCurrent").returnValue(device)
        jack.expect("device.getProgramLibrary").returnValue(library)
    });
    */
});