precision lowp float;
varying vec4 decalPos;
uniform sampler2D uDecalMap;

void main(void)
{
    // decal space position from -1..1 range, to texture space range 0..1
    vec4 p = decalPos * 0.5 + 0.5;

    // if the position is outside out 0..1 projection box, ignore the pixel
    if (p.x < 0.0 || p.x > 1.0 || p.y < 0.0 || p.y > 1.0 || p.z < 0.0 || p.z > 1.0)
        discard;

    gl_FragColor = texture2D(uDecalMap, p.xy);
}
