// Scrum/Kanban view helpers
(function(){
  function renderScrumView(app){
    if (!app) return;
    if (typeof app.showMainView === 'function') app.showMainView('scrum');
    // If there is any scrum-specific refresh we can trigger here in future
  }
  window.renderScrumView = renderScrumView;
})();
