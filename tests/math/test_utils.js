describe('sdk.tests.math.utils', function () {
  it("intToBytes32", function () {
      var i, b;

      i = 0x11223344;
      b = pc.math.intToBytes32(i);
      equal(b[0], 0x11);
      equal(b[1], 0x22);
      equal(b[2], 0x33);
      equal(b[3], 0x44);
  });

  it("intToBytes24", function () {
      var i, b;

      i = 0x112233;
      b = pc.math.intToBytes24(i);
      equal(b[0], 0x11);
      equal(b[1], 0x22);
      equal(b[2], 0x33);
  });

  it("bytesToInt32", function () {
     var i,b;

     b = [0xaa, 0xbb, 0xcc, 0xdd];
     i = pc.math.bytesToInt32(b);
     equal(i, 0xaabbccdd);
  });

  it("bytesToInt24", function () {
     var i,b;

     b = [0xaa, 0xbb, 0xcc];
     i = pc.math.bytesToInt24(b);
     equal(i, 0xaabbcc);
  });

  it("DEG_TO_RAD", function () {
     var deg = 180;

     equal(deg * pc.math.DEG_TO_RAD, Math.PI);
  });

  it("RAD_TO_DEG", function () {
     var rad = Math.PI;

     equal(rad * pc.math.RAD_TO_DEG, 180);
  });

  it("smoothstep", function () {
    equal(pc.math.smoothstep(0, 10, 0), 0);
    equal(pc.math.smoothstep(0, 10, 5), 0.5);
    equal(pc.math.smoothstep(0, 10, 10), 1);
  });

  it("smootherstep", function () {
    equal(pc.math.smootherstep(0, 10, 0), 0);
    equal(pc.math.smootherstep(0, 10, 5), 0.5);
    equal(pc.math.smootherstep(0, 10, 10), 1);
  });

});

