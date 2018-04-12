attribute vec4 vertex_boneWeights;
attribute vec4 vertex_boneIndices;

uniform sampler2D texture_poseMap;
uniform vec2 texture_poseMapSize;

mat4 getBoneMatrix(const in float i)
{
    float j = i * 4.0;
    float x = mod(j, float(texture_poseMapSize.x));
    float y = floor(j / float(texture_poseMapSize.x));

    float dx = 1.0 / float(texture_poseMapSize.x);
    float dy = 1.0 / float(texture_poseMapSize.y);

    y = dy * (y + 0.5);

    vec4 v1 = texture2D(texture_poseMap, vec2(dx * (x + 0.5), y));
    vec4 v2 = texture2D(texture_poseMap, vec2(dx * (x + 1.5), y));
    vec4 v3 = texture2D(texture_poseMap, vec2(dx * (x + 2.5), y));
    vec4 v4 = texture2D(texture_poseMap, vec2(dx * (x + 3.5), y));

    mat4 bone = mat4(v1, v2, v3, v4);

    return bone;
}

