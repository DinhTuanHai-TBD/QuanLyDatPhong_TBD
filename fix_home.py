import re

with open('src/features/home/HomePage.tsx', 'r') as f:
    content = f.read()

# Change Col breakpoints for feature cards
old_cols = "xs={24} sm={12} lg={6}"
new_cols = "xs={24} md={12} xl={6}"
content = content.replace(old_cols, new_cols)

with open('src/features/home/HomePage.tsx', 'w') as f:
    f.write(content)
