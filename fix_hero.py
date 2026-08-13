import re

with open('src/index.css', 'r') as f:
    content = f.read()

# Replace the default hero-slide heights
old_hero = """.hero-slide {
  position: relative;
  display: grid;
  min-height: 80vh;
  min-height: 580px;"""

new_hero = """.hero-slide {
  position: relative;
  display: grid;
  min-height: 680px;
  max-height: 760px;"""

content = content.replace(old_hero, new_hero)

with open('src/index.css', 'w') as f:
    f.write(content)
