import os
import sys
import json
import subprocess

sys.path.append('../utils')
from siploader_common import get_top_sites

sites = get_top_sites(2000)

result_f = open('result.csv', 'w', encoding='utf-8')

for site in sites:
    graph_filename = './graph_data/%s.txt' % site['domain']

    if not os.path.exists(graph_filename):
        continue
    line = ''
    with open(graph_filename, 'r') as f:
        line = f.readline()
    
    line = line.strip()
    node_num = line.split(' ')[0]
    edge_num = line.split(' ')[1]

    if int(node_num) >= 17:
        continue

    print('%s %s %s' % (site['domain'], node_num, edge_num))

    cmd1 = 'node topo.js %s' % (graph_filename)

    p1 = subprocess.Popen(cmd1, stdout=subprocess.PIPE, shell=True)
    output_lines1 = p1.stdout.readlines()

    # print(output_lines1)

    try:
        output_lines1[0] = str(output_lines1[0], encoding='utf-8')
        output_lines1[1] = str(output_lines1[1], encoding='utf-8')

        order = output_lines1[0].split(']: ')[0] + ']'
        si = output_lines1[0].split(']: ')[1]
        t = output_lines1[1].split(' ')[2]

        result_f.write('%s,%s,%s,%s,"%s",%s' % (site['domain'], node_num, edge_num, t, order, si))
    except Exception as e:
        print(e)
        print(output_lines1)
