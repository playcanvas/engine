import { BindingTwoWay, LabelGroup, Panel, SelectInput, SliderInput } from '@playcanvas/pcui/react';

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
                <LabelGroup text='Shape'>
                    <SelectInput
                        binding={new BindingTwoWay()}
                        link={{ observer, path: 'data.shape' }}
                        type='string'
                        options={[
                            { v: 'box', t: 'Box' },
                            { v: 'sphere', t: 'Sphere' }
                        ]}
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
            </Panel>
        </>
    );
}
