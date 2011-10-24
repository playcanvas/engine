module('pc.shape.Box');

test('create default Box', function () {
    var b = new pc.shape.Box();
    
    ok(b);
    
    equal(b.transform[0], 1);
    equal(b.transform[5], 1);
    equal(b.transform[10], 1);
    equal(b.transform[15], 1);
});

test('containsPoint: untransformed', function () {
    var b = new pc.shape.Box();
    var p = pc.math.vec3.create(0,0,0);
    
    equal(b.containsPoint(p), true);
    
    p = pc.math.vec3.create(0,0.6,0);
    equal(b.containsPoint(p), false);

    p = pc.math.vec3.create(0.6,0,0);
    equal(b.containsPoint(p), false);

    p = pc.math.vec3.create(0,0,0.6);
    equal(b.containsPoint(p), false);
});

test('containsPoint: rotated', function () {
    var t = pc.math.mat4.create();
    pc.math.mat4.makeRotate(Math.PI / 4, pc.math.vec3.create(0,0,1), t);

    var b = new pc.shape.Box(t);
    var p = pc.math.vec3.create(0,0, 0);
    
    equal(b.containsPoint(p), true)

    p = pc.math.vec3.create(0.5,0.5,0);
    equal(b.containsPoint(p), false);

    p = pc.math.vec3.create(-0.5,0.5,0);
    equal(b.containsPoint(p), false);

});

test('containsPoint: translated', function () {
    var t = pc.math.mat4.create();
    pc.math.mat4.makeTranslate(0,1,0,t);

    var b = new pc.shape.Box(t);
    var p = pc.math.vec3.create(0,0,0);
    
    equal(b.containsPoint(p), false);

    p = pc.math.vec3.create(0,1,0);    
    equal(b.containsPoint(p), true);

});

test('containsPoint: scaled', function () {
    var t = pc.math.mat4.clone(pc.math.mat4.identity);

    var b = new pc.shape.Box(t, pc.math.vec3.create(0.5,1,1.5));
    var p = pc.math.vec3.create(0,0,0);
    
    equal(b.containsPoint(p), true);

    p = pc.math.vec3.create(0,0.9,0);
    equal(b.containsPoint(p), true);    

    p = pc.math.vec3.create(0,1.1,0);
    equal(b.containsPoint(p), false);    

    p = pc.math.vec3.create(0.6,0,0);
    equal(b.containsPoint(p), false);    

    p = pc.math.vec3.create(0.4,0,0);
    equal(b.containsPoint(p), true);    

    p = pc.math.vec3.create(0,0,1.6);
    equal(b.containsPoint(p), false);    

    p = pc.math.vec3.create(0,0,1.4);
    equal(b.containsPoint(p), true);    

});
