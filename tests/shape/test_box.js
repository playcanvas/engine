module('pc.shape.Box');

test('create default Box', function () {
    var b = new pc.shape.Box();
    
    ok(b);
    
    equal(b.transform.data[0], 1);
    equal(b.transform.data[5], 1);
    equal(b.transform.data[10], 1);
    equal(b.transform.data[15], 1);
});

test('containsPoint: untransformed', function () {
    var b = new pc.shape.Box();
    var p = new pc.Vec3(0,0,0);
    
    equal(b.containsPoint(p), true);
    
    p = new pc.Vec3(0,0.6,0);
    equal(b.containsPoint(p), false);

    p = new pc.Vec3(0.6,0,0);
    equal(b.containsPoint(p), false);

    p = new pc.Vec3(0,0,0.6);
    equal(b.containsPoint(p), false);
});

test('containsPoint: rotated', function () {
    var t = new pc.Mat4();
    t.setFromAxisAngle(new pc.Vec3(0, 0, 1), Math.PI / 4);

    var b = new pc.shape.Box(t);
    var p = new pc.Vec3(0, 0, 0);
    
    equal(b.containsPoint(p), true)

    p = new pc.Vec3(0.5, 0.5, 0);
    equal(b.containsPoint(p), false);

    p = new pc.Vec3(-0.5, 0.5, 0);
    equal(b.containsPoint(p), false);

});

test('containsPoint: translated', function () {
    var t = new pc.Mat4();
    t.setTranslate(0, 1, 0);

    var b = new pc.shape.Box(t);
    var p = new pc.Vec3(0, 0, 0);
    
    equal(b.containsPoint(p), false);

    p = new pc.Vec3(0, 1, 0);
    equal(b.containsPoint(p), true);

});

test('containsPoint: scaled', function () {
    var t = new pc.Mat4();

    var b = new pc.shape.Box(t, new pc.Vec3(0.5, 1, 1.5));
    var p = new pc.Vec3(0, 0, 0);
    
    equal(b.containsPoint(p), true);

    p = new pc.Vec3(0, 0.9, 0);
    equal(b.containsPoint(p), true);    

    p = new pc.Vec3(0, 1.1, 0);
    equal(b.containsPoint(p), false);    

    p = new pc.Vec3(0.6, 0, 0);
    equal(b.containsPoint(p), false);    

    p = new pc.Vec3(0.4, 0, 0);
    equal(b.containsPoint(p), true);    

    p = new pc.Vec3(0, 0, 1.6);
    equal(b.containsPoint(p), false);    

    p = new pc.Vec3(0, 0, 1.4);
    equal(b.containsPoint(p), true);    

});
