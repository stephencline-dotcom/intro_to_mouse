const {defineConfig}=require('@playwright/test');
module.exports=defineConfig({
 testDir:'./tests',testMatch:'week89-mistakes-first.spec.js',
 timeout:60000,expect:{timeout:12000},workers:1,
 use:{baseURL:'http://127.0.0.1:4189',browserName:'chromium',headless:true,viewport:{width:1440,height:900}},
 webServer:{command:'node server.js',url:'http://127.0.0.1:4189/',reuseExistingServer:false,timeout:30000,env:{PORT:'4189'}},
 reporter:[['list'],['html',{outputFolder:'mouse-week89-mistakes-first-report',open:'never'}]]
});
