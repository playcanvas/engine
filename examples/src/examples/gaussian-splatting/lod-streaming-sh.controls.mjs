/**
 * @param {import('../../app/components/Example.mjs').ControlOptions} options - The options.
 * @returns {JSX.Element} The returned JSX Element.
 */
export const controls = ({ observer, ReactPCUI, React, jsx, fragment }) => {
    const { BindingTwoWay, LabelGroup, Panel, SelectInput, SliderInput, Label } = ReactPCUI;
    return fragment(
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
                        { v: 'desktop', t: 'Desktop (0-2)' },
                        { v: 'mobile-max', t: 'Mobile Max (1-2)' },
                        { v: 'mobile', t: 'Mobile (2-5)' }
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
                    max: 10,
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
                    max: 10,
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
