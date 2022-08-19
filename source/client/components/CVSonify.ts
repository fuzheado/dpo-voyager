/**
 * 3D Foundation Project
 * Copyright 2021 Smithsonian Institution
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

import Component, { types } from "@ff/graph/Component";
import { IPointerEvent } from "@ff/scene/RenderView";
import CRenderer from "client/../../libs/ff-scene/source/components/CRenderer";
import { WebGLRenderTarget, NearestFilter, Vector3, Color, PlaneGeometry, Mesh, Box3, Plane, Scene, OrthographicCamera, Box2, Vector2 } from "three";
import DepthShader from "../shaders/DepthShader";
import MinMaxShader from "../shaders/MinMaxShader";
import CVScene from "./CVScene";
import CVSetup from "./CVSetup";
import CVAnalytics from "./CVAnalytics";
import { computeLocalBoundingBox } from "@ff/three/helpers";
import CVOrbitNavigation from "./CVOrbitNavigation";
import CVAssetReader from "./CVAssetReader";
import Notification from "@ff/ui/Notification";

////////////////////////////////////////////////////////////////////////////////

const corners = [[1,1,1],[0,1,1],[0,0,1],[1,0,1],[0,0,0],[0,1,0],[1,1,0],[1,0,0]];
const minBoundsByView = [[0,1,0],[1,1,1],[0,1,0],[0,0,1],[0,1,1],[1,1,0]];  // left,right,top,bottom,front,back
const maxBoundsByView = [[0,0,1],[1,0,0],[1,1,1],[1,0,0],[1,0,1],[0,0,0]];  // left,right,top,bottom,front,back

const _target: Vector3 = new Vector3();
const _dir: Vector3 = new Vector3();
const _point: Vector2 = new Vector2();
const _point2: Vector2 = new Vector2();
const _color = new Color();
const _plane = new Plane();
const _box = new Box3();
const _lowVolume: number = 0.25;

export enum ESonifyMode { Frequency, Beep };

export default class CVSonify extends Component
{
    static readonly typeName: string = "CVSonify";

    protected static readonly ins = {
        active: types.Boolean("Sonify.Active", false),
        scanning: types.Boolean("Sonify.Scanning", false),
        visible: types.Boolean("Sonify.Visible", false),
        closed: types.Event("Sonify.Closed"),
        playIntro: types.Boolean("Sonify.PlayIntro", false),
        mode: types.Enum("Sonify.Mode", ESonifyMode, ESonifyMode.Frequency),
    };

    protected static readonly outs = {
        mode: types.Enum("Sonify.Mode", ESonifyMode, ESonifyMode.Frequency),
        scanline: types.Vector2("Sonify.Scanline"),
        introIsPlaying: types.Boolean("Sonify.IntroIsPlaying", false),
    };

    protected get renderer() {
        return this.getMainComponent(CRenderer);
    }
    protected get sceneNode() {
        return this.getSystemComponent(CVScene);
    }
    protected get setup() {
        return this.getSystemComponent(CVSetup);
    }
    protected get analytics() {
        return this.system.getMainComponent(CVAnalytics);
    }
    protected get navigation() {
        return this.system.getComponent(CVOrbitNavigation);
    }
    protected get assetReader() {
        return this.getMainComponent(CVAssetReader);
    }

    protected audioCtx: AudioContext = null;
    protected oscillator: OscillatorNode = null;
    protected bufferSource: AudioBufferSourceNode = null;
    protected gain: GainNode = null;
    protected limiter: DynamicsCompressorNode = null;
    protected filter: BiquadFilterNode = null;
    protected convTarget: WebGLRenderTarget = null;
    protected pickBuffer: Uint8Array;
    protected depthShader: DepthShader;
    protected minMaxShader: MinMaxShader;
    protected depthLimits: number[] = [];
    protected scanIterval: number = null;
    protected beepElement: HTMLAudioElement = null;
    protected sonifyDot: HTMLDivElement = null;
    protected scanMin: number[] = [];
    protected scanDims: number[] = [];
    protected scanBox: Box2 = null;
    protected volumeDist: number = 0;

    protected isPlaying: boolean = false;

    ins = this.addInputs(CVSonify.ins);
    outs = this.addOutputs(CVSonify.outs);

    create()
    {
        super.create();

        //this.system.on(["pointer-down", "pointer-up", "pointer-move"], this.onPointer, this);
        this.system.on(["pointer-hover", "pointer-move"], this.onPointer, this);
        
        const AudioContext = window.AudioContext;// || window.webkitAudioContext;
        this.audioCtx = new AudioContext();

        this.convTarget = new WebGLRenderTarget( window.innerWidth, window.innerHeight, { stencilBuffer: false } );

        this.pickBuffer = new Uint8Array(4);
        this.depthShader = new DepthShader();
        this.minMaxShader = new MinMaxShader();

        this.beepElement = document.createElement("audio");
        this.beepElement.src = "data:audio/wav;base64,//uQRAAAAWMSLwUIYAAsYkXgoQwAEaYLWfkWgAI0wWs/ItAAAGDgYtAgAyN"
            + "+QWaAAihwMWm4G8QQRDiMcCBcH3Cc+CDv/7xA4Tvh9Rz/y8QADBwMWgQAZG/ILNAARQ4GLTcDeIIIhxGOBAuD7hOfBB3/94gcJ"
            + "3w+o5/5eIAIAAAVwWgQAVQ2ORaIQwEMAJiDg95G4nQL7mQVWI6GwRcfsZAcsKkJvxgxEjzFUgfHoSQ9Qq7KNwqHwuB13MA4a1q"
            + "/DmBrHgPcmjiGoh//EwC5nGPEmS4RcfkVKOhJf+WOgoxJclFz3kgn//dBA+ya1GhurNn8zb//9NNutNuhz31f////9vt///z+I"
            + "dAEAAAK4LQIAKobHItEIYCGAExBwe8jcToF9zIKrEdDYIuP2MgOWFSE34wYiR5iqQPj0JIeoVdlG4VD4XA67mAcNa1fhzA1jwH"
            + "uTRxDUQ//iYBczjHiTJcIuPyKlHQkv/LHQUYkuSi57yQT//uggfZNajQ3Vmz+Zt//+mm3Wm3Q576v////+32///5/EOgAAADVg"
            + "hQAAAAA//uQZAUAB1WI0PZugAAAAAoQwAAAEk3nRd2qAAAAACiDgAAAAAAABCqEEQRLCgwpBGMlJkIz8jKhGvj4k6jzRnqasNK"
            + "Ieoh5gI7BJaC1A1AoNBjJgbyApVS4IDlZgDU5WUAxEKDNmmALHzZp0Fkz1FMTmGFl1FMEyodIavcCAUHDWrKAIA4aa2oCgILEB"
            + "upZgHvAhEBcZ6joQBxS76AgccrFlczBvKLC0QI2cBoCFvfTDAo7eoOQInqDPBtvrDEZBNYN5xwNwxQRfw8ZQ5wQVLvO8OYU+mH"
            + "vFLlDh05Mdg7BT6YrRPpCBznMB2r//xKJjyyOh+cImr2/4doscwD6neZjuZR4AgAABYAAAABy1xcdQtxYBYYZdifkUDgzzXaXn"
            + "98Z0oi9ILU5mBjFANmRwlVJ3/6jYDAmxaiDG3/6xjQQCCKkRb/6kg/wW+kSJ5//rLobkLSiKmqP/0ikJuDaSaSf/6JiLYLEYnW"
            + "/+kXg1WRVJL/9EmQ1YZIsv/6Qzwy5qk7/+tEU0nkls3/zIUMPKNX/6yZLf+kFgAfgGyLFAUwY//uQZAUABcd5UiNPVXAAAApAA"
            + "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///////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////VEFHAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAU291bmRib3kuZGUAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAMjAwNGh0dHA6Ly93d3cuc291bmRib3kuZGUAAAAAAAAAACU=";
            
        this.scanBox = new Box2();
        
        window.addEventListener("resize", this.debounce(this.onResize, 200, false));
        window.addEventListener("fullscreenchange", this.onResize);
    }

    dispose()
    {
        if(this.audioCtx) {
            this.audioCtx.close();
        }

        //this.system.off(["pointer-down", "pointer-up", "pointer-move"], this.onPointer, this);
        this.system.off(["pointer-hover", "pointer-move"], this.onPointer, this);

        window.removeEventListener("fullscreenchange", this.onResize);
        window.removeEventListener("resize", this.debounce(this.onResize, 200, false));
        
        super.dispose();
    }

    update(context)
    {
        const { ins, outs } = this;

        if (ins.active.changed && ins.scanning.value) {
            ins.scanning.setValue(false, true);
        }
        else if (ins.scanning.changed && ins.active.value) {
            ins.active.setValue(false, true);
        }

        if (ins.active.changed || ins.scanning.changed) {
            if(this.gain) {
                this.oscillator.stop();
                this.bufferSource.stop();

                if(this.outs.mode.value === ESonifyMode.Beep) {
                    this.bufferSource.disconnect(this.gain);
                }
                else {
                    this.oscillator.disconnect(this.gain);
                }

                this.isPlaying = false;
                clearInterval(this.scanIterval);

                this.filter.disconnect(this.audioCtx.destination);

                this.gain = null;
                this.oscillator = null;
                this.bufferSource = null;
                this.filter = null;
                this.limiter = null;

                //console.log("Stopping Audio");
            }

            if(ins.active.value || ins.scanning.value) {
                //console.log("Playing Audio Context");

                this.generateDepthMap();

                if (this.audioCtx.state === 'suspended') {
                    this.audioCtx.resume();
                }

                const filterNode = this.filter = this.audioCtx.createBiquadFilter();
                filterNode.frequency.value = 580;
                filterNode.Q.value = 0.001;
                filterNode.connect(this.audioCtx.destination);

                const limiterNode = this.limiter = this.audioCtx.createDynamicsCompressor();
                limiterNode.threshold.value = 0.0;
                limiterNode.knee.value = 0.0;
                limiterNode.ratio.value = 20.0;
                limiterNode.attack.value = 0.005;
                limiterNode.release.value = 0.050;
                limiterNode.connect(filterNode);
                //limiterNode.connect(this.audioCtx.destination);

                const gainNode = this.gain = this.audioCtx.createGain();
                //gainNode.connect(this.audioCtx.destination);
                gainNode.connect(limiterNode);
                //gainNode.gain.value = outs.mode.value === ESonifyMode.Volume ? _lowVolume : 1.0;

                const osc = this.oscillator = this.audioCtx.createOscillator();
                osc.type = 'sine';
                osc.frequency.value = 80;
                osc.start();

                this.setupBufferSource();
                this.bufferSource.start(0);

                if(this.outs.mode.value === ESonifyMode.Beep) {
                    this.bufferSource.connect(gainNode);
                }
                else {
                    osc.connect(gainNode);
                }

                this.analytics.sendProperty("Menu.Sonify", true);

                if(ins.active.value) {
                    this.isPlaying = true;
                }
                else {
                    this.startScanlines();
                }         
            }
        }
        else if(ins.mode.changed) {
            const outMode = outs.mode;
            const inMode = ins.mode.value;
            const osc = this.oscillator;
            const gainNode = this.gain;

            if(inMode === outMode.value) {
                return false;
            }

            if(this.ins.active.value || ins.scanning.value) {
                //gainNode.gain.value  = inMode === ESonifyMode.Volume ? _lowVolume : 1.0;
                osc.frequency.value = 80;
            
                if(inMode === ESonifyMode.Beep) {   
                    osc.disconnect(gainNode);
                    this.bufferSource.connect(gainNode);
                }
                else {
                    if(outMode.value  === ESonifyMode.Beep) {
                        this.bufferSource.disconnect(gainNode);
                        osc.connect(gainNode);
                    }   
                }
            }

            outMode.setValue(inMode);
        }
        
        if(ins.visible.changed) {
            const navigation = this.setup.navigation;
            const audio = this.setup.audio;
            this.onResize();
            if(ins.visible.value) {
                navigation.ins.enabled.setValue(false, true);
                navigation.ins.preset.on("value", this.onViewChange, this);
                this.setup.audio.outs.narrationPlaying.on("value", this.audioChanged, this);

                Notification.show(`Reminder: make sure your sound is on for this feature to work!`, "info");
            }
            else {
                this.setup.audio.outs.narrationPlaying.off("value", this.audioChanged, this);
                navigation.ins.preset.off("value", this.onViewChange, this);
                navigation.ins.enabled.setValue(true, true);
                audio.stop();
            }
        }

        if(ins.playIntro.changed) {
            const audio = this.setup.audio;
            if(!ins.playIntro.value) {
                audio.stop();
            }
            else {
                audio.playURI(this.assetReader.getSystemAssetUrl("SonifyIntro.mp3"));
                this.outs.introIsPlaying.setValue(true);
            }
        }

        return true;
    }

    protected onPointer(event: IPointerEvent)
    {
        if(this.isPlaying) {
            this.updateSonification(event.localX, event.localY);
        }
    }

    protected updateSonification(x: number, y: number) {
        const renderer = this.renderer.views[0].renderer;
        const buffer = this.pickBuffer;
        const limits = this.depthLimits;

        renderer.readRenderTargetPixels(this.convTarget, x, this.convTarget.height-y, 1, 1, buffer);

        const depth = buffer[3] * 2.337437050015319e-10 
        + buffer[2] * 5.983838848039216e-8 
        + buffer[1] * 1.531862745098039e-5 
        + buffer[0] * 0.003921568627451;

        // Normalize depth
        const nDepth = Math.max((depth - limits[0])/(limits[1] - limits[0]), 0);

        if(this.ins.mode.value === ESonifyMode.Frequency) {
            this.oscillator.frequency.value = nDepth <= 0.000001 ? 80 : 80 + 500*(1.0-nDepth);
        }
        else {
            this.bufferSource.loopEnd =  nDepth <= 0.000001 ? 1.0 : 1 / ((60 + (640.0*(1.0-nDepth))) / 60);
            //this.bufferSource.playbackRate.value = nDepth <= 0.000001 ? 1.0 : 1 + (10.0*(1.0-nDepth));
        }

        // Update volume based on proximity to object on screen
        _point.set(x,y);
        const dist = this.scanBox.distanceToPoint(_point);
        this.gain.gain.setTargetAtTime(1.0 - 0.9*(dist/this.volumeDist), 0, 0.01);

        //console.log(x + " " + y + " DEPTH: " + nDepth);
    }

    protected generateDepthMap()
    {
        const sceneComponent = this.system.getComponent(CRenderer, true).activeSceneComponent;
        const scene = sceneComponent && sceneComponent.scene;
        const sceneNode = this.sceneNode;
        const camera = sceneComponent && sceneComponent.activeCamera;
        const target = this.convTarget;
        //const bbox = /*sceneNode.models.length === 1 ? _box.copy(sceneNode.models[0].localBoundingBox).applyMatrix4(sceneNode.models[0].object3D.matrixWorld)
        //                                             :*/ sceneNode.outs.boundingBox.value;
        
        computeLocalBoundingBox(sceneNode.models[0].object3D, _box, sceneNode.object3D);
        const bbox: Box3 = _box;

        const reducedTargets: WebGLRenderTarget[] = [];

        // Create reducing power of 2 render targets for finding min/max depth
        let height = this.getPowerOfTwo(target.height);
        let width = this.getPowerOfTwo(target.width);
        while(height > 1 || width > 1) {
            height = Math.max(height/2, 1);
            width = Math.max(width/2, 1);
            reducedTargets.push(new WebGLRenderTarget( width, height, { stencilBuffer: false, minFilter: NearestFilter, magFilter: NearestFilter } ));
        }

        const oldFarPlane = camera.far;
        const oldNearPlane = camera.near;

        camera.getWorldDirection(_dir);
        camera.getWorldPosition(_target);

        _plane.set(_dir, _target.length());

        // Calculate new near and far planes based on bbox
        camera.far = 0;
        camera.near = 1000000;
        corners.forEach(corner => {
            _target.set(bbox.max.x*corner[0]+bbox.min.x*(1-corner[0]),
                bbox.max.y*corner[1]+bbox.min.y*(1-corner[1]),
                bbox.max.z*corner[2]+bbox.min.z*(1-corner[2])); 
            
            camera.far = Math.max(camera.far, _plane.distanceToPoint(_target));
            camera.near = Math.min(camera.near, _plane.distanceToPoint(_target));
        });

        camera.updateProjectionMatrix();


        let cornerSelect = minBoundsByView[this.navigation.ins.preset.value]
        _target.set(cornerSelect[0] ? bbox.max.x : bbox.min.x, cornerSelect[1] ? bbox.max.y : bbox.min.y, cornerSelect[2] ? bbox.max.z : bbox.min.z);
        _target.project(camera);
        const halfWidth = this.convTarget.width / 2;
        const halfHeight = this.convTarget.height / 2;

        this.scanMin[0] = (_target.x * halfWidth) + halfWidth;
        this.scanMin[1] = -(_target.y * halfHeight) + halfHeight;

        cornerSelect = maxBoundsByView[this.navigation.ins.preset.value]
        _target.set(cornerSelect[0] ? bbox.max.x : bbox.min.x, cornerSelect[1] ? bbox.max.y : bbox.min.y, cornerSelect[2] ? bbox.max.z : bbox.min.z);
        _target.project(camera);

        this.scanDims[0] = Math.abs(this.scanMin[0] - ((_target.x * halfWidth) + halfWidth));
        this.scanDims[1] = Math.abs(this.scanMin[1] - (-(_target.y * halfHeight) + halfHeight));

        _point.set(this.scanMin[0], this.scanMin[1]);
        _point2.set(_point.x+this.scanDims[0], _point.y+this.scanDims[1]);
        this.scanBox.set(_point, _point2);
        this.volumeDist = Math.sqrt(Math.pow((target.width-this.scanDims[0])/2.0,2.0) + Math.pow((target.height-this.scanDims[1])/2.0,2.0));

        const renderer = this.renderer.views[0].renderer;  
        
        const overrideMaterial = scene.overrideMaterial;
        renderer.getClearColor(_color);
        renderer.setClearColor(0, 0);

        this.depthShader.uniforms.cameraNear.value = camera.near;
        this.depthShader.uniforms.cameraFar.value = camera.far;
        scene.overrideMaterial = this.depthShader;
        renderer.setRenderTarget( this.convTarget );
        renderer.clear();
        renderer.render( scene, camera );
        renderer.setRenderTarget( null );
        
        scene.overrideMaterial = overrideMaterial;

        camera.far = oldFarPlane;
        camera.near = oldNearPlane;
        camera.updateProjectionMatrix();


        // Find depth min/max
        const sceneRTT = new Scene();
        const plane = new PlaneGeometry( target.width, target.height );
		const quad = new Mesh( plane );
        quad.position.z = - 100;
        sceneRTT.add(quad);

        const cameraRTT = new OrthographicCamera( target.width / - 2, target.width / 2, target.height / 2, target.height / - 2, - 10000, 10000 );
                cameraRTT.position.z = 100;
                
        const passes: number[] = [0,1];

        passes.forEach(pass => {
            this.minMaxShader.uniforms.tDepth.value = target.texture;
            this.minMaxShader.uniforms.xStep.value = 1.0 / target.width;
            this.minMaxShader.uniforms.yStep.value = 1.0 / target.height;
            this.minMaxShader.uniforms.pass.value = pass;
            
            reducedTargets.forEach(mTarget => {
                this.minMaxShader.uniforms.xOffset.value = 1.0 / mTarget.width;
                this.minMaxShader.uniforms.yOffset.value = 1.0 / mTarget.height;

                sceneRTT.overrideMaterial = this.minMaxShader;
                renderer.setRenderTarget( mTarget );
                renderer.clear();
                renderer.render( sceneRTT, cameraRTT );
                sceneRTT.overrideMaterial = overrideMaterial;

                this.minMaxShader.uniforms.tDepth.value = mTarget.texture;
                this.minMaxShader.uniforms.xStep.value = 1.0 / mTarget.width;
                this.minMaxShader.uniforms.yStep.value = 1.0 / mTarget.height;

                /*var material = new MeshBasicMaterial( {map:this.minMaxShader.uniforms.tDepth.value} );
                quad.material = material;
                renderer.setRenderTarget( null );
                renderer.render( scene2, cameraRTT );
                var dataURL = renderer.domElement.toDataURL();
                console.log(dataURL);*/
            });

            const buffer = this.pickBuffer;
            const finalTarget = reducedTargets[reducedTargets.length-1];
            renderer.readRenderTargetPixels(finalTarget, 0, 0, 1, 1, buffer);

            const depth = buffer[3] * 2.337437050015319e-10 
            + buffer[2] * 5.983838848039216e-8 
            + buffer[1] * 1.531862745098039e-5 
            + buffer[0] * 0.003921568627451;

            passes[pass] = depth;
        })

        renderer.setClearColor(_color);
        renderer.setRenderTarget( null );
        
        this.depthLimits = passes;

        //console.log("Min: " + passes[0] + " Max: " + passes[1]);
    }

    protected onViewChange()
    {
        const navigation = this.setup.navigation;
        navigation.ins.enabled.setValue(true);
        navigation.update();
        navigation.tick();
        navigation.ins.enabled.setValue(false);
        this.generateDepthMap();
    }

    protected onResize = () => 
    {   
        if(this.ins.visible.value) {
            const view = this.renderer.views[0];
            this.convTarget.dispose();
            this.convTarget = new WebGLRenderTarget( view.canvasWidth, view.canvasHeight, { stencilBuffer: false } );
            this.generateDepthMap();
        }
    }

    protected getPowerOfTwo(input: number)
    {
        input--;
        input |= input >> 1;
        input |= input >> 2;
        input |= input >> 4;
        input++;

        return input;
    }

    // From underscore.js
    protected debounce(func: Function, wait: number, immediate: boolean) {
        var timeout;
        return function() {
            var context = this, args = arguments;
            var later = function() {
                timeout = null;
                if (!immediate) func.apply(context, args);
            };
            var callNow = immediate && !timeout;
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
            if (callNow) func.apply(context, args);
        };
    };

    // Adapted from: https://github.com/padenot/metro/blob/master/metro.js.md
    // MIT License, Copyright (c) 2014 Paul Adenot
    // https://github.com/padenot/metro/blob/master/LICENSE
    protected setupBufferSource() {
        const ac = this.audioCtx;
        const buf = ac.createBuffer(1, ac.sampleRate * 2, ac.sampleRate);
        const channel = buf.getChannelData(0);
        let phase = 0;
        let amp = 1;
        const duration_frames = ac.sampleRate / 50;
        const f = 330;
        for (var i = 0; i < duration_frames; i++) {
          channel[i] = Math.sin(phase) * amp;
          phase += 2 * Math.PI * f / ac.sampleRate;
          if (phase > 2 * Math.PI) {
            phase -= 2 * Math.PI;
          }
          amp -= 1 / duration_frames;
        }
        const source = this.bufferSource = ac.createBufferSource();
        source.buffer = buf;
        source.loop = true;
        source.loopEnd = 1 / (60 / 60);
    }

    protected startScanlines() {
        let elapsedTime = 0;
        let lineCount = 0;
        const scanMin = this.scanMin;
        const height = this.scanDims[1];
        const width = this.scanDims[0];
        const increment = 2000/width;
        this.scanIterval = window.setInterval(() => {

            if(elapsedTime === 0) {
                this.beepElement.currentTime = 0;
                this.beepElement.play();
            }

            elapsedTime += increment;
            this.outs.scanline.setValue([scanMin[0] + width*(elapsedTime/2000), scanMin[1]+(height/20)*lineCount]);

            if(elapsedTime > 2000) {
                lineCount++;
                elapsedTime = 0;
            }

            if(lineCount > 20) {
                this.ins.scanning.setValue(false);
                return;
            }

            this.updateSonification(scanMin[0] + width*(elapsedTime/2000), scanMin[1]+(height/20)*lineCount);
        }, increment);
    }

    protected audioChanged() {
        const isPlayingIntro = this.setup.audio.outs.narrationPlaying.value;
        this.outs.introIsPlaying.setValue(isPlayingIntro && this.ins.visible.value);
    }
}