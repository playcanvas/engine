pc.extend(pc.posteffect, function () {

    function EdgeDetect(graphicsDevice) {
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
                "",
                "uniform sampler2D uColorBuffer;",
                "varying vec2 vUv0;",
                "uniform vec2 uResolution;",
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
                "    gl_FragColor = vec4(0.5 * sqrt(cnv[0]*cnv[0]+cnv[1]*cnv[1]));",
                "}"
            ].join("\n")
        });

        this.vertexBuffer = pc.posteffect.createFullscreenQuad(graphicsDevice);

        // Uniforms
        this.resolution = new Float32Array(2);
    }

    EdgeDetect.prototype = {
        render: function (inputTarget, outputTarget, rect) {
            var device = this.device;
            var scope = device.scope;

            this.resolution[0] = 1 / inputTarget.width;
            this.resolution[1] = 1 / inputTarget.height;
            scope.resolve("uResolution").setValue(this.resolution);
            scope.resolve("uColorBuffer").setValue(inputTarget.colorBuffer);
            pc.posteffect.drawFullscreenQuad(device, outputTarget, this.vertexBuffer, this.shader, rect);
        }
    };

    return {
        EdgeDetect: EdgeDetect
    };
}());