// window.siploaderGraph
// window.siploaderTagId
// window.siploaderChunkedHTML
// window.siploaderInlineJS

const MAX_CONNECTION = 6;
const MESSAGE_POOL_INIT = 'MESSAGE_POOL_INIT';
const MESSAGE_RESPONSE_RECEIVED = 'MESSAGE_RESPONSE_RECEIVED';
const MESSAGE_OBJECT_EVALUATED = 'MESSAGE_OBJECT_EVALUATED';

var pendingPool = {};
var inflightPool = {};
var waitingForEvalPool = {};
var urlEvaled = new Set();

console.log('Initialize SipLoader successfully!');

// inflate html

(() => {
    for (var i = 0; i < siploaderChunkedHTML.length; i++) {
        if (siploaderChunkedHTML[i].indexOf('<\\/script>') != -1) {
            siploaderChunkedHTML[i] = '</sc' + 'ript>';
        }
    }
    if ( document.body == null ) {
        var c = document.createElement('body');
        document.firstChild.appendChild(c);
    }

    var rawHTML = '';
    
    for (var i = 0; i < siploaderChunkedHTML.length; i++) {
        rawHTML += siploaderChunkedHTML[i] + '\n';
    }
    document.body.innerHTML = rawHTML;
    // console.log(rawHTML);
    
    console.log('Finished inflating HTML');
})();

// init graph data

var nodeAncestors = {}
var nodeDescendants = {}
var ancestorGraphCosts = {};
var ancestorGraphGains = {};
var bestOrder = [];
var idToUrl = {};
var nodeRemoved = [];
var nodeNumber = 0;
var linkNumber = 0;

var maxAvgWeight = -1;
var maxAvgWeightNode = 0;

function union(setA, setB) {
    let _union = new Set(setA)
    for (let elem of setB) {
        _union.add(elem)
    }
    return _union
}

function getAncestors(nodeUrl, visit) {

    if (nodeAncestors.hasOwnProperty(nodeUrl)) {
        return nodeAncestors[nodeUrl];
    }

    var ancestors = new Set();
    ancestors.add(nodeUrl);

    for (let p of siploaderGraph[nodeUrl].parent) {
        if (!visit.has(p)) {
            visit.add(p);
            var a = getAncestors(p, visit);
            ancestors = union(a, ancestors);
            visit.delete(p);
        }
    }

    nodeAncestors[nodeUrl] = ancestors;

    return ancestors;
}

function getDescendants(nodeUrl, visit) {

    if (nodeDescendants.hasOwnProperty(nodeUrl)) {
        return nodeDescendants[nodeUrl];
    }

    var descendants = new Set();
    descendants.add(nodeUrl)

    for (let p of siploaderGraph[nodeUrl].children) {
        if (!visit.has(p)) {
            visit.add(p);
            var d = getDescendants(p, visit);
            descendants = union(descendants, d);
            visit.delete(p);
        }
    }

    nodeDescendants[nodeUrl] = descendants;

    return descendants;
}

function updateAncestorGraphAvgWeight(nodeUrl) {
    var gain = 0;
    var cost = 0;
    for (let i of nodeAncestors[nodeUrl]) {
        if (nodeRemoved.indexOf(i) >= 0) {
            continue;
        }
        gain += siploaderGraph[i].gain;
        cost += siploaderGraph[i].cost;
    }
    ancestorGraphGains[nodeUrl] = gain;
    ancestorGraphCosts[nodeUrl] = cost;
}

function getNodeAvgWeight(nodeUrl) {
    return ancestorGraphCosts[nodeUrl] === 0 ? 0 : ancestorGraphGains[nodeUrl] / ancestorGraphCosts[nodeUrl];
}

function initGraphData() {
    for (var url in siploaderGraph) {
        if (siploaderGraph[url].type != 'stylesheet' && !siploaderGraph[url].visible) {
            siploaderGraph[url].gain = 0;
        }
        nodeNumber++;
        var s = new Set();
        s.add(url);
        getAncestors(url, s);
        // console.log(nodeAncestors);
        // nodeActiveAncestorNumber[i] = nodeAncestors[i].size;
        s = new Set();
        s.add(url);
        getDescendants(url, s);
        // // console.log(nodeDescendants);
        updateAncestorGraphAvgWeight(url);
        // // console.log(ancestorGraphAvgWeight);
        // // console.log(i);
    
        if (maxAvgWeight < getNodeAvgWeight(url)) {
            maxAvgWeight = getNodeAvgWeight(url);
            maxAvgWeightNode = url;
        }
    }

    // console.log(nodeAncestors);
    // console.log(nodeDescendants);
    // console.log(ancestorGraphGains);
    // console.log(ancestorGraphCosts);
    // console.log(maxAvgWeightNode);
    // console.log(maxAvgWeight);
}

