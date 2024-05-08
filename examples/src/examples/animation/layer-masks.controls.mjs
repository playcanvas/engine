import * as pc from 'playcanvas';

/**
 * @param {import('../../app/components/Example.mjs').ControlOptions} options - The options.
 * @returns {JSX.Element} The returned JSX Element.
 */
export function controls({ observer, ReactPCUI, React, jsx, fragment }) {
    const { BindingTwoWay, LabelGroup, Panel, BooleanInput, SelectInput, SliderInput } = ReactPCUI;
    return fragment(
        jsx(
            Panel,
            { headerText: 'Full Body Layer' },
            jsx(
                LabelGroup,
                { text: 'active state' },
                jsx(SelectInput, {
                    options: ['Idle', 'Walk'].map(_ => ({ v: _, t: _ })),
                    binding: new BindingTwoWay(),
                    link: {
                        observer,
                        path: 'fullBodyLayer.state'
                    }
                })
            )
        ),
        jsx(
            Panel,
            { headerText: 'Upper Body Layer' },
            jsx(
                LabelGroup,
                { text: 'active state' },
                jsx(SelectInput, {
                    options: ['Eager', 'Idle', 'Dance'].map(_ => ({ v: _, t: _ })),
                    binding: new BindingTwoWay(),
                    link: {
                        observer,
                        path: 'upperBodyLayer.state'
                    }
                })
            ),
            jsx(
                LabelGroup,
                { text: 'blend type' },
                jsx(SelectInput, {
                    options: [
                        { v: pc.ANIM_LAYER_OVERWRITE, t: 'Overwrite' },
                        { v: pc.ANIM_LAYER_ADDITIVE, t: 'Additive' }
                    ],
                    value: pc.ANIM_LAYER_ADDITIVE,
                    binding: new BindingTwoWay(),
                    link: {
                        observer,
                        path: 'upperBodyLayer.blendType'
                    }
                })
            ),
            jsx(
                LabelGroup,
                { text: 'use mask' },
                jsx(BooleanInput, {
                    type: 'toggle',
                    binding: new BindingTwoWay(),
                    link: {
                        observer,
                        path: 'upperBodyLayer.useMask'
                    }
                })
            )
        ),
        jsx(
            Panel,
            { headerText: 'Options' },
            jsx(
                LabelGroup,
                { text: 'blend' },
                jsx(SliderInput, {
                    min: 0.01,
                    max: 0.99,
                    binding: new BindingTwoWay(),
                    link: {
                        observer,
                        path: 'options.blend'
                    },
                    value: 0.5
                })
            ),
            jsx(
                LabelGroup,
                { text: 'skeleton' },
                jsx(BooleanInput, {
                    type: 'toggle',
                    binding: new BindingTwoWay(),
                    link: {
                        observer,
                        path: 'options.skeleton'
                    }
                })
            )
        )
    );
}
