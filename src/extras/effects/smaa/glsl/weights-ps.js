// SMAA blending weight calculation, ported from the reference implementation:
// Copyright (C) 2013 Jorge Jimenez, Jose I. Echevarria, Belen Masia, Fernando Navarro, Diego
// Gutierrez, distributed under the MIT license (http://www.iryoku.com/smaa/).
export default /* glsl */`
    varying vec2 uv0;
    uniform sampler2D smaaEdgesTexture;
    uniform sampler2D smaaAreaTexture;
    uniform sampler2D smaaSearchTexture;

    // 1 / width, 1 / height, width, height of the scene
    uniform vec4 smaaMetrics;

    // threshold, maximum search steps, maximum diagonal search steps, corner rounding
    uniform vec4 smaaParams;

    #define SMAA_AREATEX_MAX_DISTANCE 16.0
    #define SMAA_AREATEX_MAX_DISTANCE_DIAG 20.0

    // the size of a texel of the area texture - the 160 x 80 subtexture SMAA 1x reads
    #define SMAA_AREATEX_PIXEL_SIZE (1.0 / vec2(160.0, 80.0))
    #define SMAA_SEARCHTEX_SIZE vec2(66.0, 33.0)
    #define SMAA_SEARCHTEX_PACKED_SIZE vec2(64.0, 16.0)

    vec2 sampleEdges(vec2 uv) {
        return texture2DLod(smaaEdgesTexture, uv, 0.0).rg;
    }

    vec2 sampleEdgesOffset(vec2 uv, vec2 offset) {
        return sampleEdges(uv + offset * smaaMetrics.xy);
    }

    // ---- diagonal search ----

    // The edges are fetched with bilinear filtering at a 0.25 offset, reading two of them at once,
    // which this unpacks
    vec2 decodeDiagBilinearAccess(vec2 e) {
        e.r = e.r * abs(5.0 * e.r - 5.0 * 0.75);
        return round(e);
    }

    vec4 decodeDiagBilinearAccess(vec4 e) {
        e.rb = e.rb * abs(5.0 * e.rb - 5.0 * 0.75);
        return round(e);
    }

    // searches along a diagonal for the end of a line, returning the distance and whether the end
    // was found
    vec2 searchDiag1(vec2 texcoord, vec2 dir, out vec2 e) {
        vec4 coord = vec4(texcoord, -1.0, 1.0);
        vec3 t = vec3(smaaMetrics.xy, 1.0);
        float maxSteps = smaaParams.z - 1.0;
        e = vec2(0.0);
        while (coord.z < maxSteps && coord.w > 0.9) {
            coord.xyz = t * vec3(dir, 1.0) + coord.xyz;
            e = sampleEdges(coord.xy);
            coord.w = dot(e, vec2(0.5));
        }
        return coord.zw;
    }

    vec2 searchDiag2(vec2 texcoord, vec2 dir, out vec2 e) {
        vec4 coord = vec4(texcoord, -1.0, 1.0);
        coord.x += 0.25 * smaaMetrics.x;
        vec3 t = vec3(smaaMetrics.xy, 1.0);
        float maxSteps = smaaParams.z - 1.0;
        e = vec2(0.0);
        while (coord.z < maxSteps && coord.w > 0.9) {
            coord.xyz = t * vec3(dir, 1.0) + coord.xyz;

            // fetches both edges at once using bilinear filtering
            e = decodeDiagBilinearAccess(sampleEdges(coord.xy));
            coord.w = dot(e, vec2(0.5));
        }
        return coord.zw;
    }

    // the area below a diagonal line, from the second half of the area texture
    vec2 areaDiag(vec2 dist, vec2 e) {
        vec2 texcoord = vec2(SMAA_AREATEX_MAX_DISTANCE_DIAG) * e + dist;
        texcoord = SMAA_AREATEX_PIXEL_SIZE * texcoord + 0.5 * SMAA_AREATEX_PIXEL_SIZE;
        texcoord.x += 0.5;
        return texture2DLod(smaaAreaTexture, texcoord, 0.0).rg;
    }

    // the blending weights for the diagonal lines through the pixel
    vec2 calculateDiagWeights(vec2 texcoord, vec2 e) {
        vec2 weights = vec2(0.0);

        // the line ends
        vec4 d;
        vec2 end;
        if (e.r > 0.0) {
            d.xz = searchDiag1(texcoord, vec2(-1.0, 1.0), end);
            d.x += float(end.y > 0.9);
        } else {
            d.xz = vec2(0.0);
        }
        d.yw = searchDiag1(texcoord, vec2(1.0, -1.0), end);

        if (d.x + d.y > 2.0) {

            // the crossing edges
            vec4 coords = vec4(-d.x + 0.25, d.x, d.y, -d.y - 0.25) * smaaMetrics.xyxy + texcoord.xyxy;
            vec4 c;
            c.xy = sampleEdgesOffset(coords.xy, vec2(-1.0, 0.0));
            c.zw = sampleEdgesOffset(coords.zw, vec2(1.0, 0.0));
            c.yxwz = decodeDiagBilinearAccess(c.xyzw);

            // merges the crossing edges at each side into a single value, without the crossing
            // edge where the end of the line was not found
            vec2 cc = vec2(2.0) * c.xz + c.yw;
            cc = mix(cc, vec2(0.0), step(vec2(0.9), d.zw));

            weights += areaDiag(d.xy, cc);
        }

        // the other diagonal
        d.xz = searchDiag2(texcoord, vec2(-1.0, -1.0), end);
        if (sampleEdgesOffset(texcoord, vec2(1.0, 0.0)).r > 0.0) {
            d.yw = searchDiag2(texcoord, vec2(1.0, 1.0), end);
            d.y += float(end.y > 0.9);
        } else {
            d.yw = vec2(0.0);
        }

        if (d.x + d.y > 2.0) {
            vec4 coords = vec4(-d.x, -d.x, d.y, d.y) * smaaMetrics.xyxy + texcoord.xyxy;
            vec4 c;
            c.x = sampleEdgesOffset(coords.xy, vec2(-1.0, 0.0)).g;
            c.y = sampleEdgesOffset(coords.xy, vec2(0.0, -1.0)).r;
            c.zw = sampleEdgesOffset(coords.zw, vec2(1.0, 0.0)).gr;
            vec2 cc = vec2(2.0) * c.xz + c.yw;
            cc = mix(cc, vec2(0.0), step(vec2(0.9), d.zw));

            weights += areaDiag(d.xy, cc).gr;
        }

        return weights;
    }

    // ---- horizontal and vertical search ----

    // the length of the edge past the last two pixels fetched, which the search texture decodes
    // from their bilinear fetch
    float searchLength(vec2 e, float offset) {

        // the texture is flipped vertically, with the left and the right cases taking half of it
        // horizontally each
        vec2 scale = SMAA_SEARCHTEX_SIZE * vec2(0.5, -1.0);
        vec2 bias = SMAA_SEARCHTEX_SIZE * vec2(offset, 1.0);

        // scale and bias to access the texel centers, in the cropped texture
        scale += vec2(-1.0, 1.0);
        bias += vec2(0.5, -0.5);
        scale *= 1.0 / SMAA_SEARCHTEX_PACKED_SIZE;
        bias *= 1.0 / SMAA_SEARCHTEX_PACKED_SIZE;

        return texture2DLod(smaaSearchTexture, scale * e + bias, 0.0).r;
    }

    // searches for the end of a horizontal or vertical line, two pixels at a time, stopping at a
    // crossing edge
    float searchXLeft(vec2 texcoord, float end) {
        vec2 e = vec2(0.0, 1.0);
        while (texcoord.x > end && e.g > 0.8281 && e.r == 0.0) {
            e = sampleEdges(texcoord);
            texcoord = -vec2(2.0, 0.0) * smaaMetrics.xy + texcoord;
        }
        float offset = -(255.0 / 127.0) * searchLength(e, 0.0) + 3.25;
        return smaaMetrics.x * offset + texcoord.x;
    }

    float searchXRight(vec2 texcoord, float end) {
        vec2 e = vec2(0.0, 1.0);
        while (texcoord.x < end && e.g > 0.8281 && e.r == 0.0) {
            e = sampleEdges(texcoord);
            texcoord = vec2(2.0, 0.0) * smaaMetrics.xy + texcoord;
        }
        float offset = -(255.0 / 127.0) * searchLength(e, 0.5) + 3.25;
        return -smaaMetrics.x * offset + texcoord.x;
    }

    float searchYUp(vec2 texcoord, float end) {
        vec2 e = vec2(1.0, 0.0);
        while (texcoord.y > end && e.r > 0.8281 && e.g == 0.0) {
            e = sampleEdges(texcoord);
            texcoord = -vec2(0.0, 2.0) * smaaMetrics.xy + texcoord;
        }
        float offset = -(255.0 / 127.0) * searchLength(e.gr, 0.0) + 3.25;
        return smaaMetrics.y * offset + texcoord.y;
    }

    float searchYDown(vec2 texcoord, float end) {
        vec2 e = vec2(1.0, 0.0);
        while (texcoord.y < end && e.r > 0.8281 && e.g == 0.0) {
            e = sampleEdges(texcoord);
            texcoord = vec2(0.0, 2.0) * smaaMetrics.xy + texcoord;
        }
        float offset = -(255.0 / 127.0) * searchLength(e.gr, 0.5) + 3.25;
        return -smaaMetrics.y * offset + texcoord.y;
    }

    // the area below a horizontal or vertical line, given the distances to its ends and the
    // crossing edges there
    vec2 area(vec2 dist, float e1, float e2) {
        vec2 texcoord = vec2(SMAA_AREATEX_MAX_DISTANCE) * round(4.0 * vec2(e1, e2)) + dist;
        texcoord = SMAA_AREATEX_PIXEL_SIZE * texcoord + 0.5 * SMAA_AREATEX_PIXEL_SIZE;
        return texture2DLod(smaaAreaTexture, texcoord, 0.0).rg;
    }

    // ---- corner detection ----

    // reduces the blending at sharp corners, keeping them sharp - not at all with a corner rounding
    // of 1, the normalized smaaParams.w
    vec2 detectHorizontalCornerPattern(vec2 weights, vec4 texcoord, vec2 d) {
        vec2 leftRight = step(d.xy, d.yx);
        vec2 rounding = (1.0 - smaaParams.w) * leftRight;

        // reduces the blending for the pixels in the center of a line
        rounding /= leftRight.x + leftRight.y;

        vec2 factor = vec2(1.0);
        factor.x -= rounding.x * sampleEdgesOffset(texcoord.xy, vec2(0.0, 1.0)).r;
        factor.x -= rounding.y * sampleEdgesOffset(texcoord.zw, vec2(1.0, 1.0)).r;
        factor.y -= rounding.x * sampleEdgesOffset(texcoord.xy, vec2(0.0, -2.0)).r;
        factor.y -= rounding.y * sampleEdgesOffset(texcoord.zw, vec2(1.0, -2.0)).r;
        return weights * clamp(factor, 0.0, 1.0);
    }

    vec2 detectVerticalCornerPattern(vec2 weights, vec4 texcoord, vec2 d) {
        vec2 leftRight = step(d.xy, d.yx);
        vec2 rounding = (1.0 - smaaParams.w) * leftRight;
        rounding /= leftRight.x + leftRight.y;

        vec2 factor = vec2(1.0);
        factor.x -= rounding.x * sampleEdgesOffset(texcoord.xy, vec2(1.0, 0.0)).g;
        factor.x -= rounding.y * sampleEdgesOffset(texcoord.zw, vec2(1.0, 1.0)).g;
        factor.y -= rounding.x * sampleEdgesOffset(texcoord.xy, vec2(-2.0, 0.0)).g;
        factor.y -= rounding.y * sampleEdgesOffset(texcoord.zw, vec2(-2.0, 1.0)).g;
        return weights * clamp(factor, 0.0, 1.0);
    }

    void main(void) {
        vec2 texcoord = uv0;
        vec4 metrics = smaaMetrics;
        vec2 pixcoord = texcoord * metrics.zw;

        // the offsets of the searches, and the ends of their loops
        vec4 offset0 = metrics.xyxy * vec4(-0.25, -0.125, 1.25, -0.125) + texcoord.xyxy;
        vec4 offset1 = metrics.xyxy * vec4(-0.125, -0.25, -0.125, 1.25) + texcoord.xyxy;
        vec4 offset2 = metrics.xxyy * (vec4(-2.0, 2.0, -2.0, 2.0) * smaaParams.y) + vec4(offset0.xz, offset1.yw);

        vec4 weights = vec4(0.0);
        vec2 e = sampleEdges(texcoord);

        // an edge at the top
        if (e.g > 0.0) {

            // the diagonals first, unless disabled by no diagonal search steps
            if (smaaParams.z > 0.0) {
                weights.rg = calculateDiagWeights(texcoord, e);
            }

            // no diagonal line through the pixel, so a horizontal one
            if (weights.r == -weights.g) {
                vec2 d;
                vec3 coords;
                coords.x = searchXLeft(offset0.xy, offset2.x);
                coords.y = offset1.y;
                d.x = coords.x;

                // the crossing edges at the ends, fetched with bilinear filtering to read both of
                // a pair at once
                float e1 = texture2DLod(smaaEdgesTexture, coords.xy, 0.0).r;
                coords.z = searchXRight(offset0.zw, offset2.y);
                d.y = coords.z;

                // the distances in pixels, their square roots giving the area texture its range
                d = abs(round(metrics.zz * d - pixcoord.xx));
                vec2 sqrtD = sqrt(d);
                float e2 = sampleEdgesOffset(coords.zy, vec2(1.0, 0.0)).r;
                weights.rg = area(sqrtD, e1, e2);

                coords.y = texcoord.y;
                weights.rg = detectHorizontalCornerPattern(weights.rg, coords.xyzy, d);
            } else {

                // a diagonal line, which the vertical search would mistake for edges of its own
                e.r = 0.0;
            }
        }

        // an edge at the left
        if (e.r > 0.0) {
            vec2 d;
            vec3 coords;
            coords.y = searchYUp(offset1.xy, offset2.z);
            coords.x = offset0.x;
            d.x = coords.y;

            float e1 = texture2DLod(smaaEdgesTexture, coords.xy, 0.0).g;
            coords.z = searchYDown(offset1.zw, offset2.w);
            d.y = coords.z;

            d = abs(round(metrics.ww * d - pixcoord.yy));
            vec2 sqrtD = sqrt(d);
            float e2 = sampleEdgesOffset(coords.xz, vec2(0.0, 1.0)).g;
            weights.ba = area(sqrtD, e1, e2);

            coords.x = texcoord.x;
            weights.ba = detectVerticalCornerPattern(weights.ba, coords.xyxz, d);
        }

        gl_FragColor = weights;
    }
`;
