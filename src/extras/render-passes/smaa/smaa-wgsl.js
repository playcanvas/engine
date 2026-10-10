const smaaEdgeWGSL = /* wgsl */`
    var smaaColorTexture: texture_2d<f32>;
    var smaaColorTextureSampler: sampler;
    uniform smaaMetrics: vec4f;
    varying uv0: vec2f;

    fn sampleColor(coord: vec2f) -> vec3f {
        return textureSampleLevel(smaaColorTexture, smaaColorTextureSampler, coord, 0.0).rgb;
    }

    @fragment
    fn fragmentMain(input: FragmentInput) -> FragmentOutput {
        var output: FragmentOutput;
        let uv = input.uv0;
        let texel = uniform.smaaMetrics.xy;
        let luma = vec3f(0.2126, 0.7152, 0.0722);
        let current = dot(sampleColor(uv), luma);
        let left = dot(sampleColor(uv + vec2f(-texel.x, 0.0)), luma);
        let top = dot(sampleColor(uv + vec2f(0.0, -texel.y)), luma);
        var delta = vec4f(abs(current - left), abs(current - top), 0.0, 0.0);
        var edges = step(vec2f(0.05), delta.xy);

        if (dot(edges, vec2f(1.0)) == 0.0) {
            discard;
        }

        let right = dot(sampleColor(uv + vec2f(texel.x, 0.0)), luma);
        let bottom = dot(sampleColor(uv + vec2f(0.0, texel.y)), luma);
        delta.z = abs(current - right);
        delta.w = abs(current - bottom);
        var maxDelta = max(delta.xy, delta.zw);

        let leftLeft = dot(sampleColor(uv + vec2f(-2.0 * texel.x, 0.0)), luma);
        let topTop = dot(sampleColor(uv + vec2f(0.0, -2.0 * texel.y)), luma);
        delta.z = abs(left - leftLeft);
        delta.w = abs(top - topTop);
        maxDelta = max(maxDelta, delta.zw);
        let finalDelta = max(maxDelta.x, maxDelta.y);
        edges *= step(vec2f(finalDelta), 2.0 * delta.xy);

        output.color = vec4f(edges, 0.0, 0.0);
        return output;
    }
`;

