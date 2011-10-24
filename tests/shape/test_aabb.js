module('pc.shape.Aabb');

test("Aabb: correct default values", function() {
	var aabb = new pc.shape.Aabb();
	
    same(0, aabb.center[0]);
    same(0, aabb.center[1]);
    same(0, aabb.center[2]);

    same(0.5, aabb.halfExtents[0]);
    same(0.5, aabb.halfExtents[1]);
    same(0.5, aabb.halfExtents[2]);

});

test("Aabb: constructor sets values", function() {
    var aabb = new pc.shape.Aabb(pc.math.vec3.create(1,2,3), pc.math.vec3.create(4,5,6));
    
    same(1, aabb.center[0]);
    same(2, aabb.center[1]);
    same(3, aabb.center[2]);

    same(4, aabb.halfExtents[0]);
    same(5, aabb.halfExtents[1]);
    same(6, aabb.halfExtents[2]);
	
});


test("pointInAabb: point inside on x returns true", function () {
	var aabb = new pc.shape.Aabb(),
	point = pc.math.vec3.create(0.25, 0, 0);	

	same(true, aabb.pointInAabb(point));
});

test("pointInAabb: point inside on y returns true", function () {
    var aabb = new pc.shape.Aabb(),
    point = pc.math.vec3.create(0, 0.25, 0);  

    same(true, aabb.pointInAabb(point));
});

test("pointInAabb: point inside on y returns true", function () {
    var aabb = new pc.shape.Aabb(),
    point = pc.math.vec3.create(0, 0.25, 0);  

    same(true, aabb.pointInAabb(point));
});

test("pointInAabb: point outside on x returns false", function () {
    var aabb = new pc.shape.Aabb(),
    point = pc.math.vec3.create(0.6, 0, 0);
    
    same(false, aabb.pointInAabb(point));
});

test("pointInAabb: point outside on y returns false", function () {
    var aabb = new pc.shape.Aabb(),
    point = pc.math.vec3.create(0, 0.6, 0);
    
    same(false, aabb.pointInAabb(point));
});

test("pointInAabb: point outside on z returns false", function () {
    var aabb = new pc.shape.Aabb(),
    point = pc.math.vec3.create(0, 0, 0.6);
    
    same(false, aabb.pointInAabb(point));
});

test("pointInAabb: point on edge returns true", function () {
    var aabb = new pc.shape.Aabb(),
    point = pc.math.vec3.create(0.5, 0, 0);
    
    same(true, aabb.pointInAabb(point));
});

test("pointInAabb: point on corner returns true", function () {
    var aabb = new pc.shape.Aabb(),
    point = pc.math.vec3.create(0.5, 0.5, 0.5);
    
    same(true, aabb.pointInAabb(point));
});