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

import { types } from "@ff/graph/propertyTypes";
import Component from "@ff/graph/Component";

import { ITapeTool } from "common/types/config";

////////////////////////////////////////////////////////////////////////////////

const _inputs = {
    active: types.Boolean("Active"),
    startPosition: types.Vector3("Start.Position"),
    startDirection: types.Vector3("Start.Direction"),
    endPosition: types.Vector3("End.Position"),
    endDirection: types.Vector3("End.Direction")
};

export default class CVTapeTool extends Component
{
    ins = this.addInputs(_inputs);

    fromData(data: ITapeTool)
    {
        this.ins.copyValues({
            active: data.active,
            startPosition: data.startPosition,
            startDirection: data.startDirection,
            endPosition: data.endPosition,
            endDirection: data.endDirection
        });
    }

    toData(): ITapeTool
    {
        const ins = this.ins;

        return {
            active: ins.active.cloneValue(),
            startPosition: ins.startPosition.cloneValue(),
            startDirection: ins.startDirection.cloneValue(),
            endPosition: ins.endPosition.cloneValue(),
            endDirection: ins.endDirection.cloneValue()
        };
    }
}