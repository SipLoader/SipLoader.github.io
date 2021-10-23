const fs = require('fs');

var filename = process.argv[2];
var graph = [];
var orders = [];
var visit = [];
var maxSI = -1;
var bestOrder = [];
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
        visit.push(false);
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

    for (var i = 0; i < nodeNumber; i++) {
        graph[i].degree = graph[i].parent.length;
    }
}

initData();

// console.log(graph);

function updateBest(o) {
    var height = 0, integral = 0;
    for (var x of o) {
        integral += height * graph[x].cost;
        height += graph[x].gain;
    }
    if (integral > maxSI) {
        maxSI = integral;
        bestOrder = o.slice();
    }
}

function recursion(order) {
    // console.log(order.length);
    if (order.length >= nodeNumber) {
        // orders.push(order);
        // console.log(order);
        updateBest(order);
        return;
    }

    for (var i = 0; i < nodeNumber; i++) {
        if (graph[i].degree <= 0 && visit[i] === false) {
            visit[i] = true;
            for (var x of graph[i].children) {
                graph[x].degree--;
            }
            order.push(i);
            recursion(order);
            order.pop();
            visit[i] = false;
            for (var x of graph[i].children) {
                graph[x].degree++;
            }
        }
    }
}

function topoSort() {
    for (var i = 0; i < nodeNumber; i++) {
        if (graph[i].degree <= 0 && visit[i] === false) {
            visit[i] = true;
            for (var x of graph[i].children) {
                graph[x].degree--;
            }
            recursion([i]);
            visit[i] = false;
            for (var x of graph[i].children) {
                graph[x].degree++;
            }
        }
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
topoSort();
var end = now('nano');
// console.log(orders);
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
