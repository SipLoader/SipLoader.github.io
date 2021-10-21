// batch tracing

const EventEmitter = require('events');
const puppeteer = require('puppeteer');
const delay = require('delay');
const fs = require('fs');
const { exit } = require('process');

process.on('uncaughtException', function(error) {
    console.log(`Uncaught exception: ${error.message}`);
    process.exit(0);
});

process.on('unhandledRejection', function(error) {
    console.log(`Unhandled rejection: ${error.message}`);
    process.exit(0);
});

var domain = parseInt(process.argv[2]);
var url = process.argv[3];
var dependency_out_filename = process.argv[4];
var cost_gain_filename = process.argv[5];

var viewport = { width: 1920, height: 1080 };

var browser = null;

var firstRequest = true;
var undefinedURL = "";
var cssUrl = {};

(async () => {
    browser = await puppeteer.launch({executablePath: '/usr/bin/google-chrome', headless: false,
                                    args: ['--disable-fre', '--no-default-browser-check', '--no-first-run', '--ignore-certificate-errors', `--window-size=${viewport.width},${viewport.height}`, '--no-sandbox', '--user-data-dir=/tmp/nonexistent$(date +%s%N)']});
    
    await delay(1000);

    var page = await browser.newPage();
    await page.setViewport(viewport);
    await page.setCacheEnabled(false);

    const client = await page.target().createCDPSession();

    await client.send('Network.enable');
    var requests = {};
    var dependency = {}
    var dependency_logs = [];
    var url_resource_type = {};

    client.on('Network.requestWillBeSent', parameters => {
        // const request_url = parameters.request.url;
        // const initiator_url = parameters.initiator.url;

        if (parameters.request.method.toUpperCase() !== 'GET') {
            return;
        }

        if (firstRequest) {
            undefinedURL = parameters.request.url;
            firstRequest = false;
        }

        // console.log('The request', request_url, 'was initiated by', initiator_url, '.');
        // console.log(parameters);

        var initiator = '';
        var target = parameters.request.url;

        if (parameters.initiator) {
            initiator = parameters.initiator.url;
            if (parameters.initiator.type) {
                if (parameters.initiator.type == 'script') {
                    if(parameters.initiator.stack) {
                        //   initiator = params.initiator.stack[0].url;
                        // console.log(parameters.initiator.stack);
                        initiator = parameters.initiator.stack.callFrames[0].url;
                    }
                } else if (parameters.initiator.type == 'parser') {
                    initiator = parameters.initiator.url;
                }
            }
        }
        if (initiator == undefined) {
            initiator = undefinedURL;
        }

        if (initiator == '') {
            initiator = parameters.documentURL;
        }

        if (target == '') {
            target = parameters.documentURL;
        }

        try {
            initiator = new URL(initiator).href;
            target = new URL(target).href;
        } catch (error) {
            return;
        }

        var log = "\"" + initiator + "\" -> \"" + target  + "\";\n";
        dependency_logs.push(log);

        if (!dependency.hasOwnProperty(initiator)) {
            dependency[initiator] = [];
        }

        if (!dependency.hasOwnProperty(target)) {
            dependency[target] = [];
        }

        if (initiator !== target) {
            if (!dependency.hasOwnProperty(initiator)) {
                dependency[initiator] = [target];
            } else if (dependency[initiator].indexOf(target) < 0) {
                dependency[initiator].push(target);
            }
        }

        requests[target] = {}
        requests[target].startTime = parameters.timestamp;
        requests[target].requestId = parameters.requestId;
        
    });

    client.on('Network.responseReceived', parameters => {

        // if (parameters.type.toLowerCase() == 'stylesheet') {
        //     console.log(parameters)
        // }

        // console.log(parameters.type)
        // requests[target].endTime = parameters.timestamp;

        for (r in requests) {
            if (requests[r].requestId == parameters.requestId) {
                requests[r].endTime = parameters.timestamp;
            }
        }
    });

    page.on('response', async (response) => {
        // console.log(response.request().resourceType());
        url_resource_type[response.request().url()] = response.request().resourceType().toLocaleLowerCase();
        if (response.request().resourceType().toLocaleLowerCase() == 'stylesheet') {
            // console.log(response.request().url());
            // console.log(await response.text());
            cssUrl[response.request().url()] = await response.text();
        }
    }); 

    // page.on('console', (msg) => console[msg._type]('PAGE LOG:', msg._text));

    await page.goto(url, { waitUntil: 'networkidle0' });
    await delay(1000);

    // console.log(cssUrl);

    var [gains, url_visible] = await page.evaluate( (cssUrl, viewport) => {
        var url_gains = {}
        var url_visible = {}

        function isHidden(node) {
            var style = window.getComputedStyle(node);
            return (style.display === 'none');
        }

        function intersect(region) {
            return region.x >= -region.width && region.x <= viewport.width && region.y >= -region.height && region.y <= 1.2 * viewport.height;
        }

        function isVisble(node) {
            let bcr = getBoundingClientRect(node);
            return (bcr.width >= 0) && (bcr.height >= 0) && intersect(bcr) && !isHidden(node);
        }

        function getBoundingClientRect(element) {
            var rect = element.getBoundingClientRect();
            return {
                top: rect.top,
                right: rect.right,
                bottom: rect.bottom,
                left: rect.left,
                width: rect.width,
                height: rect.height,
                x: rect.x,
                y: rect.y
            };
          }

        function getStylesheetGain(node) {
            var rects = [];

            var cssRules = node.sheet.cssRules;
            // console.log(cssRules.length);
            for (let i = 0; i < cssRules.length; i++) {
                let rule = cssRules[i];
                // console.log(i);
                // console.log(rule.selectorText);
                if (rule instanceof CSSStyleRule) {
                    selector = rule.selectorText;
                    // console.log(selector);
                    var elements = document.querySelectorAll(selector);
                    // console.log(elements.length);
                    for (var e of elements) {
                        // console.log(e.tagName);
                        try {
                            var r = getBoundingClientRect(e);
                            if (r.left < r.right && r.bottom > r.top && isVisble(e)/* && r.left >= 0 && r.right <= viewport.width && r.top >= 0 && r.bottom <= 1.1 * viewport.height*/) {
                                var new_left = Math.max(r.left, 0);
                                var new_top = Math.max(r.top, 0);
                                var new_right = Math.min(r.right, viewport.width);
                                var new_bottom = Math.min(r.right, viewport.height);
                                r.left = new_left;
                                r.top = new_top;
                                r.right = new_right;
                                r.bottom = new_bottom;
                                delete r.width;
                                delete r.height;
                                delete r.x;
                                delete r.y;
                                rects.push(r);
                        }
                        } catch (error) {
                            // console.log("Error", error.stack);
                            // console.log("Error", error.name);
                            // console.log("Error", error.message);
                        }
                    }
                } else {
                    // console.log(typeof(rule))
                }
            }

            // console.log(rects.length);

            var scanLines = [];
            var xs = new Set();

            for (let r of rects) {
                var scanLine1 = {};
                scanLine1.left = r.left;
                scanLine1.right = r.right;
                scanLine1.y = r.bottom;
                scanLine1.d = -1;

                var scanLine2 = {};
                scanLine2.left = r.left;
                scanLine2.right = r.right;
                scanLine2.y = r.top;
                scanLine2.d = 1;

                scanLines.push(scanLine1);
                scanLines.push(scanLine2);

                xs.add(r.left);
                xs.add(r.right);
            }

            var xInterval = Array.from(xs).sort((a, b) => a - b);

            var distinctX = xInterval.length;

            scanLines = scanLines.sort((a, b) => a.y - b.y);

            // console.log(xInterval);
            // console.log(scanLines);

            var mark = new Array((distinctX + 10) * 4).fill(0);
            var sum = new Array((distinctX + 10) * 4).fill(0);

            function upParent (xIndex, left, right) {
                if (mark[xIndex] != 0) {sum[xIndex] = xInterval[right + 1] - xInterval[left];}
                else if (left == right) {sum[xIndex] = 0;}
                else {sum[xIndex] = sum[xIndex * 2] + sum[xIndex * 2 + 1];}
                // console.log(`${xIndex}, ${left}, ${right}`);
                // console.log(sum[xIndex]);
                // console.log(sum[xIndex * 2]);
                
            }

            function update(L, R, d, xIndex, left, right) {
                if (L <= left && R >= right) {
                    mark[xIndex] += d;
                    upParent(xIndex, left, right);
                    return;
                }
                var mid = parseInt((left + right) / 2);
                if (L <= mid) {update(L, R, d, xIndex * 2, left, mid);}
                if (R > mid) {update(L, R, d, xIndex * 2 + 1, mid + 1, right);}
                upParent(xIndex, left, right);
            }

            function getXIndex(xValue) {
                let l = 0, r = distinctX - 1;
                while (l <= r) {
                    var mid = parseInt((l + r) / 2);
                    if (xInterval[mid] == xValue) {return mid;}
                    else if (xInterval[mid] > xValue) {r = mid - 1;}
                    else {l = mid + 1;}
                }
                return -1;
            }

            var area = 0;

            for (let i = 0; i < scanLines.length - 1; i++) {
                var line = scanLines[i];
                let L = getXIndex(line.left);
                let R = getXIndex(line.right) - 1;
                // console.log(line);
                // console.log(L);
                // console.log(R);

                if (L < 0 || R < 0) {
                    continue;
                }

                update(L, R, line.d, 1, 0, distinctX - 1);
                area += sum[1] * (scanLines[i + 1].y - line.y);
                // console.log(sum);
            }

            return area;
        }

        function traverse(node) {
            try {
                if (node.tagName && (node.tagName.toLowerCase() == 'img' || node.tagName.toLowerCase() == 'script' || node.tagName.toLowerCase() == 'iframe' || node.tagName.toLowerCase() == 'link')){
                    var url;
                    if (node.tagName.toLowerCase() == 'link') {
                        rel = node.getAttribute('rel')
                        if ('canonical' === rel || 'alternate' === rel) {
                            url = ''
                        } else {
                            url = node.href
                        }
                    } else {
                        url = node.src;
                        if (url === '') {
                            url = node.getAttribute('data-src');
                        }
                    }
    
                    if (url != null && url !== '') {
                        url = new URL(url).href;
                        var area = node.offsetHeight * node.offsetWidth;

                        // console.log(node.href)

                        if (node.tagName.toLowerCase() == 'link' && node.rel && node.rel == 'stylesheet' && cssUrl.hasOwnProperty(node.href)) {
                            var doc = document.implementation.createHTMLDocument("");
                            var tmp_node = document.createElement('style');
                            tmp_node.textContent = cssUrl[node.href];
                            doc.body.appendChild(tmp_node);
                            // console.log(tmp_node.textContent);
                            // console.log(tmp_node);
                            area = getStylesheetGain(tmp_node);
                            console.log(`${node.href}: ${area}`);
                        }
    
                        if (url_gains.hasOwnProperty(url)) {
                            url_gains[url] = area > url_gains[url] ? area : url_gains[url];
                        } else {
                            url_gains[url] = area;
                        }
    
                        if (url_visible.hasOwnProperty(url)) {
                            url_visible[url] = url_visible[url] | isVisble(node);
                        } else {
                            if (isVisble(node)) {
                                url_visible[url] = true;
                            } else {
                                url_visible[url] = false;
                            }
                        }
                    }
                }
            } catch (error) {
                
            }
            
            for (let i = 0; i < node.children.length; i++) {
                traverse(node.children[i]);
            }
        }
        
        traverse(document);

        return [url_gains, url_visible];
    }, cssUrl, viewport);

    var graph = {};

    for (let url in dependency) {
        if (requests.hasOwnProperty(url)) {
            graph[url] = {};
            graph[url].children = dependency[url];
            graph[url].cost = requests[url].endTime * 1000 - requests[url].startTime * 1000;

            if (gains.hasOwnProperty(url)) {
                graph[url].gain = gains[url];
                graph[url].visible = url_visible[url];
            } else {
                graph[url].gain = 0;
                graph[url].visible = true;
            }
        }
    }

    for (let url in graph) {

        if (!graph[url].hasOwnProperty('parent')) {
            graph[url].parent = [];
        }

        for (let c of graph[url].children) {
            if (!graph.hasOwnProperty(c)) {
                graph[c] = {};
                graph[c].children = [];
                if (requests.hasOwnProperty(c)) {
                    graph[c].cost = requests[c].endTime * 1000 - requests[c].startTime * 1000;
                } else {
                    graph[c].cost = 1;
                }
                if (gains.hasOwnProperty(c)) {
                    graph[c].gain = gains[c];
                    graph[c].visible = url_visible[c];
                } else {
                    graph[c].gain = 0;
                    graph[c].visible = true;
                }
            }
            if (graph[c].hasOwnProperty('parent')) {
                graph[c].parent.push(url);
            } else {
                graph[c].parent = [url];
            }
        }
    }

    // console.log(url_resource_type);

    for (let url in graph) {
        if (url_resource_type.hasOwnProperty(url)) {
            graph[url].type = url_resource_type[url];
        } else {
            graph[url].type = 'other';
        }
        
    }
    
    // console.log(dependency)
    // console.log(url_weight_gain);
    // console.log(requests);
    // console.log(dependency_logs);

    var out_str = "strict digraph G {\nratio=compress;\n"

    for (var log of dependency_logs) {
        out_str += log;
    }
    out_str += "}";

    // console.log(requests);
    fs.writeFileSync(dependency_out_filename, out_str);
    fs.writeFileSync(cost_gain_filename, JSON.stringify(graph), 'utf-8');

    await browser.close();

    process.exit(0);
})();

