import re

with open('src/index.css', 'r') as f:
    content = f.read()

# Make the default padding smaller to ensure it fits at 1440px
content = content.replace("padding: 8px 16px;", "padding: 8px 12px;")
content = content.replace("margin-left: 20px;", "margin-left: 12px;")
content = content.replace("gap: 6px;", "gap: 4px;")

# Fix the media queries to match the user's exact breakpoints (1440px)
content = content.replace("@media (min-width: 1536px)", "@media (min-width: 1440px)")
content = content.replace("@media (max-width: 1535px)", "@media (max-width: 1439px)")

with open('src/index.css', 'w') as f:
    f.write(content)
