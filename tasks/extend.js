'use strict';

var ExtendPrompt = require('../lib/prompts/extend_prompt');
var lfrThemeConfig = require('../lib/liferay_theme_config');

module.exports = function(options) {
	var gulp = options.gulp;

	gulp.task('extend', function(cb) {
		new ExtendPrompt({
			themeConfig: lfrThemeConfig.getConfig()
		}, cb);
	});
};