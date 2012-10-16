module('sdk.tests.math.utils');

test("intToBytes", function () {
    var i, b;
    
    i = 0x11223344;
    b = pc.math.intToBytes(i);
    equal(b[0], 0x11);
    equal(b[1], 0x22);
    equal(b[2], 0x33);
    equal(b[3], 0x44);
});

test("intToBytes32", function () {
    var i, b;
    
    i = 0x11223344;
    b = pc.math.intToBytes32(i);
    equal(b[0], 0x11);
    equal(b[1], 0x22);
    equal(b[2], 0x33);
    equal(b[3], 0x44);
});

test("intToBytes24", function () {
    var i, b;
    
    i = 0x112233;
    b = pc.math.intToBytes24(i);
    equal(b[0], 0x11);
    equal(b[1], 0x22);
    equal(b[2], 0x33);
});

test("bytesToInt", function () {
   var i,b;
   
   b = [0xaa, 0xbb, 0xcc, 0xdd];
   i = pc.math.bytesToInt(b);
   equal(i, 0xaabbccdd);
});

test("bytesToInt32", function () {
   var i,b;
   
   b = [0xaa, 0xbb, 0xcc, 0xdd];
   i = pc.math.bytesToInt32(b);
   equal(i, 0xaabbccdd);
});

test("bytesToInt24", function () {
   var i,b;
   
   b = [0xaa, 0xbb, 0xcc];
   i = pc.math.bytesToInt24(b);
   equal(i, 0xaabbcc);
});

test("DEG_TO_RAD", function () {
   var deg = 180;
   
   equal(deg * pc.math.DEG_TO_RAD, Math.PI); 
});

test("RAD_TO_DEG", function () {
   var rad = Math.PI;
   
   equal(rad * pc.math.RAD_TO_DEG, 180); 
});

/*
test("unproject", function () {
   var transform = pc.math.mat4.makeTranslate(0,0,10);
   var modelview = pc.math.mat4.invert(transform);
   var viewport = {
       x: 0,
       y: 0,
       width: 800,
       height: 600
   }
   var fov = 45;
   var nearClip = 1;
   var farClip = 100;
   var projection = pc.math.mat4.makePerspective(fov, viewport.width / viewport.height, nearClip, farClip);
   var screen = pc.math.vec3.create(0,0,-10);
   var world = pc.math.vec3.create(0,0,0);
   
   
   pc.math.unproject(screen, modelview, projection, viewport, world);
   
   // TODO: write tests
    
});
*/