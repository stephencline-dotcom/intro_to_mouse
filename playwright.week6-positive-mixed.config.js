const {defineConfig}=require('@playwright/test');
module.exports=defineConfig({
 testDir:'./tests',testMatch:'week6-positive-mixed.spec.js',
 timeout:90000,expect:{timeout:12000},workers:1,
 use:{baseURL:'http://127.0.0.1:4187',browserName:'chromium',headless:true,viewport:{width:1440,height:900}},
 webServer:{command:'node server.js',url:'http://127.0.0.1:4187/',reuseExistingServer:false,timeout:30000,env:{PORT:'4187'}},
 reporter:[['list'],['html',{outputFolder:'mouse-week6-positive-mixed-report',open:'never'}]]
});
