const {defineConfig}=require('@playwright/test');
module.exports=defineConfig({
 testDir:'./tests',testMatch:'week67-mistakes.spec.js',
 timeout:45000,expect:{timeout:10000},workers:1,
 use:{baseURL:'http://127.0.0.1:4188',browserName:'chromium',headless:true,viewport:{width:1440,height:900}},
 webServer:{command:'node server.js',url:'http://127.0.0.1:4188/',reuseExistingServer:false,timeout:30000,env:{PORT:'4188'}},
 reporter:[['list'],['html',{outputFolder:'mouse-week67-mistakes-report',open:'never'}]]
});
