<!-- Offline Status Component -->
<!-- Displays connection status and sync indicators -->
<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { 
    isOnline, 
    offlineStatus, 
    pendingChanges, 
    lastSyncTime,
    OfflineStatus 
  } from '../helpers/offline-manager';
  import { getOfflineStatus, syncAllOfflineChanges } from '../stores/project.store';
  
  // Reactive offline status
  $: projectOfflineStatus = getOfflineStatus();
  
  // Connection status indicators
  $: statusColor = getStatusColor($offlineStatus);
  $: statusText = getStatusText($offlineStatus, $pendingChanges);
  $: showSyncButton = $projectOfflineStatus.canSync;
  
  // Sync state
  let isSyncing = false;
  let lastSyncText = '';
  
  // Auto-update last sync text
  $: {
    if ($lastSyncTime > 0) {
      updateLastSyncText($lastSyncTime);
    }
  }
  
  let syncInterval: NodeJS.Timeout;
  
  onMount(() => {
    // Update last sync text every minute
    syncInterval = setInterval(() => {
      if ($lastSyncTime > 0) {
        updateLastSyncText($lastSyncTime);
      }
    }, 60000);
  });
  
  onDestroy(() => {
    if (syncInterval) {
      clearInterval(syncInterval);
    }
  });
  
  function getStatusColor(status: OfflineStatus): string {
    switch (status) {
      case OfflineStatus.ONLINE:
        return 'text-green-600';
      case OfflineStatus.OFFLINE:
        return 'text-red-600';
      case OfflineStatus.SYNCING:
        return 'text-blue-600';
      case OfflineStatus.ERROR:
        return 'text-orange-600';
      default:
        return 'text-gray-600';
    }
  }
  
  function getStatusText(status: OfflineStatus, pending: number): string {
    switch (status) {
      case OfflineStatus.ONLINE:
        return pending > 0 ? `Online (${pending} pending)` : 'Online';
      case OfflineStatus.OFFLINE:
        return pending > 0 ? `Offline (${pending} pending)` : 'Offline';
      case OfflineStatus.SYNCING:
        return 'Syncing...';
      case OfflineStatus.ERROR:
        return 'Connection Error';
      default:
        return 'Unknown';
    }
  }
  
  function updateLastSyncText(timestamp: number): void {
    const now = Date.now();
    const diff = now - timestamp;
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);
    
    if (days > 0) {
      lastSyncText = `${days}d ago`;
    } else if (hours > 0) {
      lastSyncText = `${hours}h ago`;
    } else if (minutes > 0) {
      lastSyncText = `${minutes}m ago`;
    } else {
      lastSyncText = 'Just now';
    }
  }
  
  async function handleSync(): Promise<void> {
    if (isSyncing) return;
    
    isSyncing = true;
    try {
      await syncAllOfflineChanges();
    } catch (error) {
      console.error('Sync failed:', error);
    } finally {
      isSyncing = false;
    }
  }
  
  function getStatusIcon(status: OfflineStatus): string {
    switch (status) {
      case OfflineStatus.ONLINE:
        return '🟢';
      case OfflineStatus.OFFLINE:
        return '🔴';
      case OfflineStatus.SYNCING:
        return '🔄';
      case OfflineStatus.ERROR:
        return '⚠️';
      default:
        return '⚪';
    }
  }
</script>

<div class="offline-status-container">
  <!-- Connection Status Indicator -->
  <div class="status-indicator {statusColor}">
    <span class="status-icon" title={statusText}>
      {getStatusIcon($offlineStatus)}
    </span>
    <span class="status-text">{statusText}</span>
  </div>
  
  <!-- Sync Information -->
  {#if $lastSyncTime > 0}
    <div class="sync-info">
      <span class="sync-time" title="Last sync: {new Date($lastSyncTime).toLocaleString()}">
        {lastSyncText}
      </span>
    </div>
  {/if}
  
  <!-- Sync Button -->
  {#if showSyncButton}
    <button 
      class="sync-button"
      class:syncing={isSyncing}
      disabled={isSyncing}
      on:click={handleSync}
      title="Sync offline changes"
    >
      {#if isSyncing}
        <span class="spinner">⏳</span>
        Syncing...
      {:else}
        <span>🔄</span>
        Sync
      {/if}
    </button>
  {/if}
  
  <!-- Project Offline Status -->
  {#if $projectOfflineStatus.hasOfflineChanges}
    <div class="offline-changes-indicator" title="Project has unsaved changes">
      <span class="changes-icon">💾</span>
      <span class="changes-text">Unsaved</span>
    </div>
  {/if}
</div>

<style>
  .offline-status-container {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 8px 12px;
    background: var(--bg-secondary, #f8f9fa);
    border: 1px solid var(--border-color, #e1e5e9);
    border-radius: 6px;
    font-size: 0.875rem;
    min-width: 200px;
  }
  
  .status-indicator {
    display: flex;
    align-items: center;
    gap: 6px;
    font-weight: 500;
  }
  
  .status-icon {
    font-size: 1rem;
    line-height: 1;
  }
  
  .status-text {
    line-height: 1;
  }
  
  .sync-info {
    color: var(--text-secondary, #6c757d);
    font-size: 0.75rem;
  }
  
  .sync-button {
    display: flex;
    align-items: center;
    gap: 4px;
    padding: 4px 8px;
    background: var(--primary-color, #007bff);
    color: white;
    border: none;
    border-radius: 4px;
    font-size: 0.75rem;
    cursor: pointer;
    transition: background-color 0.2s;
  }
  
  .sync-button:hover:not(:disabled) {
    background: var(--primary-hover, #0056b3);
  }
  
  .sync-button:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }
  
  .sync-button.syncing {
    animation: pulse 1.5s infinite;
  }
  
  .offline-changes-indicator {
    display: flex;
    align-items: center;
    gap: 4px;
    color: var(--warning-color, #ffc107);
    font-size: 0.75rem;
  }
  
  .changes-icon {
    font-size: 0.875rem;
  }
  
  .spinner {
    animation: spin 1s linear infinite;
  }
  
  @keyframes spin {
    from { transform: rotate(0deg); }
    to { transform: rotate(360deg); }
  }
  
  @keyframes pulse {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.7; }
  }
  
  /* Dark mode support */
  @media (prefers-color-scheme: dark) {
    .offline-status-container {
      background: var(--bg-secondary-dark, #2d3748);
      border-color: var(--border-color-dark, #4a5568);
      color: var(--text-primary-dark, #f7fafc);
    }
    
    .sync-info {
      color: var(--text-secondary-dark, #a0aec0);
    }
  }
  
  /* Responsive design */
  @media (max-width: 768px) {
    .offline-status-container {
      gap: 8px;
      padding: 6px 10px;
      min-width: auto;
    }
    
    .status-text,
    .changes-text {
      display: none;
    }
    
    .sync-button {
      padding: 3px 6px;
      font-size: 0.7rem;
    }
  }
</style>