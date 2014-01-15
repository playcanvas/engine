module('pc.shape.Aabb');

test("Aabb: correct default values", function() {
	var aabb = new pc.shape.Aabb();
	
    QUnit.deepEqual(0, aabb.center.x);
    QUnit.deepEqual(0, aabb.center.y);
    QUnit.deepEqual(0, aabb.center.z);

    QUnit.deepEqual(0.5, aabb.halfExtents.x);
    QUnit.deepEqual(0.5, aabb.halfExtents.y);
    QUnit.deepEqual(0.5, aabb.halfExtents.z);
});

test("Aabb: constructor sets values", function() {
    var aabb = new pc.shape.Aabb(new pc.Vec3(1, 2, 3), new pc.Vec3(4, 5, 6));
    
    QUnit.deepEqual(1, aabb.center.x);
    QUnit.deepEqual(2, aabb.center.y);
    QUnit.deepEqual(3, aabb.center.z);

    QUnit.deepEqual(4, aabb.halfExtents.x);
    QUnit.deepEqual(5, aabb.halfExtents.y);
    QUnit.deepEqual(6, aabb.halfExtents.z);
	
});


test("pointInAabb: point inside on x returns true", function () {
	var aabb = new pc.shape.Aabb(),
	point = new pc.Vec3(0.25, 0, 0);	

	QUnit.deepEqual(true, aabb.containsPoint(point));
});

test("pointInAabb: point inside on y returns true", function () {
    var aabb = new pc.shape.Aabb(),
    point = new pc.Vec3(0, 0.25, 0);  

    QUnit.deepEqual(true, aabb.containsPoint(point));
});

test("pointInAabb: point inside on y returns true", function () {
    var aabb = new pc.shape.Aabb(),
    point = new pc.Vec3(0, 0.25, 0);  

    QUnit.deepEqual(true, aabb.containsPoint(point));
});

test("pointInAabb: point outside on x returns false", function () {
    var aabb = new pc.shape.Aabb(),
    point = new pc.Vec3(0.6, 0, 0);

    QUnit.deepEqual(false, aabb.containsPoint(point));
});

test("pointInAabb: point outside on y returns false", function () {
    var aabb = new pc.shape.Aabb(),
    point = new pc.Vec3(0, 0.6, 0);
    
    QUnit.deepEqual(false, aabb.containsPoint(point));
});

test("pointInAabb: point outside on z returns false", function () {
    var aabb = new pc.shape.Aabb(),
    point = new pc.Vec3(0, 0, 0.6);
    
    QUnit.deepEqual(false, aabb.containsPoint(point));
});

test("pointInAabb: point on edge returns true", function () {
    var aabb = new pc.shape.Aabb(),
    point = new pc.Vec3(0.5, 0, 0);
    
    QUnit.deepEqual(true, aabb.containsPoint(point));
});

test("pointInAabb: point on corner returns true", function () {
    var aabb = new pc.shape.Aabb(),
    point = new pc.Vec3(0.5, 0.5, 0.5);
    
    QUnit.deepEqual(true, aabb.containsPoint(point));
});