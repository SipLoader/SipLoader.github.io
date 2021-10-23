const fs = require('fs');

var filename = process.argv[2];
var graph = [];
var ancestorGraphCosts = [];
var ancestorGraphGains = [];
var nodeAncestors = [];
var nodeDescendants = [];
var nodeActiveAncestorNumber = [];
var bestOrder = [];
var nodeRemoved = [];
var nodeNumber = 0;
var linkNumber = 0;

var maxAvgWeight = -1;
var maxAvgWeightNode = 0;

function initData() {
    var inData = fs.readFileSync(filename).toString().split('\n');

    for (var i = 0; i < inData.length; i++) {
        inData[i] = inData[i].trim();
    }

    // console.log(inData);

    nodeNumber = Number(inData[0].split(' ')[0]);
    linkNumber = Number(inData[0].split(' ')[1]);

    for (var i = 0; i < nodeNumber; i++) {
        var node = {id: i, cost: 0, gain: 0, parent: [], children: []};
        graph.push(node);
        nodeRemoved.push(false);
        nodeActiveAncestorNumber.push(0);
    }

    for (var i = 0; i < nodeNumber; i++) {
        graph[i].cost = Number(inData[1 + i].split(' ')[0]);
        graph[i].gain = Number(inData[1 + i].split(' ')[1]);
    }

    for (var i = 0; i < linkNumber; i++) {
        var from = Number(inData[1 + nodeNumber + i].split(' ')[0]);
        var to = Number(inData[1 + nodeNumber + i].split(' ')[1]);
        graph[from].children.push(to);
        graph[to].parent.push(from);
    }
}

initData();

// console.log(graph);

function union(setA, setB) {
    let _union = new Set(setA)
    for (let elem of setB) {
        _union.add(elem)
    }
    return _union
}

function getAncestors(nodeId, visit) {

    if (typeof(nodeAncestors[nodeId]) !== 'undefined') {
        return nodeAncestors[nodeId];
    }

    var ancestors = new Set();
    ancestors.add(nodeId);

    for (let p of graph[nodeId].parent) {
        if (!visit.has(p)) {
            visit.add(p);
            var a = getAncestors(p, visit);
            ancestors = union(a, ancestors);
            visit.delete(p);
        }
    }

    nodeAncestors[nodeId] = ancestors;

    return ancestors;
}

function getDescendants(nodeId, visit) {

    if (typeof(nodeDescendants[nodeId]) !== 'undefined') {
        return nodeDescendants[nodeId];
    }

    var descendants = new Set();
    descendants.add(nodeId)

    for (let p of graph[nodeId].children) {
        if (!visit.has(p)) {
            visit.add(p);
            var d = getDescendants(p, visit);
            descendants = union(descendants, d);
            visit.delete(p);
        }
    }

    nodeDescendants[nodeId] = descendants;

    return descendants;
}

function updateAncestorGraphAvgWeight(nodeId) {
    var gain = 0;
    var cost = 0;
    for (let i of nodeAncestors[nodeId]) {
        if (nodeRemoved[i]) {
            continue;
        }
        gain += graph[i].gain;
        cost += graph[i].cost;
    }
    ancestorGraphGains[nodeId] = gain;
    ancestorGraphCosts[nodeId] = cost;
}

function getNodeAvgWeight(nodeId) {
    return ancestorGraphCosts[nodeId] === 0 ? 0 : ancestorGraphGains[nodeId] / ancestorGraphCosts[nodeId];
}

for (var i = 0; i < nodeNumber; i++) {
    var s = new Set();
    s.add(i);
    getAncestors(i, s);
    // console.log(nodeAncestors);
    // nodeActiveAncestorNumber[i] = nodeAncestors[i].size;
    s = new Set();
    s.add(i);
    getDescendants(i, s);
    // console.log(nodeDescendants);
    updateAncestorGraphAvgWeight(i);
    // console.log(ancestorGraphAvgWeight);
    // console.log(i);

    if (maxAvgWeight < getNodeAvgWeight(i)) {
        maxAvgWeight = getNodeAvgWeight(i);
        maxAvgWeightNode = i;
    }
}
// console.log(nodeAncestors);
// console.log(nodeDescendants);
// console.log(ancestorGraphAvgWeight);

function ancestorGraphDP() {
    for (var iteration = 0; iteration < nodeNumber; iteration++) {
        // console.log(nodeRemoved);
        // console.log(`maxAvgWeightNode: ${maxAvgWeightNode}`);
        var rootPtr = maxAvgWeightNode;
        while (graph[rootPtr].parent.length > 0) {
            var nextMax = -1;
            var noParent = true;
            var k = rootPtr;
            for (var p of nodeAncestors[rootPtr]) {
                if (nodeRemoved[p] || p === k) {
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

        nodeRemoved[rootPtr] = true;
        // console.log(`nodeRemoved: ${rootPtr}`);
        bestOrder.push(rootPtr);

        maxAvgWeight = -1;
        maxAvgWeightNode = 0;

        var visit = [];
        for (var i = 0; i < nodeNumber; i++) {
            visit.push(nodeRemoved[i]);
        }

        for (var nodeId of nodeDescendants[rootPtr]) {

            if (visit[nodeId]) {
                continue;
            }

            ancestorGraphGains[nodeId] -= graph[rootPtr].gain;
            ancestorGraphCosts[nodeId] -= graph[rootPtr].cost;
            var avgWeight = getNodeAvgWeight(nodeId);

            if (avgWeight > maxAvgWeight) {
                maxAvgWeight = avgWeight;
                maxAvgWeightNode = nodeId;
            }

            visit[nodeId] = true;
        }

        for (var i = 0; i < nodeNumber; i++) {
            if (visit[i]) {
                continue;
            }

            var avgWeight = getNodeAvgWeight(i);

            if (avgWeight > maxAvgWeight) {
                maxAvgWeight = avgWeight;
                maxAvgWeightNode = i;
            }
        }
        // console.log(`ancestorGraphAvgWeight: ${ancestorGraphAvgWeight}`);
        // console.log(`maxAvgWeight: ${maxAvgWeight}`);
        // console.log(`maxAvgWeightNode: ${maxAvgWeightNode}`);
    }
}

function get_si(order) {
    var h = 0;
    var si = 0;
    for (var i = 0; i < order.length; i++) {
        si += (h * graph[i].cost);
        h += graph[i].gain;
    }
    return si;
}
const now = (unit) => {
  
    const hrTime = process.hrtime();
    
    switch (unit) {
      
      case 'milli':
        return hrTime[0] * 1000 + hrTime[1] / 1000000;
        
      case 'micro':
        return hrTime[0] * 1000000 + hrTime[1] / 1000;
        
      case 'nano':
      default:
        return hrTime[0] * 1000000000 + hrTime[1];
    }
    
  };
var start = now('nano');
ancestorGraphDP();
var end = now('nano');
// console.log(bestOrder);
var out = '[';
for (var i = 0; i < bestOrder.length; i++) {
    out += (bestOrder[i].toString());
    if (i !== bestOrder.length - 1) {
        out += ', ';
    } else {
        out += ']: '
    }
}
out += get_si(bestOrder);
console.log(out);
console.log('time cost', `${end - start} ns`);
