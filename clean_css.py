from pathlib import Path
import re

css_file = Path("src/styles/index.css")

text = css_file.read_text(encoding="utf-8")

# Remove 3+ blank lines
text = re.sub(r"\n{3,}", "\n\n", text)

# Find duplicate selectors
selectors = re.findall(r"(^[^{@][^{]+)\{", text, flags=re.MULTILINE)

seen = {}
duplicates = []

for s in selectors:
    selector = s.strip()

    if selector in seen:
        duplicates.append(selector)
    else:
        seen[selector] = 1

# Save cleaned file
output = Path("index.cleaned.css")
output.write_text(text, encoding="utf-8")

print("=" * 60)
print("CSS Scan Finished")
print("=" * 60)
print()

print("Total selectors :", len(selectors))
print("Unique selectors:", len(seen))
print("Duplicate selectors:", len(duplicates))
print()

if duplicates:
    print("Duplicate CSS blocks:")
    print("-" * 60)
    for d in sorted(set(duplicates)):
        print(d)

print()
print("Clean file saved as:", output)