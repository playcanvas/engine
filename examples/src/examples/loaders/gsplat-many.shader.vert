uniform float uTime;
varying float height;

void animate(inout vec3 center) {
    // modify center
    float heightIntensity = center.y * 0.2;
    center.x += sin(uTime * 5.0 + center.y) * 0.3 * heightIntensity;

    // output y-coordinate
    height = center.y;
}

uniform vec3 view_position;

uniform sampler2D splatColor;

varying mediump vec2 texCoord;
varying mediump vec4 color;

mediump vec4 discardVec = vec4(0.0, 0.0, 2.0, 1.0);

void main(void)
{
    // calculate splat uv
    if (!calcSplatUV()) {
        gl_Position = discardVec;
        return;
    }

    // get center
    vec3 center = getCenter();

    animate(center);

    // handle transforms
    mat4 model_view = matrix_view * matrix_model;
    vec4 splat_cam = model_view * vec4(center, 1.0);

    // cull behind camera
    if (splat_cam.z > 0.0) {
        gl_Position = discardVec;
        return;
    }

    vec4 splat_proj = matrix_projection * splat_cam;

    // ensure gaussians are not clipped by camera near and far
    splat_proj.z = clamp(splat_proj.z, -abs(splat_proj.w), abs(splat_proj.w));

    // get covariance
    vec3 covA, covB;
    getCovariance(covA, covB);

    vec4 v1v2 = calcV1V2(splat_cam.xyz, covA, covB, transpose(mat3(model_view)));

    // get color
    color = texelFetch(splatColor, splatUV, 0);

    // calculate scale based on alpha
    float scale = min(1.0, sqrt(-log(1.0 / 255.0 / color.a)) / 2.0);

    v1v2 *= scale;

    // early out tiny splats
    if (dot(v1v2.xy, v1v2.xy) < 4.0 && dot(v1v2.zw, v1v2.zw) < 4.0) {
        gl_Position = discardVec;
        return;
    }

    gl_Position = splat_proj + vec4((vertex_position.x * v1v2.xy + vertex_position.y * v1v2.zw) / viewport * splat_proj.w, 0, 0);

    texCoord = vertex_position.xy * scale / 2.0;

    #ifdef USE_SH1
        vec4 worldCenter = matrix_model * vec4(center, 1.0);
        vec3 viewDir = normalize((worldCenter.xyz / worldCenter.w - view_position) * mat3(matrix_model));
        color.xyz = max(color.xyz + evalSH(viewDir), 0.0);
    #endif

    #ifndef DITHER_NONE
        id = float(splatId);
    #endif
}