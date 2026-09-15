import json, collections
for f in ['.tmp-abomaS.json', '.tmp-garS.json']:
    print('====', f, '====')
    d = json.load(open(f, encoding='utf-8'))
    cats = collections.defaultdict(list)
    for r in d.get('rows', []):
        cats[r.get('category')].append(r)
    for c, rs in cats.items():
        if c in ('stat_points',):
            print('[%s] count=%d' % (c, len(rs)))
        else:
            vals = []
            for r in rs:
                v = r.get('name', '')
                if r.get('stat_up') or r.get('stat_down'):
                    v += ' (up=%s down=%s)' % (r.get('stat_up'), r.get('stat_down'))
                vals.append('%s %s' % (v, r.get('percentage', '')))
            print('[%s]' % c, ' | '.join(vals))
