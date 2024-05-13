/**
 * @param {import('../../app/components/Example.mjs').ControlOptions} options - The options.
 * @returns {JSX.Element} The returned JSX Element.
 */
export function controls({ observer, ReactPCUI, React, jsx, fragment }) {
    const { BindingTwoWay, LabelGroup, Panel, SelectInput, SliderInput } = ReactPCUI;
    return fragment(
        jsx(
            Panel,
            { headerText: 'Settings' },
            jsx(
                LabelGroup,
                { text: 'Update' },
                jsx(SelectInput, {
                    binding: new BindingTwoWay(),
                    link: { observer, path: 'settings.updateFrequency' },
                    type: 'number',
                    options: [
                        { v: 0, t: 'Once' },
                        { v: 1, t: 'Every frame' },
                        { v: 10, t: 'Every 10 frames' },
                        { v: 30, t: 'Every 30 frames' }
                    ]
                })
            ),
            jsx(
                LabelGroup,
                { text: 'Gloss' },
                jsx(SliderInput, {
                    binding: new BindingTwoWay(),
                    link: { observer, path: 'settings.gloss' },
                    min: 0,
                    max: 1,
                    precision: 2
                })
            ),
            jsx(
                LabelGroup,
                { text: 'Metalness' },
                jsx(SliderInput, {
                    binding: new BindingTwoWay(),
                    link: { observer, path: 'settings.metalness' },
                    min: 0,
                    max: 1,
                    precision: 2
                })
            ),
            jsx(
                LabelGroup,
                { text: 'Reflectivity' },
                jsx(SliderInput, {
                    binding: new BindingTwoWay(),
                    link: { observer, path: 'settings.reflectivity' },
                    min: 0,
                    max: 1,
                    precision: 2
                })
            ),
            jsx(
                LabelGroup,
                { text: 'Bumpiness' },
                jsx(SliderInput, {
                    binding: new BindingTwoWay(),
                    link: { observer, path: 'settings.bumpiness' },
                    min: 0,
                    max: 1,
                    precision: 2
                })
            )
        )
    );
}
