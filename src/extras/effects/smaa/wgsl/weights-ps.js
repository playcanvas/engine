// SMAA blending weight calculation, ported from the reference implementation:
// Copyright (C) 2013 Jorge Jimenez, Jose I. Echevarria, Belen Masia, Fernando Navarro, Diego
// Gutierrez, distributed under the MIT license (http://www.iryoku.com/smaa/).
export default /* wgsl */`
    varying uv0: vec2f;
    var smaaEdgesTexture: texture_2d<f32>;
    var smaaEdgesTextureSampler: sampler;
    var smaaAreaTexture: texture_2d<f32>;
    var smaaAreaTextureSampler: sampler;
    var smaaSearchTexture: texture_2d<f32>;
    var smaaSearchTextureSampler: sampler;

    // 1 / width, 1 / height, width, height of the scene
    uniform smaaMetrics: vec4f;

    // threshold, maximum search steps, maximum diagonal search steps, corner rounding
    uniform smaaParams: vec4f;

    const SMAA_AREATEX_MAX_DISTANCE: f32 = 16.0;
    const SMAA_AREATEX_MAX_DISTANCE_DIAG: f32 = 20.0;

    // the size of a texel of the area texture - the 160 x 80 subtexture SMAA 1x reads
    const SMAA_AREATEX_PIXEL_SIZE: vec2f = vec2f(1.0 / 160.0, 1.0 / 80.0);
    const SMAA_SEARCHTEX_SIZE: vec2f = vec2f(66.0, 33.0);
    const SMAA_SEARCHTEX_PACKED_SIZE: vec2f = vec2f(64.0, 16.0);

    fn sampleEdges(uv: vec2f) -> vec2f {
        return textureSampleLevel(smaaEdgesTexture, smaaEdgesTextureSampler, uv, 0.0).rg;
    }

    fn sampleEdgesOffset(uv: vec2f, offset: vec2f) -> vec2f {
        return sampleEdges(uv + offset * uniform.smaaMetrics.xy);
    }

    // ---- diagonal search ----

    // The edges are fetched with bilinear filtering at a 0.25 offset, reading two of them at once,
    // which this unpacks
    fn decodeDiagBilinearAccess2(e: vec2f) -> vec2f {
        return round(vec2f(e.r * abs(5.0 * e.r - 5.0 * 0.75), e.g));
    }

    fn decodeDiagBilinearAccess4(e: vec4f) -> vec4f {
        return round(vec4f(e.r * abs(5.0 * e.r - 5.0 * 0.75), e.g, e.b * abs(5.0 * e.b - 5.0 * 0.75), e.a));
    }

    // a diagonal search: the distance and whether the end was found, and the last edges fetched
    struct DiagSearch {
        result: vec2f,
        e: vec2f
    }

    // searches along a diagonal for the end of a line
    fn searchDiag1(texcoord: vec2f, dir: vec2f) -> DiagSearch {
        var coord = vec4f(texcoord, -1.0, 1.0);
        let t = vec3f(uniform.smaaMetrics.xy, 1.0);
        let maxSteps = uniform.smaaParams.z - 1.0;
        var e = vec2f(0.0);
        while (coord.z < maxSteps && coord.w > 0.9) {
            coord = vec4f(t * vec3f(dir, 1.0) + coord.xyz, coord.w);
            e = sampleEdges(coord.xy);
            coord.w = dot(e, vec2f(0.5));
        }
        return DiagSearch(coord.zw, e);
    }

    fn searchDiag2(texcoord: vec2f, dir: vec2f) -> DiagSearch {
        var coord = vec4f(texcoord, -1.0, 1.0);
        coord.x += 0.25 * uniform.smaaMetrics.x;
        let t = vec3f(uniform.smaaMetrics.xy, 1.0);
        let maxSteps = uniform.smaaParams.z - 1.0;
        var e = vec2f(0.0);
        while (coord.z < maxSteps && coord.w > 0.9) {
            coord = vec4f(t * vec3f(dir, 1.0) + coord.xyz, coord.w);

            // fetches both edges at once using bilinear filtering
            e = decodeDiagBilinearAccess2(sampleEdges(coord.xy));
            coord.w = dot(e, vec2f(0.5));
        }
        return DiagSearch(coord.zw, e);
    }

    // the area below a diagonal line, from the second half of the area texture
    fn areaDiag(dist: vec2f, e: vec2f) -> vec2f {
        var texcoord = vec2f(SMAA_AREATEX_MAX_DISTANCE_DIAG) * e + dist;
        texcoord = SMAA_AREATEX_PIXEL_SIZE * texcoord + 0.5 * SMAA_AREATEX_PIXEL_SIZE;
        texcoord.x += 0.5;
        return textureSampleLevel(smaaAreaTexture, smaaAreaTextureSampler, texcoord, 0.0).rg;
    }

    // the blending weights for the diagonal lines through the pixel
    fn calculateDiagWeights(texcoord: vec2f, e: vec2f) -> vec2f {
        var weights = vec2f(0.0);
        let metrics = uniform.smaaMetrics;

        // the line ends
        var d = vec4f(0.0);
        if (e.r > 0.0) {
            let search = searchDiag1(texcoord, vec2f(-1.0, 1.0));
            d.x = search.result.x + select(0.0, 1.0, search.e.y > 0.9);
            d.z = search.result.y;
        }
        let search1 = searchDiag1(texcoord, vec2f(1.0, -1.0));
        d.y = search1.result.x;
        d.w = search1.result.y;

        if (d.x + d.y > 2.0) {

            // the crossing edges
            let coords = vec4f(-d.x + 0.25, d.x, d.y, -d.y - 0.25) * metrics.xyxy + texcoord.xyxy;
            let decoded = decodeDiagBilinearAccess4(vec4f(sampleEdgesOffset(coords.xy, vec2f(-1.0, 0.0)), sampleEdgesOffset(coords.zw, vec2f(1.0, 0.0))));
            let c = decoded.yxwz;

            // merges the crossing edges at each side into a single value, without the crossing
            // edge where the end of the line was not found
            var cc = vec2f(2.0) * c.xz + c.yw;
            cc = mix(cc, vec2f(0.0), step(vec2f(0.9), d.zw));

            weights += areaDiag(d.xy, cc);
        }

        // the other diagonal
        let search2 = searchDiag2(texcoord, vec2f(-1.0, -1.0));
        d.x = search2.result.x;
        d.z = search2.result.y;
        if (sampleEdgesOffset(texcoord, vec2f(1.0, 0.0)).r > 0.0) {
            let search3 = searchDiag2(texcoord, vec2f(1.0, 1.0));
            d.y = search3.result.x + select(0.0, 1.0, search3.e.y > 0.9);
            d.w = search3.result.y;
        } else {
            d.y = 0.0;
            d.w = 0.0;
        }

        if (d.x + d.y > 2.0) {
            let coords = vec4f(-d.x, -d.x, d.y, d.y) * metrics.xyxy + texcoord.xyxy;
            let right = sampleEdgesOffset(coords.zw, vec2f(1.0, 0.0));
            let c = vec4f(
                sampleEdgesOffset(coords.xy, vec2f(-1.0, 0.0)).g,
                sampleEdgesOffset(coords.xy, vec2f(0.0, -1.0)).r,
                right.g,
                right.r
            );
            var cc = vec2f(2.0) * c.xz + c.yw;
            cc = mix(cc, vec2f(0.0), step(vec2f(0.9), d.zw));

            weights += areaDiag(d.xy, cc).gr;
        }

        return weights;
    }

    // ---- horizontal and vertical search ----

    // the length of the edge past the last two pixels fetched, which the search texture decodes
    // from their bilinear fetch
    fn searchLength(e: vec2f, offset: f32) -> f32 {

        // the texture is flipped vertically, with the left and the right cases taking half of it
        // horizontally each
        var scale = SMAA_SEARCHTEX_SIZE * vec2f(0.5, -1.0);
        var bias = SMAA_SEARCHTEX_SIZE * vec2f(offset, 1.0);

        // scale and bias to access the texel centers, in the cropped texture
        scale += vec2f(-1.0, 1.0);
        bias += vec2f(0.5, -0.5);
        scale *= 1.0 / SMAA_SEARCHTEX_PACKED_SIZE;
        bias *= 1.0 / SMAA_SEARCHTEX_PACKED_SIZE;

        return textureSampleLevel(smaaSearchTexture, smaaSearchTextureSampler, scale * e + bias, 0.0).r;
    }

    // searches for the end of a horizontal or vertical line, two pixels at a time, stopping at a
    // crossing edge
    fn searchXLeft(start: vec2f, end: f32) -> f32 {
        var texcoord = start;
        var e = vec2f(0.0, 1.0);
        while (texcoord.x > end && e.g > 0.8281 && e.r == 0.0) {
            e = sampleEdges(texcoord);
            texcoord = -vec2f(2.0, 0.0) * uniform.smaaMetrics.xy + texcoord;
        }
        let offset = -(255.0 / 127.0) * searchLength(e, 0.0) + 3.25;
        return uniform.smaaMetrics.x * offset + texcoord.x;
    }

    fn searchXRight(start: vec2f, end: f32) -> f32 {
        var texcoord = start;
        var e = vec2f(0.0, 1.0);
        while (texcoord.x < end && e.g > 0.8281 && e.r == 0.0) {
            e = sampleEdges(texcoord);
            texcoord = vec2f(2.0, 0.0) * uniform.smaaMetrics.xy + texcoord;
        }
        let offset = -(255.0 / 127.0) * searchLength(e, 0.5) + 3.25;
        return -uniform.smaaMetrics.x * offset + texcoord.x;
    }

    fn searchYUp(start: vec2f, end: f32) -> f32 {
        var texcoord = start;
        var e = vec2f(1.0, 0.0);
        while (texcoord.y > end && e.r > 0.8281 && e.g == 0.0) {
            e = sampleEdges(texcoord);
            texcoord = -vec2f(0.0, 2.0) * uniform.smaaMetrics.xy + texcoord;
        }
        let offset = -(255.0 / 127.0) * searchLength(e.gr, 0.0) + 3.25;
        return uniform.smaaMetrics.y * offset + texcoord.y;
    }

    fn searchYDown(start: vec2f, end: f32) -> f32 {
        var texcoord = start;
        var e = vec2f(1.0, 0.0);
        while (texcoord.y < end && e.r > 0.8281 && e.g == 0.0) {
            e = sampleEdges(texcoord);
            texcoord = vec2f(0.0, 2.0) * uniform.smaaMetrics.xy + texcoord;
        }
        let offset = -(255.0 / 127.0) * searchLength(e.gr, 0.5) + 3.25;
        return -uniform.smaaMetrics.y * offset + texcoord.y;
    }

    // the area below a horizontal or vertical line, given the distances to its ends and the
    // crossing edges there
    fn area(dist: vec2f, e1: f32, e2: f32) -> vec2f {
        var texcoord = vec2f(SMAA_AREATEX_MAX_DISTANCE) * round(4.0 * vec2f(e1, e2)) + dist;
        texcoord = SMAA_AREATEX_PIXEL_SIZE * texcoord + 0.5 * SMAA_AREATEX_PIXEL_SIZE;
        return textureSampleLevel(smaaAreaTexture, smaaAreaTextureSampler, texcoord, 0.0).rg;
    }

    // ---- corner detection ----

    // reduces the blending at sharp corners, keeping them sharp - not at all with a corner rounding
    // of 1, the normalized smaaParams.w
    fn detectHorizontalCornerPattern(weights: vec2f, texcoord: vec4f, d: vec2f) -> vec2f {
        let leftRight = step(d.xy, d.yx);
        var rounding = (1.0 - uniform.smaaParams.w) * leftRight;

        // reduces the blending for the pixels in the center of a line
        rounding /= leftRight.x + leftRight.y;

        var factor = vec2f(1.0);
        factor.x -= rounding.x * sampleEdgesOffset(texcoord.xy, vec2f(0.0, 1.0)).r;
        factor.x -= rounding.y * sampleEdgesOffset(texcoord.zw, vec2f(1.0, 1.0)).r;
        factor.y -= rounding.x * sampleEdgesOffset(texcoord.xy, vec2f(0.0, -2.0)).r;
        factor.y -= rounding.y * sampleEdgesOffset(texcoord.zw, vec2f(1.0, -2.0)).r;
        return weights * clamp(factor, vec2f(0.0), vec2f(1.0));
    }

    fn detectVerticalCornerPattern(weights: vec2f, texcoord: vec4f, d: vec2f) -> vec2f {
        let leftRight = step(d.xy, d.yx);
        var rounding = (1.0 - uniform.smaaParams.w) * leftRight;
        rounding /= leftRight.x + leftRight.y;

        var factor = vec2f(1.0);
        factor.x -= rounding.x * sampleEdgesOffset(texcoord.xy, vec2f(1.0, 0.0)).g;
        factor.x -= rounding.y * sampleEdgesOffset(texcoord.zw, vec2f(1.0, 1.0)).g;
        factor.y -= rounding.x * sampleEdgesOffset(texcoord.xy, vec2f(-2.0, 0.0)).g;
        factor.y -= rounding.y * sampleEdgesOffset(texcoord.zw, vec2f(-2.0, 1.0)).g;
        return weights * clamp(factor, vec2f(0.0), vec2f(1.0));
    }

    @fragment
    fn fragmentMain(input: FragmentInput) -> FragmentOutput {
        var output: FragmentOutput;
        let texcoord = uv0;
        let metrics = uniform.smaaMetrics;
        let pixcoord = texcoord * metrics.zw;

        // the offsets of the searches, and the ends of their loops
        let offset0 = metrics.xyxy * vec4f(-0.25, -0.125, 1.25, -0.125) + texcoord.xyxy;
        let offset1 = metrics.xyxy * vec4f(-0.125, -0.25, -0.125, 1.25) + texcoord.xyxy;
        let offset2 = metrics.xxyy * (vec4f(-2.0, 2.0, -2.0, 2.0) * uniform.smaaParams.y) + vec4f(offset0.xz, offset1.yw);

        var weights = vec4f(0.0);
        var e = sampleEdges(texcoord);

        // an edge at the top
        if (e.g > 0.0) {

            // the diagonals first, unless disabled by no diagonal search steps
            if (uniform.smaaParams.z > 0.0) {
                let diag = calculateDiagWeights(texcoord, e);
                weights = vec4f(diag, weights.zw);
            }

            // no diagonal line through the pixel, so a horizontal one
            if (weights.r == -weights.g) {
                let left = searchXLeft(offset0.xy, offset2.x);
                let y = offset1.y;

                // the crossing edges at the ends, fetched with bilinear filtering to read both of
                // a pair at once
                let e1 = textureSampleLevel(smaaEdgesTexture, smaaEdgesTextureSampler, vec2f(left, y), 0.0).r;
                let right = searchXRight(offset0.zw, offset2.y);

                // the distances in pixels, their square roots giving the area texture its range
                let d = abs(round(metrics.zz * vec2f(left, right) - pixcoord.xx));
                let sqrtD = sqrt(d);
                let e2 = sampleEdgesOffset(vec2f(right, y), vec2f(1.0, 0.0)).r;
                let horizontal = detectHorizontalCornerPattern(area(sqrtD, e1, e2), vec4f(left, texcoord.y, right, texcoord.y), d);
                weights = vec4f(horizontal, weights.zw);
            } else {

                // a diagonal line, which the vertical search would mistake for edges of its own
                e.r = 0.0;
            }
        }

        // an edge at the left
        if (e.r > 0.0) {
            let up = searchYUp(offset1.xy, offset2.z);
            let x = offset0.x;

            let e1 = textureSampleLevel(smaaEdgesTexture, smaaEdgesTextureSampler, vec2f(x, up), 0.0).g;
            let down = searchYDown(offset1.zw, offset2.w);

            let d = abs(round(metrics.ww * vec2f(up, down) - pixcoord.yy));
            let sqrtD = sqrt(d);
            let e2 = sampleEdgesOffset(vec2f(x, down), vec2f(0.0, 1.0)).g;
            let vertical = detectVerticalCornerPattern(area(sqrtD, e1, e2), vec4f(texcoord.x, up, texcoord.x, down), d);
            weights = vec4f(weights.xy, vertical);
        }

        output.color = weights;
        return output;
    }
`;
