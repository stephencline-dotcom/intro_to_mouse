const { defineConfig } = require('@playwright/test');
module.exports = defineConfig({
 testDir:'./tests', testMatch:'week4-last-two-positive.spec.js', timeout:90000,
 expect:{timeout:15000}, workers:1,
 use:{baseURL:'http://127.0.0.1:4183',browserName:'chromium',headless:true,viewport:{width:1440,height:900}},
 webServer:{command:'node server.js',url:'http://127.0.0.1:4183/',reuseExistingServer:false,timeout:30000,env:{PORT:'4183'}},
 reporter:[['list'],['html',{outputFolder:'mouse-last-two-report',open:'never'}]]
});
