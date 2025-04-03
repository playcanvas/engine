// evaluation of a light with index {i}, driven by defines
export default /* glsl */`
#if defined(LIGHT{i})
    evaluateLight{i}();
#endif
`;
