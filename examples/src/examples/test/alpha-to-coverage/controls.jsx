import {
    BindingObserversToElement,
    BindingTwoWay,
    BooleanInput,
    Label,
    LabelGroup,
    Panel,
    SelectInput
} from '@playcanvas/pcui/react';
import { useEffect, useState } from 'react';

import { PIXELFORMAT_111110F, PIXELFORMAT_RGBA16F, PIXELFORMAT_RGBA8 } from 'playcanvas';

/**
 * @import { Observer } from '@playcanvas/observer'
 * @import { ReactElement } from 'react'
 */

/**
 * @param {{ observer: Observer }} props - The control panel props.
 * @returns {ReactElement} The control panel.
 */
export function Controls({ observer }) {
    const [cameraFrame, setCameraFrame] = useState(observer.get('data.cameraFrame') ?? false);

    useEffect(() => {
        // observer.on returns an EventHandle to unbind with - the observer has no 'off' method
        const event = observer.on('data.cameraFrame:set', () => {
            setCameraFrame(observer.get('data.cameraFrame'));
        });
        return () => event?.unbind();
    }, [observer]);

    return (
        <>
            <Panel headerText='Material'>
                <LabelGroup text='Alpha To Coverage'>
                    <BooleanInput
                        type='toggle'
                        binding={new BindingTwoWay()}
                        link={{ observer, path: 'data.alphaToCoverage' }}
                    />
                </LabelGroup>
            </Panel>
            <Panel headerText='Render Destination'>
                <LabelGroup text='MSAA'>
                    <BooleanInput
                        type='toggle'
                        binding={new BindingTwoWay()}
                        link={{ observer, path: 'data.msaa' }}
                    />
                </LabelGroup>
                <LabelGroup text='Camera Frame'>
                    <BooleanInput
                        type='toggle'
                        binding={new BindingTwoWay()}
                        link={{ observer, path: 'data.cameraFrame' }}
                    />
                </LabelGroup>
                <LabelGroup text='Rendering To'>
                    {/* read-only readout, written by the example itself */}
                    <Label
                        binding={new BindingObserversToElement()}
                        link={{ observer, path: 'data.renderingTo' }}
                    />
                </LabelGroup>
                {cameraFrame && (
                    <LabelGroup text='Format'>
                        <SelectInput
                            binding={new BindingTwoWay()}
                            link={{ observer, path: 'data.format' }}
                            type='number'
                            options={[
                                { v: PIXELFORMAT_RGBA8, t: 'RGBA8 (alpha)' },
                                { v: PIXELFORMAT_RGBA16F, t: 'RGBA16F (alpha)' },
                                { v: PIXELFORMAT_111110F, t: '111110F (no alpha)' }
                            ]}
                        />
                    </LabelGroup>
                )}
            </Panel>
        </>
    );
}
