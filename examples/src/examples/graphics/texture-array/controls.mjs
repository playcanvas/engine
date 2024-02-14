import * as pc from 'playcanvas';

/**
 * @param {import('../../../app/components/Example.mjs').ControlOptions} options - The options.
 * @returns {JSX.Element} The returned JSX Element.
 */
export function controls({ observer, ReactPCUI, React, jsx, fragment }) {
    const { InfoBox, BindingTwoWay, LabelGroup, Panel, BooleanInput } = ReactPCUI;
    return fragment(
        jsx(InfoBox, {
            icon: 'E218',
            title: 'WebGL 1.0',
            text: 'Texture Arrays are not supported on WebGL 1.0 devices',
            hidden: !(pc.app?.graphicsDevice.isWebGL1 ?? false)
        }),
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
