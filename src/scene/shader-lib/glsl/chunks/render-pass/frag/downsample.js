export default /* glsl */`
uniform sampler2D sourceTexture;
uniform vec2 sourceInvResolution;
varying vec2 uv0;

#ifdef PREMULTIPLY
    uniform sampler2D premultiplyTexture;
#endif

void main()
{
    vec3 e = texture2D (sourceTexture, uv0).rgb;

    #ifdef BOXFILTER
        vec3 value = e;

        #ifdef PREMULTIPLY
            float premultiply = texture2D(premultiplyTexture, uv0).{PREMULTIPLY_SRC_CHANNEL};
            value *= vec3(premultiply);
        #endif
    #else

        float x = sourceInvResolution.x;
        float y = sourceInvResolution.y;

        vec3 a = texture2D(sourceTexture, vec2 (uv0.x - 2.0 * x, uv0.y + 2.0 * y)).rgb;
        vec3 b = texture2D(sourceTexture, vec2 (uv0.x,           uv0.y + 2.0 * y)).rgb;
        vec3 c = texture2D(sourceTexture, vec2 (uv0.x + 2.0 * x, uv0.y + 2.0 * y)).rgb;

        vec3 d = texture2D(sourceTexture, vec2 (uv0.x - 2.0 * x, uv0.y)).rgb;
        vec3 f = texture2D(sourceTexture, vec2 (uv0.x + 2.0 * x, uv0.y)).rgb;

        vec3 g = texture2D(sourceTexture, vec2 (uv0.x - 2.0 * x, uv0.y - 2.0 * y)).rgb;
        vec3 h = texture2D(sourceTexture, vec2 (uv0.x,           uv0.y - 2.0 * y)).rgb;
        vec3 i = texture2D(sourceTexture, vec2 (uv0.x + 2.0 * x, uv0.y - 2.0 * y)).rgb;

        vec3 j = texture2D(sourceTexture, vec2 (uv0.x - x, uv0.y + y)).rgb;
        vec3 k = texture2D(sourceTexture, vec2 (uv0.x + x, uv0.y + y)).rgb;
        vec3 l = texture2D(sourceTexture, vec2 (uv0.x - x, uv0.y - y)).rgb;
        vec3 m = texture2D(sourceTexture, vec2 (uv0.x + x, uv0.y - y)).rgb;


        vec3 value = e * 0.125;
        value += (a + c + g + i) * 0.03125;
        value += (b + d + f + h) * 0.0625;
        value += (j + k + l + m) * 0.125;
    #endif

    gl_FragColor = vec4(value, 1.0);
}
`;