initGraphData();

function ancestorGraphDP() {
    for (var iteration = 0; iteration < nodeNumber; iteration++) {
        // console.log(nodeRemoved);
        // console.log(`maxAvgWeightNode: ${maxAvgWeightNode}`);
        var rootPtr = maxAvgWeightNode;
        while (siploaderGraph[rootPtr].parent.length > 0) {
            var nextMax = -1;
            var noParent = true;
            var k = rootPtr;
            for (var p of nodeAncestors[rootPtr]) {
                if (nodeRemoved.indexOf(p) >= 0 || p === k) {
                    continue;
                }
                noParent = false;
                var avgWeight = getNodeAvgWeight(p);
                if (nextMax < getNodeAvgWeight(p)) {
                    nextMax = avgWeight;
                    rootPtr = p;
                }
            }
            if (noParent) {
                break;
            }
        }

        nodeRemoved.push(rootPtr);
        // console.log(`nodeRemoved: ${rootPtr}`);
        bestOrder.push(rootPtr);

        maxAvgWeight = -1;
        maxAvgWeightNode = 0;

        var visit = [];
        for (var n of nodeRemoved) {
            visit.push(n);
        }

        for (var nodeUrl of nodeDescendants[rootPtr]) {

            if (visit.indexOf(nodeUrl) >= 0) {
                continue;
            }

            ancestorGraphGains[nodeUrl] -= siploaderGraph[rootPtr].gain;
            ancestorGraphCosts[nodeUrl] -= siploaderGraph[rootPtr].cost;
            var avgWeight = getNodeAvgWeight(nodeUrl);

            if (avgWeight > maxAvgWeight) {
                maxAvgWeight = avgWeight;
                maxAvgWeightNode = nodeUrl;
            }

            visit.push(nodeUrl);
        }

        for (var url in siploaderGraph) {
            if (visit.indexOf(url) >= 0) {
                continue;
            }

            var avgWeight = getNodeAvgWeight(url);

            if (avgWeight > maxAvgWeight) {
                maxAvgWeight = avgWeight;
                maxAvgWeightNode = url;
            }
        }
        // console.log(`ancestorGraphAvgWeight: ${ancestorGraphAvgWeight}`);
        // console.log(`maxAvgWeight: ${maxAvgWeight}`);
        // console.log(`maxAvgWeightNode: ${maxAvgWeightNode}`);
    }
}

ancestorGraphDP();
console.log(bestOrder);

for (var url of bestOrder) {
    idToUrl[siploaderTagId[url]] = url;
}

function initPools() {
    // Pending Pool
    for (let url in siploaderTagId) {
        var urlFormatted = new URL(url, window.location.href);
        var hostname = urlFormatted.hostname;
        if (pendingPool.hasOwnProperty(hostname)) {
            pendingPool[hostname].push(url);
        } else {
            pendingPool[hostname] = [url];
            inflightPool[hostname] = [];
        }
    }

    for (let hostname in pendingPool) {
        pendingPool[hostname] = pendingPool[hostname].sort((a, b) => (bestOrder.indexOf(a) == -1 ? Number.MAX_VALUE : bestOrder.indexOf(a)) - (bestOrder.indexOf(b) == -1 ? Number.MAX_VALUE : bestOrder.indexOf(b)));
    }

    window.top.postMessage([MESSAGE_POOL_INIT, pendingPool], '*');

    // Eval pool

    for (var id in siploaderInlineJS) {
        waitingForEvalPool[id] = siploaderInlineJS[id];
        waitingForEvalPool[id].evaled = false;
    }
}

initPools();

function eventHandler(event) {
    // console.log(event);

    if (event.data[0] == MESSAGE_POOL_INIT) {
        handlePendingPool();
    } else if (event.data[0] == MESSAGE_RESPONSE_RECEIVED) {
        handlePendingPool();
        handleResponse(event.data[1]);
        handleEvalPool();
    } else if (event.data[0] == MESSAGE_OBJECT_EVALUATED) {
        if (event.data[1]) {
            handleEvalPool();
        }
    }
}

