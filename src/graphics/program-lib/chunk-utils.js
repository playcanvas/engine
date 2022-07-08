const decodeTable = {
    'linear': 'decodeLinear',
    'srgb': 'decodeGamma',
    'rgbm': 'decodeRGBM',
    'rgbe': 'decodeRGBE'
};

class ChunkUtils {
    // returns the name of the decode function for the texture encoding
    static decodeFunc(encoding) {
        return decodeTable[encoding] || 'decodeGamma';
    }
}

export { ChunkUtils };
