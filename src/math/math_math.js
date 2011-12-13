/**
 * @name pc.math
 * @namespace
 */
pc.math = {
    /**
     * @name pc.math.DEG_TO_RAD
     * @description Conversion factor between degrees and radians
     * @example
     * <code><pre>var rad = 180 * pc.math.DEG_TO_RAD; // Converts 180 degrees to pi radians</pre></code>
     */
    DEG_TO_RAD: Math.PI / 180,
    /**
     * @name pc.math.RAD_TO_DEG
     * @description Conversion factor between degrees and radians
     * @example
     * <code><pre>var deg = Math.PI * pc.math.RAD_TO_DEG; // Converts pi radians to 180 degrees</pre></code>
     */
    RAD_TO_DEG: 180 / Math.PI,
    
    /**
     * @function
     * @name pc.math.clamp
     * @description Clamp a number between min and max inclusive.
     * @param {Number} value Number to clamp
     * @param {Number} min Min value
     * @param {Number} max Max value
     * @returns {Number} The clamped value
     */
    clamp: function(value, min, max) {
        if(value >= max) return max;
        if(value <= min) return min;
        return value;
    },
    
    /**
     * @function
     * @name pc.math.intToBytes32
     * @description Convert an 32 bit integer into an array of 4 bytes.
     * @param {Object} i
     * @example
     * <code><pre>
     * var bytes = pc.math.intToBytes32(0x11223344); // bytes === [0x11,0x22,0x33,0x44] 
     * </code></pre>
     */
    intToBytes32: function (i) {
        var r,g,b,a;
        
        r = (i >> 24) & 0xff;
        g = (i >> 16) & 0xff;
        b = (i >> 8) & 0xff;
        a = (i) & 0xff;
        
        return [r,g,b,a];
    },
    
    /**
     * @function
     * @name pc.math.intToBytes24
     * @description Convert an 24 bit integer into an array of 3 bytes.
     * @param {Object} i
     * @example
     * <code><pre>
     * var bytes = pc.math.intToBytes24(0x112233); // bytes === [0x11,0x22,0x33] 
     * </code></pre>
     */
     intToBytes24: function (i) {
        var r,g,b;
        
        r = (i >> 16) & 0xff;
        g = (i >> 8) & 0xff;
        b = (i) & 0xff;
        
        return [r,g,b];        
    },

    /**
     * @function
     * @name pc.math.bytesToInt32
     * @description Convert 4 1-byte Numbers into a single unsigned 32bit Number 
     * @example
     * <code><pre>
     * var int = pc.math.bytesToInt32([0x11,0x22,0x33,0x44]); // int === 0x11223344
     * </pre></code>
     * @param {Number} r A single byte (0-255)
     * @param {Number} g A single byte (0-255)
     * @param {Number} b A single byte (0-255)
     * @param {Number} a A single byte (0-255)
     */    
    bytesToInt32: function (r,g,b,a) {
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
    },
     /**
     * @function
     * @name pc.math.bytesToInt24
     * @description Convert 3 8 bit Numbers into a single unsigned 24 bit Number 
     * @example
     * <code><pre>
     * var int = pc.math.bytesToInt24([0x11,0x22,0x33]); // int === 0x112233
     * </pre></code>
     * @param {Number} r A single byte (0-255)
     * @param {Number} g A single byte (0-255)
     * @param {Number} b A single byte (0-255)
     * @param {Number} a A single byte (0-255)
     */            
    bytesToInt24: function (r,g,b) {
        if (r.length) {
            b = r[2];
            g = r[1];
            r = r[0];
        }
        return ((r << 16) | (g << 8) | b);
    },
    
    unproject: function (screen, view, projection, viewport, worldCoord) {
        if (worldCoord === undefined) {
            worldCoord = pc.math.vec3.create();
        }
        var viewProj = pc.math.mat4.multiply(projection, view);
        var invViewProj = pc.math.mat4.invert(viewProj);
    
        // Screen coordinate -> normalized device coordinates (-1.0 .. 1.0)
        var invec = pc.math.vec3.create(
                                    ((screen[0]-viewport.x)/viewport.width)  * 2.0 - 1.0, 
                                    ((screen[1]-viewport.y)/viewport.height) * 2.0 - 1.0, 
                                    2.0*screen[2]-1.0);
        var outvec = pc.math.mat4.multiplyVec3(invec, 1.0, invViewProj);
    
        if (outvec[3] === 0.0)
            return null;
        outvec[3] = 1.0 / outvec[3];
        worldCoord[0] = outvec[0] * outvec[3];
        worldCoord[1] = outvec[1] * outvec[3];
        worldCoord[2] = outvec[2] * outvec[3];
        return worldCoord;
    },
    
    /**
     * @function
     * @name pc.math.random
     * @description Return a pseudo-random number between min and max
     */
    random: function (min, max) {
        var diff = max - min;
        return Math.random() * diff + min;        
    }
};

pc.math.intToBytes = pc.math.intToBytes32;
pc.math.bytesToInt = pc.math.bytesToInt32;
