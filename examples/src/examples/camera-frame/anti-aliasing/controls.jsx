import {
    BindingTwoWay,
    BooleanInput,
    LabelGroup,
    Panel,
    SelectInput,
    SliderInput
} from '@playcanvas/pcui/react';
import { useEffect, useState } from 'react';

/**
 * @import { Observer } from '@playcanvas/observer'
 * @import { ReactElement } from 'react'
 */

/**
 * @param {{ observer: Observer }} props - The control panel props.
 * @returns {ReactElement} The control panel.
 */
export function Controls({ observer }) {
    // the SMAA debug views are offered only while a method using SMAA is selected
    const [method, setMethod] = useState(observer.get('data.aa.method'));
    useEffect(() => {
        // observer.on returns an EventHandle to unbind with - the observer has no 'off' method
        const event = observer.on('data.aa.method:set', setMethod);
        return () => event?.unbind();
    }, [observer]);
    const smaa = method?.startsWith('smaa') || method === 'msaaSmaa';

    return (
        <>
            <Panel headerText='Anti-Aliasing'>
                <LabelGroup text='method'>
                    <SelectInput
                        binding={new BindingTwoWay()}
                        link={{ observer, path: 'data.aa.method' }}
                        type='string'
                        options={[
                            { v: 'none', t: 'None' },
                            { v: 'smaaLow', t: 'SMAA - Low' },
                            { v: 'smaaMedium', t: 'SMAA - Medium' },
                            { v: 'smaaHigh', t: 'SMAA - High' },
                            { v: 'smaaUltra', t: 'SMAA - Ultra' },
                            { v: 'taa', t: 'TAA' },
                            { v: 'taaUpscale', t: 'TAA - Upscale' },
                            { v: 'msaa', t: 'MSAA 4x' },
                            { v: 'msaaSmaa', t: 'MSAA 4x + SMAA - High' }
                        ]}
                    />
                </LabelGroup>
                {smaa && (
                    <LabelGroup text='SMAA debug'>
                        <SelectInput
                            binding={new BindingTwoWay()}
                            link={{ observer, path: 'data.aa.debug' }}
                            type='string'
                            options={[
                                { v: 'none', t: 'None' },
                                { v: 'edges', t: 'Edges' },
                                { v: 'weights', t: 'Weights' }
                            ]}
                        />
                    </LabelGroup>
                )}
            </Panel>
            <Panel headerText='Scene Rendering'>
                <LabelGroup text='resolution'>
                    <SliderInput
                        binding={new BindingTwoWay()}
                        link={{ observer, path: 'data.scene.scale' }}
                        min={0.25}
                        max={1}
                        precision={2}
                    />
                </LabelGroup>
                <LabelGroup text='sharpness'>
                    <SliderInput
                        binding={new BindingTwoWay()}
                        link={{ observer, path: 'data.scene.sharpness' }}
                        min={0}
                        max={1}
                        precision={2}
                    />
                </LabelGroup>
                <LabelGroup text='bloom'>
                    <BooleanInput
                        type='toggle'
                        binding={new BindingTwoWay()}
                        link={{ observer, path: 'data.scene.bloom' }}
                    />
                </LabelGroup>
            </Panel>
        </>
    );
}
