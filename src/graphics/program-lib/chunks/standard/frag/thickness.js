export default /* glsl */`
#ifdef MAPFLOAT
uniform float material_thickness;
#endif

#ifdef MAPTEXTURE
uniform sampler2D texture_thicknessMap;
#endif

void getThickness() {
    dThickness = 1.0;

    #ifdef MAPFLOAT
    dThickness *= material_thickness;
    #endif

    #ifdef MAPTEXTURE
    dThickness *= texture2D(texture_thicknessMap, $UV, textureBias).$CH;
    #endif

    #ifdef MAPVERTEX
    dThickness *= saturate(vVertexColor.$VC);
    #endif
}
`;
