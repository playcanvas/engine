varying vec2 vUv0;
uniform sampler2D source;
uniform vec4 params; // xy = single tile resolution, zw = same - 1

void main(void) {
    vec4 color = texture2D(source, vUv0);
    vec2 tiles = mod(floor(gl_FragCoord.xy), params.xy);
    bool border = tiles.x==0.0 || tiles.x==params.z || tiles.y==0.0 || tiles.y==params.w;
    gl_FragColor = border? vec4(0.0) : color;
}

