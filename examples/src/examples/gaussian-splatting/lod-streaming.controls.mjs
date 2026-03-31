/**
 * @param {import('../../app/components/Example.mjs').ControlOptions} options - The options.
 * @returns {JSX.Element} The returned JSX Element.
 */
export const controls = ({ observer, ReactPCUI, React, jsx, fragment }) => {
    const { BindingTwoWay, LabelGroup, BooleanInput, Panel, SelectInput, SliderInput, Label } = ReactPCUI;
    const isWebGPU = observer.get('isWebGPU');
    return fragment(
        jsx(
            Panel,
            { headerText: 'Camera' },
            jsx(
                LabelGroup,
                { text: 'FOV' },
                jsx(SliderInput, {
                    binding: new BindingTwoWay(),
                    link: { observer, path: 'cameraFov' },
                    min: 10,
                    max: 120,
                    precision: 0
                })
            ),
            jsx(
                LabelGroup,
                { text: 'High Res' },
                jsx(BooleanInput, {
                    type: 'toggle',
                    binding: new BindingTwoWay(),
                    link: { observer, path: 'highRes' },
                    value: observer.get('highRes') || false
                })
            ),
            jsx(
                LabelGroup,
                { text: 'Tonemapping' },
                jsx(SelectInput, {
                    type: 'number',
                    binding: new BindingTwoWay(),
                    link: { observer, path: 'toneMapping' },
                    value: observer.get('toneMapping') ?? 0,
                    options: [
                        { v: 0, t: 'Linear' },
                        { v: 1, t: 'Filmic' },
                        { v: 2, t: 'Hejl' },
                        { v: 3, t: 'ACES' },
                        { v: 4, t: 'ACES2' },
                        { v: 5, t: 'Neutral' },
                        { v: 6, t: 'None' }
                    ]
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
            )
        ),
        jsx(
            Panel,
            { headerText: 'Settings' },
            jsx(
                LabelGroup,
                { text: 'Min Pixel Size' },
                jsx(SliderInput, {
                    binding: new BindingTwoWay(),
                    link: { observer, path: 'minPixelSize' },
                    min: 0,
                    max: 5,
                    precision: 1
                })
            ),
            jsx(
                LabelGroup,
                { text: 'Radial' },
                jsx(BooleanInput, {
                    type: 'toggle',
                    binding: new BindingTwoWay(),
                    link: { observer, path: 'radialSorting' },
                    value: observer.get('radialSorting') ?? true
                })
            ),
            isWebGPU && jsx(
                LabelGroup,
                { text: 'GPU Sorting' },
                jsx(BooleanInput, {
                    type: 'toggle',
                    binding: new BindingTwoWay(),
                    link: { observer, path: 'gpuSorting' },
                    value: observer.get('gpuSorting') || false
                })
            ),
            jsx(
                LabelGroup,
                { text: 'Compact' },
                jsx(BooleanInput, {
                    type: 'toggle',
                    binding: new BindingTwoWay(),
                    link: { observer, path: 'compact' },
                    value: observer.get('compact') || false
                })
            ),
            jsx(
                LabelGroup,
                { text: 'Colorize LOD' },
                jsx(BooleanInput, {
                    type: 'toggle',
                    binding: new BindingTwoWay(),
                    link: { observer, path: 'debugLod' },
                    value: observer.get('debugLod')
                })
            ),
            jsx(
                LabelGroup,
                { text: 'LOD Preset' },
                jsx(SelectInput, {
                    type: 'string',
                    binding: new BindingTwoWay(),
                    link: { observer, path: 'lodPreset' },
                    value: observer.get('lodPreset') || 'desktop',
                    options: [
                        { v: 'desktop-max', t: 'Desktop Max (0-5)' },
                        { v: 'desktop', t: 'Desktop (1-5)' },
                        { v: 'mobile-max', t: 'Mobile Max (2-5)' },
                        { v: 'mobile', t: 'Mobile (3-5)' }
                    ]
                })
            ),
            jsx(
                LabelGroup,
                { text: 'LOD Base Dist' },
                jsx(SliderInput, {
                    binding: new BindingTwoWay(),
                    link: { observer, path: 'lodBaseDistance' },
                    min: 1,
                    max: 50,
                    precision: 1
                })
            ),
            jsx(
                LabelGroup,
                { text: 'LOD Multiplier' },
                jsx(SliderInput, {
                    binding: new BindingTwoWay(),
                    link: { observer, path: 'lodMultiplier' },
                    min: 1.2,
                    max: 5,
                    precision: 1
                })
            ),
            jsx(
                LabelGroup,
                { text: 'Splat Budget' },
                jsx(SliderInput, {
                    binding: new BindingTwoWay(),
                    link: { observer, path: 'splatBudget' },
                    min: 0,
                    max: 40,
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
                { text: 'Resolution' },
                jsx(Label, {
                    binding: new BindingTwoWay(),
                    link: { observer, path: 'data.stats.resolution' },
                    value: observer.get('data.stats.resolution')
                })
            ),
            jsx(
                LabelGroup,
                { text: 'GSplat Count' },
                jsx(Label, {
                    binding: new BindingTwoWay(),
                    link: { observer, path: 'data.stats.gsplats' },
                    value: observer.get('data.stats.gsplats')
                })
            )
        )
    );
};
