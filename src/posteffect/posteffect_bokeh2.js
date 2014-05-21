pc.extend(pc.posteffect, function () {

    function Bokeh2(graphicsDevice) {
        this.device = graphicsDevice;

        this.shader = new pc.gfx.Shader(graphicsDevice, {
            attributes: {
                aPosition: pc.gfx.SEMANTIC_POSITION
            },
            vshader: [
                "attribute vec2 aPosition;",
                "",
                "varying vec2 vUv0;",
                "",
                "void main(void)",
                "{",
                "    gl_Position = vec4(aPosition, 0.0, 1.0);",
                "    vUv0 = (aPosition.xy + 1.0) * 0.5;",
                "}"
            ].join("\n"),
            fshader: [
                "precision " + graphicsDevice.precision + " float;",

                "varying vec2 vUv0;",

                "uniform sampler2D tColor;",
                "uniform sampler2D tDepth;",
                "uniform float textureWidth;",
                "uniform float textureHeight;",

                "const float PI = 3.14159265;",

                "float width = textureWidth; //texture width",
                "float height = textureHeight; //texture height",

                "vec2 texel = vec2(1.0/width,1.0/height);",

                "uniform float focalDepth;  //focal distance value in meters, but you may use autofocus option below",
                "uniform float focalLength; //focal length in mm",
                "uniform float fstop; //f-stop value",
                "uniform bool showFocus; //show debug focus point and focal range (red = focal point, green = focal range)",

                "/*",
                "make sure that these two values are the same for your camera, otherwise distances will be wrong.",
                "*/",

                "uniform float znear; // camera clipping start",
                "uniform float zfar; // camera clipping end",

                "//------------------------------------------",
                "//user variables",

                "const int samples = 4; //samples on the first ring",
                "const int rings = 3; //ring count",

                "const int maxringsamples = rings * samples;",

                "uniform bool manualdof; // manual dof calculation",
                "float ndofstart = 1.0; // near dof blur start",
                "float ndofdist = 2.0; // near dof blur falloff distance",
                "float fdofstart = 1.0; // far dof blur start",
                "float fdofdist = 3.0; // far dof blur falloff distance",

                "float CoC = 0.03; //circle of confusion size in mm (35mm film = 0.03mm)",

                "uniform bool vignetting; // use optical lens vignetting",

                "float vignout = 1.3; // vignetting outer border",
                "float vignin = 0.0; // vignetting inner border",
                "float vignfade = 22.0; // f-stops till vignete fades",

                "uniform bool shaderFocus;",

                "bool autofocus = shaderFocus;",
                "//use autofocus in shader - use with focusCoords",
                "// disable if you use external focalDepth value",

                "uniform vec2 focusCoords;",
                "// autofocus point on screen (0.0,0.0 - left lower corner, 1.0,1.0 - upper right)",
                "// if center of screen use vec2(0.5, 0.5);",

                "uniform float maxblur;",
                "//clamp value of max blur (0.0 = no blur, 1.0 default)",

                "uniform float threshold; // highlight threshold;",
                "uniform float gain; // highlight gain;",

                "uniform float bias; // bokeh edge bias",
                "uniform float fringe; // bokeh chromatic aberration / fringing",

                "uniform bool noise; //use noise instead of pattern for sample dithering",

                "uniform float dithering;",
                "float namount = dithering; //dither amount",

                "uniform bool depthblur; // blur the depth buffer",
                "float dbsize = 1.25; // depth blur size",

                "/*",
                "next part is experimental",
                "not looking good with small sample and ring count",
                "looks okay starting from samples = 4, rings = 4",
                "*/",

                "uniform bool pentagon; //use pentagon as bokeh shape?",
                "float feather = 0.4; //pentagon shape feather",

                "//------------------------------------------",

                "float penta(vec2 coords) {",
                    "//pentagonal shape",
                    "float scale = float(rings) - 1.3;",
                    "vec4  HS0 = vec4( 1.0,         0.0,         0.0,  1.0);",
                    "vec4  HS1 = vec4( 0.309016994, 0.951056516, 0.0,  1.0);",
                    "vec4  HS2 = vec4(-0.809016994, 0.587785252, 0.0,  1.0);",
                    "vec4  HS3 = vec4(-0.809016994,-0.587785252, 0.0,  1.0);",
                    "vec4  HS4 = vec4( 0.309016994,-0.951056516, 0.0,  1.0);",
                    "vec4  HS5 = vec4( 0.0        ,0.0         , 1.0,  1.0);",

                    "vec4  one = vec4( 1.0 );",

                    "vec4 P = vec4((coords),vec2(scale, scale));",

                    "vec4 dist = vec4(0.0);",
                    "float inorout = -4.0;",

                    "dist.x = dot( P, HS0 );",
                    "dist.y = dot( P, HS1 );",
                    "dist.z = dot( P, HS2 );",
                    "dist.w = dot( P, HS3 );",

                    "dist = smoothstep( -feather, feather, dist );",

                    "inorout += dot( dist, one );",

                    "dist.x = dot( P, HS4 );",
                    "dist.y = HS5.w - abs( P.z );",

                    "dist = smoothstep( -feather, feather, dist );",
                    "inorout += dist.x;",

                    "return clamp( inorout, 0.0, 1.0 );",
                "}",

                "float bdepth(vec2 coords) {",
                    "// Depth buffer blur",
                    "float d = 0.0;",
                    "float kernel[9];",
                    "vec2 offset[9];",

                    "vec2 wh = vec2(texel.x, texel.y) * dbsize;",

                    "offset[0] = vec2(-wh.x,-wh.y);",
                    "offset[1] = vec2( 0.0, -wh.y);",
                    "offset[2] = vec2( wh.x -wh.y);",

                    "offset[3] = vec2(-wh.x,  0.0);",
                    "offset[4] = vec2( 0.0,   0.0);",
                    "offset[5] = vec2( wh.x,  0.0);",

                    "offset[6] = vec2(-wh.x, wh.y);",
                    "offset[7] = vec2( 0.0,  wh.y);",
                    "offset[8] = vec2( wh.x, wh.y);",

                    "kernel[0] = 1.0/16.0;   kernel[1] = 2.0/16.0;   kernel[2] = 1.0/16.0;",
                    "kernel[3] = 2.0/16.0;   kernel[4] = 4.0/16.0;   kernel[5] = 2.0/16.0;",
                    "kernel[6] = 1.0/16.0;   kernel[7] = 2.0/16.0;   kernel[8] = 1.0/16.0;",


                    "for( int i=0; i<9; i++ ) {",
                        "float tmp = texture2D(tDepth, coords + offset[i]).r;",
                        "d += tmp * kernel[i];",
                    "}",

                    "return d;",
                "}",


                "vec3 color(vec2 coords,float blur) {",
                    "//processing the sample",

                    "vec3 col = vec3(0.0);",

                    "col.r = texture2D(tColor,coords + vec2(0.0,1.0)*texel*fringe*blur).r;",
                    "col.g = texture2D(tColor,coords + vec2(-0.866,-0.5)*texel*fringe*blur).g;",
                    "col.b = texture2D(tColor,coords + vec2(0.866,-0.5)*texel*fringe*blur).b;",

                    "vec3 lumcoeff = vec3(0.299,0.587,0.114);",
                    "float lum = dot(col.rgb, lumcoeff);",
                    "float thresh = max((lum-threshold)*gain, 0.0);",
                    "return col+mix(vec3(0.0),col,thresh*blur);",
                "}",

                "vec2 rand(vec2 coord) {",
                    "// generating noise / pattern texture for dithering",

                    "float noiseX = ((fract(1.0-coord.s*(width/2.0))*0.25)+(fract(coord.t*(height/2.0))*0.75))*2.0-1.0;",
                    "float noiseY = ((fract(1.0-coord.s*(width/2.0))*0.75)+(fract(coord.t*(height/2.0))*0.25))*2.0-1.0;",

                    "if (noise) {",
                        "noiseX = clamp(fract(sin(dot(coord ,vec2(12.9898,78.233))) * 43758.5453),0.0,1.0)*2.0-1.0;",
                        "noiseY = clamp(fract(sin(dot(coord ,vec2(12.9898,78.233)*2.0)) * 43758.5453),0.0,1.0)*2.0-1.0;",
                    "}",

                    "return vec2(noiseX,noiseY);",
                "}",

                "vec3 debugFocus(vec3 col, float blur, float depth) {",
                    "float edge = 0.002*depth; //distance based edge smoothing",
                    "float m = clamp(smoothstep(0.0,edge,blur),0.0,1.0);",
                    "float e = clamp(smoothstep(1.0-edge,1.0,blur),0.0,1.0);",

                    "col = mix(col,vec3(1.0,0.5,0.0),(1.0-m)*0.6);",
                    "col = mix(col,vec3(0.0,0.5,1.0),((1.0-e)-(1.0-m))*0.2);",

                    "return col;",
                "}",

                "float linearize(float depth) {",
                    "return -zfar * znear / (depth * (zfar - znear) - zfar);",
                "}",


                "float vignette() {",
                    "float dist = distance(vUv0.xy, vec2(0.5,0.5));",
                    "dist = smoothstep(vignout+(fstop/vignfade), vignin+(fstop/vignfade), dist);",
                    "return clamp(dist,0.0,1.0);",
                "}",

                "float gather(float i, float j, int ringsamples, inout vec3 col, float w, float h, float blur) {",
                    "float rings2 = float(rings);",
                    "float step = PI*2.0 / float(ringsamples);",
                    "float pw = cos(j*step)*i;",
                    "float ph = sin(j*step)*i;",
                    "float p = 1.0;",
                    "if (pentagon) {",
                        "p = penta(vec2(pw,ph));",
                    "}",
                    "col += color(vUv0.xy + vec2(pw*w,ph*h), blur) * mix(1.0, i/rings2, bias) * p;",
                    "return 1.0 * mix(1.0, i /rings2, bias) * p;",
                "}",

                "void main() {",
                    "//scene depth calculation",

                    "float depth = linearize(texture2D(tDepth,vUv0.xy).x);",

                    "// Blur depth?",
                    "if (depthblur) {",
                        "depth = linearize(bdepth(vUv0.xy));",
                    "}",

                    "//focal plane calculation",

                    "float fDepth = focalDepth;",

                    "if (autofocus) {",

                        "fDepth = linearize(texture2D(tDepth,focusCoords).x);",

                    "}",

                    "// dof blur factor calculation",

                    "float blur = 0.0;",

                    "if (manualdof) {",
                        "float a = depth-fDepth; // Focal plane",
                        "float b = (a-fdofstart)/fdofdist; // Far DoF",
                        "float c = (-a-ndofstart)/ndofdist; // Near Dof",
                        "blur = (a>0.0) ? b : c;",
                    "} else {",
                        "float f = focalLength; // focal length in mm",
                        "float d = fDepth*1000.0; // focal plane in mm",
                        "float o = depth*1000.0; // depth in mm",

                        "float a = (o*f)/(o-f);",
                        "float b = (d*f)/(d-f);",
                        "float c = (d-f)/(d*fstop*CoC);",

                        "blur = abs(a-b)*c;",
                    "}",

                    "blur = clamp(blur,0.0,1.0);",

                    "// calculation of pattern for dithering",

                    "vec2 noise = rand(vUv0.xy)*namount*blur;",

                    "// getting blur x and y step factor",

                    "float w = (1.0/width)*blur*maxblur+noise.x;",
                    "float h = (1.0/height)*blur*maxblur+noise.y;",

                    "// calculation of final color",

                    "vec3 col = vec3(0.0);",

                    "if(blur < 0.05) {",
                        "//some optimization thingy",
                        "col = texture2D(tColor, vUv0.xy).rgb;",
                    "} else {",
                        "col = texture2D(tColor, vUv0.xy).rgb;",
                        "float s = 1.0;",
                        "int ringsamples;",

                        "for (int i = 1; i <= rings; i++) {",
                            "/*unboxstart*/",
                            "ringsamples = i * samples;",

                            "for (int j = 0 ; j < maxringsamples ; j++) {",
                                "if (j >= ringsamples) break;",
                                "s += gather(float(i), float(j), ringsamples, col, w, h, blur);",
                            "}",
                            "/*unboxend*/",
                        "}",

                        "col /= s; //divide by sample count",
                    "}",

                    "if (showFocus) {",
                        "col = debugFocus(col, blur, depth);",
                    "}",

                    "if (vignetting) {",
                        "col *= vignette();",
                    "}",

                    "gl_FragColor.rgb = col;",
                    "gl_FragColor.a = 1.0;",
                "} "

            ].join("\n")
        });

        this.vertexBuffer = pc.posteffect.createFullscreenQuad(graphicsDevice);

        // Uniforms
        this.textureWidth = 1;
        this.textureHeight = 1;
        this.focalDepth = 1;
        this.focalLength = 24;
        this.fstop = 0.9;
        this.maxBlur = 1;
        this.showFocus = 0;
        this.manualdof = 0;
        this.vignetting = 0;
        this.depthblur = 0;
        this.threshold = 0.5;
        this.gain = 2;
        this.bias = 0.5;
        this.fringe = 0.7;
        this.znear = 0.1;
        this.zfar = 100;
        this.noise = 1;
        this.dithering = 0.0001;
        this.pentagon = 0;
        this.shaderFocus = 1;
        this.focusCoords = [0,0];

        this.depthMap = new pc.gfx.Texture(graphicsDevice);
    }

    Bokeh2.prototype = {
        render: function (inputTarget, outputTarget) {
            var device = this.device;
            var scope = device.scope;

            scope.resolve("textureWidth").setValue(this.textureWidth);
            scope.resolve("textureHeight").setValue(this.textureHeight);
            scope.resolve("focalDepth").setValue(this.focalDepth);
            scope.resolve("focalLength").setValue(this.focalLength);
            scope.resolve("fstop").setValue(this.fstop);
            scope.resolve("maxblur").setValue(this.maxBlur);
            scope.resolve("showFocus").setValue(this.showFocus);
            scope.resolve("manualdof").setValue(this.manualdof);
            scope.resolve("vignetting").setValue(this.vignetting);
            scope.resolve("depthblur").setValue(this.depthblur);
            scope.resolve("threshold").setValue(this.threshold);
            scope.resolve("gain").setValue(this.gain);
            scope.resolve("bias").setValue(this.bias);
            scope.resolve("fringe").setValue(this.fringe);
            scope.resolve("znear").setValue(this.znear);
            scope.resolve("zfar").setValue(this.zfar);
            scope.resolve("noise").setValue(this.noise);
            scope.resolve("dithering").setValue(this.dithering);
            scope.resolve("pentagon").setValue(this.pentagon);
            scope.resolve("shaderFocus").setValue(this.shaderFocus);
            scope.resolve("focusCoords").setValue(this.focusCoords);
            scope.resolve("tColor").setValue(inputTarget.colorBuffer);
            scope.resolve("tDepth").setValue(this.depthMap);
            pc.posteffect.drawFullscreenQuad(device, outputTarget, this.vertexBuffer, this.shader);
        }
    };

    return {
        Bokeh2: Bokeh2
    };
}());