module("pc.math.vec3");

test("add", function() {
    var v1 = pc.math.vec3.create(2, 4, 6);
    var v2 = pc.math.vec3.create(1, 2, 3);
    var r = pc.math.vec3.create();

    pc.math.vec3.add(v1,v2,r);

    same(3, r[0]);
    same(6, r[1]);
    same(9, r[2]);
});
 
test("sum", function() {
    var v1 = pc.math.vec3.create(1, 2, 3);
    var v2 = pc.math.vec3.create(2, 3, 4);
    var v3 = pc.math.vec3.create(3, 4, 5);
    var r = pc.math.vec3.create();
    
    pc.math.vec3.sum(v1,v2,v3,r);

    same(r[0], 6);
    same(r[1], 9);
    same(r[2], 12);
});

test("sum: vector used in args and result", function() {
    var v1 = pc.math.vec3.create(1, 2, 3);
    var v2 = pc.math.vec3.create(2, 3, 4);
    var v3 = pc.math.vec3.create(3, 4, 5);
    
    pc.math.vec3.sum(v1,v2,v3,v1);

    same(v1[0], 6);
    same(v1[1], 9);
    same(v1[2], 12);
});

test("clone", function () {
    var v1 = pc.math.vec3.create();
    var v2 = pc.math.vec3.clone(v1);
    
    ok(typeof(v2) === "object");
    
    same(v1[0], v2[0]);
    same(v1[1], v2[1]);
    same(v1[2], v2[2]);
});
    
test("copy", function () {
    var v1 = pc.math.vec3.create(2, 4, 6);
    var v2 = pc.math.vec3.create();

    pc.math.vec3.copy(v1, v2);

    same(2, v2[0]);
    same(4, v2[1]);
    same(6, v2[2]);
});

test("create: no args", function () { 
    var v = pc.math.vec3.create();
    
    same(3, v.length);
    equal(v[0], 0);
    equal(v[1], 0);
    equal(v[2], 0);
});


test("create: args", function() {
    var v = pc.math.vec3.create(1, 2, 3);
    
    same(1, v[0]);
    same(2, v[1]);
    same(3, v[2]);
});

test("cross", function() {
    var v1 = pc.math.vec3.create(1, 0, 0);
    var v2 = pc.math.vec3.create(0, 1, 0);
    var r = pc.math.vec3.create();

    pc.math.vec3.cross(v1, v2, r);

    same(0, r[0]);
    same(0, r[1]);
    same(1, r[2]);        
});

test("dot", function() {
    var v1 = pc.math.vec3.create(1, 2, 3);
    var v2 = pc.math.vec3.create(4, 5, 6);
    
    var r = pc.math.vec3.dot(v1, v2);
    
    same(r, 32);
});

test("dot: parallel", function() {
    var v1 = pc.math.vec3.create(0, 1, 0);
    var v2 = pc.math.vec3.create(0, 1, 0);
    
    var r = pc.math.vec3.dot(v1, v2);
    
    same(r, 1);
});

test("dot: perpendicular", function() {
    var v1 = pc.math.vec3.create(1, 0, 0);
    var v2 = pc.math.vec3.create(0, 1, 0);
    
    var r = pc.math.vec3.dot(v1, v2);
    
    same(r, 0);
});

test("length", function() {
    var v = pc.math.vec3.create(0, 3, 4);
    var l = pc.math.vec3.length(v);
    same(5, l);
});

test("lerp", function() {
    var v0 = pc.math.vec3.create(1, 2, 3);
    var v1 = pc.math.vec3.create(4, 5, 6);
    var r = pc.math.vec3.create();

    pc.math.vec3.lerp(v0, v1, 0, r);

    same(v0[0], r[0]);
    same(v0[1], r[1]);
    same(v0[2], r[2]);        

    pc.math.vec3.lerp(v0, v1, 1, r);

    same(v1[0], r[0]);
    same(v1[1], r[1]);
    same(v1[2], r[2]);        
});

test("multiply", function() {
    var v1 = pc.math.vec3.create(1, 2, 3);
    var v2 = pc.math.vec3.create(1, 2, 3);
    var r = pc.math.vec3.create();
    pc.math.vec3.multiply(v1, v2, r);
    
    same(1, r[0]);
    same(4, r[1]);
    same(9, r[2]);
});

test("normalize", function(){
    var x = pc.math.vec3.create(10, 0, 0);
    var y = pc.math.vec3.create(0, 10, 0);
    var z = pc.math.vec3.create(0, 0, 10);
    var r = pc.math.vec3.create();

    pc.math.vec3.normalize(x, r)
    same(1, r[0]);
    same(0, r[1]);
    same(0, r[2]);

    pc.math.vec3.normalize(y, r)
    same(0, r[0]);
    same(1, r[1]);
    same(0, r[2]);
    
    pc.math.vec3.normalize(z, r)
    same(0, r[0]);
    same(0, r[1]);
    same(1, r[2]);
});

test("project", function () {
    var v0 = pc.math.vec3.create(5,5,0);
    var v1 = pc.math.vec3.create(1,0,0);
    var r = pc.math.vec3.create();
    
    pc.math.vec3.project(v0,v1,r);
    
    same(r[0], 5);
    same(r[1], 0);
    same(r[2], 0);
        
});

test("scale", function() {
    var v = pc.math.vec3.create(1, 2, 3);
    var r = pc.math.vec3.create();
    pc.math.vec3.scale(v, 2, r);
    
    same(2, r[0]);
    same(4, r[1]);
    same(6, r[2]);
});

test("subtract", function() {
    var v1 = pc.math.vec3.create(2, 4, 6);
    var v2 = pc.math.vec3.create(1, 2, 3);
    var r = pc.math.vec3.create();

    pc.math.vec3.subtract(v1, v2, r);

    same(1, r[0]);
    same(2, r[1]);
    same(3, r[2]);
});
