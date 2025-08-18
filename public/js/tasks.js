// Tasks module renderer and interactions
(function(){
  function renderTasksView(app){
    // If tasks are already loaded, just refresh the display; else load
    if (!app) return;
    if (app.tasks && app.tasks.length) {
      app.filterAndDisplayTasks();
    } else {
      app.loadTasks();
    }
  }

  // Expose small helpers for inline actions if needed later
  window.renderTasksView = renderTasksView;
})();
