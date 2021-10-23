import sys
import re
from urllib import parse

in_file = sys.argv[1]
site = sys.argv[2]

def site_repl(matchobj):
    print('url(%s)' % parse.urljoin(site, matchobj.group(1)))
    return 'url(%s)' % parse.urljoin(site, matchobj.group(1))

css = ''
with open(in_file) as f:
    for line in f:
        css = css + line
# print css
pattern = r"url\([\"']?(.*?)[\"']?\)"
print(re.sub(pattern, site_repl, css, flags=re.IGNORECASE))