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

test("sin", function () {
  var d = 56;

  equal(pc.math.sin(56), Math.sin(d * pc.math.DEG_TO_RAD));
});

test("cos", function () {
  var d = 56;

  equal(pc.math.cos(56), Math.cos(d * pc.math.DEG_TO_RAD));
});

test("tan", function () {
  var d = 56;

  equal(pc.math.tan(56), Math.tan(d * pc.math.DEG_TO_RAD));
});

test("asin", function () {
  var n = 0.5;

  equal(pc.math.asin(n), Math.asin(n) * pc.math.RAD_TO_DEG);
});

test("asin", function () {
  var n = 0.5;

  equal(pc.math.acos(n), Math.acos(n) * pc.math.RAD_TO_DEG);
});

test("atan", function () {
  var n = 0.5;

  equal(pc.math.atan(n), Math.atan(n) * pc.math.RAD_TO_DEG);
});

test("atan2", function () {
  var x = 1;
  var y = 2;

  equal(pc.math.atan2(y, x), Math.atan2(y, x) * pc.math.RAD_TO_DEG);
});

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
