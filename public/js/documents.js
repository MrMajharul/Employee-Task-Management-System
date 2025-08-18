// Documents module - handles all document-related functionality
(function(){
  function renderDocumentsView(app) {
    if (!app) return;
    
    // Show documents view
    if (typeof app.showMainView === 'function') {
      app.showMainView('documents');
    }
    
    // Load documents if not already loaded
    if (typeof app.loadDocuments === 'function') {
      app.loadDocuments();
    }
    
    // Setup document interface
    setTimeout(() => {
      if (typeof app.setupDocumentsInterface === 'function') {
        app.setupDocumentsInterface();
      }
    }, 100);
  }

  // Document-specific utilities
  function formatFileSize(bytes) {
    if (!bytes && bytes !== 0) return '';
    const units = ['B', 'KB', 'MB', 'GB'];
    let i = 0;
    let size = bytes;
    while (size >= 1024 && i < units.length - 1) {
      size /= 1024;
      i++;
    }
    return `${size.toFixed(size < 10 && i > 0 ? 1 : 0)} ${units[i]}`;
  }

  function getDocumentIcon(type) {
    const icons = {
      board: '📋',
      document: '📝', 
      spreadsheet: '📊',
      presentation: '📽️',
      file: '📄'
    };
    return icons[type] || icons.file;
  }

  // Expose functions
  window.renderDocumentsView = renderDocumentsView;
  window.formatFileSize = formatFileSize;
  window.getDocumentIcon = getDocumentIcon;
})();
