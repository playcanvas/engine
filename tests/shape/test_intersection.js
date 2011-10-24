module('pc.shape.intersection');

test("rayAabb: ray x ends in aabb", function() {
    var aabb = new pc.shape.Aabb(),
    rayOrigin = pc.math.vec3.create(-1,0,0),
    rayDir = pc.math.vec3.create(1,0,0);
    
    same(true, pc.shape.intersection.rayAabb(rayOrigin, rayDir, aabb));
});

test("rayAabb: ray y ends in aabb", function() {
	var aabb = new pc.shape.Aabb(),
	rayOrigin = pc.math.vec3.create(0,-1,0),
	rayDir = pc.math.vec3.create(0,1,0);
	
	same(true, pc.shape.intersection.rayAabb(rayOrigin, rayDir, aabb));
});

test("rayAabb: ray z ends in aabb", function() {
    var aabb = new pc.shape.Aabb(),
    rayOrigin = pc.math.vec3.create(0,0,-1),
    rayDir = pc.math.vec3.create(0,0,1);
    
    same(true, pc.shape.intersection.rayAabb(rayOrigin, rayDir, aabb));
});

test("rayAabb: ray x starts in aabb", function() {
    var aabb = new pc.shape.Aabb(),
    rayOrigin = pc.math.vec3.create(0.25,0,0),
    rayDir = pc.math.vec3.create(1,0,0);
    
    same(true, pc.shape.intersection.rayAabb(rayOrigin, rayDir, aabb));
});

test("rayAabb: ray y starts in aabb", function() {
    var aabb = new pc.shape.Aabb(),
    rayOrigin = pc.math.vec3.create(0.25,0,0),
    rayDir = pc.math.vec3.create(0,1,0);
    
    same(true, pc.shape.intersection.rayAabb(rayOrigin, rayDir, aabb));
});

test("rayAabb: ray z starts in aabb", function() {
    var aabb = new pc.shape.Aabb(),
    rayOrigin = pc.math.vec3.create(0.25,0,0),
    rayDir = pc.math.vec3.create(0,0,1);
    
    same(true, pc.shape.intersection.rayAabb(rayOrigin, rayDir, aabb));
});

test("rayAabb: ray x goes through aabb", function() {
    var aabb = new pc.shape.Aabb(),
    rayOrigin = pc.math.vec3.create(-1,0,0),
    rayDir = pc.math.vec3.create(2,0,0);
    
    same(true, pc.shape.intersection.rayAabb(rayOrigin, rayDir, aabb));
});

test("rayAabb: ray y goes through aabb", function() {
    var aabb = new pc.shape.Aabb(),
    rayOrigin = pc.math.vec3.create(0,-1,0),
    rayDir = pc.math.vec3.create(0,2,0);
    
    same(true, pc.shape.intersection.rayAabb(rayOrigin, rayDir, aabb));
});

test("rayAabb: ray z goes through aabb", function() {
    var aabb = new pc.shape.Aabb(),
    rayOrigin = pc.math.vec3.create(0,0,-1),
    rayDir = pc.math.vec3.create(0,0,2);
    
    same(true, pc.shape.intersection.rayAabb(rayOrigin, rayDir, aabb));
});

test("rayAabb: ray x misses aabb", function() {
    var aabb = new pc.shape.Aabb(),
    rayOrigin = pc.math.vec3.create(-1,1,0),
    rayDir = pc.math.vec3.create(2,0,0);
    
    same(false, pc.shape.intersection.rayAabb(rayOrigin, rayDir, aabb));
});

test("rayAabb: ray y misses aabb", function() {
    var aabb = new pc.shape.Aabb(),
    rayOrigin = pc.math.vec3.create(1,-1,0),
    rayDir = pc.math.vec3.create(0,2,0);
    
    same(false, pc.shape.intersection.rayAabb(rayOrigin, rayDir, aabb));
});

test("rayAabb: ray z misses aabb", function() {
    var aabb = new pc.shape.Aabb(),
    rayOrigin = pc.math.vec3.create(0,1,-1),
    rayDir = pc.math.vec3.create(0,0,2);
    
    same(false, pc.shape.intersection.rayAabb(rayOrigin, rayDir, aabb));
});

test("raySphere: ray ends in sphere", function() {
   var sphere = new pc.shape.Sphere(),
   rayOrigin = pc.math.vec3.create(2, 0, 0),
   rayDir = pc.math.vec3.create(-2, 0, 0),
   result = {};
   
   same(true, pc.shape.intersection.raySphere(rayOrigin, rayDir, sphere, result));
   same(true, result.success);
   same(0.5, result.t);
});

test("raySphere: ray starts in sphere", function() {
   var sphere = new pc.shape.Sphere(),
   rayOrigin = pc.math.vec3.create(0.1, 0, 0),
   rayDir = pc.math.vec3.create(2, 0, 0),
   result = {};
   
   same(true, pc.shape.intersection.raySphere(rayOrigin, rayDir, sphere, result));
   same(true, result.success);
   same(0, result.t);
});

test("raySphere: ray goes through sphere", function() {
   var sphere = new pc.shape.Sphere(),
   rayOrigin = pc.math.vec3.create(2, 0, 0),
   rayDir = pc.math.vec3.create(-4, 0, 0),
   result = {};
   
   same(true, pc.shape.intersection.raySphere(rayOrigin, rayDir, sphere, result));
   same(true, result.success);
   same(0.25, result.t);
});

test("raySphere: ray misses sphere", function() {
   var sphere = new pc.shape.Sphere(),
   rayOrigin = pc.math.vec3.create(100, 100, 0),
   rayDir = pc.math.vec3.create(-2, 0, 0),
   result = {};
   
   same(false, pc.shape.intersection.raySphere(rayOrigin, rayDir, sphere, result));
   same(false, result.success);
   same(0, result.t);
});
