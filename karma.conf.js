// Karma configuration for the Simplifica Agenda frontend.
// Picked up automatically by `@angular-devkit/build-angular:karma`
// because it lives at the workspace root.
//
// Run modes:
//   npm test                 -> `ng test` (watch mode, default Chrome)
//   npm run test:ci          -> single-run, headless Chrome (CI-friendly)
//   npm run test:headless    -> single-run, headless Chrome (local)
//
// ChromeHeadlessNoSandbox flags mirror Angular's built-in launcher so that
// tests can run inside containers / sandboxes without the GPU or /dev/shm.
const path = require('path');

module.exports = function (config) {
  config.set({
    basePath: '',
    frameworks: ['jasmine', '@angular-devkit/build-angular'],
    plugins: [
      require('karma-jasmine'),
      require('karma-chrome-launcher'),
      require('karma-jasmine-html-reporter'),
      require('karma-coverage'),
      require('@angular-devkit/build-angular/plugins/karma'),
    ],
    client: {
      jasmine: {},
      clearContext: false,
    },
    jasmineHtmlReporter: { suppressAll: true },
    coverageReporter: {
      dir: path.join(__dirname, './coverage/simplifica-agenda-frontend'),
      subdir: '.',
      reporters: [{ type: 'html' }, { type: 'text-summary' }],
    },
    reporters: ['progress', 'kjhtml'],
    port: 9876,
    colors: true,
    logLevel: config.LOG_INFO,
    autoWatch: true,
    browsers: ['Chrome'],
    customLaunchers: {
      ChromeHeadlessNoSandbox: {
        base: 'ChromeHeadless',
        flags: ['--no-sandbox', '--disable-gpu', '--disable-dev-shm-usage'],
      },
    },
    singleRun: false,
    restartOnFileChange: true,
  });
};
