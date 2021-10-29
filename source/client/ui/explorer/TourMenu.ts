/**
 * 3D Foundation Project
 * Copyright 2019 Smithsonian Institution
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

import CustomElement, { customElement, property, html } from "@ff/ui/CustomElement";
import "@ff/ui/Button";

import { ITour } from "client/schema/setup";
import { ELanguageType } from "client/schema/common";
import {getFocusableElements, focusTrap} from "../../utils/focusHelpers"

////////////////////////////////////////////////////////////////////////////////

export interface ITourMenuSelectEvent extends CustomEvent
{
    detail: {
        index: number;
    }
}

@customElement("sv-tour-menu")
export default class TourMenu extends CustomElement
{
    @property({ attribute: false })
    tours: ITour[];

    @property({ attribute: false })
    activeLanguage: ELanguageType;

    protected needsFocus: boolean = false;
    protected focusableElements: HTMLElement[] = [];

    protected firstConnected()
    {
        super.firstConnected();
        this.classList.add("sv-document-overlay", "sv-article", "sv-tour-menu");
        this.needsFocus = true;
    }

    protected renderEntry(tour: ITour, index: number)
    {
        return html`<div role="menuitem" title="tour entry ${index+1} of ${this.tours.length}" tabindex="0" @keydown=${e =>this.onKeyDown(e, index)} class="sv-entry" @click=${e => this.onClickTour(e, index)}>
            <h1>${Object.keys(tour.titles).length > 0 ? tour.titles[ELanguageType[this.activeLanguage]] : tour.title}</h1>
            <p>${Object.keys(tour.leads).length > 0 ? tour.leads[ELanguageType[this.activeLanguage]] : tour.lead}</p>
        </div>`;
    }

    protected render()
    {
        const tours = this.tours;

        if (tours.length === 0) {
            return html`<div class="sv-entry">
                <h1>No tours available.</h1>
            </div>`;
        }

        return html`<div role="region" aria-label="interactive tour menu" class="ff-scroll-y">
            ${tours.map((tour, index) => this.renderEntry(tour, index))}
        </div>`;
    }

    protected update(changedProperties) {
        super.update(changedProperties);

        if(this.needsFocus) {
            const container = this.getElementsByClassName("sv-entry").item(0) as HTMLElement;
            container.focus();
            this.needsFocus = false;
        }
    }

    protected onClickTour(e: MouseEvent, index: number)
    {
        e.stopPropagation();

        this.dispatchEvent(new CustomEvent("select", {
            detail: { index }
        }));
    }

    protected onKeyDown(e: KeyboardEvent, index: number)
    {
        if (e.code === "Space" || e.code === "Enter") {
            e.preventDefault();
            this.dispatchEvent(new CustomEvent("select", {
                detail: { index }
            }));
        }
        else if (e.code === "Escape") {
            e.preventDefault();
            this.dispatchEvent(new CustomEvent("close", {
                detail: { index }
            }));
        }
        else if(e.code === "Tab") {
            if(this.focusableElements.length === 0) {
                this.focusableElements = getFocusableElements(this) as HTMLElement[];
            }

            focusTrap(this.focusableElements, e);
        }
    }
}