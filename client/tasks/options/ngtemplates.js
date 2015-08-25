module.exports = {
    app: {
        cwd: 'app',
        src: 'scripts/superdesk*/**/*.html',
        dest: 'app/scripts/templates.js',
        options: {
            htmlmin: {
                collapseWhitespace: true,
                collapseBooleanAttributes: true
            },
            bootstrap: function(module, script) {
                return '"use strict";' +
                    'var templates = angular.module("templates", []);' +
                    'templates.run([\'$templateCache\', function($templateCache) {' +
                    script + ' }]);';
            }
        }
    }
};