const smaaWeightsWGSL = /* wgsl */`
    var smaaEdgesTexture: texture_2d<f32>;
    var smaaEdgesTextureSampler: sampler;
    var smaaAreaTexture: texture_2d<f32>;
    var smaaAreaTextureSampler: sampler;
    var smaaSearchTexture: texture_2d<f32>;
    var smaaSearchTextureSampler: sampler;
    uniform smaaMetrics: vec4f;
    varying uv0: vec2f;

    fn sampleEdges(coord: vec2f) -> vec2f {
        return textureSampleLevel(smaaEdgesTexture, smaaEdgesTextureSampler, coord, 0.0).rg;
    }

    fn sampleEdgesOffset(coord: vec2f, offset: vec2f) -> vec2f {
        return sampleEdges(coord + offset * uniform.smaaMetrics.xy);
    }

    fn decodeDiagBilinear2(initialEdges: vec2f) -> vec2f {
        var edges = initialEdges;
        edges.x *= abs(5.0 * edges.x - 3.75);
        return round(edges);
    }

    fn decodeDiagBilinear4(initialEdges: vec4f) -> vec4f {
        var edges = initialEdges;
        edges.x *= abs(5.0 * edges.x - 3.75);
        edges.z *= abs(5.0 * edges.z - 3.75);
        return round(edges);
    }

    struct DiagSearchResult {
        distanceAndEdge: vec2f,
        edges: vec2f
    }

    fn searchDiag1(initialCoord: vec2f, direction: vec2f) -> DiagSearchResult {
        var coord = vec4f(initialCoord, -1.0, 1.0);
        var edges = vec2f(0.0);
        loop {
            if (!(coord.z < 15.0 && coord.w > 0.9)) { break; }
            coord.x += uniform.smaaMetrics.x * direction.x;
            coord.y += uniform.smaaMetrics.y * direction.y;
            coord.z += 1.0;
            edges = sampleEdges(coord.xy);
            coord.w = dot(edges, vec2f(0.5));
        }
        return DiagSearchResult(coord.zw, edges);
    }

    fn searchDiag2(initialCoord: vec2f, direction: vec2f) -> DiagSearchResult {
        var coord = vec4f(initialCoord, -1.0, 1.0);
        coord.x += 0.25 * uniform.smaaMetrics.x;
        var edges = vec2f(0.0);
        loop {
            if (!(coord.z < 15.0 && coord.w > 0.9)) { break; }
            coord.x += uniform.smaaMetrics.x * direction.x;
            coord.y += uniform.smaaMetrics.y * direction.y;
            coord.z += 1.0;
            edges = decodeDiagBilinear2(sampleEdges(coord.xy));
            coord.w = dot(edges, vec2f(0.5));
        }
        return DiagSearchResult(coord.zw, edges);
    }

    fn areaDiag(distance: vec2f, edges: vec2f) -> vec2f {
        var coord = 20.0 * edges + distance;
        coord = vec2f(1.0 / 160.0, 1.0 / 560.0) * coord +
            0.5 * vec2f(1.0 / 160.0, 1.0 / 560.0);
        coord.x += 0.5;
        return textureSampleLevel(smaaAreaTexture, smaaAreaTextureSampler, coord, 0.0).rg;
    }

    fn calculateDiagWeights(uv: vec2f, initialEdges: vec2f) -> vec2f {
        var weights = vec2f(0.0);
        var distance = vec4f(0.0);
        var result: DiagSearchResult;

        if (initialEdges.x > 0.0) {
            result = searchDiag1(uv, vec2f(-1.0, 1.0));
            distance.x = result.distanceAndEdge.x + select(0.0, 1.0, result.edges.y > 0.9);
            distance.z = result.distanceAndEdge.y;
        }
        result = searchDiag1(uv, vec2f(1.0, -1.0));
        distance.y = result.distanceAndEdge.x;
        distance.w = result.distanceAndEdge.y;

        if (distance.x + distance.y > 2.0) {
            let coords = uv.xyxy + vec4f(
                -distance.x + 0.25,
                distance.x,
                distance.y,
                -distance.y - 0.25
            ) * uniform.smaaMetrics.xyxy;
            let left = sampleEdgesOffset(coords.xy, vec2f(-1.0, 0.0));
            let right = sampleEdgesOffset(coords.zw, vec2f(1.0, 0.0));
            let decoded = decodeDiagBilinear4(vec4f(left, right));
            let crossing = decoded.yxwz;
            var combined = 2.0 * crossing.xz + crossing.yw;
            combined.x = select(combined.x, 0.0, distance.z >= 0.9);
            combined.y = select(combined.y, 0.0, distance.w >= 0.9);
            weights += areaDiag(distance.xy, combined);
        }

        result = searchDiag2(uv, vec2f(-1.0, -1.0));
        distance.x = result.distanceAndEdge.x;
        distance.z = result.distanceAndEdge.y;
        if (sampleEdgesOffset(uv, vec2f(1.0, 0.0)).x > 0.0) {
            result = searchDiag2(uv, vec2f(1.0, 1.0));
            distance.y = result.distanceAndEdge.x + select(0.0, 1.0, result.edges.y > 0.9);
            distance.w = result.distanceAndEdge.y;
        } else {
            distance.y = 0.0;
            distance.w = 0.0;
        }

        if (distance.x + distance.y > 2.0) {
            let coords = uv.xyxy + vec4f(
                -distance.x,
                -distance.x,
                distance.y,
                distance.y
            ) * uniform.smaaMetrics.xyxy;
            let left = sampleEdgesOffset(coords.xy, vec2f(-1.0, 0.0));
            let leftBelow = sampleEdgesOffset(coords.xy, vec2f(0.0, -1.0));
            let right = sampleEdgesOffset(coords.zw, vec2f(1.0, 0.0));
            var combined = 2.0 * vec2f(left.y, right.y) + vec2f(leftBelow.x, right.x);
            combined.x = select(combined.x, 0.0, distance.z >= 0.9);
            combined.y = select(combined.y, 0.0, distance.w >= 0.9);
            weights += areaDiag(distance.xy, combined).yx;
        }

        return weights;
    }

    fn searchLength(edges: vec2f, offset: f32) -> f32 {
        var scale = vec2f(66.0, 33.0) * vec2f(0.5, -1.0);
        var bias = vec2f(66.0, 33.0) * vec2f(offset, 1.0);
        scale += vec2f(-1.0, 1.0);
        bias += vec2f(0.5, -0.5);
        scale /= vec2f(64.0, 16.0);
        bias /= vec2f(64.0, 16.0);
        return textureSampleLevel(
            smaaSearchTexture,
            smaaSearchTextureSampler,
            scale * edges + bias,
            0.0
        ).r;
    }

    fn searchXLeft(initialCoord: vec2f, end: f32) -> f32 {
        var coord = initialCoord;
        var edges = vec2f(0.0, 1.0);
        loop {
            if (!(coord.x > end && edges.y > 0.8281 && edges.x == 0.0)) { break; }
            edges = sampleEdges(coord);
            coord -= vec2f(2.0 * uniform.smaaMetrics.x, 0.0);
        }
        let offset = -255.0 / 127.0 * searchLength(edges, 0.0) + 3.25;
        return uniform.smaaMetrics.x * offset + coord.x;
    }

    fn searchXRight(initialCoord: vec2f, end: f32) -> f32 {
        var coord = initialCoord;
        var edges = vec2f(0.0, 1.0);
        loop {
            if (!(coord.x < end && edges.y > 0.8281 && edges.x == 0.0)) { break; }
            edges = sampleEdges(coord);
            coord += vec2f(2.0 * uniform.smaaMetrics.x, 0.0);
        }
        let offset = -255.0 / 127.0 * searchLength(edges, 0.5) + 3.25;
        return -uniform.smaaMetrics.x * offset + coord.x;
    }

    fn searchYUp(initialCoord: vec2f, end: f32) -> f32 {
        var coord = initialCoord;
        var edges = vec2f(1.0, 0.0);
        loop {
            if (!(coord.y > end && edges.x > 0.8281 && edges.y == 0.0)) { break; }
            edges = sampleEdges(coord);
            coord -= vec2f(0.0, 2.0 * uniform.smaaMetrics.y);
        }
        let offset = -255.0 / 127.0 * searchLength(edges.yx, 0.0) + 3.25;
        return uniform.smaaMetrics.y * offset + coord.y;
    }

    fn searchYDown(initialCoord: vec2f, end: f32) -> f32 {
        var coord = initialCoord;
        var edges = vec2f(1.0, 0.0);
        loop {
            if (!(coord.y < end && edges.x > 0.8281 && edges.y == 0.0)) { break; }
            edges = sampleEdges(coord);
            coord += vec2f(0.0, 2.0 * uniform.smaaMetrics.y);
        }
        let offset = -255.0 / 127.0 * searchLength(edges.yx, 0.5) + 3.25;
        return -uniform.smaaMetrics.y * offset + coord.y;
    }

    fn area(distance: vec2f, edge1: f32, edge2: f32) -> vec2f {
        var coord = vec2f(16.0) * round(4.0 * vec2f(edge1, edge2)) + distance;
        coord = vec2f(1.0 / 160.0, 1.0 / 560.0) * coord +
            0.5 * vec2f(1.0 / 160.0, 1.0 / 560.0);
        return textureSampleLevel(smaaAreaTexture, smaaAreaTextureSampler, coord, 0.0).rg;
    }

    fn horizontalCorners(initialWeights: vec2f, coord: vec4f, distance: vec2f) -> vec2f {
        var weights = initialWeights;
        let leftRight = step(distance, distance.yx);
        var rounding = 0.75 * leftRight;
        rounding /= leftRight.x + leftRight.y;
        var factor = vec2f(1.0);
        factor.x -= rounding.x * sampleEdgesOffset(coord.xy, vec2f(0.0, 1.0)).x;
        factor.x -= rounding.y * sampleEdgesOffset(coord.zw, vec2f(1.0, 1.0)).x;
        factor.y -= rounding.x * sampleEdgesOffset(coord.xy, vec2f(0.0, -2.0)).x;
        factor.y -= rounding.y * sampleEdgesOffset(coord.zw, vec2f(1.0, -2.0)).x;
        weights *= clamp(factor, vec2f(0.0), vec2f(1.0));
        return weights;
    }

    fn verticalCorners(initialWeights: vec2f, coord: vec4f, distance: vec2f) -> vec2f {
        var weights = initialWeights;
        let leftRight = step(distance, distance.yx);
        var rounding = 0.75 * leftRight;
        rounding /= leftRight.x + leftRight.y;
        var factor = vec2f(1.0);
        factor.x -= rounding.x * sampleEdgesOffset(coord.xy, vec2f(1.0, 0.0)).y;
        factor.x -= rounding.y * sampleEdgesOffset(coord.zw, vec2f(1.0, 1.0)).y;
        factor.y -= rounding.x * sampleEdgesOffset(coord.xy, vec2f(-2.0, 0.0)).y;
        factor.y -= rounding.y * sampleEdgesOffset(coord.zw, vec2f(-2.0, 1.0)).y;
        weights *= clamp(factor, vec2f(0.0), vec2f(1.0));
        return weights;
    }

    @fragment
    fn fragmentMain(input: FragmentInput) -> FragmentOutput {
        var output: FragmentOutput;
        let uv = input.uv0;
        let metrics = uniform.smaaMetrics;
        let pixelCoord = uv * metrics.zw;
        let offset0 = uv.xyxy + metrics.xyxy * vec4f(-0.25, -0.125, 1.25, -0.125);
        let offset1 = uv.xyxy + metrics.xyxy * vec4f(-0.125, -0.25, -0.125, 1.25);
        let offset2 = vec4f(
            offset0.x - 64.0 * metrics.x,
            offset0.z + 64.0 * metrics.x,
            offset1.y - 64.0 * metrics.y,
            offset1.w + 64.0 * metrics.y
        );
        var weights = vec4f(0.0);
        var edges = sampleEdges(uv);

        if (edges.y > 0.0) {
            let diagonalWeights = calculateDiagWeights(uv, edges);
            weights.x = diagonalWeights.x;
            weights.y = diagonalWeights.y;

            if (weights.x == -weights.y) {
                var coord = vec3f(0.0);
                coord.x = searchXLeft(offset0.xy, offset2.x);
                coord.y = offset1.y;
                let edge1 = sampleEdges(coord.xy).x;
                coord.z = searchXRight(offset0.zw, offset2.y);
                let distance = abs(round(metrics.zz * coord.xz - pixelCoord.xx));
                let edge2 = sampleEdgesOffset(coord.zy, vec2f(1.0, 0.0)).x;
                let areaWeights = area(sqrt(distance), edge1, edge2);
                weights.x = areaWeights.x;
                weights.y = areaWeights.y;
                let cornerWeights = horizontalCorners(
                    weights.xy,
                    vec4f(coord.x, uv.y, coord.z, uv.y),
                    distance
                );
                weights.x = cornerWeights.x;
                weights.y = cornerWeights.y;
            } else {
                edges.x = 0.0;
            }
        }

        if (edges.x > 0.0) {
            var coord = vec3f(0.0);
            coord.y = searchYUp(offset1.xy, offset2.z);
            coord.x = offset0.x;
            let edge1 = sampleEdges(coord.xy).y;
            coord.z = searchYDown(offset1.zw, offset2.w);
            let distance = abs(round(metrics.ww * coord.yz - pixelCoord.yy));
            let edge2 = sampleEdgesOffset(coord.xz, vec2f(0.0, 1.0)).y;
            let areaWeights = area(sqrt(distance), edge1, edge2);
            weights.z = areaWeights.x;
            weights.w = areaWeights.y;
            let cornerWeights = verticalCorners(
                weights.zw,
                vec4f(uv.x, coord.y, uv.x, coord.z),
                distance
            );
            weights.z = cornerWeights.x;
            weights.w = cornerWeights.y;
        }

        output.color = weights;
        return output;
    }
`;

