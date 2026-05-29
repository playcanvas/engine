#ifdef CAPS_MULTI_DRAW

    attribute int aInstanceId;

    uniform float uDrawOffsets[10];
    uniform sampler2D uInstanceMatrices;

    // We use a texture to store the instance's transformation matrix.
    mat4 getInstancedMatrix(int index) {
        int size = textureSize(uInstanceMatrices, 0).x;
        int j = index * 4;
        int x = j % size;
        int y = j / size;
        vec4 v1 = texelFetch(uInstanceMatrices, ivec2(x    , y), 0);
        vec4 v2 = texelFetch(uInstanceMatrices, ivec2(x + 1, y), 0);
        vec4 v3 = texelFetch(uInstanceMatrices, ivec2(x + 2, y), 0);
        vec4 v4 = texelFetch(uInstanceMatrices, ivec2(x + 3, y), 0);
        return mat4(v1, v2, v3, v4);
    }

    mat4 getModelMatrix() {
        // using gl_InstanceID leads to a system error, we will use a hack with vertices
        // We take the maximum offset for the previous instance types and add the current one.
        int drawOffset = int(uDrawOffsets[gl_DrawID]);
        int instanceIndex = drawOffset + aInstanceId;
        return matrix_model * getInstancedMatrix(instanceIndex);
    }

#endif