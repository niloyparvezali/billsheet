from pathlib import Path
import re

path = Path('src/styles/index.css')
text = path.read_text(encoding='utf-8')
lines = text.splitlines()
start_regex = re.compile(r'^\s*@media\s*\(([^)]+)\)\s*\{')
blocks = []

# locate blocks
line_index = 0
while line_index < len(lines):
    m = start_regex.match(lines[line_index])
    if not m:
        line_index += 1
        continue
    cond = m.group(1).strip()
    start = line_index
    depth = 0
    end = start
    for j in range(start, len(lines)):
        depth += lines[j].count('{')
        depth -= lines[j].count('}')
        if depth == 0:
            end = j
            break
    blocks.append({'start': start, 'end': end, 'cond': cond, 'lines': lines[start:end+1]})
    line_index = end + 1

# group blocks by condition
groups = {}
for idx, block in enumerate(blocks):
    groups.setdefault(block['cond'], []).append((idx, block))

# build merged contents for duplicate groups
merged_inner = {}
for cond, group_items in groups.items():
    if len(group_items) > 1:
        merged = []
        for idx, block in group_items:
            inner = block['lines'][1:-1]
            if inner:
                merged.extend(inner)
        merged_inner[cond] = merged

# rewrite lines, outputting first occurrence for each group with merged content and skipping duplicates
output = []
next_block_idx = 0
block_map = {block['start']: (idx, block) for idx, block in enumerate(blocks)}
written = set()
line_index = 0
while line_index < len(lines):
    if line_index in block_map:
        idx, block = block_map[line_index]
        cond = block['cond']
        group = groups[cond]
        first_idx = group[0][0]
        if idx == first_idx:
            output.append(lines[line_index])
            if cond in merged_inner:
                output.extend(merged_inner[cond])
            else:
                output.extend(block['lines'][1:-1])
            output.append(lines[block['end']])
        # skip all block lines
        line_index = block['end'] + 1
        continue
    output.append(lines[line_index])
    line_index += 1

new_text = '\n'.join(output) + ('\n' if text.endswith('\n') else '')
path.write_text(new_text, encoding='utf-8')
print(f'Merged {sum(1 for cond, items in groups.items() if len(items) > 1)} duplicate @media query conditions')
