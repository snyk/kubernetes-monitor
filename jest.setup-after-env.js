const failFast = require("jasmine-fail-fast");

const jasmineEnv = jasmine.getEnv();
jasmineEnv.addReporter(failFast.init());
