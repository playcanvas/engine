pc.gfx.post.bloom = function () {
    var targets = [];
    var programs = {};
    var vertexBuffer = null;
    
    var getBlurValues = function (dx, dy, blurAmount) {

        var _computeGaussian = function (n, theta) {
            return ((1.0 / Math.sqrt(2 * Math.PI * theta)) * Math.exp(-(n * n) / (2 * theta * theta)));
        };
        
        // Look up how many samples our gaussian blur effect supports.
        var sampleCount = 15;

        // Create temporary arrays for computing our filter settings.
        // The first sample always has a zero offset.
        var sampleWeights = [ _computeGaussian(0, blurAmount) ];
        var sampleOffsets = [ 0, 0 ];

        // Maintain a sum of all the weighting values.
        var totalWeights = sampleWeights[0];

        // Add pairs of additional sample taps, positioned
        // along a line in both directions from the center.
        var i, len;
        for (i = 0, len = Math.floor(sampleCount / 2); i < len; i++) {
            // Store weights for the positive and negative taps.
            var weight = _computeGaussian(i + 1, blurAmount);
            sampleWeights.push(weight, weight);
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
            sampleOffsets.push(dx * sampleOffset, dy * sampleOffset, -dx * sampleOffset, -dy * sampleOffset);
        }

        // Normalize the list of sample weightings, so they will always sum to one.
        for (i = 0, len = sampleWeights.length; i < len; i++) {
            sampleWeights[i] /= totalWeights;
        }

        return {
            weights: sampleWeights,
            offsets: sampleOffsets
        };
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
                "#ifdef GL_ES\n",
                "precision highp float;",
                "#endif",
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
                "#ifdef GL_ES\n",
                "precision highp float;",
                "#endif",
                "",
                "#define SAMPLE_COUNT 15",
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
                "#ifdef GL_ES\n",
                "precision highp float;",
                "#endif",
                "",
                "varying vec2 vUv0;",
                "",
                "uniform sampler2D uBaseTexture;",
                "uniform sampler2D uBloomTexture;",
                "uniform float uBloomIntensity;",
                "uniform float uBaseIntensity;",
                "uniform float uBloomSaturation;",
                "uniform float uBaseSaturation;",
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

            var passThroughShader = new pc.gfx.Shader(pc.gfx.ShaderType.VERTEX, passThroughVert);
            var extractShader = new pc.gfx.Shader(pc.gfx.ShaderType.FRAGMENT, bloomExtractFrag);
            var blurShader = new pc.gfx.Shader(pc.gfx.ShaderType.FRAGMENT, gaussianBlurFrag);
            var combineShader = new pc.gfx.Shader(pc.gfx.ShaderType.FRAGMENT, bloomCombineFrag);
            programs["extract"] = new pc.gfx.Program(passThroughShader, extractShader);
            programs["blur"] = new pc.gfx.Program(passThroughShader, blurShader);
            programs["combine"] = new pc.gfx.Program(passThroughShader, combineShader);

            var backBuffer = pc.gfx.FrameBuffer.getBackBuffer();
            width = backBuffer.getWidth();
            height = backBuffer.getHeight();

            for (var i = 0; i < 2; i++) {
                var buffer = new pc.gfx.FrameBuffer(width >> 1, height >> 1, false);
                buffer.getTexture().setFilterMode(pc.gfx.TextureFilter.LINEAR, pc.gfx.TextureFilter.LINEAR);
                buffer.getTexture().setAddressMode(pc.gfx.TextureAddress.CLAMP_TO_EDGE, pc.gfx.TextureAddress.CLAMP_TO_EDGE);
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
            var defaults = {
                bloomThreshold: 0.25, 
                blurAmount: 4,
                bloomIntensity: 1.25, 
                baseIntensity: 1,
                bloomSaturation: 1,
                baseSaturation: 1
            };
            if (options === undefined) {
                options = options || defaults;
            } else {
                for (var index in defaults) {
                    if (typeof options[index] == "undefined") options[index] = defaults[index];
                }
            }

            var device = pc.gfx.Device.getCurrent();
            var scope = device.scope;

            var _drawFullscreenQuad = function (dst, program) {
                device.setRenderTarget(dst);
                device.updateBegin();
                device.updateLocalState({
                    depthTest: false,
                    depthWrite: false
                });
                device.setVertexBuffer(vertexBuffer, 0);
                device.setProgram(program);
                device.draw({
                    primitiveType: pc.gfx.PrimType.TRIANGLE_STRIP,
                    base: 0,
                    count: 4,
                    useIndexBuffer: false
                });
                device.clearLocalState();
                device.updateEnd();
            }

            // Pass 1: draw the scene into rendertarget 1, using a
            // shader that extracts only the brightest parts of the image.
            scope.resolve("uBloomThreshold").setValue(options.bloomThreshold);
            scope.resolve("uBaseTexture").setValue(inputTarget.getFrameBuffer().getTexture());
            _drawFullscreenQuad(targets[0], programs["extract"]);
            
            // Pass 2: draw from rendertarget 1 into rendertarget 2,
            // using a shader to apply a horizontal gaussian blur filter.
            var blurValues;
            blurValues = getBlurValues(1.0 / targets[1].getFrameBuffer().getWidth(), 0, options.blurAmount);
            scope.resolve("uBlurWeights[0]").setValue(blurValues.weights);
            scope.resolve("uBlurOffsets[0]").setValue(blurValues.offsets);
            scope.resolve("uBloomTexture").setValue(targets[0].getFrameBuffer().getTexture());
            _drawFullscreenQuad(targets[1], programs["blur"]);

            // Pass 3: draw from rendertarget 2 back into rendertarget 1,
            // using a shader to apply a vertical gaussian blur filter.
            blurValues = getBlurValues(0, 1.0 / targets[0].getFrameBuffer().getHeight(), options.blurAmount);
            scope.resolve("uBlurWeights[0]").setValue(blurValues.weights);
            scope.resolve("uBlurOffsets[0]").setValue(blurValues.offsets);
            scope.resolve("uBloomTexture").setValue(targets[1].getFrameBuffer().getTexture());
            _drawFullscreenQuad(targets[0], programs["blur"]);
            
            // Pass 4: draw both rendertarget 1 and the original scene
            // image back into the main backbuffer, using a shader that
            // combines them to produce the final bloomed result.
            scope.resolve("uBloomIntensity").setValue(options.bloomIntensity);
            scope.resolve("uBaseIntensity").setValue(options.baseIntensity);
            scope.resolve("uBloomSaturation").setValue(options.bloomSaturation);
            scope.resolve("uBaseSaturation").setValue(options.baseSaturation);
            scope.resolve("uBloomTexture").setValue(targets[0].getFrameBuffer().getTexture());
            scope.resolve("uBaseTexture").setValue(inputTarget.getFrameBuffer().getTexture());
            _drawFullscreenQuad(outputTarget, programs["combine"]);
        }
    };
} ();
