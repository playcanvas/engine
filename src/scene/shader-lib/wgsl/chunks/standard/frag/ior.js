export default /* wgsl */`
#ifdef STD_IOR_CONSTANT
    uniform material_refractionIndex: f32;
#endif

fn getIor() {
#ifdef STD_IOR_CONSTANT
    dIor = uniform.material_refractionIndex;
#else
    dIor = 1.0 / 1.5;
#endif
}
`;
