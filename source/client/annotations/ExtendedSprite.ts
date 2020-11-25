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

import * as THREE from "three";

import math from "@ff/core/math";
import Color from "@ff/core/Color";

import { customElement, PropertyValues, html, render } from "@ff/ui/CustomElement";
import "@ff/ui/Button";

import AnnotationSprite, { Annotation, AnnotationElement } from "./AnnotationSprite";
import AnnotationFactory from "./AnnotationFactory";

////////////////////////////////////////////////////////////////////////////////

const _quadrantClasses = [ "sv-q0", "sv-q1", "sv-q2", "sv-q3" ];
const _color = new Color();
const _offset = new THREE.Vector3(0, 1, 0);

export default class ExtendedSprite extends AnnotationSprite
{
    static readonly typeName: string = "Extended";

    protected stemLine: THREE.Line;
    protected quadrant = -1;

    constructor(annotation: Annotation)
    {
        super(annotation);

        const geometry = new THREE.Geometry();
        geometry.vertices.push(new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, 1, 0));
        const material = new THREE.LineBasicMaterial({ color: "#009cde", transparent: true });

        this.stemLine = new THREE.Line(geometry, material);
        this.stemLine.frustumCulled = false;
        this.stemLine.matrixAutoUpdate = false;
        this.add(this.stemLine);

        this.update();
    }

    update()
    {
        const annotation = this.annotation.data;

        this.stemLine.scale.setScalar(annotation.scale);
        this.stemLine.position.y = annotation.offset;
        this.stemLine.updateMatrix();

        const material = this.stemLine.material as THREE.LineBasicMaterial;
        material.color.fromArray(annotation.color);

        super.update();
    }

    renderHTMLElement(element: ExtendedAnnotation, container: HTMLElement, camera: THREE.Camera)
    {
        super.renderHTMLElement(element, container, camera, this.stemLine, _offset);

        const angleOpacity = math.scaleLimit(this.viewAngle * math.RAD2DEG, 90, 100, 1, 0);
        const opacity = this.annotation.data.visible ? angleOpacity : 0;

        this.stemLine.material["opacity"] = opacity;
        element.setOpacity(opacity);

        // update quadrant/orientation
        if (this.orientationQuadrant !== this.quadrant) {
            element.classList.remove(_quadrantClasses[this.quadrant]);
            element.classList.add(_quadrantClasses[this.orientationQuadrant]);
            this.quadrant = this.orientationQuadrant;
        }

        // don't show if behind the camera
        this.visible = !this.isBehindCamera(this.stemLine, camera);
    }

    protected createHTMLElement(): ExtendedAnnotation
    {
        return new ExtendedAnnotation(this);
    }
}

AnnotationFactory.registerType(ExtendedSprite);

////////////////////////////////////////////////////////////////////////////////

@customElement("sv-extended-annotation")
class ExtendedAnnotation extends AnnotationElement
{
    protected titleElement: HTMLDivElement;
    protected contentElement: HTMLDivElement;
    protected wrapperElement: HTMLDivElement;
    protected handler = 0;
    protected isExpanded = undefined;

    constructor(sprite: AnnotationSprite)
    {
        super(sprite);

        this.onClickTitle = this.onClickTitle.bind(this);
        this.onClickArticle = this.onClickArticle.bind(this);

        this.titleElement = this.appendElement("div");
        this.titleElement.classList.add("sv-title");
        this.titleElement.addEventListener("click", this.onClickTitle);

        this.wrapperElement = this.appendElement("div");

        this.contentElement = this.createElement("div", null, this.wrapperElement);
        this.contentElement.classList.add("sv-content");
    }

    protected firstConnected()
    {
        super.firstConnected();
        this.classList.add("sv-extended-annotation");
    }

    protected update(changedProperties: PropertyValues): void
    {
        super.update(changedProperties);

        const annotation = this.sprite.annotation.data;

        // update title
        this.titleElement.innerText = annotation.title;

        // update content
        const contentTemplate = html`
            ${annotation.imageUri ? html`<img class="sv-annotation-img" src="${annotation.imageUri}"></img>` : null}     
            <p>${annotation.lead}</p>
            ${annotation.articleId ? html`<ff-button inline text="Read more..." icon="document" @click=${this.onClickArticle}></ff-button>` : null}`;

        render(contentTemplate, this.contentElement);

        // update color
        _color.fromArray(annotation.color);
        this.style.borderColor = _color.toString();

        // update expanded/collapsed
        if (this.isExpanded !== annotation.expanded) {

            this.isExpanded = annotation.expanded;
            window.clearTimeout(this.handler);

            if (this.isExpanded) {
                this.classList.add("sv-expanded");
                this.contentElement.style.display = "inherit";
                this.contentElement.style.height = this.contentElement.scrollHeight + "px";

            }
            else {
                this.classList.remove("sv-expanded");
                this.contentElement.style.height = "0";
                this.handler = window.setTimeout(() => this.contentElement.style.display = "none", 300);
            }
        }
    }

    protected onClickTitle(event: MouseEvent)
    {
        event.stopPropagation();
        this.sprite.emitClickEvent();
    }

    protected onClickArticle(event: MouseEvent)
    {
        event.stopPropagation();
        this.sprite.emitLinkEvent(this.sprite.annotation.data.articleId);
    }
}