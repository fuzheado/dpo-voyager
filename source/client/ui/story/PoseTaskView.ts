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

import { customElement, html } from "@ff/ui/CustomElement";

import "@ff/ui/Splitter";
import "@ff/ui/Button";
import { IButtonClickEvent } from "@ff/ui/Button";

import "./PropertyView";

import NVNode from "../../nodes/NVNode";
import CVPoseTask, { EPoseManipMode } from "../../components/CVPoseTask";
import { TaskView } from "../../components/CVTask";

////////////////////////////////////////////////////////////////////////////////

@customElement("sv-pose-task-view")
export default class PoseTaskView extends TaskView<CVPoseTask>
{
    protected render()
    {
        const node = this.activeNode;
        const model = node && node.model;

        if (!model) {
            return html`<div class="sv-placeholder">Please select a model to edit its pose</div>`;
        }

        const modeProp = this.task.ins.mode;

        const globalUnits = this.activeScene.ins.units;
        const itemUnits = model.ins.localUnits;
        const position = model.ins.position;
        const rotation = model.ins.rotation;

        return html`
            <div class="sv-commands">
                <ff-button icon="select" text="Select" index=${EPoseManipMode.Off} selectedIndex=${modeProp.value} @click=${this.onClickMode}></ff-button>
                <ff-button icon="rotate" text="Rotate" index=${EPoseManipMode.Rotate} selectedIndex=${modeProp.value} @click=${this.onClickMode}></ff-button>
                <ff-button icon="move" text="Move" index=${EPoseManipMode.Translate} selectedIndex=${modeProp.value} @click=${this.onClickMode}></ff-button>
                <ff-button icon="compress" text="Center" @click=${this.onClickCenter}></ff-button>
                <ff-button icon="expand" text="Zoom Extent" @click=${this.onClickZoomViews}></ff-button>
            </div>
            <div class="sv-panel-section sv-dialog sv-scrollable">
                <sv-property-view .property=${globalUnits} label="Global Units"></sv-property-view>    
                <sv-property-view .property=${itemUnits} label="Item Units"></sv-property-view>
                <sv-property-view .property=${position}></sv-property-view>
                <sv-property-view .property=${rotation}></sv-property-view>
            </div>`;
    }

    protected onClickMode(event: IButtonClickEvent)
    {
        this.task.ins.mode.setValue(event.target.index);
    }

    protected onClickCenter()
    {
        this.activeNode.model.ins.center.set();
    }

    protected onClickZoomViews()
    {
        this.activeDocument.documentScene.navigation.ins.zoomExtents.set();
    }

    protected onActiveNode(previous: NVNode, next: NVNode)
    {
        this.requestUpdate();
    }
}