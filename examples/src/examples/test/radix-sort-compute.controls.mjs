/**
 * @param {import('../../app/components/Example.mjs').ControlOptions} options - The options.
 * @returns {JSX.Element} The returned JSX Element.
 */
export const controls = ({ observer, ReactPCUI, jsx, fragment }) => {
    const { BindingTwoWay, LabelGroup, Panel, SliderInput, SelectInput } = ReactPCUI;

    return fragment(
        jsx(
            Panel,
            { headerText: 'Compute Radix Sort' },
            jsx(
                LabelGroup,
                { text: 'Elements (K)' },
                jsx(SliderInput, {
                    binding: new BindingTwoWay(),
                    link: { observer, path: 'options.elementsK' },
                    min: 1,
                    max: 30000,
                    precision: 0
                })
            ),
            jsx(
                LabelGroup,
                { text: 'Bits' },
                jsx(SelectInput, {
                    binding: new BindingTwoWay(),
                    link: { observer, path: 'options.bits' },
                    options: [
                        { v: 8, t: '8 bits' },
                        { v: 16, t: '16 bits' },
                        { v: 24, t: '24 bits' },
                        { v: 32, t: '32 bits' }
                    ]
                })
            ),
            jsx(
                LabelGroup,
                { text: 'Scan kernel' },
                jsx(SelectInput, {
                    binding: new BindingTwoWay(),
                    link: { observer, path: 'options.scan' },
                    type: 'string',
                    options: [
                        { v: 'csdldf', t: 'CSDLDF' },
                        { v: 'blelloch', t: 'Blelloch' }
                    ]
                })
            ),
            jsx(
                LabelGroup,
                { text: 'Radix mode' },
                jsx(SelectInput, {
                    binding: new BindingTwoWay(),
                    link: { observer, path: 'options.mode' },
                    type: 'string',
                    options: [
                        { v: '4-shared-mem', t: '4-bit shared' },
                        { v: '8-shared-mem', t: '8-bit shared' },
                        { v: '8-subgroup', t: '8-bit ballot' },
                        { v: '8-subgroup-packed', t: '8-bit ballot packed' }
                    ]
                })
            )
        )
    );
};
