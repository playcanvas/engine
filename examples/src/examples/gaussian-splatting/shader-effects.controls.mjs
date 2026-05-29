/**
 * @param {import('../../app/components/Example.mjs').ControlOptions} options - The options.
 * @returns {JSX.Element} The returned JSX Element.
 */
export const controls = ({ observer, ReactPCUI, React, jsx, fragment }) => {
    const { BindingTwoWay, LabelGroup, SelectInput, BooleanInput, Button } = ReactPCUI;
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
            LabelGroup,
            { text: 'Effect' },
            jsx(SelectInput, {
                options: [
                    { v: 'hide', t: 'Statue Hide' },
                    { v: 'reveal', t: 'Statue Reveal' },
                    { v: 'tint', t: 'Statue Tint' },
                    { v: 'untint', t: 'Statue Untint' },
                    { v: 'roomHide', t: 'Room Hide' },
                    { v: 'roomReveal', t: 'Room Reveal' },
                    { v: 'roomTint', t: 'Room Tint' },
                    { v: 'roomUntint', t: 'Room Untint' }
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
            text: 'Prev',
            onClick: () => {
                observer.emit('prev');
            }
        }),
        jsx(Button, {
            text: 'Next',
            onClick: () => {
                observer.emit('next');
            }
        }),
        jsx(
            LabelGroup,
            { text: 'Enabled' },
            jsx(BooleanInput, {
                type: 'toggle',
                binding: new BindingTwoWay(),
                link: { observer, path: 'enabled' }
            })
        )
    );
};
