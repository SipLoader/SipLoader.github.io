// batch tracing

const EventEmitter = require('events');
const puppeteer = require('puppeteer');
const delay = require('delay');
const fs = require('fs');
const { exit } = require('process');
const speedline = require('speedline');

process.on('uncaughtException', function(error) {
    console.log(`Uncaught exception: ${error.message}`);
    console.log(error);
    process.exit(0);
});

process.on('unhandledRejection', function(error) {
    console.log(`Unhandled rejection: ${error.message}`);
    console.log(error);
    process.exit(0);
});

var domain = process.argv[2];
var url = process.argv[3];
var suffix = process.argv[4];

var viewport = { width: 1920, height: 1080 };

var browser = null;

(async () => {
    try {
        var trace_path = `./measurement_data/${domain}_${viewport.width}_${viewport.height}_${suffix}.json`;

        if (fs.existsSync(trace_path)) {
            fs.unlinkSync(trace_path);
        }
    
        browser = await puppeteer.launch({executablePath: '/usr/bin/google-chrome', headless: false,
                                    defaultViewport: {width: viewport.width, height: viewport.height},
                                    args: ['--disable-fre', '--no-default-browser-check', '--no-first-run', '--ignore-certificate-errors', `--window-size=${parseInt(viewport.width)},${parseInt(viewport.height)}`, '--no-sandbox', '--user-data-dir=/tmp/nonexistent$(date +%s%N)']});
    
        await delay(1000);
    
        var page = await browser.newPage();
        await page.setViewport({ width: parseInt(viewport.width), height: parseInt(viewport.height) });
        await page.setCacheEnabled(false);
        await page.tracing.start({ path: trace_path, screenshots: true });
    
        // page.on('load', async() => {
        //     await page.tracing.stop();
        // });
    
        await delay(100);
    
        try {
            if (suffix == 'ours') {
                await page.goto(url, {timeout: 20000});
            } else {
                await page.goto(url, {timeout: 20000});
            }
            await delay(1000);
        } catch (error) {
            console.log('Navigation timeout...');
            console.log(error);
        }

        try {
            await page.tracing.stop();
        } catch (error) {
            console.log(error);
        }
        
        results = await speedline(trace_path, {include: 'speedIndex'});
        console.log(results.speedIndex);
        fs.writeFileSync('TRACE_OK', results.speedIndex.toString());
        
        await delay(500);
    
        await page.close();
        await browser.close();
        fs.unlinkSync(trace_path);
    } catch (error) {
        console.log(error);
    } finally {
        process.exit(0);
    }

})();

