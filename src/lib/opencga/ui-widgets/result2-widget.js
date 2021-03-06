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

function ResultWidget(args) {
    var _this = this;

    //set default args
    this.extItems = [];

    //set instantiation args, must be last
    _.extend(this, args);

    this.panelId = null;
    this.networkViewerId = null;
    this.genomeMapsId = null;
}

ResultWidget.prototype = {
    id: "ResultWidget" + Math.round(Math.random() * 10000),
    draw: function (sid, record) {
        var _this = this;
        this.job = record.raw;

        this.job['command'] = Utils.parseJobCommand(this.job);

        this.jobId = this.job.id;
        this.id = this.jobId + this.id;
        this.panelId = "ResultWidget_" + this.jobId;

        this.panel = Ext.getCmp(this.panelId);
        if (this.panel == null) {
            this.panel = Ext.create('Ext.panel.Panel', {
                id: this.panelId,
                border: 0,
                title: this.job.name,
                closable: true,
                autoScroll: true
            });

            Ext.getCmp(this.targetId).add(this.panel);
            Ext.getCmp(this.targetId).setActiveTab(this.panel);
            this.panel.setLoading("Loading job info...");

            var url = OpencgaManager.jobResultUrl({
                accountId: $.cookie("bioinfo_account"),
                sessionId: sid,
                jobId: this.jobId,
                format: "json"
            });
            console.log(url);
            $.getScript(url, function () {
                _this.panel.setLoading(false);
                _this.result = RESULT;
                var layout = _this.result[_this.layoutName].layout;
                layout.outputItems = _this.job.outputData.sort(layout.sortOutputItems);
                layout.job = _this.job;
                _this.render(_this.result);
            });
        } else {
            Ext.getCmp(this.targetId).setActiveTab(this.panel);
        }
    },
    render: function (resultData) {
        var _this = this;
        console.log(this.application);

        var getJobInfo = function (args) {
            var args = args || {};
            var itemTpl = new Ext.XTemplate(
                '<p><span class="ssel border-bot s120">Information </span><span style="color:steelblue"> &nbsp; &nbsp; Job Id: <span><span style="color:slategrey">{id}</span></p><br>',
                '<p><span class="emph">{name}</span> - <span class="info"> {toolName} </span> - <span style="color:orangered"> {date}</span></p>',
                '<p class="tip emph">{description}</p>',
                '<p class="">{command.html}</p>'
            );
            var container = Ext.create('Ext.container.Container', {
                margin: '15 0 15 15',
                items: [
                    {
                        xtype: 'box',
                        data: _this.job,
                        tpl: itemTpl
                    },
                    {
                        xtype: 'container', layout: 'hbox', margin: '10 0 0 0', defaults: {margin: '0 5 0 5'},
                        items: [
                            {
                                xtype: 'button',
                                text: 'download',
                                handler: function () {
                                    OpencgaManager.downloadJob($.cookie('bioinfo_account'), $.cookie('bioinfo_sid'), _this.jobId);
                                }
                            },
                            {
                                xtype: 'button',
                                text: 'delete',
                                handler: function () {
                                    Ext.Msg.confirm("Delete job", "Are you sure you want to delete this job?", function (btnClicked) {
                                        if (btnClicked == "yes") {
                                            OpencgaManager.deleteJob({
                                                accountId: $.cookie('bioinfo_account'),
                                                sessionId: $.cookie('bioinfo_sid'),
                                                jobId: _this.jobId,
                                                success: function (data) {
                                                    var msg = "";
                                                    if (data.indexOf("OK") != -1) {
                                                        Ext.getCmp(_this.targetId).getActiveTab().close();
                                                        msg = "The job has been succesfully deleted.";
                                                    } else {
                                                        msg = "ERROR: could not delete job.";
                                                    }
                                                    Ext.Msg.alert("Delete job", msg);
                                                }
                                            });
                                        }
                                    });
                                }
                            }
                        ]
                    }
                ]
            });
            if (typeof args.items != 'undefined') {
                container.child('container').add(args.items);
            }
            return container;
        };

        var getResultIndex = function (children) {
            var boxes = [
                {xtype: 'box', cls: 'inlineblock ssel border-bot s120', html: 'Index', margin: 15}
            ];
            for (var i = 0; i < children.length; i++) {
                boxes.push(Ext.create('Ext.Component', {
                    margin: "0 15 0 15",
                    cls: 'dedo emph',
                    overCls: 'err',
                    resultId: _this.jobId + children[i].title.replace(/ /g, ''),
                    html: children[i].title,
                    listeners: {
                        afterrender: function (este) {
                            this.getEl().on("click", function () {
                                var pos = $('#' + este.resultId).position();
                                if (typeof pos != 'undefined') {
                                    var top = pos.top;
                                    $(_this.panel.getEl().dom).children().scrollTop(top - 10);
                                }

                                var tab = Ext.getCmp(este.resultId);//for tab mode
                                var parent = tab.up();
                                if (parent.isXType('tabpanel')) {
                                    parent.setActiveTab(tab);
                                }
                            });
                        }
                    }
                }));
            }
            return Ext.create('Ext.container.Container', {
                margin: '0 0 20 0',
                items: boxes
            });
        };

        var itemTpl = new Ext.XTemplate(
            '<span class="s140 emph">{title}</span>',
            '<span class="ok"> {pathi} </span>',
            '<span class="info"> {date}</span><br>'
        );

        var processLeafItem = function (item) {
            var boxes = [];
            var itemBox;
            for (var j = 0; j < item.renderers.length; j++) {
                var renderer = item.renderers[j];
                switch (renderer.type) {
                    case 'text':
                        itemBox = Ext.create('Ext.Component', {
                            html: '<span class="key">' + item.title + '</span> <span class="emph">' + item.file + '</span>',
                            item: item,
                            padding: 3,
//                            overCls: 'encima',
                            cls: 'inlineblock whiteborder'
                        });
                        break;
                    case 'file':
                        itemBox = Ext.create('Ext.Component', {
                            html: '<span class="key">' + item.title + '</span><span class="file">' + item.file + '</span>',
                            item: item,
                            padding: 3,
                            overCls: 'encima',
                            cls: 'inlineblock whiteborder',
                            listeners: {
                                afterrender: function () {
                                    var item = this.item;
                                    this.getEl().on("click", function () {
                                        console.log(item);
                                        OpencgaManager.poll({
                                            accountId: $.cookie('bioinfo_account'),
                                            sessionId: $.cookie('bioinfo_sid'),
                                            jobId: _this.jobId,
                                            filename: item.file,
                                            zip: true
                                        });
                                    });
                                }
                            }
                        });
                        break;
                    case 'image':
                        var url = OpencgaManager.pollurl({
                            accountId: $.cookie('bioinfo_account'),
                            sessionId: $.cookie('bioinfo_sid'),
                            jobId: _this.jobId,
                            filename: item.file
                        });
                        itemBox = Ext.create('Ext.Component', {
                            html: '<div><img src="' + url + '"></div>'
                        });
                        break;
                    case 'piechart':

                        var url = OpencgaManager.pollurl({
                            accountId: $.cookie('bioinfo_account'),
                            sessionId: $.cookie('bioinfo_sid'),
                            jobId: _this.jobId,
                            filename: item.file
                        });

                        var img;
                        $.ajax({
                            type: "GET",
                            async: false,
                            url: url,
                            success: function (data) {
                                if (data != "") {
                                    var lines = data.split("\n");
                                    var fields = [];
                                    var names = [];
                                    var values = [];
                                    var normValues = [];
                                    var total = 0;
                                    for (var i = 0; i < lines.length; i++) {
                                        fields.push(lines[i].split("\t"));
                                        if (fields[i][0] != "") {
                                            names.push(fields[i][0]);
                                        }
                                        if (fields[i][1] != null) {
                                            total = total + parseFloat(fields[i][1]);
                                            values.push(fields[i][1]);
                                        }
                                    }
                                    for (var i = 0; i < values.length; i++) {
                                        normValues.push(Math.round(parseFloat(values[i]) / total * 100));
                                    }
                                    names = names.toString().replace(/,/gi, "|");
                                    img = '<img src="https://chart.googleapis.com/chart?cht=p&chs=600x300&chd=t:' + normValues + '&chl=' + names + '&chtt=Consequence+types&chts=000000,14.5">';
                                }
                            }
                        });

                        itemBox = Ext.create('Ext.Component', {
                            html: '<div>' + img + '</div>'
                        });
                        break;
                    case 'grid':
                        var id = 'resultTable_' + _this.jobId + item.file;
                        var resultTable = new ResultTable(_this.jobId, item.file, item.tags, {targetId: id, tableLayout: renderer.tableLayout});
                        itemBox = Ext.create('Ext.Component', {
                            flex: 1,
                            resultTable: resultTable,
                            html: '<div id="' + id + '" style="padding:5px;"> </div>',
                            listeners: {
                                afterrender: function (este) {
                                    este.resultTable.draw();
                                }
                            }
                        });
                        break;
                    case 'table':
                        var url = OpencgaManager.pollurl({
                            accountId: $.cookie('bioinfo_account'),
                            sessionId: $.cookie('bioinfo_sid'),
                            jobId: _this.jobId,
                            filename: item.file
                        });
                        $.ajax({
                            type: "GET",
                            async: false,
                            url: url,
                            success: function (data) {
                                var tableHtml = '<table cellspacing="0" style="border-collapse: collapse;border:1px solid #ccc;"><tbody>';
                                var lines = data.split('\n');
                                var numLines = 0;
                                for (var i = 0; i < lines.length; i++) {
                                    var line = lines[i];
                                    if (line.charAt(0) != '#' && line.trim() != '') {
                                        numLines++;
                                        if (renderer.header && numLines == 1) {
                                            tableHtml += '<tr style="border-collapse: collapse;border:1px solid #ccc;font-weight:bold;">';
                                        } else {
                                            tableHtml += '<tr style="border-collapse: collapse;border:1px solid #ccc;">';
                                        }
                                        var fields = line.split('\t');
                                        for (var j = 0; j < fields.length; j++) {
                                            var field = fields[j];
                                            tableHtml += '<td style="border-collapse: collapse;border:1px solid #ccc;padding: 5px;background-color: whiteSmoke;">' + field + '</td>';
                                        }
                                        tableHtml += '</tr>';
                                    }
                                }
                                tableHtml += '</tbody></table>';

                                itemBox = Ext.create('Ext.Component', {
                                    flex: 1,
                                    html: tableHtml
                                });

                            }
                        });
                        break;
                    case 'genome-viewer':
                        var gm_id = Utils.genId('gm');
                        var vfw_id = Utils.genId('vfw');
                        var html =
                            '<div style="width:1500px;height:800px;">' +
                            '<div id="' + vfw_id + '" style="width:1500px;">' +
                            '</div>' +
                            '<div id="' + gm_id + '" style="width:1500px;height:800px;">' +
                            '</div>' +
                            '</div>';
                        itemBox = Ext.create('Ext.Component', {
                            flex: 1,
                            html: html,
                            listeners: {
                                afterrender: function () {
                                   var gv = _this._createGenomeViewer(gm_id);
                                    _this._createVariantFilterWidget(vfw_id,gv,_this.result[_this.layoutName].layout.variantFilterFiles, renderer.tableLayout);
                                }
                            }
                        });
                        break;
                }
                boxes.push(itemBox);
            }
            return Ext.create('Ext.container.Container', {
                title: item.title,
                margin: '0 0 5 0',
                items: boxes
            });
        };

        /* Process recursively the result structure */
        var getDetailsAsDocument = function (item, isRoot) {
            var boxes;
            if (typeof item.children != 'undefined') {
                if (typeof item.children == 'function') {
                    item.children = item.children();
                }
                boxes = [];
                for (var i = 0; i < item.children.length; i++) {
                    boxes.push(getDetailsAsDocument(item.children[i]));
                }
                if (isRoot == true) {
                    var detailsItemsContainer = {
                        xtype: 'container',
                        items: boxes
                    };
                    if (item.presentation == 'tabs') {
                        detailsItemsContainer = {
                            xtype: 'tabpanel',
                            padding: '0 30 15 15',
                            plain: true,
                            border: 0,
                            defaults: {
                                overflowX: 'scroll',
                                height: 2000,
                                padding: 10
                            },
                            items: boxes
                        };
                    }
                    return Ext.create('Ext.container.Container', {
                        title: item.title,
                        items: [
                            {
                                xtype: 'box',
                                cls: 'inlineblock ssel border-bot s120', margin: '15',
                                html: 'Details'
                            },
                            detailsItemsContainer
                        ]
                    });
                } else {

                    if (_.isUndefined(item.title)) {

                        debugger
                    }

                    return Ext.create('Ext.container.Container', {
                        id: _this.jobId + item.title.replace(/ /g, ''),
                        title: item.title,
                        margin: '0 0 20 20',
                        items: [
                            {
                                xtype: 'box',
                                overCls: 'dedo',
                                cls: 'panel-border-bottom', margin: '0 0 10 0',
                                data: item, tpl: itemTpl,
                                listeners: {
                                    afterrender: function () {
                                        this.getEl().on("click", function () {
                                            $(_this.panel.getEl().dom).children().scrollTop(0);
                                        });
                                    }
                                }
                            },
                            {
                                xtype: 'container',
                                items: boxes
                            }
                        ]
                    });
                }
            } else {
                return processLeafItem(item);
            }
        };

        var detailedResutls = getDetailsAsDocument(resultData[this.layoutName].layout, true);
        var indexResutl = getResultIndex(resultData[this.layoutName].layout.children);
        this.panel.add(getJobInfo({items: this.extItems}));
        this.panel.insert(indexResutl);
        this.panel.add(detailedResutls);

    },//end render

    _createGenomeViewer: function (targetId) {
        console.log('creating result genome viewer in: ' + targetId);
        var _this = this;
        var genomeViewer = new GenomeViewer({
            targetId: targetId,
            autoRender: true,
            sidePanel: false,
            region: new Region(DEFAULT_SPECIES.region),
            species: DEFAULT_SPECIES,
            border: true,
            version: '',
            resizable: false,
//            trackPanelScrollWidth: 36,
//            zoom: urlZoom,
//            confPanelHidden: confPanelHidden,
//            regionPanelHidden: regionPanelHidden,
            availableSpecies: AVAILABLE_SPECIES,
            popularSpecies: POPULAR_SPECIES,
            drawNavigationBar: true,
            drawStatusBar: true,
//            height: this.height - this.headerWidget.height,
//            width: this.width-18,
            handlers: {
                'species:change': function (event) {
//            _this._setTracks();
//            _this.setTracksMenu();
                    _this.species = event.species;
                    var text = _this.species.text + ' <span style="color: #8396b2">' + _this.species.assembly + '</span>';
                    _this.headerWidget.setDescription(text);
//                    _this._refreshInitialTracksConfig();
                }
            }
        });
        genomeViewer.draw();

        var renderer = new FeatureRenderer('gene');
        renderer.on({
            'feature:click': function (event) {
                console.log(event)
                new GeneInfoWidget(null, _this.species).draw(event);
            }
        });
        var geneOverview = new FeatureTrack({
            targetId: null,
            id: 2,
            title: 'Gene',
            histogramZoom: 10,
            labelZoom: 20,
            height: 100,
            visibleRange: {start: 0, end: 100},
            titleVisibility: 'hidden',
            featureTypes: FEATURE_TYPES,

            renderer: renderer,

            dataAdapter: new CellBaseAdapter({
                category: "genomic",
                subCategory: "region",
                resource: "gene",
                params: {
                    exclude: 'transcripts'
                },
                species: genomeViewer.species,
                featureCache: {
                    gzip: true,
                    chunkSize: 50000
                }
            })
        });
        genomeViewer.addOverviewTrack(geneOverview);


//        var sequence = new SequenceTrack({
//            targetId: null,
//            id: 1,
//            title: 'Sequence',
//            histogramZoom: 20,
//            transcriptZoom: 50,
//            height: 30,
//            visibleRange: {start: 99, end: 100},
//            featureTypes: FEATURE_TYPES,
//
//            renderer: new SequenceRenderer(),
//
//            dataAdapter: new SequenceAdapter({
//                category: "genomic",
//                subCategory: "region",
//                resource: "sequence",
//                species: genomeViewer.species,
//                featureCache: {
//                    gzip: true,
//                    chunkSize: 1000
//                }
//            })
//        });
//
//        genomeViewer.addTrack(sequence);

        var gene = new GeneTrack({
            targetId: null,
            id: 2,
            title: 'Gene',
            histogramZoom: 20,
            transcriptZoom: 50,
            height: 140,
            visibleRange: {start: 0, end: 100},
            featureTypes: FEATURE_TYPES,

            renderer: new GeneRenderer(),

            dataAdapter: new CellBaseAdapter({
                category: "genomic",
                subCategory: "region",
                resource: "gene",
                species: genomeViewer.species,
                featureCache: {
                    gzip: true,
                    chunkSize: 50000
                },
                filters: {},
                options: {},
                featureConfig: FEATURE_CONFIG.gene
            })
        });

        genomeViewer.addTrack(gene);


//        var snp = new FeatureTrack({
//            targetId: null,
//            id: 4,
//            title: 'SNP',
//            histogramZoom: 70,
//            labelZoom: 80,
//            height: 100,
//            visibleRange: {start: 0, end: 100},
//            featureTypes: FEATURE_TYPES,
//
//            renderer: new FeatureRenderer('snp'),
//
//            dataAdapter: new CellBaseAdapter({
//                category: "genomic",
//                subCategory: "region",
//                resource: "snp",
//                params: {
//                    exclude: 'transcriptVariations,xrefs,samples'
//                },
//                species: genomeViewer.species,
//                featureCache: {
//                    gzip: true,
//                    chunkSize: 10000
//                },
//                filters: {},
//                options: {},
//                featureConfig: FEATURE_CONFIG.snp
//            })
//        });
//
//        genomeViewer.addTrack(snp);


        genomeViewer.chromosomePanel.hide();
        genomeViewer.karyotypePanel.hide();


        var filteredFile = this.result[_this.layoutName].layout.filteredFile;
        if(!_.isUndefined(filteredFile)){
            OpencgaManager.poll({
                accountId: $.cookie('bioinfo_account'),
                sessionId: $.cookie('bioinfo_sid'),
                jobId: _this.jobId,
                filename: filteredFile,
                zip: false,
                success:function(data){
                    if(data.indexOf("ERROR")!=-1){
                        console.error(data);
                    }
                    var vcfDataAdapter = new VCFDataAdapter(new StringDataSource(data),{async:false,species:genomeViewer.species});
//                    var vcfTrack = new Track("VCF file",{
//                        adapter: vcfDataAdapter
//                    });
//                    genomeViewer.addTrack(vcfTrack,{
//                        id:"VCF file",
//                        histogramZoom:50,
//                        height:150,
//                        visibleRange:{start:0,end:100},
//                        featureTypes:FEATURE_TYPES
//                    });
                    var fileTrack = new FeatureTrack({
                        targetId: null,
                        id: "VCF file",
                        title: "VCF file",
//                        histogramZoom:50,
//                labelZoom: 80,
                        height: 150,
                        visibleRange: {start: 0, end: 100},
                        featureTypes: FEATURE_TYPES,
                        renderer: new FeatureRenderer(FEATURE_TYPES.vcf),
                        dataAdapter:vcfDataAdapter
                    });

                    genomeViewer.addTrack(fileTrack);

                    //var feature = vcfDataAdapter.featureCache.getFirstFeature();
                    //genomeViewer.region.load(feature);
                    //genomeViewer.setRegion({sender:""});
                    //genomeViewer.setZoom(75);
                }
            });
        }else{
            console.log("No filtered VCF file.");
        }

        return genomeViewer;
    },
    _createVariantFilterWidget: function(targetId, gv, variantFilterFiles, tableLayout){
        var variantFilterWidget = new VariantFilterWidget(this.jobId,{
            width:1500,
            height:300,
            targetId:targetId,
            viewer:gv,
//            fileNames:_this.variantFiles
            fileNames:variantFilterFiles,
            tableLayout:tableLayout
        });
        variantFilterWidget.getPanel(targetId);

        return variantFilterWidget;
    }
};