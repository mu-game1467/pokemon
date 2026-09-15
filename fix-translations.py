path = index.html
with open(path, r, encoding=utf-8) as f:
    content = f.read()

old_move =  'Night Daze':'ナイトバースト',\r\n 'Illusion':'イリュージョン',\r\n 'Nuzzle':'ほっぺすりすり',
new_move =  'Night Daze':'ナイトバースト',\r\n 'Night Slash':'つじぎり',\r\n 'Nuzzle':'ほっぺすりすり',
if old_move in content:
    content = content.replace(old_move, new_move)
    print(Fix 1: MOVE_EN_TO_JA - OK)
else:
    print(Fix 1: pattern not found)

old_ability =  'White Smoke':'しろいけむり'\r\n };
new_ability =  'White Smoke':'しろいけむり',\r\n 'Illusion':'イリュージョン'\r\n };
if old_ability in content:
    content = content.replace(old_ability, new_ability)
    print(Fix 2: ABILITY_EN_TO_JA - OK)
else:
    print(Fix 2: pattern not found)

with open(path, w, encoding=utf-8) as f:
    f.write(content)
print(File saved)