window.addEventListener('message', eventHandler, false);

function handleResponse(requested_url) {
    var url = new URL(requested_url, window.location.href);
    var hostname = url.hostname;

    var index = inflightPool[hostname].indexOf(requested_url);
    if (index >= 0) {
        inflightPool[hostname].splice(index, 1);
    }
    
}

function handlePendingPool() {
    for (let hostname in pendingPool) {
        while (inflightPool[hostname].length < MAX_CONNECTION && pendingPool[hostname].length > 0) {
            var url = pendingPool[hostname].shift();
            inflightPool[hostname].push(url);

            var request = new XMLHttpRequest();
            request.original_host = hostname;
            request.requested_url = url;

            if (url.indexOf('js') == -1) {
                request.responseType = "blob";
            }

            request.open('GET', url, true);

            request.send();
        }
    }
}

function handleEvalPool() {
    // console.log(waitingForEvalPool);

    var evalMore = false;
    var bestScript = -1;
    var priority = Number.MAX_VALUE;
    for (var id in waitingForEvalPool) {
        if (!waitingForEvalPool[id].evaled && waitingForEvalPool[id].prev_js_id < 0 && waitingForEvalPool[id].code != 'NO_INLINE') {
            if (bestScript == -1) {
                bestScript = id;
                var new_priority = bestOrder.indexOf(idToUrl[id]);
                priority = new_priority < 0 ? Number.MAX_VALUE : new_priority;
            } else {
                var new_priority = bestOrder.indexOf(idToUrl[id]);
                if (new_priority >= 0 && new_priority < priority) {
                    bestScript = id;
                    priority = new_priority;
                }
            }
        } else if (!waitingForEvalPool[id].evaled && waitingForEvalPool[id].prev_js_id >= 0 && waitingForEvalPool[waitingForEvalPool[id].prev_js_id].evaled && waitingForEvalPool[id].code != 'NO_INLINE') {
            if (bestScript == -1) {
                bestScript = id;
                var new_priority = bestOrder.indexOf(idToUrl[id]);
                priority = new_priority < 0 ? Number.MAX_VALUE : new_priority;
            } else {
                var new_priority = bestOrder.indexOf(idToUrl[id]);
                if (new_priority >= 0 && new_priority < priority) {
                    bestScript = id;
                    priority = new_priority;
                }
            }
        }
    }
    if (bestScript != -1) {
        try {
            window.eval(waitingForEvalPool[bestScript].code);
        } catch (error) {
            // console.log(error)
        } finally {
            waitingForEvalPool[bestScript].evaled = true;
            evalMore = true;
        }
    }

    setTimeout(() => {
        window.top.postMessage([MESSAGE_OBJECT_EVALUATED, evalMore], '*');
    }, 5);
}

function onResponseReceived() {
    // console.log(this);

    if (siploaderTagId.hasOwnProperty(this.requested_url)) {
        var tagIds = siploaderTagId[this.requested_url];
        // console.log(tagIds);

        for (let id of tagIds) {
            // console.log(id);
            var element = document.querySelector(`[tag_id="${id}"]`);
            // console.log(element);

            if (element == null) {
                continue;
            }

            if (element.tagName.toLowerCase() == 'img') {
                var objUrl = window.URL.createObjectURL(this.response);
                // console.log(objUrl)
                element.setAttribute('src', objUrl);
                urlEvaled.add(this.requested_url);
            } else if (element.tagName.toLowerCase() == 'link') {
                var objUrl = window.URL.createObjectURL(this.response);
                // console.log(objUrl)
                element.setAttribute('href', objUrl);
                urlEvaled.add(this.requested_url);
            } else if (element.tagName.toLowerCase() == 'script') {
                waitingForEvalPool[id].code = this.responseText;
            } else {
                this.onload_native();
            }
        }        
    }
    window.top.postMessage([MESSAGE_RESPONSE_RECEIVED, this.requested_url], '*');
}

var _xhrsend = XMLHttpRequest.prototype.send;
XMLHttpRequest.prototype.send = function(){
    this.onload_native= this.onload;
    this.onload = onResponseReceived;

    _xhrsend.call(this)
};

</script>
