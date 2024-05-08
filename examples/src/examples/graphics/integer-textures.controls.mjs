/**
 * @param {import('../../app/components/Example.mjs').ControlOptions} options - The options.
 * @returns {JSX.Element} The returned JSX Element.
 */
export function controls({ observer, ReactPCUI, jsx, fragment }) {
    const { BindingTwoWay, Container, Button, LabelGroup, Panel, SliderInput, SelectInput } = ReactPCUI;

    return fragment(
        jsx(
            Panel,
            { headerText: 'Sand simulation' },
            jsx(
                LabelGroup,
                { text: 'Brush' },
                jsx(SelectInput, {
                    binding: new BindingTwoWay(),
                    link: { observer, path: 'options.brush' },
                    type: 'string',
                    value: 1,
                    options: [
                        { v: 1, t: 'Sand' },
                        { v: 2, t: 'Orange Sand' },
                        { v: 3, t: 'Gray Sand' },
                        { v: 4, t: 'Stone' }
                    ]
                })
            ),
            jsx(
                LabelGroup,
                { text: 'Brush size' },
                jsx(SliderInput, {
                    binding: new BindingTwoWay(),
                    link: { observer, path: 'options.brushSize' },
                    value: 8,
                    min: 1,
                    max: 16,
                    precision: 0
                })
            ),
            jsx(
                Container,
                { flex: true, flexGrow: 1 },
                jsx(Button, {
                    text: 'Reset',
                    onClick: () => observer.emit('reset')
                })
            )
        )
    );
}
