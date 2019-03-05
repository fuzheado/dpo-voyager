/**
 * 3D Foundation Project
 * Copyright 2018 Smithsonian Institution
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import { types } from "@ff/graph/Component";

import "../ui/PropertyBoolean";
import "../ui/PropertyString";

import CVTool, { ToolView, customElement, html } from "./CVTool";

////////////////////////////////////////////////////////////////////////////////

export default class CVTapeTool extends CVTool
{
    static readonly typeName: string = "CVTapeTool";

    static readonly text = "Tape Measure";
    static readonly icon = "tape";

    protected static readonly tapeIns = {
        enabled: types.Boolean("Tape.Enabled"),
    };

    protected static readonly tapeOuts = {
        state: types.String("Tape.Measurement", "Tap on model to set start of tape.")
    };

    ins = this.addInputs(CVTapeTool.tapeIns);
    outs = this.addOutputs(CVTapeTool.tapeOuts);

    update(context)
    {
        return true;
    }

    createView()
    {
        return new TapeToolView(this);
    }
}

////////////////////////////////////////////////////////////////////////////////

@customElement("sv-tape-tool-view")
export class TapeToolView extends ToolView<CVTapeTool>
{
    protected firstConnected()
    {
        super.firstConnected();
        this.classList.add("sv-tape-tool-view");
    }

    protected render()
    {
        const enabled = this.tool.ins.enabled;
        const state = this.tool.outs.state;

        return html`<sv-property-boolean .property=${enabled} name="Tape Tool"></sv-property-boolean>
            <sv-property-string .property=${state} name="Measured Distance"></sv-property-string>`;
    }
}