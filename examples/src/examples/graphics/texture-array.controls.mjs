/**
 * @param {import('../../app/components/Example.mjs').ControlOptions} options - The options.
 * @returns {JSX.Element} The returned JSX Element.
 */
export function controls({ observer, ReactPCUI, React, jsx, fragment }) {
    const { BindingTwoWay, LabelGroup, Panel, BooleanInput } = ReactPCUI;
    return fragment(
        jsx(
            Panel,
            { headerText: 'Texture Arrays' },
            jsx(
                LabelGroup,
                { text: 'Show mipmaps' },
                jsx(BooleanInput, {
                    type: 'toggle',
                    binding: new BindingTwoWay(),
                    link: {
                        observer,
                        path: 'mipmaps'
                    }
                })
            )
        )
    );
}
