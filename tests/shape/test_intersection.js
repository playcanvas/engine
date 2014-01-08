module('pc.shape.intersection');

test("rayAabb: ray x ends in aabb", function() {
    var aabb = new pc.shape.Aabb(),
    rayOrigin = new pc.Vec3(-1,0,0),
    rayDir = new pc.Vec3(1,0,0);
    
    QUnit.deepEqual(true, pc.shape.intersection.rayAabb(rayOrigin, rayDir, aabb));
});

test("rayAabb: ray y ends in aabb", function() {
	var aabb = new pc.shape.Aabb(),
	rayOrigin = new pc.Vec3(0,-1,0),
	rayDir = new pc.Vec3(0,1,0);
	
	QUnit.deepEqual(true, pc.shape.intersection.rayAabb(rayOrigin, rayDir, aabb));
});

test("rayAabb: ray z ends in aabb", function() {
    var aabb = new pc.shape.Aabb(),
    rayOrigin = new pc.Vec3(0,0,-1),
    rayDir = new pc.Vec3(0,0,1);
    
    QUnit.deepEqual(true, pc.shape.intersection.rayAabb(rayOrigin, rayDir, aabb));
});

test("rayAabb: ray x starts in aabb", function() {
    var aabb = new pc.shape.Aabb(),
    rayOrigin = new pc.Vec3(0.25,0,0),
    rayDir = new pc.Vec3(1,0,0);
    
    QUnit.deepEqual(true, pc.shape.intersection.rayAabb(rayOrigin, rayDir, aabb));
});

test("rayAabb: ray y starts in aabb", function() {
    var aabb = new pc.shape.Aabb(),
    rayOrigin = new pc.Vec3(0.25,0,0),
    rayDir = new pc.Vec3(0,1,0);
    
    QUnit.deepEqual(true, pc.shape.intersection.rayAabb(rayOrigin, rayDir, aabb));
});

test("rayAabb: ray z starts in aabb", function() {
    var aabb = new pc.shape.Aabb(),
    rayOrigin = new pc.Vec3(0.25,0,0),
    rayDir = new pc.Vec3(0,0,1);
    
    QUnit.deepEqual(true, pc.shape.intersection.rayAabb(rayOrigin, rayDir, aabb));
});

test("rayAabb: ray x goes through aabb", function() {
    var aabb = new pc.shape.Aabb(),
    rayOrigin = new pc.Vec3(-1,0,0),
    rayDir = new pc.Vec3(2,0,0);
    
    QUnit.deepEqual(true, pc.shape.intersection.rayAabb(rayOrigin, rayDir, aabb));
});

test("rayAabb: ray y goes through aabb", function() {
    var aabb = new pc.shape.Aabb(),
    rayOrigin = new pc.Vec3(0,-1,0),
    rayDir = new pc.Vec3(0,2,0);
    
    QUnit.deepEqual(true, pc.shape.intersection.rayAabb(rayOrigin, rayDir, aabb));
});

test("rayAabb: ray z goes through aabb", function() {
    var aabb = new pc.shape.Aabb(),
    rayOrigin = new pc.Vec3(0,0,-1),
    rayDir = new pc.Vec3(0,0,2);
    
    QUnit.deepEqual(true, pc.shape.intersection.rayAabb(rayOrigin, rayDir, aabb));
});

test("rayAabb: ray x misses aabb", function() {
    var aabb = new pc.shape.Aabb(),
    rayOrigin = new pc.Vec3(-1,1,0),
    rayDir = new pc.Vec3(2,0,0);
    
    QUnit.deepEqual(false, pc.shape.intersection.rayAabb(rayOrigin, rayDir, aabb));
});

test("rayAabb: ray y misses aabb", function() {
    var aabb = new pc.shape.Aabb(),
    rayOrigin = new pc.Vec3(1,-1,0),
    rayDir = new pc.Vec3(0,2,0);
    
    QUnit.deepEqual(false, pc.shape.intersection.rayAabb(rayOrigin, rayDir, aabb));
});

test("rayAabb: ray z misses aabb", function() {
    var aabb = new pc.shape.Aabb(),
    rayOrigin = new pc.Vec3(0,1,-1),
    rayDir = new pc.Vec3(0,0,2);
    
    QUnit.deepEqual(false, pc.shape.intersection.rayAabb(rayOrigin, rayDir, aabb));
});

test("raySphere: ray ends in sphere", function() {
   var sphere = new pc.shape.Sphere(),
   rayOrigin = new pc.Vec3(2, 0, 0),
   rayDir = new pc.Vec3(-2, 0, 0),
   result = {};
   
   QUnit.deepEqual(true, pc.shape.intersection.raySphere(rayOrigin, rayDir, sphere, result));
   QUnit.deepEqual(true, result.success);
   QUnit.deepEqual(0.5, result.t);
});

test("raySphere: ray starts in sphere", function() {
   var sphere = new pc.shape.Sphere(),
   rayOrigin = new pc.Vec3(0.1, 0, 0),
   rayDir = new pc.Vec3(2, 0, 0),
   result = {};
   
   QUnit.deepEqual(true, pc.shape.intersection.raySphere(rayOrigin, rayDir, sphere, result));
   QUnit.deepEqual(true, result.success);
   QUnit.deepEqual(0, result.t);
});

test("raySphere: ray goes through sphere", function() {
   var sphere = new pc.shape.Sphere(),
   rayOrigin = new pc.Vec3(2, 0, 0),
   rayDir = new pc.Vec3(-4, 0, 0),
   result = {};
   
   QUnit.deepEqual(true, pc.shape.intersection.raySphere(rayOrigin, rayDir, sphere, result));
   QUnit.deepEqual(true, result.success);
   QUnit.deepEqual(0.25, result.t);
});

test("raySphere: ray misses sphere", function() {
   var sphere = new pc.shape.Sphere(),
   rayOrigin = new pc.Vec3(100, 100, 0),
   rayDir = new pc.Vec3(-2, 0, 0),
   result = {};
   
   QUnit.deepEqual(false, pc.shape.intersection.raySphere(rayOrigin, rayDir, sphere, result));
   QUnit.deepEqual(false, result.success);
   QUnit.deepEqual(0, result.t);
});
