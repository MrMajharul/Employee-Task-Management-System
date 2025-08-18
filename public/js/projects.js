// Projects view: basic placeholder and hook for future expansion
(function(){
  function renderProjectsView(app){
    if (!app) return;
    // currently the projectsView is a placeholder; this function ensures it's shown
    if (typeof app.showMainView === 'function') app.showMainView('projects');
  }
  window.renderProjectsView = renderProjectsView;
})();
