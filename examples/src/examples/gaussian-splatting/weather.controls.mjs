/**
 * @param {import('../../app/components/Example.mjs').ControlOptions} options - The options.
 * @returns {JSX.Element} The returned JSX Element.
 */
export const controls = ({ observer, ReactPCUI, React, jsx, fragment }) => {
    const { BindingTwoWay, BooleanInput, Label, LabelGroup, Panel, SliderInput, ColorPicker, SelectInput, VectorInput } = ReactPCUI;
    return fragment(
        jsx(
            Panel,
            { headerText: 'Renderer' },
            jsx(
                LabelGroup,
                { text: 'Renderer' },
                jsx(SelectInput, {
                    type: 'number',
                    binding: new BindingTwoWay(),
                    link: { observer, path: 'renderer' },
                    value: observer.get('renderer') ?? 0,
                    options: [
                        { v: 0, t: 'Auto' },
                        { v: 1, t: 'Raster (CPU Sort)' },
                        { v: 2, t: 'Raster (GPU Sort)' },
                        { v: 3, t: 'Compute' }
                    ]
                })
            )
        ),
        jsx(
            Panel,
            { headerText: 'Preset' },
            jsx(
                LabelGroup,
                { text: 'Type' },
                jsx(SelectInput, {
                    binding: new BindingTwoWay(),
                    link: { observer, path: 'preset' },
                    type: 'string',
                    options: [
                        { v: 'none', t: 'None' },
                        { v: 'snow', t: 'Snow' },
                        { v: 'rain', t: 'Rain' }
                    ]
                })
            ),
            jsx(
                LabelGroup,
                { text: 'Fog Density' },
                jsx(SliderInput, {
                    binding: new BindingTwoWay(),
                    link: { observer, path: 'fogDensity' },
                    min: 0,
                    max: 0.5,
                    precision: 3,
                    step: 0.001
                })
            ),
            jsx(
                LabelGroup,
                { text: 'Exposure' },
                jsx(SliderInput, {
                    binding: new BindingTwoWay(),
                    link: { observer, path: 'exposure' },
                    min: 0,
                    max: 5,
                    precision: 2,
                    step: 0.05
                })
            ),
            jsx(
                LabelGroup,
                { text: 'Splat Fog' },
                jsx(BooleanInput, {
                    binding: new BindingTwoWay(),
                    link: { observer, path: 'useFog' }
                })
            )
        ),
        jsx(
            Panel,
            { headerText: 'Animation' },
            jsx(
                LabelGroup,
                { text: 'Speed' },
                jsx(SliderInput, {
                    binding: new BindingTwoWay(),
                    link: { observer, path: 'speed' },
                    min: 0,
                    max: 40,
                    precision: 2,
                    step: 0.1
                })
            ),
            jsx(
                LabelGroup,
                { text: 'Drift' },
                jsx(SliderInput, {
                    binding: new BindingTwoWay(),
                    link: { observer, path: 'drift' },
                    min: 0,
                    max: 1,
                    precision: 2,
                    step: 0.01
                })
            ),
            jsx(
                LabelGroup,
                { text: 'Angle' },
                jsx(SliderInput, {
                    binding: new BindingTwoWay(),
                    link: { observer, path: 'angle' },
                    min: 0,
                    max: 360,
                    precision: 0,
                    step: 1
                })
            )
        ),
        jsx(
            Panel,
            { headerText: 'Particle Properties' },
            jsx(
                LabelGroup,
                { text: 'Color' },
                jsx(ColorPicker, {
                    binding: new BindingTwoWay(),
                    link: { observer, path: 'color' }
                })
            ),
            jsx(
                LabelGroup,
                { text: 'Opacity' },
                jsx(SliderInput, {
                    binding: new BindingTwoWay(),
                    link: { observer, path: 'opacity' },
                    min: 0,
                    max: 1,
                    precision: 2,
                    step: 0.05
                })
            ),
            jsx(
                LabelGroup,
                { text: 'Min Size' },
                jsx(SliderInput, {
                    binding: new BindingTwoWay(),
                    link: { observer, path: 'particleMinSize' },
                    min: 0,
                    max: 1,
                    precision: 2,
                    step: 0.01
                })
            ),
            jsx(
                LabelGroup,
                { text: 'Max Size' },
                jsx(SliderInput, {
                    binding: new BindingTwoWay(),
                    link: { observer, path: 'particleMaxSize' },
                    min: 0,
                    max: 1,
                    precision: 2,
                    step: 0.01
                })
            ),
            jsx(
                LabelGroup,
                { text: 'Elongate' },
                jsx(SliderInput, {
                    binding: new BindingTwoWay(),
                    link: { observer, path: 'elongate' },
                    min: 1,
                    max: 20,
                    precision: 1,
                    step: 0.5
                })
            )
        ),
        jsx(
            Panel,
            { headerText: 'Grid (rebuilds)' },
            jsx(
                LabelGroup,
                { text: 'Extents' },
                jsx(VectorInput, {
                    binding: new BindingTwoWay(),
                    link: { observer, path: 'extents' },
                    dimensions: 3
                })
            ),
            jsx(
                LabelGroup,
                { text: 'Density' },
                jsx(SliderInput, {
                    binding: new BindingTwoWay(),
                    link: { observer, path: 'density' },
                    min: 0.5,
                    max: 4,
                    precision: 1,
                    step: 0.1
                })
            )
        ),
        jsx(
            Panel,
            { headerText: 'Stats' },
            jsx(
                LabelGroup,
                { text: 'Particles' },
                jsx(Label, {
                    binding: new BindingTwoWay(),
                    link: { observer, path: 'particles' },
                    value: observer.get('particles')
                })
            )
        )
    );
};
