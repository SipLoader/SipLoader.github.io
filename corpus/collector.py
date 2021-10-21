import os
import subprocess
import time
import sys

sys.path.append('../utils')
from siploader_common import get_top_sites

sites = get_top_sites(2000)

print(sites)

# cmd = 'mm-webrecord /tmp/nytimes chromium-browser --ignore-certificate-errors --user-data-dir=/tmp/nonexistent$(date +%s%N) www.nytimes.com'

for site in sites:
    domain = site['domain']
    url = site['url']

    our_dir = './mahimahi_record/%s' % (domain)

    if os.path.exists(our_dir):
        print('%s already exists.' % (domain))
        continue

    cmd = 'mm-webrecord %s /usr/bin/google-chrome --disable-fre --no-default-browser-check --no-first-run --window-size=1920,1080 --ignore-certificate-errors --user-data-dir=./nonexistent/$(date +%%s%%N) %s' % (our_dir, url)
    # print(cmd)
    p = subprocess.Popen([cmd], shell=True)
    tick = 0

    while (True):
        if p.poll() is None:
            if (tick >= 30):
                break
            tick += 2
            time.sleep(2)
        else:
            break
    
    try:
        p.kill()
        killer = 'pkill -9 chrome-*'
        os.system(killer)
    except Exception as e:
        print(e)
        