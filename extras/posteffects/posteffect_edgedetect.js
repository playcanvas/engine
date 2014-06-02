//----------------------------- POST EFFECT DEFINITION -----------------------------//
pc.extend(pc.posteffect, function () {

    /**
     * @name pc.posteffect.EdgeDetect
     * @class Edge Detection post effect using Sobel filter
     * @constructor Creates new instance of the post effect.
     * @extends pc.posteffect.PostEffect
     * @param {pc.gfx.Device} graphicsDevice The graphics device of the application
     */
    var EdgeDetect = function (graphicsDevice) {
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
                "",
                "uniform sampler2D uColorBuffer;",
                "varying vec2 vUv0;",
                "uniform vec2 uResolution;",
                "uniform float uIntensity;",
                "uniform vec4 uColor;",
                "",
                "mat3 G[2];",
                "",
                "const mat3 g0 = mat3( 1.0, 2.0, 1.0, 0.0, 0.0, 0.0, -1.0, -2.0, -1.0 );",
                "const mat3 g1 = mat3( 1.0, 0.0, -1.0, 2.0, 0.0, -2.0, 1.0, 0.0, -1.0 );",
                "",
                "void main(void)",
                "{",
                "    mat3 I;",
                "    float cnv[2];",
                "    vec3 sample;",
                "",
                "    G[0] = g0;",
                "    G[1] = g1;",
                "",
                     /* Fetch the 3x3 neighbourhood and use the RGB vector's length as intensity value */
                "    for (float i = 0.0; i < 3.0; i++)",
                "    {",
                "        for (float j = 0.0; j < 3.0; j++)",
                "        {",
                "            sample = texture2D(uColorBuffer, vUv0 + uResolution * vec2(i - 1.0, j - 1.0)).rgb;",
                "            I[int(i)][int(j)] = length(sample);",
                "         }",
                "    }",
                "",
                     /* Calculate the convolution values for all the masks */
                "    for (int i=0; i<2; i++)",
                "    {",
                "        float dp3 = dot(G[i][0], I[0]) + dot(G[i][1], I[1]) + dot(G[i][2], I[2]);",
                "        cnv[i] = dp3 * dp3; ",
                "    }",
                "",
                "    gl_FragColor = uIntensity * uColor * vec4(sqrt(cnv[0]*cnv[0]+cnv[1]*cnv[1]));",
                "}"
            ].join("\n")
        });

        // Uniforms
        this.resolution = new Float32Array(2);
        this.intensity = 1.0;
        this.color = new pc.Color(1,1,1,1);
    }

    EdgeDetect = pc.inherits(EdgeDetect, pc.posteffect.PostEffect);

    EdgeDetect.prototype = pc.extend(EdgeDetect.prototype, {
        render: function (inputTarget, outputTarget, rect) {
            var device = this.device;
            var scope = device.scope;

            this.resolution[0] = 1 / inputTarget.width;
            this.resolution[1] = 1 / inputTarget.height;
            scope.resolve("uResolution").setValue(this.resolution);
            scope.resolve("uColorBuffer").setValue(inputTarget.colorBuffer);
            scope.resolve("uColor").setValue(this.color.data);
            scope.resolve("uIntensity").setValue(this.intensity);
            pc.posteffect.drawFullscreenQuad(device, outputTarget, this.vertexBuffer, this.shader, rect);
        }
    });

    return {
        EdgeDetect: EdgeDetect
    };
}());

//----------------------------- SCRIPT ATTRIBUTES -----------------------------//
pc.script.attribute('intensity', 'number', 1, {
    min: 0,
    max: 2
});

pc.script.attribute('color', 'rgba', [0.5, 0.5, 0.5, 1]);

//----------------------------- SCRIPT DEFINITION -----------------------------//
pc.script.create('edgedetect', function (context) {
    var Edgedetect = function (entity) {
        this.entity = entity;
        this.effect = new pc.posteffect.EdgeDetect(context.graphicsDevice);
    };

    Edgedetect.prototype = {
        initialize: function () {
            this.on('set', this.onAttributeChanged, this);
            this.effect.intensity = this.intensity;
            this.effect.color = this.color;
        },

        onAttributeChanged: function (name, oldValue, newValue) {
            this.effect[name] = newValue;
        },

        onEnable: function () {
            this.entity.camera.postEffects.addEffect(this.effect);
        },

        onDisable: function () {
            this.entity.camera.postEffects.removeEffect(this.effect);
        }
    };

    return Edgedetect;
});
