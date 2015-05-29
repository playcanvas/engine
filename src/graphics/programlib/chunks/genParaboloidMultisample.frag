#extension GL_EXT_shader_texture_lod : enable

varying vec2 vUv0;

uniform samplerCube source;
uniform vec4 params; // x = mip

void main(void) {

    vec4 color;
    vec2 texelOffset = params.yz;
    vec2 uv = vUv0 - params.yz * 2.0;
    bool right = vUv0.x >= 0.5;

    for(int y=0; y<5; y++) {
        for(int x=0; x<5; x++) {
            vec2 sampleOffset = vec2(x,y);
            vec2 sampleCoords = uv + sampleOffset * texelOffset;

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

            float side = sampleCoords.x < 0.5? 1.0 : -1.0;
            vec2 tc;
            tc.x = fract(sampleCoords.x * 2.0) * 2.0 - 1.0;
            tc.y = sampleCoords.y * 2.0 - 1.0;
            vec3 dir;
            dir.y = (dot(tc, tc) - 1.0) * side; // from 1.0 center to 0.0 borders quadratically
            dir.xz = tc * -2.0;
            dir.x *= side;
            dir = fixSeams(dir, params.x);
            dir.x *= -1.0;
            color += textureCubeLodEXT(source, dir, 0.0);
        }
    }

    gl_FragColor = color / 25.0;
}
