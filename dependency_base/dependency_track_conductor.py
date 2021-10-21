import os
import sys
import subprocess
import time

sys.path.append('../utils')
from siploader_common import get_top_sites

sites = get_top_sites(2000)

for site in sites:
    domain = site['domain']
    url = site['url']

    # if domain == 'qq.com':
    #     break

    dependency_out_dir = './dependency_dot/%s.dot'  % (domain)
    cost_gain_out_dir = './cost_gain_graph/%s.json'  % (domain)

    if os.path.exists(dependency_out_dir):
        print('%s already exists.' % (dependency_out_dir))
        continue
    # cmd = 'node ./dependency_tracker.js %s %s %s %s' % (domain, url, dependency_out_dir, cost_gain_out_dir)
    # os.system(cmd)

    cmd1 = 'mm-webreplay ../corpus/mahimahi_record/%s' % (domain)
    cmd2 = 'node ./dependency_tracker.js %s %s %s %s' % (domain, url, dependency_out_dir, cost_gain_out_dir)
    
    p_webreplay = subprocess.Popen([cmd1], shell=True, stdin=subprocess.PIPE)
    
    p_webreplay.stdin.write(cmd2 + '\n')
    time.sleep(2)

    sec = 0

    while True:
        if (os.path.exists(dependency_out_dir) and os.path.exists(cost_gain_out_dir)) or sec >= 30:
            break
        time.sleep(1)
        sec += 1
    
    try:
        os.system('pkill -9 chrome-*')
        p_webreplay.kill()
        os.system('pkill apache2')
    except Exception as e:
        print(e)