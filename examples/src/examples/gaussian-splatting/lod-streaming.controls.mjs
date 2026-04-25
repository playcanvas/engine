/**
 * @param {import('../../app/components/Example.mjs').ControlOptions} options - The options.
 * @returns {JSX.Element} The returned JSX Element.
 */
export const controls = ({ observer, ReactPCUI, React, jsx, fragment }) => {
    const { BindingTwoWay, LabelGroup, BooleanInput, Panel, SelectInput, SliderInput, Label, TextInput } = ReactPCUI;
    return fragment(
        jsx(
            Panel,
            { headerText: 'Scene' },
            jsx(
                LabelGroup,
                { text: 'URL' },
                jsx(TextInput, {
                    binding: new BindingTwoWay(),
                    link: { observer, path: 'url' },
                    value: observer.get('url') || '',
                    placeholder: 'Enter gsplat URL...'
                })
            ),
            jsx(
                LabelGroup,
                { text: 'Orientation' },
                jsx(SelectInput, {
                    binding: new BindingTwoWay(),
                    link: { observer, path: 'orientation' },
                    type: 'number',
                    options: [
                        { v: 0, t: '0°' },
                        { v: 90, t: '90°' },
                        { v: 180, t: '180°' },
                        { v: 270, t: '270°' }
                    ]
                })
            ),
            jsx(
                LabelGroup,
                { text: 'Occluder' },
                jsx(BooleanInput, {
                    type: 'toggle',
                    binding: new BindingTwoWay(),
                    link: { observer, path: 'occluder' },
                    value: observer.get('occluder') || false
                })
            ),
            jsx(
                LabelGroup,
                { text: 'Environment' },
                jsx(SelectInput, {
                    type: 'string',
                    binding: new BindingTwoWay(),
                    link: { observer, path: 'environment' },
                    value: observer.get('environment') || 'none',
                    options: [
                        { v: 'none', t: 'None' },
                        { v: 'rosendal', t: 'Rosendal Sunset' },
                        { v: 'industrial-sunset', t: 'Industrial Sunset' },
                        { v: 'partly-cloudy', t: 'Partly Cloudy' },
                        { v: 'moonlit', t: 'Moonlit Sky' },
                        { v: 'sunflowers', t: 'Sunflowers' },
                        { v: 'table-mountain', t: 'Table Mountain' },
                        { v: 'cloud-layers', t: 'Cloud Layers' },
                        { v: 'night', t: 'Night Sky' }
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
            )
        ),
        jsx(
            Panel,
            { headerText: 'Camera' },
            jsx(
                LabelGroup,
                { text: 'Camera Frame' },
                jsx(BooleanInput, {
                    type: 'toggle',
                    binding: new BindingTwoWay(),
                    link: { observer, path: 'cameraFrame' },
                    value: observer.get('cameraFrame') || false
                })
            ),
            jsx(
                LabelGroup,
                { text: 'FOV' },
                jsx(SliderInput, {
                    binding: new BindingTwoWay(),
                    link: { observer, path: 'cameraFov' },
                    min: 10,
                    max: 360,
                    precision: 0
                })
            ),
            jsx(
                LabelGroup,
                { text: 'Fisheye' },
                jsx(SliderInput, {
                    binding: new BindingTwoWay(),
                    link: { observer, path: 'fisheye' },
                    min: 0,
                    max: 1,
                    precision: 4,
                    step: 0.0001
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
            ),
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
                { text: 'Min Contribution' },
                jsx(SliderInput, {
                    binding: new BindingTwoWay(),
                    link: { observer, path: 'minContribution' },
                    min: 0,
                    max: 10,
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
                { text: 'Debug' },
                jsx(SelectInput, {
                    type: 'number',
                    binding: new BindingTwoWay(),
                    link: { observer, path: 'debug' },
                    value: observer.get('debug') ?? 0,
                    options: [
                        { v: 0, t: 'None' },
                        { v: 1, t: 'LOD' },
                        { v: 2, t: 'SH Update' },
                        { v: 3, t: 'Heatmap' },
                        { v: 4, t: 'AABBs' },
                        { v: 5, t: 'Node AABBs' }
                    ]
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
