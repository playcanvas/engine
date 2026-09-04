import {
    BindingTwoWay,
    BooleanInput,
    LabelGroup,
    Panel,
    SelectInput
} from '@playcanvas/pcui/react';

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
            <Panel headerText='Paragraph'>
                <LabelGroup text='Justify'>
                    <BooleanInput
                        type='toggle'
                        binding={new BindingTwoWay()}
                        link={{ observer, path: 'data.justify' }}
                    />
                </LabelGroup>
                <LabelGroup text='Alignment'>
                    <SelectInput
                        binding={new BindingTwoWay()}
                        link={{ observer, path: 'data.alignment' }}
                        options={[
                            { v: 'left', t: 'Left' },
                            { v: 'center', t: 'Center' },
                            { v: 'right', t: 'Right' }
                        ]}
                    />
                </LabelGroup>
            </Panel>
        </>
    );
}
