/**
 * @param {import('../../app/components/Example.mjs').ControlOptions} options - The options.
 * @returns {JSX.Element} The returned JSX Element.
 */
export const controls = ({ observer, ReactPCUI, jsx, fragment }) => {
    const { BindingTwoWay, BooleanInput, Button, LabelGroup, Panel, SliderInput, SelectInput } = ReactPCUI;

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
                { text: 'Radix mode' },
                jsx(SelectInput, {
                    binding: new BindingTwoWay(),
                    link: { observer, path: 'options.mode' },
                    type: 'string',
                    options: [
                        { v: '4-shared-mem', t: '4-bit shared (portable)' },
                        { v: 'onesweep', t: 'OneSweep (fused, NVIDIA)' }
                    ]
                })
            ),
            jsx(
                LabelGroup,
                { text: 'Render' },
                jsx(BooleanInput, {
                    type: 'toggle',
                    binding: new BindingTwoWay(),
                    link: { observer, path: 'options.render' }
                })
            ),
            jsx(
                LabelGroup,
                { text: 'Validation' },
                jsx(BooleanInput, {
                    type: 'toggle',
                    binding: new BindingTwoWay(),
                    link: { observer, path: 'options.validation' }
                })
            )
        ),
        jsx(
            Panel,
            { headerText: 'Benchmark' },
            jsx(
                LabelGroup,
                { text: 'Run up to' },
                jsx(SelectInput, {
                    type: 'number',
                    binding: new BindingTwoWay(),
                    link: { observer, path: 'options.benchMaxElements' },
                    options: [
                        { v: 100_000, t: '100K' },
                        { v: 500_000, t: '500K' },
                        { v: 1_000_000, t: '1M' },
                        { v: 2_000_000, t: '2M' },
                        { v: 3_000_000, t: '3M' },
                        { v: 4_000_000, t: '4M' },
                        { v: 5_000_000, t: '5M' },
                        { v: 6_000_000, t: '6M' },
                        { v: 8_000_000, t: '8M' },
                        { v: 10_000_000, t: '10M' },
                        { v: 15_000_000, t: '15M' },
                        { v: 20_000_000, t: '20M' },
                        { v: 25_000_000, t: '25M' },
                        { v: 30_000_000, t: '30M' },
                        { v: 40_000_000, t: '40M' },
                        { v: 50_000_000, t: '50M' }
                    ]
                })
            ),
            jsx(Button, {
                text: 'Run',
                onClick: () => {
                    observer.emit('benchmark');
                }
            }),
            jsx(Button, {
                text: 'Validate',
                onClick: () => {
                    observer.emit('validate');
                }
            })
        )
    );
};
