import re

with open('src/index.css', 'r') as f:
    content = f.read()

# We need to replace the old media queries related to nav-item-more and user-email-text
# First let's remove them. They are around line 1066.
# We will use regex to find and replace.

pattern = re.compile(r'@media \(min-width: 1440px\) \{[\s\S]*?@media \(max-width: 1023px\) \{', re.MULTILINE)
# Wait, this might match too much. Let's do string replacement for safety.
