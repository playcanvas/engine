/**
 * @param {import('../../app/components/Example.mjs').ControlOptions} options - The options.
 * @returns {JSX.Element} The returned JSX Element.
 */
export const controls = ({ observer, ReactPCUI, React, jsx, fragment }) => {
    const { BindingTwoWay, LabelGroup, SelectInput, SliderInput, Button, Panel } = ReactPCUI;

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
            { headerText: 'Editor Settings' },
            jsx(Button, {
                text: 'Select',
                onClick: () => observer.emit('select')
            }),
            jsx(
                LabelGroup,
                { text: 'Box Size' },
                jsx(SliderInput, {
                    binding: new BindingTwoWay(),
                    link: { observer, path: 'boxSize' },
                    min: 0.1,
                    max: 5.0,
                    precision: 2
                })
            ),
            jsx(Button, {
                text: 'Delete Selected',
                onClick: () => observer.emit('deleteSelected')
            }),
            jsx(Button, {
                text: 'Clone Selected',
                onClick: () => observer.emit('cloneSelected')
            })
        )
    );
};
