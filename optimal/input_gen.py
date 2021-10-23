import os
import sys
import json

sys.path.append('../utils')
from siploader_common import get_top_sites

sites = get_top_sites(2000)

for site in sites:
    filename = '../dependency_base/cost_gain_graph/%s.json' % site['domain']
    out_filename = './graph_data/%s.txt' % site['domain']

    if not os.path.exists(filename):
        continue
    
    with open(filename, 'r', encoding='utf-8') as f:
        raw = json.loads(f.read())
        
    node_id = 0
    edge_number = 0

    for key in raw:
        raw[key]['id'] = node_id
        node_id += 1
        edge_number += len(raw[key]['children'])
    
    # print(node_id)
    # print(edge_number)
    
    with open(out_filename, 'w', encoding='utf-8') as fp:
        try:
            fp.write('%d %d\n' % (node_id, edge_number))
    
            for key in raw:
                fp.write('%f %f\n' % (0 if raw[key]['cost'] is None else raw[key]['cost'], raw[key]['gain']))
            
            for key in raw:
                for c in raw[key]['children']:
                    fp.write('%d %d\n' % (raw[key]['id'], raw[c]['id']))
        except Exception as e:
            print(e)
            print(raw[key])
