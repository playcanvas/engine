/**
 * @param {import('../../app/components/Example.mjs').ControlOptions} options - The options.
 * @returns {JSX.Element} The returned JSX Element.
 */
export const controls = ({ observer, ReactPCUI, React, jsx, fragment }) => {
    const { BindingTwoWay, ColorPicker, LabelGroup, Panel, SelectInput, SliderInput } = ReactPCUI;
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
                    { v: 2, t: 'Raster (Hybrid)' },
                    { v: 3, t: 'Compute' }
                ]
            })
        ),
        jsx(
            Panel,
            { headerText: 'Annotations' },
            jsx(
                LabelGroup,
                { text: 'Hotspot Size' },
                jsx(SliderInput, {
                    binding: new BindingTwoWay(),
                    link: { observer, path: 'data.hotspotSize' },
                    min: 10,
                    max: 50
                })
            ),
            jsx(
                LabelGroup,
                { text: 'Hotspot Color' },
                jsx(ColorPicker, {
                    binding: new BindingTwoWay(),
                    link: { observer, path: 'data.hotspotColor' }
                })
            ),
            jsx(
                LabelGroup,
                { text: 'Hover Color' },
                jsx(ColorPicker, {
                    binding: new BindingTwoWay(),
                    link: { observer, path: 'data.hoverColor' }
                })
            ),
            jsx(
                LabelGroup,
                { text: 'Opacity' },
                jsx(SliderInput, {
                    binding: new BindingTwoWay(),
                    link: { observer, path: 'data.opacity' },
                    min: 0,
                    max: 1,
                    precision: 2
                })
            ),
            jsx(
                LabelGroup,
                { text: 'Behind Opacity' },
                jsx(SliderInput, {
                    binding: new BindingTwoWay(),
                    link: { observer, path: 'data.behindOpacity' },
                    min: 0,
                    max: 1,
                    precision: 2
                })
            )
        )
    );
};
