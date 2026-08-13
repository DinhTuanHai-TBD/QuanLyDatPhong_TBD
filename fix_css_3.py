with open('src/index.css', 'r') as f:
    lines = f.readlines()

# We know the block starts at 1066 and ends at 1135 in this specific state, but let's be careful.
with open('temp_to_replace.txt', 'r') as f:
    to_replace = f.read()

with open('src/index.css', 'r') as f:
    content = f.read()

new_content = """@media (min-width: 1536px) {
  .nav-item-more {
    display: inline-block;
  }
  .nav-more-dropdown {
    display: none !important;
  }
}

@media (max-width: 1535px) and (min-width: 1024px) {
  .nav-item-more {
    display: none;
  }
  .nav-more-dropdown {
    display: inline-flex !important;
    align-items: center;
    cursor: pointer;
    color: rgba(255, 255, 255, 0.85);
    font-weight: 600;
    text-transform: uppercase;
    font-size: 14px;
    padding: 8px 16px;
  }
}

@media (min-width: 1100px) {
  .user-email-text {
    display: inline-block;
    max-width: 150px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    vertical-align: bottom;
  }
  .user-dropdown-trigger {
    display: none !important;
  }
  .nav-user-button-desktop {
    display: inline-flex !important;
  }
}

@media (max-width: 1099px) and (min-width: 1024px) {
  .user-email-text {
    display: none;
  }
  .user-dropdown-trigger {
    display: inline-flex !important;
  }
  .nav-user-button-desktop {
    display: none !important;
  }
}

@media (max-width: 1023px) {
  .desktop-nav {
    display: none !important;
  }
  .mobile-menu-button {
    display: inline-flex !important;
  }
  .tbd-navbar {
    gap: 14px;
    padding-inline: 16px;
  }
  .user-email-text {
    display: none;
  }
  .user-dropdown-trigger {
    display: none !important;
  }
  .nav-user-button-desktop {
    display: none !important;
  }
}"""

content = content.replace(to_replace, new_content)

with open('src/index.css', 'w') as f:
    f.write(content)
