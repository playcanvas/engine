module('pc.shape.Sphere');

test('Sphere: correct default values', function() {
    var sphere = new pc.shape.Sphere();
    
    QUnit.deepEqual(sphere.center.x, 0);
    QUnit.deepEqual(sphere.center.y, 0);
    QUnit.deepEqual(sphere.center.z, 0);
    QUnit.deepEqual(sphere.radius, 1);
});

test('Sphere: Constructor sets correct values', function() {
    var sphere = new pc.shape.Sphere(new pc.Vec3(1, 2, 3), 4);

    QUnit.deepEqual(sphere.center.x, 1);
    QUnit.deepEqual(sphere.center.y, 2);
    QUnit.deepEqual(sphere.center.z, 3);
    QUnit.deepEqual(sphere.radius, 4);
});

test('containsPoint: Point is in sphere returns true', function() {
    var sphere = new pc.shape.Sphere(new pc.Vec3(1, 1, 1), 2);
    var point  = new pc.Vec3(0.5, 0.5, 0.5);
    
    QUnit.deepEqual(sphere.containsPoint(point), true);
});

test('containsPoint: Point not in sphere returns false', function() {
    var sphere = new pc.shape.Sphere(new pc.Vec3(1, 1, 1), 2);
    var point = new pc.Vec3(0, 0, 5);
    
    QUnit.deepEqual(sphere.containsPoint(point), false);
});
