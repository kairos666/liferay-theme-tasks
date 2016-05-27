'use strict';

var _ = require('lodash');
var async = require('async');
var lfrThemeConfig = require('../lib/liferay_theme_config');
var path = require('path');
var plugins = require('gulp-load-plugins')();
var vinylPaths = require('vinyl-paths');

var gutil = plugins.util;

var themeConfig = lfrThemeConfig.getConfig();

var CWD = process.cwd();

module.exports = function(options) {
	var gulp = options.gulp;

	var pathBuild = options.pathBuild;

	var runSequence = require('run-sequence').use(gulp);

	gulp.task('build:themelets', function(cb) {
		runSequence(
			['build:themelet-lint-css'],
			['build:themelet-css', 'build:themelet-images', 'build:themelet-js', 'build:themelet-templates'],
			['build:themelet-css-inject', 'build:themelet-js-inject'],
			cb
		);
	});
	
	gulp.task('build:themelet-lint-css', function(){
	        getThemeletSrcPaths('.+(css|scss)').map(function(themeletSrcPath){
		        gulp.src(themeletSrcPath)
			        .pipe(plugins.stylelint({
				        reporters: [
				        	{ formatter: 'verbose', console: true }
				        ]
			        }))
			        .on('error', gutil.log)
	        });
    	});

	gulp.task('build:themelet-css', function(cb) {
		buildStaticThemeletFiles('css', '.+(css|scss)', cb);
	});

	gulp.task('build:themelet-css-inject', function(cb) {
		var themeSrcPaths = path.join(pathBuild, 'css/themelets/**/_custom.+(css|scss)');

		var injected = false;
		var themeletSources = false;

		var sources = gulp.src(themeSrcPaths, {
			read: false
		}).pipe(plugins.sort())
		  .pipe(vinylPaths(function(path, cb) {
			themeletSources = true;

			cb();
		}));

		var fileName = themeConfig.version == '6.2' ? 'custom.css' : '_custom.scss';

		gulp.src(path.join(pathBuild, 'css', fileName))
			.pipe(plugins.inject(sources, {
				starttag: '/* inject:imports */',
				endtag: '/* endinject */',
				transform: function(filePath, file, index, length, targetFile) {
					injected = true;

					filePath = filePath.replace(/(.*\/css\/)(.*)/, '$2');

					return '@import "' + filePath + '";';
				}
			}))
			.pipe(gulp.dest(path.join(pathBuild, 'css')))
			.on('end', function() {
				if (!injected && themeletSources && !_.isEmpty(themeConfig.themeletDependencies)) {
					var colors = gutil.colors;

					gutil.log(colors.yellow('Warning:'), 'Failed to automatically inject themelet styles. Make sure inject tags are present in', colors.magenta(fileName));
				}

				cb();
			});
	});

	gulp.task('build:themelet-js-inject', function(cb) {
		var themeSrcPaths = path.join(pathBuild, 'js/themelets/**/*.js');

		var injected = false;
		var themeletSources = false;

		var sources = gulp.src(themeSrcPaths, {
			read: false
		}).pipe(plugins.sort(({
	            comparator: function(file1, file2) {
	              var fileRegExp = new RegExp(/[^/\\]*$/),
	                  file1Name = file1.path.replace(file1.base,'').match(fileRegExp),
	                  file2Name = file2.path.replace(file2.base,'').match(fileRegExp),
	                  file1ThemeletPath = file1.path.replace(file1.base,'').replace(file1Name,''),
	                  file2ThemeletPath = file2.path.replace(file2.base,'').replace(file2Name,''),
	                  isFile1PriorityLib = (file1ThemeletPath.indexOf('lib') > -1) ? true : false,
	                  isFile2PriorityLib = (file2ThemeletPath.indexOf('lib') > -1) ? true : false,
	                  isFile1PriorityCore = (file1ThemeletPath.indexOf('core') > -1) ? true : false,
	                  isFile2PriorityCore = (file2ThemeletPath.indexOf('core') > -1) ? true : false;
	
	              //strongest criteria --> libraries first
	              if (isFile1PriorityLib && !isFile2PriorityLib) {
	                return -1;
	              }
	              if (!isFile1PriorityLib && isFile2PriorityLib) {
	                return 1;
	              }
	              //medium criteria --> core first
	              if (isFile1PriorityCore && !isFile2PriorityCore) {
	                return -1;
	              }
	              if (!isFile1PriorityCore && isFile2PriorityCore) {
	                return 1;
	              }
	              //weak criteria --> alphabetical order
	              if (file1Name < file2Name) {
	                return -1;
	              }
	              if (file1Name > file2Name) {
	                return 1;
	              }
	              return 0;
	            }
	          })))
		  .pipe(vinylPaths(function(path, cb) {
			themeletSources = true;

			cb();
		}));

		var defaultTemplateLanguage = 'ftl';

		if (themeConfig.version == '6.2') {
			defaultTemplateLanguage = 'vm';
		}

		var templateLanguage = themeConfig.templateLanguage || defaultTemplateLanguage;

		gulp.src(path.join(pathBuild, 'templates/portal_normal.' + templateLanguage))
			.pipe(plugins.inject(sources, {
				starttag: '<!-- inject:js -->',
				endtag: '<!-- endinject -->',
				transform: function(filePath, file, index, length, targetFile) {
					injected = true;

					var themeName = lfrThemeConfig.getConfig(true).name;

					var FORWARD_SLASH = '/';

					filePath = FORWARD_SLASH + 'o/' + themeName + FORWARD_SLASH + filePath.replace(/(.*)(js\/.*)/, '$2');

					return '<script src="' + filePath + '"></script>';
				}
			}))
			.pipe(gulp.dest(path.join(pathBuild, 'templates')))
			.on('end', function() {
				if (!injected && themeletSources && !_.isEmpty(themeConfig.themeletDependencies)) {
					var colors = gutil.colors;

					gutil.log(colors.yellow('Warning:'), 'Failed to automatically inject themelet js. Make sure inject tags are present in', colors.magenta('portal_normal.' + templateLanguage));
				}

				cb();
			});
	});

	gulp.task('build:themelet-images', function(cb) {
		buildStaticThemeletFiles('images', null, cb);
	});

	gulp.task('build:themelet-js', function(cb) {
		buildStaticThemeletFiles('js', '.js', cb);
	});

	gulp.task('build:themelet-templates', function(cb) {
		buildStaticThemeletFiles('templates', '.+(ftl|vm)', cb);
	});

	function getThemeletSrcPaths(fileTypes) {
		var srcFiles = 'src/**/*';

		if (fileTypes) {
			srcFiles += fileTypes;
		}

		var themeSrcPaths = _.map(getThemeletDependencies(), function(item, index) {
			return path.resolve(CWD, 'node_modules', index, srcFiles);
		});

		return themeSrcPaths;
	}

	function buildStaticThemeletFiles(dirName, fileTypes, cb) {
		var srcFiles = '**/*';

		if (fileTypes) {
			srcFiles += fileTypes;
		}

		runThemeletDependenciesSeries(function(item, index, done) {
			gulp.src(path.resolve(CWD, 'node_modules', index, 'src', dirName, srcFiles))
				.pipe(gulp.dest(path.join(pathBuild, dirName, 'themelets', index)))
				.on('end', done);
		}, cb);
	}

	function runThemeletDependenciesSeries(asyncTask, cb) {
		var themeletStreamMap = _.map(getThemeletDependencies(), function(item, index) {
			return _.bind(asyncTask, this, item, index);
		});

		async.series(themeletStreamMap, cb);
	}
};

function getThemeletDependencies() {
	var packageJSON = require(path.join(CWD, 'package.json'));

	var themeletDependencies;

	if (packageJSON.liferayTheme && packageJSON.liferayTheme.themeletDependencies) {
		themeletDependencies = packageJSON.liferayTheme.themeletDependencies;
	}

	return themeletDependencies;
}
