/**
 * @param {import('../../app/components/Example.mjs').ControlOptions} options - The options.
 * @returns {JSX.Element} The returned JSX Element.
 */
export const controls = ({ observer, ReactPCUI, React, jsx, fragment }) => {
    const { BindingTwoWay, LabelGroup, SelectInput, Button } = ReactPCUI;
    return fragment(
        jsx(
            LabelGroup,
            { text: 'Effect' },
            jsx(SelectInput, {
                options: [
                    { v: 'radial', t: 'Radial' },
                    { v: 'rain', t: 'Rain' },
                    { v: 'grid', t: 'Grid Eruption' }
                ],
                binding: new BindingTwoWay(),
                link: { observer, path: 'effect' }
            })
        ),
        jsx(Button, {
            text: 'Restart',
            onClick: () => {
                observer.emit('restart');
            }
        }),
        jsx(Button, {
            text: 'Next',
            onClick: () => {
                observer.emit('next');
            }
        })
    );
};
