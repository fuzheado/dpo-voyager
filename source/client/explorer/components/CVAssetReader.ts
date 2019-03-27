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

import resolvePathname from "resolve-pathname";
import * as THREE from "three";

import Component, { Node, types } from "@ff/graph/Component";

import { IDocument } from "common/types/document";

import JSONReader from "../../core/readers/JSONReader";
import DocumentValidator from "../../core/readers/DocumentValidator";
import ModelReader from "../../core/readers/ModelReader";
import GeometryReader from "../../core/readers/GeometryReader";
import TextureReader from "../../core/readers/TextureReader";

////////////////////////////////////////////////////////////////////////////////

const _VERBOSE = true;

export interface IAssetService
{
    setBusy: (isBusy: boolean) => void;
}

export default class CVAssetReader extends Component implements IAssetService
{
    static readonly typeName: string = "CVAssetReader";

    protected static readonly ins = {
        rootUrl: types.String("Reader.RootURL"),
        setBusy: types.Boolean("Reader.SetBusy"),
    };

    protected static readonly outs = {
        busy: types.Boolean("Reader.IsBusy"),
    };

    ins = this.addInputs(CVAssetReader.ins);
    outs = this.addOutputs(CVAssetReader.outs);

    readonly jsonLoader: JSONReader;
    readonly validator: DocumentValidator;
    readonly modelLoader: ModelReader;
    readonly geometryLoader: GeometryReader;
    readonly textureLoader: TextureReader;

    private _loadingManager: AssetLoadingManager;
    private _isBusy = false;


    constructor(node: Node, id: string)
    {
        super(node, id);

        const loadingManager = this._loadingManager = new AssetLoadingManager(this);

        this.jsonLoader = new JSONReader(loadingManager);
        this.validator = new DocumentValidator();
        this.modelLoader = new ModelReader(loadingManager);
        this.geometryLoader = new GeometryReader(loadingManager);
        this.textureLoader = new TextureReader(loadingManager);
    }

    update(context)
    {
        const ins = this.ins;

        if (ins.setBusy.changed) {
            this.outs.busy.setValue(ins.setBusy.value || this._isBusy);
        }

        return true;
    }

    setBusy(isBusy: boolean)
    {
        this._isBusy = isBusy;
        this.outs.busy.setValue(this.ins.setBusy.value || this._isBusy);
    }

    setRootURL(url: string)
    {
        const href = window.location.href.split("?")[0];
        let rootUrl = resolvePathname(url, href);
        rootUrl = resolvePathname(".", rootUrl);
        this.ins.rootUrl.setValue(rootUrl);

        console.log("CVAssetReader.setRootURL - %s", rootUrl);
    }

    getAssetURL(uri: string)
    {
        return resolvePathname(uri, this.ins.rootUrl.value);
    }

    getJSON(assetPath: string): Promise<any>
    {
        const url = this.getAssetURL(assetPath);
        return this.jsonLoader.get(url);
    }

    getModel(assetPath: string): Promise<THREE.Object3D>
    {
        const url = this.getAssetURL(assetPath);
        return this.modelLoader.get(url);
    }

    getGeometry(assetPath: string): Promise<THREE.Geometry>
    {
        const url = this.getAssetURL(assetPath);
        return this.geometryLoader.get(url);
    }

    getTexture(assetPath: string): Promise<THREE.Texture>
    {
        const url = this.getAssetURL(assetPath);
        return this.textureLoader.get(url);
    }

    getDocument(assetPath: string): Promise<IDocument>
    {
        return this.getJSON(assetPath)
            .then(json => this.validateDocument(json));
    }

    validateDocument(json: any): Promise<IDocument>
    {
        return new Promise((resolve, reject) => {
            if (!this.validator.validate(json)) {
                return reject(new Error("document validation failed"));
            }

            return resolve(json as IDocument);
        });
    }
}

////////////////////////////////////////////////////////////////////////////////

export class AssetLoadingManager extends THREE.LoadingManager
{
    protected assetService: IAssetService;

    constructor(assetService: IAssetService)
    {
        super();
        this.assetService = assetService;

        this.onStart = this.onLoadingStart.bind(this);
        this.onProgress = this.onLoadingProgress.bind(this);
        this.onLoad = this.onLoadingCompleted.bind(this);
        this.onError = this.onLoadingError.bind(this);
    }

    protected onLoadingStart()
    {
        if (_VERBOSE) {
            console.log("Loading files...");
        }

        this.assetService.setBusy(true);
    }

    protected onLoadingProgress(url, itemsLoaded, itemsTotal)
    {
        if (_VERBOSE) {
            console.log(`Loaded ${itemsLoaded} of ${itemsTotal} files: ${url}`);
        }
    }

    protected onLoadingCompleted()
    {
        if (_VERBOSE) {
            console.log("Loading completed");
        }

        this.assetService.setBusy(false);
    }

    protected onLoadingError()
    {
        if (_VERBOSE) {
            console.error(`Loading error`);
        }

        this.assetService.setBusy(false);
    }
}