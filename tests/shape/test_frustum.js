module('pc.shape.Frustum');

test('Frustum: default constructor', function() {
    var frustum = new pc.shape.Frustum();

    // Check we have 6 frustum planes
    QUnit.deepEqual(frustum.planes.length, 6);
});

test('containsSphere', function() {
    var sphere, frustum;

    frustum = new pc.shape.Frustum();

    // Behind the viewpoint (looking down negative Z)
    sphere = new pc.shape.Sphere(new pc.Vec3(0, 0, 100), 10);
    QUnit.deepEqual(frustum.containsSphere(sphere), 0);

    // Around the viewpoint (so intersects the frustum)
    sphere = new pc.shape.Sphere(new pc.Vec3(0, 0, 0), 10);
    QUnit.deepEqual(frustum.containsSphere(sphere), 1);

    // In front of the viewpoint (contained within frustum)
    sphere = new pc.shape.Sphere(new pc.Vec3(0, 0, -100), 10);
    QUnit.deepEqual(frustum.containsSphere(sphere), 2);

    // In front of the viewpoint marginally intersecting the far clip plane
    sphere = new pc.shape.Sphere(new pc.Vec3(0, 0, -1009.9), 10);
    QUnit.deepEqual(frustum.containsSphere(sphere), 1);

    // In front of the viewpoint touching the far clip plane but essentially
    // outside the frustum
    sphere = new pc.shape.Sphere(new pc.Vec3(0, 0, -1010), 10);
    QUnit.deepEqual(frustum.containsSphere(sphere), 0);
});