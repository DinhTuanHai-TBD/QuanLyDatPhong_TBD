import re

with open('src/index.css', 'r') as f:
    content = f.read()

# Update the media query to include .tbd-navbar gap adjustment
media_query_old = """
@media (max-width: 1450px) {
  .desktop-nav {
    margin-left: 10px;
    gap: 4px;
  }
"""

media_query_new = """
@media (max-width: 1450px) {
  .tbd-navbar {
    gap: 12px;
  }
  .desktop-nav {
    margin-left: 10px;
    gap: 4px;
  }
"""

content = content.replace(media_query_old, media_query_new)

with open('src/index.css', 'w') as f:
    f.write(content)
