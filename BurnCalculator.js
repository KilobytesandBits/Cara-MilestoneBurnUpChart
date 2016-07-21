Ext.define('Rally.example.BurnCalculator', {
	extend : 'Rally.data.lookback.calculator.TimeSeriesCalculator',
	config : {
		completedScheduleStateNames : [ 'Accepted' ]
	},

	constructor : function(config) {
		this.initConfig(config);
		this.callParent(arguments);
	},

	getDerivedFieldsOnInput : function() {
		var completedScheduleStateNames = this.getCompletedScheduleStateNames();
		return [ {
			"as" : "StoryCount",
			"f" : function(snapshot) {
				return 1;
			}
		}, {
			"as" : "CompletedStoryCount",
			"f" : function(snapshot) {
				var ss = snapshot.ScheduleState;
				if (completedScheduleStateNames.indexOf(ss) > -1) {
					return 1;
				} else {
					return 0;
				}
			}
		} ];
	},

	getDerivedFieldsAfterSummary : function() {
		var stateFieldValues = this.stateFieldValues;
		return [ {
			as : 'Ideal',
			f : function(row, index, summaryMetrics, seriesData) {
				var data = _.last(seriesData), max = seriesData[seriesData.length-1].Planned, increments = seriesData.length - 1, incrementAmount;
				if (increments === 0) {
					return max;
				}
				incrementAmount = max / increments;
				return Math.floor(100 * (index * incrementAmount)) / 100;
			},
			display : 'line'
		}, {
			as : 'Actual',
			f : function(row, index, summaryMetrics, seriesData) {
				var today = Rally.util.DateTime.toIsoString(new Date());
				var endIndex = _.findIndex(seriesData, function(data) {
					return data.tick > today;
				});
				if(endIndex < 0){ //Assuming for expired milestone endIndex is coming as -1
					endIndex = seriesData.length-1;
				}
				if (index <= endIndex) {
					var acceptedSeriesData = _.pluck(seriesData, 'Completed');
					var slope = (acceptedSeriesData[0] - acceptedSeriesData[endIndex]) / (0 - endIndex);
					return index * slope;
				}
			},
			display : 'line'
		} ];
	},

	getMetrics : function() {
		return [ {
			"field" : "StoryCount",
			"as" : "Planned",
			"display" : "line",
			"f" : "sum"
		}, {
			"field" : "CompletedStoryCount",
			"as" : "Completed",
			"f" : "sum",
			"display" : "column"
		} ];
	}
});