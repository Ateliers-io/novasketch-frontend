export default {
    testEnvironment: 'node',
    reporters: [
        'default',
        ['jest-html-reporter', {
            pageTitle: 'ExportTools Unit Test Report',
            outputPath: './src/components/ExportTools/test-report.html',
            includeFailureMsg: true,
            includeSuiteFailure: true,
            includeConsoleLog: true,
            dateFormat: 'yyyy-mm-dd HH:MM:ss',
            theme: 'lightTheme',
            customInfos: [
                { title: 'Project', value: 'NovaSketch Frontend' },
                { title: 'Component', value: 'ExportTools' },
                { title: 'Tester', value: 'QA Team' }
            ]
        }]
    ],
    testMatch: ['**/*.test.js'],
    verbose: true,
    transform: {}
};
