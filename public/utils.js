// Override window.alert globally for modern glassmorphic toasts
(function() {
  // Inject style block for toasts dynamically
  const style = document.createElement('style');
  style.textContent = `
    #toast-container {
      position: fixed;
      top: 24px;
      right: 24px;
      z-index: 100000;
      display: flex;
      flex-direction: column;
      gap: 12px;
      pointer-events: none;
      max-width: 380px;
      width: calc(100% - 48px);
    }
    .custom-toast {
      background: rgba(15, 23, 42, 0.95);
      backdrop-filter: blur(12px);
      -webkit-backdrop-filter: blur(12px);
      border: 1px solid rgba(255, 255, 255, 0.08);
      border-radius: 14px;
      padding: 16px 20px;
      color: #f3f4f6;
      font-size: 14px;
      font-weight: 600;
      font-family: 'Inter', system-ui, sans-serif;
      box-shadow: 0 10px 30px rgba(0, 0, 0, 0.5), inset 0 1px 0 rgba(255,255,255,0.05);
      display: flex;
      align-items: center;
      gap: 12px;
      transform: translateX(120%);
      opacity: 0;
      transition: transform 0.4s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.4s;
      pointer-events: auto;
    }
    .custom-toast.show {
      transform: translateX(0);
      opacity: 1;
    }
    .custom-toast.error {
      border-color: #ef4444;
      background: linear-gradient(135deg, rgba(239, 68, 68, 0.15), rgba(239, 68, 68, 0.05));
      box-shadow: 0 10px 30px rgba(239, 68, 68, 0.15);
    }
    .custom-toast.success {
      border-color: #10b981;
      background: linear-gradient(135deg, rgba(16, 185, 129, 0.15), rgba(16, 185, 129, 0.05));
      box-shadow: 0 10px 30px rgba(16, 185, 129, 0.15);
    }
    .custom-toast.info {
      border-color: #f59e0b;
      background: linear-gradient(135deg, rgba(245, 158, 11, 0.15), rgba(245, 158, 11, 0.05));
      box-shadow: 0 10px 30px rgba(245, 158, 11, 0.15);
    }
    .custom-toast-emoji {
      font-size: 20px;
      display: flex;
      align-items: center;
      justify-content: center;
    }
  `;
  document.head.appendChild(style);

  // Create toast container
  function getContainer() {
    let container = document.getElementById('toast-container');
    if (!container) {
      container = document.createElement('div');
      container.id = 'toast-container';
      document.body.appendChild(container);
    }
    return container;
  }

  window.showToast = function(message, type = 'info') {
    const container = getContainer();
    const toast = document.createElement('div');
    toast.className = `custom-toast ${type}`;
    
    let emoji = 'ℹ️';
    if (type === 'success') emoji = '🏆';
    else if (type === 'error') emoji = '🚨';
    
    toast.innerHTML = `
      <div class="custom-toast-emoji">${emoji}</div>
      <div style="flex: 1; line-height: 1.4;">${message}</div>
    `;
    
    container.appendChild(toast);
    
    // Animate in
    setTimeout(() => toast.classList.add('show'), 50);
    
    // Remove after timeout
    setTimeout(() => {
      toast.classList.remove('show');
      setTimeout(() => toast.remove(), 400);
    }, 4500);
  };

  // Override standard window.alert
  window.alert = function(msg) {
    const text = String(msg).toLowerCase();
    let type = 'info';
    if (text.includes('erro') || text.includes('falha') || text.includes('insuficiente') || text.includes('inválid') || text.includes('não autorizado') || text.includes('limite') || text.includes('perdeu') || text.includes('recusou') || text.includes('morreste')) {
      type = 'error';
    } else if (text.includes('sucesso') || text.includes('ganhou') || text.includes('venceu') || text.includes('parabéns') || text.includes('recuper') || text.includes('sobreviveu')) {
      type = 'success';
    }
    window.showToast(msg, type);
  };
})();
