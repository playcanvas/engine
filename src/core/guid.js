// Look up table for GUIDs
const LUT = [];
for (let i = 0; i < 256; i++) {
    LUT[i] = (i < 16 ? '0' : '') + i.toString(16);
}

/**
 * @name guid
 * @namespace
 * @description Basically a very large random number (128-bit) which means the probability of creating two that clash is vanishingly small.
 * GUIDs are used as the unique identifiers for Entities.
 */
const guid = {
    /**
     * @function
     * @name guid.create
     * @description Create an RFC4122 version 4 compliant GUID.
     * @returns {string} A new GUID.
     */
    create: function () {
        const d0 = Math.random() * 0xffffffff | 0;
        const d1 = Math.random() * 0xffffffff | 0;
        const d2 = Math.random() * 0xffffffff | 0;
        const d3 = Math.random() * 0xffffffff | 0;
        return LUT[d0 & 0xff] + LUT[d0 >> 8 & 0xff] + LUT[d0 >> 16 & 0xff] + LUT[d0 >> 24 & 0xff] + '-' +
            LUT[d1 & 0xff] + LUT[d1 >> 8 & 0xff] + '-' + LUT[d1 >> 16 & 0x0f | 0x40] + LUT[d1 >> 24 & 0xff] + '-' +
            LUT[d2 & 0x3f | 0x80] + LUT[d2 >> 8 & 0xff] + '-' + LUT[d2 >> 16 & 0xff] + LUT[d2 >> 24 & 0xff] +
            LUT[d3 & 0xff] + LUT[d3 >> 8 & 0xff] + LUT[d3 >> 16 & 0xff] + LUT[d3 >> 24 & 0xff];
    }
};

export { guid };
