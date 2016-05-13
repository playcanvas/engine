/*float exponent = 10.0;

// Applies exponential warp to shadow map depth, input depth should be in [0, 1]
// Rescale depth into [-1, 1]
depth = 2.0 * depth - 1.0;
depth =  exp(exponent * depth);

//gl_FragColor = vec4(encodeFloatRG(depth), encodeFloatRG(depth*depth));
gl_FragColor = vec4(depth, depth*depth, 0.0, 0.0);
*/

float expScale = 10.0;

// Applies exponential warp to shadow map depth, input depth should be in [0, 1]
// Rescale depth into [-1, 1]
depth = 2.0 * depth - 1.0;
depth =  exp(expScale * depth);

float x = depth;
float exponent = floor(log(x * 10.0) / log(10.0));
if (floor(x)==0.0) exponent = 0.0; // TODO: do better
float significand = x / pow(10.0, exponent);
float encX = significand;
float encY = fract(255.0 * significand);
encX -= encY / 255.0;
encY -= encY / 255.0;
float encY2 = encY*0.1 + exponent*0.1;
//float encY2 = (min(exponent,7.0) * 32.0 + encY * 31.0) / 255.0;
vec2 rg = vec2(encX, encY2);

x = depth * depth;
exponent = floor(log(x * 10.0) / log(10.0));
if (floor(x)==0.0) exponent = 0.0; // TODO: do better
significand = x / pow(10.0, exponent);
encX = significand;
encY = fract(255.0 * significand);
encX -= encY / 255.0;
encY -= encY / 255.0;
encY2 = encY*0.1 + exponent*0.1;
//encY2 = (min(exponent,7.0) * 32.0 + encY * 31.0) / 255.0;
vec2 ba = vec2(encX, encY2);

gl_FragColor = vec4(rg, ba);

//gl_FragColor = vec4(depth);

