export default /* glsl */`
    uniform sampler2D sourceTexture;
    uniform vec2 sourceInvResolution;
    varying vec2 uv0;

    void main()
    {
        float x = sourceInvResolution.x;
        float y = sourceInvResolution.y;

        vec3 a = texture2D (sourceTexture, vec2 (uv0.x - x, uv0.y + y)).rgb;
        vec3 b = texture2D (sourceTexture, vec2 (uv0.x,     uv0.y + y)).rgb;
        vec3 c = texture2D (sourceTexture, vec2 (uv0.x + x, uv0.y + y)).rgb;

        vec3 d = texture2D (sourceTexture, vec2 (uv0.x - x, uv0.y)).rgb;
        vec3 e = texture2D (sourceTexture, vec2 (uv0.x,     uv0.y)).rgb;
        vec3 f = texture2D (sourceTexture, vec2 (uv0.x + x, uv0.y)).rgb;

        vec3 g = texture2D (sourceTexture, vec2 (uv0.x - x, uv0.y - y)).rgb;
        vec3 h = texture2D (sourceTexture, vec2 (uv0.x,     uv0.y - y)).rgb;
        vec3 i = texture2D (sourceTexture, vec2 (uv0.x + x, uv0.y - y)).rgb;

        vec3 value = e * 4.0;
        value += (b + d + f + h) * 2.0;
        value += (a + c + g + i);
        value *= 1.0 / 16.0;

        gl_FragColor = vec4(value, 1.0);
    }
`;
