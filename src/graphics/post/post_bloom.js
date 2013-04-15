pc.gfx.post.bloom = function () {
    // Render targets
    var targets = [];
    
    // Bloom programs
    var extractProg = null;
    var blurProg = null;
    var combineProg = null;

    // Effect defaults
    var defaults = {
        bloomThreshold: 0.25, 
        blurAmount: 4,
        bloomIntensity: 1.25, 
        baseIntensity: 1,
        bloomSaturation: 1,
        baseSaturation: 1
    };
    var sampleCount = 15;
    var combineParams = pc.math.vec4.create(0, 0, 0, 0);

    // Full screen quad rendering
    var vertexBuffer = null;

    var quadPrimitive = {
        type: pc.gfx.PRIMITIVE_TRISTRIP,
        base: 0,
        count: 4,
        indexed: false
    };
    var quadState = {
        depthTest: false,
        depthWrite: false
    };

    var drawFullscreenQuad = function (device, target, program) {
        device.setRenderTarget(target);
        device.updateBegin();
        device.updateLocalState(quadState);
        device.setVertexBuffer(vertexBuffer, 0);
        device.setProgram(program);
        device.draw(quadPrimitive);
        device.clearLocalState();
        device.updateEnd();
    }

    var sampleWeights = new Float32Array(sampleCount);
    var sampleOffsets = new Float32Array(sampleCount * 2);

    var calculateBlurValues = function (dx, dy, blurAmount) {

        var _computeGaussian = function (n, theta) {
            return ((1.0 / Math.sqrt(2 * Math.PI * theta)) * Math.exp(-(n * n) / (2 * theta * theta)));
        };
        
        // Look up how many samples our gaussian blur effect supports.

        // Create temporary arrays for computing our filter settings.
        // The first sample always has a zero offset.
        sampleWeights[0] = _computeGaussian(0, blurAmount);
        sampleOffsets[0] = 0;
        sampleOffsets[1] = 0;

        // Maintain a sum of all the weighting values.
        var totalWeights = sampleWeights[0];

        // Add pairs of additional sample taps, positioned
        // along a line in both directions from the center.
        var i, len;
        for (i = 0, len = Math.floor(sampleCount / 2); i < len; i++) {
            // Store weights for the positive and negative taps.
            var weight = _computeGaussian(i + 1, blurAmount);
            sampleWeights[i*2] = weight;
            sampleWeights[i*2+1] = weight;
            totalWeights += weight * 2;

            // To get the maximum amount of blurring from a limited number of
            // pixel shader samples, we take advantage of the bilinear filtering
            // hardware inside the texture fetch unit. If we position our texture
            // coordinates exactly halfway between two texels, the filtering unit
            // will average them for us, giving two samples for the price of one.
            // This allows us to step in units of two texels per sample, rather
            // than just one at a time. The 1.5 offset kicks things off by
            // positioning us nicely in between two texels.
            var sampleOffset = i * 2 + 1.5;

            // Store texture coordinate offsets for the positive and negative taps.
            sampleOffsets[i*4] = dx * sampleOffset;
            sampleOffsets[i*4+1] = dy * sampleOffset;
            sampleOffsets[i*4+2] = -dx * sampleOffset;
            sampleOffsets[i*4+3] = -dy * sampleOffset;
        }

        // Normalize the list of sample weightings, so they will always sum to one.
        for (i = 0, len = sampleWeights.length; i < len; i++) {
            sampleWeights[i] /= totalWeights;
        }
    };
    
    return {
        initialize: function () {
            var passThroughVert = [
                "attribute vec3 aPosition;",
                "",
                "varying vec2 vUv0;",
                "",
                "void main(void)",
                "{",
                "    gl_Position = vec4(aPosition, 1.0);",
                "    vUv0 = (aPosition.xy + 1.0) * 0.5;",
                "}"
            ].join("\n");

            // Pixel shader extracts the brighter areas of an image.
            // This is the first step in applying a bloom postprocess.
            var bloomExtractFrag = [
                "precision mediump float;",
                "",
                "varying vec2 vUv0;",
                "",
                "uniform sampler2D uBaseTexture;",
                "uniform float uBloomThreshold;",
                "",
                "void main(void)",
                "{",
                     // Look up the original image color.
                "    vec4 color = texture2D(uBaseTexture, vUv0);",
                "",
                     // Adjust it to keep only values brighter than the specified threshold.
                "    gl_FragColor = clamp((color - uBloomThreshold) / (1.0 - uBloomThreshold), 0.0, 1.0);",
                "}"
            ].join("\n");

            // Pixel shader applies a one dimensional gaussian blur filter.
            // This is used twice by the bloom postprocess, first to
            // blur horizontally, and then again to blur vertically.
            var gaussianBlurFrag = [
                "precision mediump float;",
                "",
                "#define SAMPLE_COUNT " + sampleCount,
                "",
                "varying vec2 vUv0;",
                "",
                "uniform sampler2D uBloomTexture;",
                "uniform vec2 uBlurOffsets[SAMPLE_COUNT];",
                "uniform float uBlurWeights[SAMPLE_COUNT];",
                "",
                "void main(void)",
                "{",
                "    vec4 color = vec4(0.0);",
                     // Combine a number of weighted image filter taps.
                "    for (int i = 0; i < SAMPLE_COUNT; i++)",
                "    {",
                "        color += texture2D(uBloomTexture, vUv0 + uBlurOffsets[i]) * uBlurWeights[i];",
                "    }",
                "",
                "    gl_FragColor = color;",
                "}"
            ].join("\n");

            // Pixel shader combines the bloom image with the original
            // scene, using tweakable intensity levels and saturation.
            // This is the final step in applying a bloom postprocess.
            var bloomCombineFrag = [
                "precision mediump float;",
                "",
                "varying vec2 vUv0;",
                "",
                "#define uBloomIntensity uCombineParams.x",
                "#define uBaseIntensity uCombineParams.y",
                "#define uBloomSaturation uCombineParams.z",
                "#define uBaseSaturation uCombineParams.w",
                "uniform vec4 uCombineParams;",
                "uniform sampler2D uBaseTexture;",
                "uniform sampler2D uBloomTexture;",
                "",
                // Helper for modifying the saturation of a color.
                "vec4 adjust_saturation(vec4 color, float saturation)",
                "{",
                     // The constants 0.3, 0.59, and 0.11 are chosen because the
                     // human eye is more sensitive to green light, and less to blue.
                "    float grey = dot(color.rgb, vec3(0.3, 0.59, 0.11));",
                "",
                "    return mix(vec4(grey), color, saturation);",
                "}",
                "",
                "void main(void)",
                "{",
                     // Look up the bloom and original base image colors.
                "    vec4 bloom = texture2D(uBloomTexture, vUv0);",
                "    vec4 base = texture2D(uBaseTexture, vUv0);",
                "",
                     // Adjust color saturation and intensity.
                "    bloom = adjust_saturation(bloom, uBloomSaturation) * uBloomIntensity;",
                "    base = adjust_saturation(base, uBaseSaturation) * uBaseIntensity;",
                "",
                     // Darken down the base image in areas where there is a lot of bloom,
                     // to prevent things looking excessively burned-out.
                "    base *= (1.0 - clamp(bloom, 0.0, 1.0));",
                "",
                     // Combine the two images.
                "    gl_FragColor = base + bloom;",
                "}"
            ].join("\n");

            var passThroughShader = new pc.gfx.Shader(pc.gfx.SHADERTYPE_VERTEX, passThroughVert);
            var extractShader = new pc.gfx.Shader(pc.gfx.SHADERTYPE_FRAGMENT, bloomExtractFrag);
            var blurShader = new pc.gfx.Shader(pc.gfx.SHADERTYPE_FRAGMENT, gaussianBlurFrag);
            var combineShader = new pc.gfx.Shader(pc.gfx.SHADERTYPE_FRAGMENT, bloomCombineFrag);
            extractProg = new pc.gfx.Program(passThroughShader, extractShader);
            blurProg = new pc.gfx.Program(passThroughShader, blurShader);
            combineProg = new pc.gfx.Program(passThroughShader, combineShader);

            var backBuffer = pc.gfx.FrameBuffer.getBackBuffer();
            width = backBuffer.getWidth();
            height = backBuffer.getHeight();

            for (var i = 0; i < 2; i++) {
                var buffer = new pc.gfx.FrameBuffer(width >> 1, height >> 1, false);
                var buffTex = buffer.getTexture();
                buffTex.minFilter = pc.gfx.FILTER_LINEAR;
                buffTex.magFilter = pc.gfx.FILTER_LINEAR;
                buffTex.addressU = pc.gfx.ADDRESS_CLAMP_TO_EDGE;
                buffTex.addressV = pc.gfx.ADDRESS_CLAMP_TO_EDGE;
                targets.push(new pc.gfx.RenderTarget(buffer));
            }
            
            // Create the vertex format
            var vertexFormat = new pc.gfx.VertexFormat();
            vertexFormat.begin();
            vertexFormat.addElement(new pc.gfx.VertexElement("aPosition", 3, pc.gfx.VertexElementType.FLOAT32));
            vertexFormat.end();

            // Create a vertex buffer
            vertexBuffer = new pc.gfx.VertexBuffer(vertexFormat, 4);

            // Fill the vertex buffer
            var iterator = new pc.gfx.VertexIterator(vertexBuffer);
            iterator.element.aPosition.set(-1.0, -1.0, 0.0);
            iterator.next();
            iterator.element.aPosition.set(1.0, -1.0, 0.0);
            iterator.next();
            iterator.element.aPosition.set(-1.0, 1.0, 0.0);
            iterator.next();
            iterator.element.aPosition.set(1.0, 1.0, 0.0);
            iterator.end();
        },

        render: function (inputTarget, outputTarget, options) {
            if (options === undefined) {
                options = options || defaults;
            } else {
                for (var index in defaults) {
                    if (typeof options[index] == "undefined") options[index] = defaults[index];
                }
            }

            var device = pc.gfx.Device.getCurrent();
            var scope = device.scope;

            // Pass 1: draw the scene into rendertarget 1, using a
            // shader that extracts only the brightest parts of the image.
            scope.resolve("uBloomThreshold").setValue(options.bloomThreshold);
            scope.resolve("uBaseTexture").setValue(inputTarget.getFrameBuffer().getTexture());
            drawFullscreenQuad(device, targets[0], extractProg);
            
            // Pass 2: draw from rendertarget 1 into rendertarget 2,
            // using a shader to apply a horizontal gaussian blur filter.
            calculateBlurValues(1.0 / targets[1].getFrameBuffer().getWidth(), 0, options.blurAmount);
            scope.resolve("uBlurWeights[0]").setValue(sampleWeights);
            scope.resolve("uBlurOffsets[0]").setValue(sampleOffsets);
            scope.resolve("uBloomTexture").setValue(targets[0].getFrameBuffer().getTexture());
            drawFullscreenQuad(device, targets[1], blurProg);

            // Pass 3: draw from rendertarget 2 back into rendertarget 1,
            // using a shader to apply a vertical gaussian blur filter.
            calculateBlurValues(0, 1.0 / targets[0].getFrameBuffer().getHeight(), options.blurAmount);
            scope.resolve("uBlurWeights[0]").setValue(sampleWeights);
            scope.resolve("uBlurOffsets[0]").setValue(sampleOffsets);
            scope.resolve("uBloomTexture").setValue(targets[1].getFrameBuffer().getTexture());
            drawFullscreenQuad(device, targets[0], blurProg);
            
            // Pass 4: draw both rendertarget 1 and the original scene
            // image back into the main backbuffer, using a shader that
            // combines them to produce the final bloomed result.
            combineParams[0] = options.bloomIntensity;
            combineParams[1] = options.baseIntensity;
            combineParams[2] = options.bloomSaturation;
            combineParams[3] = options.baseSaturation;
            scope.resolve("uCombineParams").setValue(combineParams);
            scope.resolve("uBloomTexture").setValue(targets[0].getFrameBuffer().getTexture());
            scope.resolve("uBaseTexture").setValue(inputTarget.getFrameBuffer().getTexture());
            drawFullscreenQuad(device, outputTarget, combineProg);
        }
    };
} ();
