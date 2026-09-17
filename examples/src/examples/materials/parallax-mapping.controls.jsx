import {
    BindingTwoWay,
    BooleanInput,
    LabelGroup,
    Panel,
    SelectInput,
    SliderInput
} from '@playcanvas/pcui/react';

import { PARALLAX_OCCLUSION, PARALLAX_OFFSET } from 'playcanvas';

/**
 * @import { Observer } from '@playcanvas/observer'
 * @import { ReactElement } from 'react'
 */

/**
 * @param {{ observer: Observer }} props - The control panel props.
 * @returns {ReactElement} The control panel.
 */
export function Controls({ observer }) {
    return (
        <>
            <Panel headerText='Settings'>
                <LabelGroup text='Mode'>
                    <SelectInput
                        binding={new BindingTwoWay()}
                        link={{ observer, path: 'data.mode' }}
                        type='string'
                        options={[
                            // 'none' is not an engine mode - the example unassigns the height map
                            { v: 'none', t: 'None' },
                            { v: PARALLAX_OFFSET, t: 'Offset' },
                            { v: PARALLAX_OCCLUSION, t: 'Occlusion' }
                        ]}
                    />
                </LabelGroup>
                <LabelGroup text='Samples'>
                    <SliderInput
                        binding={new BindingTwoWay()}
                        link={{ observer, path: 'data.samples' }}
                        min={1}
                        max={64}
                        precision={0}
                    />
                </LabelGroup>
                <LabelGroup text='Height'>
                    <SliderInput
                        binding={new BindingTwoWay()}
                        link={{ observer, path: 'data.height' }}
                        min={0.0}
                        max={2}
                        precision={2}
                    />
                </LabelGroup>
                <LabelGroup text='Base'>
                    <SliderInput
                        binding={new BindingTwoWay()}
                        link={{ observer, path: 'data.base' }}
                        min={0.0}
                        max={1}
                        precision={2}
                    />
                </LabelGroup>
            </Panel>
            <Panel headerText='Lighting'>
                <LabelGroup text='Spot'>
                    <BooleanInput
                        type='toggle'
                        binding={new BindingTwoWay()}
                        link={{ observer, path: 'data.spot' }}
                        value={observer.get('data.spot')}
                    />
                </LabelGroup>
                <LabelGroup text='Omni'>
                    <BooleanInput
                        type='toggle'
                        binding={new BindingTwoWay()}
                        link={{ observer, path: 'data.omni' }}
                        value={observer.get('data.omni')}
                    />
                </LabelGroup>
                <LabelGroup text='Environment'>
                    <SliderInput
                        binding={new BindingTwoWay()}
                        link={{ observer, path: 'data.env' }}
                        min={0.0}
                        max={1}
                        precision={2}
                    />
                </LabelGroup>
            </Panel>
        </>
    );
}
