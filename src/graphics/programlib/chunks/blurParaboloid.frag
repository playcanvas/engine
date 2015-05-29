#define BLURSIZE 5
#define BLURSUB 2.0

varying vec2 vUv0;

uniform sampler2D source;
uniform vec4 params; // x = texel size

void main(void) {
    float texel = params.x;
    vec2 step = texel * vec2(0.5, 1.0); // 2x1 images
    bool right = vUv0.x >= 0.5;
    vec2 offset; // -1-1 offset from center
    vec4 sum = vec4(0);
    for(int y=0; y<BLURSIZE; y++) {
        offset.y = float(y) - BLURSUB;
        for(int x=0; x<BLURSIZE; x++) {
            offset.x = float(x) - BLURSUB;
            vec2 sampleCoords = vUv0 + offset * step; // offset in [0, 1]

            // Move from quad [0, 1] to [-1, 1] inside each half
            sampleCoords.y = sampleCoords.y * 2.0 - 1.0;
            sampleCoords.x = (sampleCoords.x - (right? 0.75 : 0.25)) * 4.0;

            float sqLength = dot(sampleCoords, sampleCoords);
            if (sqLength >= 1.0) {
                // If outside of this half, move from [1, 2] to quadratic [1, 0.5] (paraboloid edge-to-center distortion is quadratic)
                // also flip x, because it differs on each half
                sampleCoords = (sampleCoords / sqLength) * vec2(-1, 1);
            }

            // Move back to [0, 1]
            // If outside of this half, use other half
            sampleCoords.y = sampleCoords.y * 0.5 + 0.5;
            sampleCoords.x = sampleCoords.x * 0.25
            + (right?
                (sqLength>=1.0? 0.25 : 0.75) :
                (sqLength>=1.0? 0.75 : 0.25));

            sum += texture2D(source, sampleCoords);
        }
    }
    gl_FragColor = sum / float(BLURSIZE * BLURSIZE);
}
