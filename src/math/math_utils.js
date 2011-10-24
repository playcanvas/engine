/*
Math.clamp = function(v, min, max) {
    if(v >= max) return max;
    if(v <= min) return min;
    return v;
};

Math.toRadians = function (degrees) {
    return degrees * Math.PI / 180;
};

Math.toDegrees = function (radians) {
    return radians * 180 / Math.PI;
};

pc.math.DEG_TO_RAD
pc.math.RAD_TO_DEG

Math.headingToTransform = function (heading, position, up, t) {
    var left = pc.math.vec3.create();
    pc.math.vec3.normalize(heading, heading);
    pc.math.vec3.normalize(up, up);
    
    pc.math.vec3.cross(up, heading, left);
    pc.math.vec3.normalize(left, left);

    pc.math.vec3.cross(heading, left, up);
    pc.math.vec3.normalize(up, up);
    
    t[0] = left[0];
    t[1] = left[1];
    t[2] = left[2];
    t[3] = 0;

    t[4] = up[0];
    t[5] = up[1];
    t[6] = up[2];
    t[7] = 0;

    t[8] = heading[0];
    t[9] = heading[1];
    t[10] = heading[2];
    t[11] = 0;

    t[12] = position[0];
    t[13] = position[1];
    t[14] = position[2];
    t[15] = 1;
};
*/
/**
 * Convert Number (treated as 32bit unsigned int) to 4 bytes 
 * e.g. 0x11223344 -> [0x11, 0x22, 0x33, 0x44]
 * @param {Number} i
 */
/*
Math.intToBytes = function (i) {
    var r,g,b,a;
    
    r = (i >> 24) & 0xff;
    g = (i >> 16) & 0xff;
    b = (i >> 8) & 0xff;
    a = (i) & 0xff;
    
    return [r,g,b,a];
};
*/
/**
 * Convert 4 1-byte Numbers into a single unsigned 32bit Number 
 * e.g. [0x11,0x22,0x33,0x44] -> 0x11223344
 * @param {Number} r A single byte (0-255)
 * @param {Number} g A single byte (0-255)
 * @param {Number} b A single byte (0-255)
 * @param {Number} a A single byte (0-255)
 */
/*
Math.bytesToInt = function (r,g,b,a) {
    if (r.length) {
        a = r[3];
        b = r[2];
        g = r[1];
        r = r[0];
    }
    // Why ((r << 24)>>>32)?
    // << operator uses signed 32 bit numbers, so 128<<24 is negative. 
    // >>> used unsigned so >>>32 converts back to an unsigned.
    // See http://stackoverflow.com/questions/1908492/unsigned-integer-in-javascript
    return ((r << 24) | (g << 16) | (b << 8) | a)>>>32;
};

pc.math.unproject = function (screen, view, projection, viewport, worldCoord) {
    if (worldCoord === undefined) {
        worldCoord = pc.math.vec3.create();
    }
    var viewProj = pc.math.mat4.multiply(projection, view);
    var invViewProj = pc.math.mat4.invert(viewProj);

    // Screen coordinate -> normalized device coordinates (-1.0 .. 1.0)
    var invec = pc.math.Vec4.create(
                                ((screen[0]-viewport.x)/viewport.width)  * 2.0 - 1.0, 
                                ((screen[1]-viewport.y)/viewport.height) * 2.0 - 1.0, 
                                2.0*screen[2]-1.0, 1.0);
    var outvec = pc.math.mat4.multiplyVec4(invec, invViewProj);

    if (outvec[3] === 0.0)
        return null;
    outvec[3] = 1.0 / outvec[3];
    worldCoord[0] = outvec[0] * outvec[3];
    worldCoord[1] = outvec[1] * outvec[3];
    worldCoord[2] = outvec[2] * outvec[3];
    return worldCoord;
}
pc.math = pc.math || {};
pc.math.transform = pc.math.transform || {};
pc.math.transform = {
    getTranslation: function(t) {
        return pc.math.vec3.create(t[12], t[13], t[14]);
    },
    
    getX: function (t) {
        return pc.math.vec3.create(t[0], t[1], t[2]);
    },
    
    getY: function (t) {
        return pc.math.vec3.create(t[4], t[5], t[6]);
    },
    
    getZ: function (t) {
        return pc.math.vec3.create(t[8], t[9], t[10]);
    }
}
*/
