/*
 * Copyright (c) 2012 Francisco Salavert (ICM-CIPF)
 * Copyright (c) 2012 Ruben Sanchez (ICM-CIPF)
 * Copyright (c) 2012 Ignacio Medina (ICM-CIPF)
 *
 * This file is part of JS Common Libs.
 *
 * JS Common Libs is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 2 of the License, or
 * (at your option) any later version.
 *
 * JS Common Libs is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with JS Common Libs. If not, see <http://www.gnu.org/licenses/>.
 */

BamTrack.prototype = new Track({});

function BamTrack(args) {
    Track.call(this,args);
    // Using Underscore 'extend' function to extend and add Backbone Events
    _.extend(this, Backbone.Events);

    //set default args

    //save default render reference;
    this.defaultRenderer = this.renderer;
    this.histogramRenderer = new HistogramRenderer();


    this.chunksDisplayed = {};

    //set instantiation args, must be last
    _.extend(this, args);
};

BamTrack.prototype.render = function(targetId){
    var _this = this;
    this.initializeDom(targetId);

    this.svgCanvasOffset = (this.width * 3 / 2) / this.pixelBase;
    this.svgCanvasLeftLimit = this.region.start - this.svgCanvasOffset*2;
    this.svgCanvasRightLimit = this.region.start + this.svgCanvasOffset*2

    this.dataAdapter.on('data:ready',function(event){
        if(event.params.histogram == true){
            _this.renderer = _this.histogramRenderer;
        }else{
            _this.renderer = _this.defaultRenderer;
        }
//        _this.setHeight(_this.height - trackSvg.getHeight());//modify height before redraw
        var features = _this._removeDisplayedChunks(event);
        _this.renderer.render(features, {
            svgCanvasFeatures : _this.svgCanvasFeatures,
            featureTypes:_this.featureTypes,
            renderedArea:_this.renderedArea,
            pixelBase : _this.pixelBase,
            position : _this.region.center(),
            region : _this.region,
            width : _this.width,
            zoom : _this.zoom,
            labelZoom : _this.labelZoom,
            pixelPosition : _this.pixelPosition
        });

        _this.updateHeight();
        _this.setLoading(false);
    });

};

BamTrack.prototype.draw = function(){
    var _this = this;

    this.svgCanvasOffset = (this.width * 3 / 2) / this.pixelBase;
    this.svgCanvasLeftLimit = this.region.start - this.svgCanvasOffset*2;
    this.svgCanvasRightLimit = this.region.start + this.svgCanvasOffset*2

    this.updateHistogramParams();
    this.cleanSvg();
//    setCallRegion();

    if( this.zoom >= this.visibleRange.start && this.zoom <= this.visibleRange.end ){
        this.setLoading(true);
        var data = this.dataAdapter.getData({
            chromosome:this.region.chromosome,
            start:this.region.start-this.svgCanvasOffset*2,
            end:this.region.end+this.svgCanvasOffset*2,
            histogram:this.histogram,
            histogramLogarithm:this.histogramLogarithm,
            histogramMax:this.histogramMax,
            interval:this.interval
        });

        this.invalidZoomText.setAttribute("visibility", "hidden");
    }else{
        this.invalidZoomText.setAttribute("visibility", "visible");
    }

};


BamTrack.prototype.move = function(disp){
    var _this = this;
//    trackSvg.position = _this.region.center();
    _this.region.center();
    var pixelDisplacement = disp*_this.pixelBase;
    this.pixelPosition-=pixelDisplacement;

    //parseFloat important
    var move =  parseFloat(this.svgCanvasFeatures.getAttribute("x")) + pixelDisplacement;
    this.svgCanvasFeatures.setAttribute("x",move);

    var virtualStart = parseInt(this.region.start - this.svgCanvasOffset);
    var virtualEnd = parseInt(this.region.end + this.svgCanvasOffset);
    // check if track is visible in this zoom
    if(this.zoom >= this.visibleRange.start && this.zoom <= this.visibleRange.end){

        if(disp>0 && virtualStart < this.svgCanvasLeftLimit){
            this.dataAdapter.getData({
                chromosome:_this.region.chromosome,
                start:parseInt(this.svgCanvasLeftLimit-this.svgCanvasOffset),
                end:this.svgCanvasLeftLimit,
                histogram:this.histogram,
                histogramLogarithm:this.histogramLogarithm,
                histogramMax:this.histogramMax,
                interval:this.interval
            });
            this.svgCanvasLeftLimit = parseInt(this.svgCanvasLeftLimit - this.svgCanvasOffset);
        }

        if(disp<0 && virtualEnd > this.svgCanvasRightLimit){
            this.dataAdapter.getData({
                chromosome:_this.region.chromosome,
                start:this.svgCanvasRightLimit,
                end:parseInt(this.svgCanvasRightLimit+this.svgCanvasOffset),
                histogram:this.histogram,
                histogramLogarithm:this.histogramLogarithm,
                histogramMax:this.histogramMax,
                interval:this.interval
            });
            this.svgCanvasRightLimit = parseInt(this.svgCanvasRightLimit+this.svgCanvasOffset);
        }

    }

};

BamTrack.prototype._removeDisplayedChunks = function(response){
    //Returns an array avoiding already drawn features in this.chunksDisplayed
    var chunks = response.items;
    var newChunks = [];
    var dataType = response.params.dataType;
    var chromosome = response.params.chromosome;

    var feature, displayed, featureFirstChunk, featureLastChunk, features = [];
    for ( var i = 0, leni = chunks.length; i < leni; i++) {//loop over chunks
        if(this.chunksDisplayed[chunks[i].key+dataType] != true){//check if any chunk is already displayed and skip it

            features = []; //initialize array, will contain features not drawn by other drawn chunks
            for ( var j = 0, lenj = chunks[i][dataType].length; j < lenj; j++) {
                feature = chunks[i][dataType][j];

                //check if any feature has been already displayed by another chunk
                displayed = false;
                featureFirstChunk = this.dataAdapter.featureCache._getChunk(feature.start);
                featureLastChunk = this.dataAdapter.featureCache._getChunk(feature.end);
                for(var f=featureFirstChunk; f<=featureLastChunk; f++){//loop over chunks touched by this feature
                    var fkey = chromosome+":"+f;
                    if(this.chunksDisplayed[fkey+dataType]==true){
                        displayed = true;
                        break;
                    }
                }
                if(!displayed){
                    features.push(feature);
                }
            }
            this.chunksDisplayed[chunks[i].key+dataType]=true;
            chunks[i][dataType] = features;//update features array
            newChunks.push(chunks[i]);
        }
    }
    response.items = newChunks;
    return response;
};