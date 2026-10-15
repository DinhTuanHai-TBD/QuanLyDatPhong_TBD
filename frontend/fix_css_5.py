import re

with open('src/index.css', 'r') as f:
    content = f.read()

# Remove the `@media (max-width: 1250px)` and `@media (max-width: 1450px)` entirely because we have new precise breakpoints
content = re.sub(r'@media \(max-width: 1250px\) \{[\s\S]*?\}\s*\}', '', content)
content = re.sub(r'@media \(max-width: 1450px\) \{[\s\S]*?\}\s*\}', '', content)

with open('src/index.css', 'w') as f:
    f.write(content)
