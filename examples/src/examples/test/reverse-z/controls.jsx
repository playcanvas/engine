import {
    BindingObserversToElement,
    BindingTwoWay,
    BooleanInput,
    Label,
    LabelGroup,
    Panel,
    SelectInput
} from '@playcanvas/pcui/react';

import { PIXELFORMAT_DEPTH, PIXELFORMAT_DEPTH16, PIXELFORMAT_DEPTHSTENCIL } from 'playcanvas';

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
        <Panel headerText='Depth'>
            <LabelGroup text='Format'>
                <SelectInput
                    binding={new BindingTwoWay()}
                    link={{ observer, path: 'data.depthFormat' }}
                    type='number'
                    options={[
                        { v: PIXELFORMAT_DEPTH, t: '32-bit float' },
                        { v: PIXELFORMAT_DEPTHSTENCIL, t: '24-bit + stencil' },
                        { v: PIXELFORMAT_DEPTH16, t: '16-bit' }
                    ]}
                />
            </LabelGroup>
            <LabelGroup text='Near Clip'>
                <SelectInput
                    binding={new BindingTwoWay()}
                    link={{ observer, path: 'data.nearClip' }}
                    options={[
                        { v: 0.01, t: '0.01' },
                        { v: 0.1, t: '0.1' },
                        { v: 1, t: '1' }
                    ]}
                />
            </LabelGroup>
            <LabelGroup text='Animate'>
                <BooleanInput
                    type='toggle'
                    binding={new BindingTwoWay()}
                    link={{ observer, path: 'data.animate' }}
                />
            </LabelGroup>
            <LabelGroup text='Rendering'>
                {/* read-only readout, written by the example itself */}
                <Label
                    binding={new BindingObserversToElement()}
                    link={{ observer, path: 'data.status' }}
                />
            </LabelGroup>
        </Panel>
    );
}
