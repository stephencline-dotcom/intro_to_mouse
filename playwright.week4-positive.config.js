const {defineConfig}=require('@playwright/test');
module.exports=defineConfig({
 testDir:'./tests',testMatch:'week4-positive-completion.spec.js',
 timeout:45000,expect:{timeout:12000},workers:1,
 use:{baseURL:'http://127.0.0.1:4181',browserName:'chromium',headless:true,viewport:{width:1440,height:900}},
 webServer:{command:'node server.js',url:'http://127.0.0.1:4181/',reuseExistingServer:false,timeout:30000,env:{PORT:'4181'}},
 reporter:[['list'],['html',{outputFolder:'mouse-positive-report',open:'never'}]]
});
