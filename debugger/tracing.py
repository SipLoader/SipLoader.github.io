import os
import sys
import subprocess
import time

sys.path.append('../utils')
from siploader_common import get_top_sites

sites = get_top_sites(100)

result_filename = 'result.csv'
data = {}

dataset_names = []

data_set = [
    ['ours', '../scheduler/scheduled_page'],
    ['original', '../corpus/mahimahi_record']
]

if os.path.exists(result_filename):
    head = True
    with open(result_filename, 'r') as fp:
        lines = fp.readlines()
        for line in lines:
            line = line.strip()
            if line == '':
                continue
            if head:
                ds = line.split(',')
                i = 1
                while i < len(ds):
                    dataset_names.append(ds[i])
                    i += 1
                head = False
            else:
                ds = line.split(',')
                if ds[0] in data:
                    continue
                data[ds[0]] = []
                i = 1
                while i < len(ds):
                    data[ds[0]].append([dataset_names[i - 1], float(ds[i])])
                    i += 1

for site in sites:
    domain = site['domain']
    url = site['url']

    if domain in data:
        print('%s already exists.' % (domain))
        continue

    domain_data = {}

    for ds in data_set:

        trace_out_dir = './measurement_data/%s_%d_%d_%s.json' % (domain, 1920, 1080, ds[0])

        # if os.path.exists(trace_out_dir):
        #     print('%s already exists.' % (trace_out_dir))
        #     continue
        
        os.system('rm -rf %s' % (trace_out_dir))
        os.system('rm -rf TRACE_OK')
        # cmd = 'node ./dependency_tracker.js %s %s %s %s' % (domain, url, dependency_out_dir, cost_gain_out_dir)
        # os.system(cmd)

        cmd1 = 'mm-webreplay %s/%s mm-delay 50 mm-loss downlink 0.05' % (ds[1], domain)
        cmd2 = 'node ./tracing.js %s %s %s' % (domain, url, ds[0])
        
        p_webreplay = subprocess.Popen([cmd1], shell=True, stdin=subprocess.PIPE)
        
        try:
            time.sleep(1)
            p_webreplay.stdin.write(cmd2 + '\n')
            time.sleep(1)
        except Exception as e:
            print(e)

        sec = 0

        while True:
            if os.path.exists('TRACE_OK') or sec >= 45 or p_webreplay.poll() is not None:
                break
            time.sleep(1)
            sec += 1
        
        if os.path.exists('TRACE_OK'):
            time.sleep(1)
            with open('TRACE_OK', 'r') as fp:
                si = float(fp.readline())
                print(ds[0] + ': ' + str(si))
                domain_data[ds[0]] = si
    
        try:
            os.system('pkill -9 chrome-*')
            p_webreplay.kill()
            os.system('pkill apache2')
        except Exception as e:
            print(e)
        
        os.system('rm -rf TRACE_OK')

    out_data = domain
    
    for ds in data_set:
        if ds[0] in domain_data:
            out_data += ',%f' % (domain_data[ds[0]])
        else:
            out_data += ',-1'
    out_data += '\n'

    print(out_data)
    
    with open(result_filename, 'a') as fp:
        fp.write(out_data)