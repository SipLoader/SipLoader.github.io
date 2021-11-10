import os
import sys
import subprocess
import time
import threading

sys.path.append('../utils')
from siploader_common import get_top_sites

sites = get_top_sites(20)

def replay(cmd1, cmd2):
    p_webreplay = subprocess.Popen([cmd1], shell=True, stdin=subprocess.PIPE)
    
    # p_webreplay.stdin.write(bytes(cmd2 + '\n', 'utf-8'))
    p_webreplay.communicate(cmd2.encode('utf-8')) 
    # p_webreplay.kill()

for site in sites:
    domain = site['domain']
    url = site['url']

    per_out_dir = './per_data/%s.json'  % (domain)

    if os.path.exists(per_out_dir):
        print('%s already exists.' % (per_out_dir))
        continue
    # cmd = 'node ./dependency_tracker.js %s %s %s %s' % (domain, url, dependency_out_dir, cost_gain_out_dir)
    # os.system(cmd)

    cmd1 = 'mm-webreplay ../corpus/mahimahi_record/%s' % (domain)
    cmd2 = 'node ./per_genenerator.js %s %s %s' % (domain, url, per_out_dir)
    
    # p_webreplay = subprocess.Popen([cmd1], shell=True, stdin=subprocess.PIPE)
    # time.sleep(2)
    
    # p_webreplay.stdin.write(bytes(cmd2 + '\n', 'utf-8'))

    t = threading.Thread(target=replay, args=(cmd1, cmd2))
    t.start()

    sec = 0

    while True:
        if (os.path.exists(per_out_dir) and os.path.exists(per_out_dir)) or sec >= 30:
            break
        time.sleep(1)
        sec += 1
    
    try:
        os.system('pkill -9 chrome-*')
        # p_webreplay.kill()
        # t.stop()
        os.system('pkill apache2')
    except Exception as e:
        print(e)