import os

def get_top_sites(top_x):
    current_path = os.path.abspath(__file__)
    parent_path = os.path.abspath(os.path.dirname(current_path) + os.path.sep + ".")
    websites_file = '%s/../top_sites/top-sites-url.txt' % parent_path

    f = open(websites_file, 'r')
    lines = f.readlines()
    f.close()

    sites = []

    for line in lines:
        site = {}
        site['id'] = line.split('\t')[0].strip()
        site['domain'] = line.split('\t')[1].strip()
        site['url'] = line.split('\t')[2].strip()
        sites.append(site)

        if len(sites) >= top_x:
            break

    return sites