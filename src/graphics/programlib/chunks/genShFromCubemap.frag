varying vec2 vUv0;
uniform samplerCube source;
uniform vec4 params;

struct sh {
    vec4 c, nx, px, ny, py, nz, pz;
    vec4 nxy, pxy, nyz, pyz, nzx, pzx;
    vec4 nfuck1, pfuck1, nfuck2, pfuck2;
};

vec4 saturate(vec4 x) {
    return clamp(x, vec4(0.0), vec4(1.0));
}

void lookup(inout sh data, samplerCube tex, vec3 dir) {
    vec4 val = textureCube(tex, fixSeamsStatic(dir, 0.75));
    data.c += val;
    vec4 x = val * dir.x;
    vec4 y = val * dir.y;
    vec4 z = val * dir.z;
    vec4 xy = val * dir.x * dir.y;
    vec4 yz = val * dir.y * dir.z;
    vec4 zx = val * dir.z * dir.x;
    vec4 fuck1 = val * (dir.x * dir.x - dir.y * dir.y);
    vec4 fuck2 = val * (3.0 * dir.z * dir.z - 1.0);
    data.nx += saturate(-x);
    data.px += saturate(x);
    data.ny += saturate(-y);
    data.py += saturate(y);
    data.nz += saturate(-z);
    data.pz += saturate(z);
    data.nxy += saturate(-xy);
    data.pxy += saturate(xy);
    data.nyz += saturate(-yz);
    data.pyz += saturate(yz);
    data.nzx += saturate(-zx);
    data.pzx += saturate(zx);
    data.nfuck1 += saturate(-fuck1);
    data.pfuck1 += saturate(fuck1);
    data.nfuck2 += saturate(-fuck2);
    data.pfuck2 += saturate(fuck2);
}

void lookup4(inout sh data, samplerCube tex, vec3 dir) {
    bvec3 nonzero = notEqual(dir, vec3(0.0));
    vec3 xdir = nonzero.x? vec3(0,1,0) : vec3(1,0,0);
    vec3 ydir = nonzero.x? vec3(0,0,1) : (nonzero.y? vec3(0,0,1) : vec3(0,1,0));
    for(int y=0; y<2; y++) {
        for(int x=0; x<2; x++) {
            vec2 offset = vec2(x, y) - vec2(0.5);
            lookup(data, tex, normalize(dir + xdir * offset.x + ydir * offset.y));
        }
    }
}

void main(void) {

    sh data;
    data.c = vec4(0.0);
    data.nx = vec4(0.0);
    data.px = vec4(0.0);
    data.ny = vec4(0.0);
    data.py = vec4(0.0);
    data.nz = vec4(0.0);
    data.pz = vec4(0.0);
    data.nxy = vec4(0.0);
    data.pxy = vec4(0.0);
    data.nyz = vec4(0.0);
    data.pyz = vec4(0.0);
    data.nzx = vec4(0.0);
    data.pzx = vec4(0.0);
    data.nfuck1 = vec4(0.0);
    data.pfuck1 = vec4(0.0);
    data.nfuck2 = vec4(0.0);
    data.pfuck2 = vec4(0.0);

    lookup4(data, source, vec3(-1,0,0));
    lookup4(data, source, vec3(1,0,0));
    lookup4(data, source, vec3(0,-1,0));
    lookup4(data, source, vec3(0,1,0));
    lookup4(data, source, vec3(0,0,-1));
    lookup4(data, source, vec3(0,0,1));

    int id = int(gl_FragCoord.x);
    if (id==0) {
        data.c *= 0.23529411764705882352941176470588;
    } else if (id==1) {
        data.c = data.nx * 0.47058823529411764705882352941176;
    } else if (id==2) {
        data.c = data.px * 0.47058823529411764705882352941176;
    } else if (id==3) {
        data.c = data.ny * 0.47058823529411764705882352941176;
    } else if (id==4) {
        data.c = data.py * 0.47058823529411764705882352941176;
    } else if (id==5) {
        data.c = data.nz * 0.47058823529411764705882352941176;
    } else if (id==6) {
        data.c = data.pz * 0.47058823529411764705882352941176;
    } else if (id==7) {
        data.c = data.nxy * 0.88235294117647058823529411764706;
    } else if (id==8) {
        data.c = data.pxy * 0.88235294117647058823529411764706;
    } else if (id==9) {
        data.c = data.nyz * 0.88235294117647058823529411764706;
    } else if (id==10) {
        data.c = data.pyz * 0.88235294117647058823529411764706;
    } else if (id==11) {
        data.c = data.nzx * 0.88235294117647058823529411764706;
    } else if (id==12) {
        data.c = data.pzx * 0.88235294117647058823529411764706;
    } else if (id==13) {
        data.c = data.nfuck1 * 0.07352941176470588235294117647059;
    } else if (id==14) {
        data.c = data.pfuck1 * 0.07352941176470588235294117647059;
    } else if (id==15) {
        data.c = data.nfuck2 * 0.22058823529411764705882352941176;
    } else if (id==16) {
        data.c = data.pfuck2 * 0.22058823529411764705882352941176;
    }

    gl_FragColor = data.c * 0.04166666666666666666666666666667 * 8.0; // 1.0 / 24.0;
}
