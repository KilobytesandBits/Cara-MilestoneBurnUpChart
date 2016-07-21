Ext.define('CustomApp', {
	extend : 'Rally.app.App',
	componentCls : 'app',
	launch : function() {
		this._getMilestone("MI302");
	},

	_getMilestone : function(formattedId) {

		Ext.getBody().mask('Generating Burnup Chart...');
		
		var projectMilestoneFilter = Ext.create('Rally.data.wsapi.Filter', {
			property : 'FormattedID',
			operator : '=',
			value : formattedId
		});

		var milsetoneStore = Ext.create("Rally.data.wsapi.Store", {
			model : 'milestone',
			autoLoad : true,
			compact : false,
			filters : projectMilestoneFilter,
			context : {
				workspace : Rally.environment.getContext().getWorkspace()._ref,
				project : null,
				limit : Infinity,
				projectScopeUp : false,
				projectScopeDown : true
			},
			fetch : [ 'ObjectID', 'FormattedID', 'Name', 'TargetDate', 'TargetProject', 'c_ActiveStartDate' ],
			listeners : {
				load : function(store, data, success) {
					if (data.length > 0) {
						this.selectedMilestoneObj = data[0].data;
						this._getBurnupChart();
					} else {
						Rally.ui.notify.Notifier.showError({
							message : 'No Milestone available for the formattedId : ' + formattedId
						});
					}
				},
				scope : this
			},
			sorters : [ {
				property : 'Name',
				direction : 'ASC'
			} ]
		});
	},

	/**
	 * Create the burnup chart and draw it
	 */
	_getBurnupChart : function() {

		var that = this;

		Deft.Promise.all([ that._loadPIsInMilestone(), that._loadScheduleStateValues() ]).then({
			success : function() {
				that._addChart();
			},
			scope : this
		});
	},

	_loadScheduleStateValues : function() {
		return Rally.data.ModelFactory.getModel({
			type : 'UserStory',
			success : function(model) {
				model.getField('ScheduleState').getAllowedValueStore().load({
					callback : function(records) {
						this.scheduleStateValues = _.invoke(records, 'get', 'StringValue');
					},
					scope : this
				});
			},
			scope : this
		});
	},

	_loadPIsInMilestone : function() {
		var that = this;
		return Ext.create('Rally.data.wsapi.artifact.Store', {
			models : [ 'portfolioitem/feature', 'defect', 'userstory' ],
			context : {
				workspace : Rally.environment.getContext().getWorkspace()._ref,
				project : null,
				limit : Infinity,
				projectScopeUp : false,
				projectScopeDown : true
			},
			filters : [ {
				property : 'Milestones.ObjectID',
				operator : '=',
				value : that.selectedMilestoneObj.ObjectID
			} ]
		}).load().then({
			success : function(artifacts) {
				this.piRecords = artifacts;
			},
			scope : this
		});
	},

	_addChart : function() {
		var that = this;
		
		if (that.down('rallychart')) {
			that.down('rallychart').destroy();
		}

		var chartStartDate = that.selectedMilestoneObj.c_ActiveStartDate !== '' ? that.selectedMilestoneObj.c_ActiveStartDate : _.min(_.compact(_.invoke(that.piRecords, 'get',
				'ActualStartDate')));
		var chartEndDate = that.selectedMilestoneObj.TargetDate;

		this.add({
			xtype : 'rallychart',
			flex : 1,
			storeType : 'Rally.data.lookback.SnapshotStore',
			storeConfig : that._getStoreConfig(),
			calculatorType : 'Rally.example.BurnCalculator',
			calculatorConfig : {
				completedScheduleStateNames : [ 'Accepted', 'Released' ],
				stateFieldValues : that.scheduleStateValues,
				startDate : chartStartDate,
				endDate : chartEndDate,
				enableProjects : true
			},
			chartColors : [ "#A16E3A", "#1B7F25", "#B1B1B7", "#2E2EAC" ],
			chartConfig : that._getChartConfig(),
			listeners : {
				afterrender : function(obj, eOpts) {
					Ext.getBody().unmask();
				},
				scope : this
			}
		});
	},

	/**
	 * Generate the store config to retrieve all snapshots for all leaf child
	 * stories of the specified PI
	 */
	_getStoreConfig : function() {
		return {
			find : {
				_TypeHierarchy : {
					'$in' : [ 'HierarchicalRequirement' ]
				},
				_ItemHierarchy : {
					'$in' : _.invoke(this.piRecords, 'getId')
				}
			},
			fetch : [ 'ScheduleState', 'PlanEstimate' ],
			hydrate : [ 'ScheduleState' ],
			sort : {
				_ValidFrom : 1
			},
			context : Rally.environment.getContext().getDataContext(),
			limit : Infinity
		};
	},

	/**
	 * Generate a valid Highcharts configuration object to specify the chart
	 */

	_getChartConfig : function() {
		var chartTitle = ' ';

		chartTitle = 'Milestone Burnup';

		return {
			chart : {
				defaultSeriesType : 'area',
				zoomType : 'xy'
			},
			title : {
				text : chartTitle
			},
			xAxis : {
				categories : [],
				tickmarkPlacement : 'on',
				tickInterval : 30,
				title : {
					text : 'Date',
					margin : 10
				}
			},
			yAxis : [ {
				title : {
					text : 'Counts'
				}
			} ],
			tooltip : {
				formatter : function() {
					return '' + this.x + '<br />' + this.series.name + ': ' + Math.ceil(this.y);
				}
			},
			plotOptions : {
				series : {
					marker : {
						enabled : false,
						states : {
							hover : {
								enabled : true
							}
						}
					},
					groupPadding : 0.01
				},
				column : {
					stacking : null,
					shadow : false
				}
			}
		};
	}

});
