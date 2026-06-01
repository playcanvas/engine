/**
 * @param {import('../../app/components/Example.mjs').ControlOptions} options - The options.
 * @returns {JSX.Element} The returned JSX Element.
 */
export const controls = ({ observer, ReactPCUI, React, jsx, fragment }) => {
    const { BindingTwoWay, BooleanInput, LabelGroup, Panel, SelectInput, SliderInput } = ReactPCUI;
    return fragment(
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
            Panel,
            { headerText: 'Soft Shadow Settings' },
            jsx(
                LabelGroup,
                { text: 'Soft Shadows' },
                jsx(BooleanInput, {
                    type: 'toggle',
                    binding: new BindingTwoWay(),
                    link: { observer, path: 'settings.light.soft' }
                })
            ),
            jsx(
                LabelGroup,
                { text: 'Resolution' },
                jsx(SliderInput, {
                    binding: new BindingTwoWay(),
                    link: { observer, path: 'settings.light.shadowResolution' },
                    min: 512,
                    max: 4096,
                    precision: 0
                })
            ),
            jsx(
                LabelGroup,
                { text: 'Penumbra' },
                jsx(SliderInput, {
                    binding: new BindingTwoWay(),
                    link: { observer, path: 'settings.light.penumbraSize' },
                    min: 0,
                    max: 0.2,
                    precision: 3
                })
            ),
            jsx(
                LabelGroup,
                { text: 'Falloff' },
                jsx(SliderInput, {
                    binding: new BindingTwoWay(),
                    link: { observer, path: 'settings.light.penumbraFalloff' },
                    min: 1,
                    max: 10,
                    precision: 1
                })
            ),
            jsx(
                LabelGroup,
                { text: 'Samples' },
                jsx(SliderInput, {
                    binding: new BindingTwoWay(),
                    link: { observer, path: 'settings.light.shadowSamples' },
                    min: 1,
                    max: 128,
                    precision: 0
                })
            ),
            jsx(
                LabelGroup,
                { text: 'Blocker Samples' },
                jsx(SliderInput, {
                    binding: new BindingTwoWay(),
                    link: { observer, path: 'settings.light.shadowBlockerSamples' },
                    min: 0,
                    max: 128,
                    precision: 0
                })
            )
        )
    );
};
