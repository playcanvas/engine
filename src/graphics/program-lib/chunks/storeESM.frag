float exponent = 48.0;
depth = exp(exponent * depth);

depth = depth / exp(exponent);

gl_FragColor = encodeFloatRGBA(depth);

