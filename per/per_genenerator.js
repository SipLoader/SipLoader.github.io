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
var per_out_filename = process.argv[4];

var viewport = { width: 1920, height: 1080 };

// var browser = null;

var firstRequest = true;
var undefinedURL = "";
var cssUrl = {};

// async function resizeWindow(browser, page, width, height) {
//     await page.setViewport({height, width})
  
//     // Window frame - probably OS and WM dependent.
//     height += 85
    
//     // Any tab.
//     const targets = await browser._connection.send(
//       'Target.getTargets'
//     )
  
//     // modified code
//     const target = targets.targetInfos.filter(t => t.attached === true && t.type === 'page')[0]
    
//     // Tab window. 
//     const {windowId} = await browser._connection.send(
//       'Browser.getWindowForTarget',
//       {targetId: target.targetId}
//     )
//     const {bounds} = await browser._connection.send(
//       'Browser.getWindowBounds',
//       {windowId}
//     )
    
//     const resize = async () => {
//       await browser._connection.send('Browser.setWindowBounds', {
//         bounds: {width: width, height: height},
//         windowId
//       })
//     }
  
//     if(bounds.windowState === 'normal') {
//       await resize()
//     } else {
//       await browser._connection.send('Browser.setWindowBounds', {
//         bounds: {windowState: 'minimized'},
//         windowId
//       })
//       await resize()
//     }
// }
  
// (async () => {
//     const browser = await puppeteer.launch({
//         args: ['--app=http://localhost:8080'],
//         headless: false,
//         defaultViewport: null
//       })
      
//       const page = (await browser.pages())[0]

//      var i = 100;
      
//       setInterval(() => {
//         console.log('resize')
//         resizeWindow(browser, page, 800 + i, 600 + i)
//         i += 100;
//       }, 1000)
// })();

async function resizeWindow(browser, page, width, height) {
    // console.log('resize');
    await page.setViewport({height, width});

    // Window frame - probably OS and WM dependent.
    height += 85;
    
    // Any tab.
    const {targetInfos: [{targetId}]} = await browser._connection.send(
      'Target.getTargets'
    );
    
    // Tab window. 
    const {windowId} = await browser._connection.send(
      'Browser.getWindowForTarget',
      {targetId}
    );
    
    // Resize.
    await browser._connection.send('Browser.setWindowBounds', {
      bounds: {height, width},
      windowId
    });    
}

function grahamScan(points) {
    if (points.length <= 1) {
        return points;
    }

    var leftBottom = 0;
    
    for (let i = 1; i < points.length; i++) {
        if (points[i].y < points[leftBottom].y || points[i].y == points[leftBottom].y && points[i].x < points[leftBottom].x) {
            leftBottom = i;
        }
    }

    var tmp = {};
    Object.assign(tmp, points[leftBottom]);
    Object.assign(points[leftBottom], points[0]);
    Object.assign(points[0], tmp);

    var subarr = points.slice(1, points.length);

    subarr.sort((a, b) => {
        var angle1 = Math.atan2(a.y - points[0].y, a.x - points[0].x);
        var angle2 = Math.atan2(b.y - points[0].y, b.x - points[0].x);
        if (angle1 > angle2) {
            return 1;
        } else if (angle1 < angle2) {
            return -1;
        } else {
            if (a.x > b.x) {
                return 1;
            } else {
                return -1;
            }
        }
    });

    for (let i = 0; i < subarr.length; i++) {
        points[i + 1] = subarr[i];
    }

    var convexHull = [points[0], points[1]];
    var ptr = 1;

    function cross(p1, p2, p3) {
        return (p2.x - p1.x) * (p3.y - p1.y) - (p2.y - p1.y) * (p3.x - p1.x);
    }

    for (let i = 2; i < points.length;) {
        if (ptr > 0 && cross(convexHull[ptr - 1], points[i], convexHull[ptr]) >= 0) {
            ptr--;
        } else {
            convexHull[++ptr] = points[i++];
        }
    }

    return convexHull.slice(0, ptr + 1);

}

