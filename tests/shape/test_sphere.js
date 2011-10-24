module('pc.shape.Sphere');

test('Sphere: correct default values', function() {
    var sphere = new pc.shape.Sphere();
    
    same(sphere.center[0], 0);
    same(sphere.center[1], 0);
    same(sphere.center[2], 0);
    same(sphere.radius, 1);
});

test('Sphere: Constructor sets correct values', function() {
    var sphere = new pc.shape.Sphere(pc.math.vec3.create(1, 2, 3), 4);

    same(sphere.center[0], 1);
    same(sphere.center[1], 2);
    same(sphere.center[2], 3);
    same(sphere.radius, 4);
});

test('containsPoint: Point is in sphere returns true', function() {
    var sphere = new pc.shape.Sphere(pc.math.vec3.create(1, 1, 1), 2);
    var point  = pc.math.vec3.create(0.5, 0.5, 0.5);
    
    same(sphere.containsPoint(point), true);
});

test('containsPoint: Point not in sphere returns false', function() {
    var sphere = new pc.shape.Sphere(pc.math.vec3.create(1, 1, 1), 2);
    var point = pc.math.vec3.create(0, 0, 5);
    
    same(sphere.containsPoint(point), false);
});
