import re

with open('src/index.css', 'r') as f:
    content = f.read()

# Remove the old max-width: 640px hero-slide min-height
content = re.sub(r'(\s*)\.hero-slide \{\s*min-height: 600px;\s*border-radius: 0 0 20px 20px;\s*\}', '', content)
content = re.sub(r'@media \(max-width: 992px\) and \(min-width: 641px\) \{\s*\.hero-slide \{\s*min-height: 620px;\s*\}\s*\}', '', content)

with open('src/index.css', 'w') as f:
    f.write(content)
