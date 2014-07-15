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

test('intersectRay: Intersection is correct', function () {
    var sphere = new pc.shape.Sphere(new pc.Vec3(0,0,0), 5);
    var start = new pc.Vec3(0,0, 10);
    var direction = new pc.Vec3(0,0,-1);
    var intersection = sphere.intersectRay(start, direction);

    QUnit.equal(intersection.x, 0);
    QUnit.equal(intersection.y, 0);
    QUnit.equal(intersection.z, 5);
});

test('intersectRay: Intersection from center of sphere is correct', function () {
    var sphere = new pc.shape.Sphere(new pc.Vec3(0,0,0), 5);
    var start = new pc.Vec3(0,0,0);
    var direction = new pc.Vec3(1,0,0);
    var intersection = sphere.intersectRay(start, direction);

    QUnit.equal(intersection.x, 5);
    QUnit.equal(intersection.y, 0);
    QUnit.equal(intersection.z, 0);
});

test('intersectRay: Tangential intersection works', function () {
    var sphere = new pc.shape.Sphere(new pc.Vec3(0,0,0), 5);
    var start = new pc.Vec3(0,5,0);
    var direction = new pc.Vec3(0,0,-1);
    var intersection = sphere.intersectRay(start, direction);

    QUnit.equal(intersection.x, 0);
    QUnit.equal(intersection.y, 5);
    QUnit.equal(intersection.z, 0);
});

test('intersectRay: Ray starting from sphere returns ray origin', function () {
    var sphere = new pc.shape.Sphere(new pc.Vec3(0,0,0), 5);
    var start = new pc.Vec3(0,0,5);
    var direction = new pc.Vec3(0,0,-1);
    var intersection = sphere.intersectRay(start, direction);

    QUnit.equal(intersection.x, 0);
    QUnit.equal(intersection.y, 0);
    QUnit.equal(intersection.z, 5);
});

test('intersectRay: Ray starting from sphere returns ray origin', function () {
    var sphere = new pc.shape.Sphere(new pc.Vec3(0,0,0), 5);
    var start = new pc.Vec3(0,0,5);
    var direction = new pc.Vec3(0,0,-1);
    var intersection = sphere.intersectRay(start, direction);

    QUnit.equal(intersection.x, 0);
    QUnit.equal(intersection.y, 0);
    QUnit.equal(intersection.z, 5);
});

test('intersectRay: Ray pointing away from sphere does not return intersection', function () {
    var sphere = new pc.shape.Sphere(new pc.Vec3(0,0,0), 5);
    var start = new pc.Vec3(0,6,0);
    var direction = new pc.Vec3(0,0,-1);
    var intersection = sphere.intersectRay(start, direction);

    QUnit.equal(intersection, null);
});

test('intersectRay: Ray pointing away from sphere does not return intersection #2', function () {
    var sphere = new pc.shape.Sphere(new pc.Vec3(0,0,0), 5);
    var start = new pc.Vec3(0,0,6);
    var direction = new pc.Vec3(0,0,1);
    var intersection = sphere.intersectRay(start, direction);

    QUnit.equal(intersection, null);
});
