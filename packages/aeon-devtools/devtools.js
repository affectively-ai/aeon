// Create the Aeon Flow panel in Chrome DevTools
chrome.devtools.panels.create(
  'Aeon Flow',
  'icons/aeon-16.png',
  'panel.html',
  function (panel) {
    console.log('Aeon Flow Inspector panel created');
  }
);
