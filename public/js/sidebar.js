// Sidebar and module navigation controller
// Exposes navigateToModule globally for sidebar links in dashboard.html
(function(){
  function navigateToModule(moduleName) {
    // Update active state in sidebar
    document.querySelectorAll('.app-sidebar-nav a').forEach(link => link.classList.remove('active'));
    const active = document.querySelector(`.app-sidebar-nav [data-route="${moduleName}"]`);
    if (active) active.classList.add('active');

    // Close sidebar after navigation (especially on mobile)
  const sidebar = document.getElementById('appSidebar');
  const overlay = document.getElementById('sidebarOverlay');
  if (sidebar) sidebar.classList.remove('active');
  if (overlay) overlay.classList.remove('active');
  const toggleBtn = document.getElementById('sidebarToggle');
  if (toggleBtn) toggleBtn.setAttribute('aria-expanded', 'false');

    // Route handling
    const app = window.app;
    switch (moduleName) {
      case 'tasks':
        window.showMainView && window.showMainView('tasks');
        if (window.renderTasksView && window.app) {
          window.renderTasksView(window.app);
        }
        break;
      case 'documents':
        window.showMainView && window.showMainView('documents');
        if (window.renderDocumentsView && window.app) {
          window.renderDocumentsView(window.app);
        }
        break;
      case 'messenger':
        window.showMainView && window.showMainView('messenger');
        if (window.messenger && typeof window.messenger.initializeMessenger === 'function') {
          window.messenger.initializeMessenger();
        }
        break;
      case 'settings':
        if (app && typeof app.showSettingsModal === 'function') app.showSettingsModal();
        break;
      case 'calendar':
      case 'feed':
      case 'webmail':
      case 'groupworks':
      case 'booking':
      case 'inventory':
      case 'esignature':
      case 'subscription':
        app && app.showNotification && app.showNotification('Module coming soon!', 'info');
        break;
      case 'employees':
        window.showMainView && window.showMainView('employees');
        if (app && typeof app.renderEmployeesList === 'function') {
          app.renderEmployeesList();
        }
        break;
      default:
        // Unknown module
        break;
    }
  }

  // expose
  window.navigateToModule = navigateToModule;
})();