(async () => {
    var browser = await puppeteer.launch({executablePath: '/usr/bin/google-chrome', headless: false,
                                    args: ['--disable-fre', '--no-default-browser-check', '--no-first-run', '--ignore-certificate-errors', `--window-size=${viewport.width},${viewport.height}`, '--no-sandbox', '--user-data-dir=/tmp/nonexistent$(date +%s%N)']});
    
    await delay(1000);

    var page = await browser.newPage();
    
    await resizeWindow(browser, page, 1920, 1080);
    await page.goto(url);
    await delay(2000);

    var scheme_regions = [];
    var controls = {};
    var prev_angle = -1;

    const MIN_WIDTH = 500;
    const MAX_WIDTH = 2500;
    var startWidth = MIN_WIDTH;

    for (let width = 500; width <= MAX_WIDTH; width += 50) {
        await resizeWindow(browser, page, width, 1080);
        var [angle, pos] = await page.evaluate( () => {
            var url_pos = {}
            var elements = [];

            function traverse(node) {
                try {
                    if (node.tagName && (node.tagName.toLowerCase() == 'img')){
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
                            var rect = node.getBoundingClientRect();
                            url_pos[url] = {x1: rect.left, y1: rect.top, x2: rect.right, y2: rect.bottom};
                            elements.push(node);
                        }
                    }
                } catch (error) {
                    
                }
                
                for (let i = 0; i < node.children.length; i++) {
                    traverse(node.children[i]);
                }
            }
            
            traverse(document);

            var count = 0;
            var deg = 0;

            for (let i = 0; i < elements.length; i++) {
                for (let j = i + 1; j < elements.length; j++) {
                    var rect1 = elements[i].getBoundingClientRect();
                    var rect2 = elements[j].getBoundingClientRect();

                    var x1 = (rect1.left + rect1.right) / 2;
                    var y1 = (rect1.top + rect1.bottom) / 2;
                    var x2 = (rect2.left + rect2.right) / 2;
                    var y2 = (rect2.top + rect2.bottom) / 2;

                    var vec = [x1 - x2, y1 - y2];

                    var len = Math.sqrt(vec[0] * vec[0] + vec[1] * vec[1]);

                    if (len == 0) {
                        continue;
                    }

                    var theta = Math.acos((vec[0] * 0 + vec[1] * 1) / (len * 1)) * 180 / Math.PI;
                    if (!isNaN(theta)) {
                        deg += theta;
                        count++;
                    }
                }
            }

            return [deg / count, url_pos];
        });
        console.log(angle, pos);

        if (prev_angle == -1) {
            prev_angle = angle;
            for (let key in pos) {
                if (!controls.hasOwnProperty(key)) {
                    controls[key] = [];
                }
    
                controls[key].push({x: pos[key].x1, y: pos[key].y1});
                controls[key].push({x: pos[key].x2, y: pos[key].y1});
                controls[key].push({x: pos[key].x2, y: pos[key].y2});
                controls[key].push({x: pos[key].x1, y: pos[key].y2});
            }
        } else if (Math.abs(prev_angle - angle) >= 5) {
            prev_angle = angle;

            var regions = {};

            for (let key in controls) {
                regions[key] = grahamScan(controls[key]);
            }

            var item = {widthMin: startWidth, widthMax: width, regions: regions}

            scheme_regions.push(item);

            controls = {};

            for (let key in pos) {
                if (!controls.hasOwnProperty(key)) {
                    controls[key] = [];
                }
    
                controls[key].push({x: pos[key].x1, y: pos[key].y1});
                controls[key].push({x: pos[key].x2, y: pos[key].y1});
                controls[key].push({x: pos[key].x2, y: pos[key].y2});
                controls[key].push({x: pos[key].x1, y: pos[key].y2});
            }

            startWidth = width;
        } else if (width == MAX_WIDTH) {
            for (let key in pos) {
                if (!controls.hasOwnProperty(key)) {
                    controls[key] = [];
                }
    
                controls[key].push({x: pos[key].x1, y: pos[key].y1});
                controls[key].push({x: pos[key].x2, y: pos[key].y1});
                controls[key].push({x: pos[key].x2, y: pos[key].y2});
                controls[key].push({x: pos[key].x1, y: pos[key].y2});
            }

            var regions = {};

            for (let key in controls) {
                regions[key] = grahamScan(controls[key]);
            }

            var item = {widthMin: startWidth, widthMax: width, regions: regions}

            scheme_regions.push(item);
        }
    }

    for (let i = 0; i < scheme_regions.length; i++) {
        for (let key in scheme_regions[i].regions) {
            console.log(scheme_regions[i].regions[key]);
        }
    }

    fs.writeFileSync(per_out_filename, JSON.stringify(scheme_regions), 'utf-8');

    await browser.close();

    process.exit(0);
})();

