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

import * as THREE from "three";

////////////////////////////////////////////////////////////////////////////////

export default class TextureLoader
{
    static readonly extensions = [ "jpg", "png" ];
    static readonly mimeTypes = [ "image/jpeg", "image/png" ];

    protected textureLoader: THREE.TextureLoader;


    constructor(loadingManager: THREE.LoadingManager)
    {
        this.textureLoader = new THREE.TextureLoader(loadingManager);
    }

    canLoad(url: string): boolean
    {
        const extension = url.split(".").pop().toLowerCase();
        return TextureLoader.extensions.indexOf(extension) >= 0;
    }

    canLoadMimeType(mimeType: string): boolean
    {
        return TextureLoader.mimeTypes.indexOf(mimeType) >= 0;
    }

    load(url: string): Promise<THREE.Texture>
    {
        return new Promise((resolve, reject) => {
            this.textureLoader.load(url, texture => {
                resolve(texture);
            }, null, errorEvent => {
                console.error(errorEvent);
                reject(new Error(errorEvent.message));
            });
        });
    }

    loadImmediate(url: string): THREE.Texture
    {
        return this.textureLoader.load(url, null, null, errorEvent => {
            console.error(errorEvent);
        });
    }
}