/**
 * ----------------------------------------------------------------------------------
 * PurifyBrowserExtension devtools.js
 * Licensed under MIT (https://github.com/cyberpurify/CyberPurify/blob/main/LICENSE)
 * ----------------------------------------------------------------------------------
 */

const browser = window.browser || chrome;

// TODO: Try to move it to first cell
browser.devtools.panels.elements.createSidebarPane("CyberPurify", (sidebar) => {
  sidebar.setHeight("400px");
  sidebar.setPage("pages/devtools-elements-sidebar.html");
});