const smaaNeighborhoodWGSL = /* wgsl */`
    var smaaColorTexture: texture_2d<f32>;
    var smaaColorTextureSampler: sampler;
    var smaaBlendTexture: texture_2d<f32>;
    var smaaBlendTextureSampler: sampler;
    uniform smaaMetrics: vec4f;
    varying uv0: vec2f;

    fn srgbToLinear(color: vec3f) -> vec3f {
        let low = color / 12.92;
        let high = pow((color + 0.055) / 1.055, vec3f(2.4));
        return select(high, low, color <= vec3f(0.04045));
    }

    fn linearToSrgb(color: vec3f) -> vec3f {
        let low = color * 12.92;
        let high = 1.055 * pow(color, vec3f(1.0 / 2.4)) - 0.055;
        return select(high, low, color <= vec3f(0.0031308));
    }

    fn sampleColor(coord: vec2f) -> vec4f {
        var color = textureSampleLevel(smaaColorTexture, smaaColorTextureSampler, coord, 0.0);
        color = vec4f(srgbToLinear(color.rgb), color.a);
        return color;
    }

    @fragment
    fn fragmentMain(input: FragmentInput) -> FragmentOutput {
        var output: FragmentOutput;
        let uv = input.uv0;
        let texel = uniform.smaaMetrics.xy;
        var weights = vec4f(0.0);
        weights.x = textureSample(smaaBlendTexture, smaaBlendTextureSampler, uv + vec2f(texel.x, 0.0)).a;
        weights.y = textureSample(smaaBlendTexture, smaaBlendTextureSampler, uv + vec2f(0.0, texel.y)).g;
        let currentWeights = textureSample(smaaBlendTexture, smaaBlendTextureSampler, uv);
        weights.w = currentWeights.x;
        weights.z = currentWeights.z;

        var color: vec4f;
        if (dot(weights, vec4f(1.0)) < 1e-5) {
            color = textureSampleLevel(smaaColorTexture, smaaColorTextureSampler, uv, 0.0);
            #ifdef SMAA_SRGB_TARGET
                color = vec4f(srgbToLinear(color.rgb), color.a);
            #endif
        } else {
            let horizontal = max(weights.x, weights.z) > max(weights.y, weights.w);
            var blendingOffset = vec4f(0.0, weights.y, 0.0, weights.w);
            var blendingWeight = weights.yw;
            if (horizontal) {
                blendingOffset = vec4f(weights.x, 0.0, weights.z, 0.0);
                blendingWeight = weights.xz;
            }
            blendingWeight /= dot(blendingWeight, vec2f(1.0));
            let coord = uv.xyxy + blendingOffset * vec4f(texel, -texel);
            color = blendingWeight.x * sampleColor(coord.xy) + blendingWeight.y * sampleColor(coord.zw);
            #ifndef SMAA_SRGB_TARGET
                color = vec4f(linearToSrgb(color.rgb), color.a);
            #endif
        }

        output.color = color;
        return output;
    }
`;

export { smaaEdgeWGSL, smaaWeightsWGSL, smaaNeighborhoodWGSL };
