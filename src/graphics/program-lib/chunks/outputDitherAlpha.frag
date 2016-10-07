float dither = dot(vec2( 171.0, 231.0 ), gl_FragCoord.xy);
dither = fract(dither / 103.0);
dither = dither*2.0-1.0;
dither *= 0.25;

dAlpha += dither;
gl_FragColor.a = dAlpha;

