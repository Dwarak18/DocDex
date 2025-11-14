/**
 * DocDex Widget JavaScript
 * Handles all widget functionality including search, document display, and user interactions
 */

class DocDexWidget {
    constructor() {
        this.config = {
            baseUrl: '{{CATALYST_APP_URL}}',
            apiVersion: 'v1'
        };
        
        this.state = {
            isAuthenticated: false,
            currentUser: null,
            documents: [],
            searchQuery: '',
            filters: {
                sourceType: 'all',
                fileType: 'all',
                sortBy: 'relevance'
            },
            currentPage: 0,
            hasMoreDocuments: false,
            isLoading: false
        };
        
        this.init();
    }
    
    init() {
        this.bindEvents();
        this.checkAuthStatus();
        this.loadDocuments();
    }
    
    bindEvents() {
        // Search functionality
        const searchInput = document.getElementById('searchInput');
        const clearSearch = document.getElementById('clearSearch');
        const filtersBtn = document.getElementById('searchFiltersBtn');
        
        searchInput?.addEventListener('input', this.debounce(this.handleSearch.bind(this), 500));
        searchInput?.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                this.handleSearch();
            }
        });
        
        clearSearch?.addEventListener('click', this.clearSearch.bind(this));
        filtersBtn?.addEventListener('click', this.toggleFilters.bind(this));
        
        // Filter change handlers
        document.getElementById('sourceFilter')?.addEventListener('change', this.applyFilters.bind(this));
        document.getElementById('fileTypeFilter')?.addEventListener('change', this.applyFilters.bind(this));
        document.getElementById('sortFilter')?.addEventListener('change', this.applyFilters.bind(this));
        
        // Action buttons
        document.getElementById('authorizeBtn')?.addEventListener('click', this.startAuth.bind(this));
        document.getElementById('refreshIndexBtn')?.addEventListener('click', this.refreshIndex.bind(this));
        document.getElementById('viewStatsBtn')?.addEventListener('click', this.viewStats.bind(this));
        document.getElementById('loadMoreBtn')?.addEventListener('click', this.loadMoreDocuments.bind(this));
        
        // Modal handlers
        document.getElementById('closeModal')?.addEventListener('click', () => this.closeModal('documentModal'));
        document.getElementById('saveToTaskBtn')?.addEventListener('click', this.saveToTask.bind(this));
        document.getElementById('downloadFileBtn')?.addEventListener('click', this.downloadFile.bind(this));
        
        // Click outside modal to close
        document.addEventListener('click', (e) => {
            if (e.target.classList.contains('modal')) {
                this.closeModal(e.target.id);
            }
        });
    }
    
    async checkAuthStatus() {
        try {
            const response = await this.apiCall('GET', '/auth/status');
            
            if (response.success && response.data.isAuthenticated) {
                this.state.isAuthenticated = true;
                this.state.currentUser = response.data.user;
                this.showMainContent();
                this.updateAuthStatus('authorized', 'Connected');
            } else {
                this.showAuthSection();
                this.updateAuthStatus('unauthorized', 'Not Connected');
            }
        } catch (error) {
            console.error('Auth check failed:', error);
            this.showAuthSection();
            this.updateAuthStatus('error', 'Connection Error');
        }
    }
    
    showAuthSection() {
        document.getElementById('authSection').style.display = 'block';
        document.getElementById('mainContent').style.display = 'none';
    }
    
    showMainContent() {
        document.getElementById('authSection').style.display = 'none';
        document.getElementById('mainContent').style.display = 'block';
    }
    
    updateAuthStatus(status, text) {
        const indicator = document.getElementById('statusIndicator');
        const statusText = document.getElementById('statusText');
        
        indicator?.classList.remove('authorized');
        if (status === 'authorized') {
            indicator?.classList.add('authorized');
        }
        
        if (statusText) {
            statusText.textContent = text;
        }
    }
    
    async startAuth() {
        try {
            const btn = document.getElementById('authorizeBtn');
            btn.disabled = true;
            btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Redirecting...';
            
            const response = await this.apiCall('POST', '/auth/start');
            
            if (response.success && response.data.authUrl) {
                window.open(response.data.authUrl, 'DocDexAuth', 'width=600,height=700');
                
                // Poll for auth completion
                this.pollAuthStatus();
            } else {
                throw new Error(response.message || 'Failed to start authentication');
            }
        } catch (error) {
            console.error('Auth start failed:', error);
            this.showToast('Authentication failed: ' + error.message, 'error');
            
            const btn = document.getElementById('authorizeBtn');
            btn.disabled = false;
            btn.innerHTML = '<i class="fas fa-shield-alt"></i> Authorize Access';
        }
    }
    
    pollAuthStatus() {
        const pollInterval = setInterval(async () => {
            try {
                const response = await this.apiCall('GET', '/auth/status');
                
                if (response.success && response.data.isAuthenticated) {
                    clearInterval(pollInterval);
                    this.state.isAuthenticated = true;
                    this.showMainContent();
                    this.updateAuthStatus('authorized', 'Connected');
                    this.loadDocuments();
                    this.showToast('Successfully authenticated!', 'success');
                }
            } catch (error) {
                // Continue polling
            }
        }, 2000);
        
        // Stop polling after 5 minutes
        setTimeout(() => {
            clearInterval(pollInterval);
        }, 300000);
    }
    
    async loadDocuments(append = false) {
        if (!this.state.isAuthenticated) return;
        
        try {
            this.setLoading(true);
            
            if (!append) {
                this.state.currentPage = 0;
                this.state.documents = [];
            }
            
            const requestBody = {
                query: this.state.searchQuery,
                limit: 20,
                offset: this.state.currentPage * 20,
                ...this.state.filters
            };
            
            const response = await this.apiCall('POST', '/search', requestBody);
            
            if (response.success) {
                const newDocuments = response.data.results || [];
                
                if (append) {
                    this.state.documents.push(...newDocuments);
                } else {
                    this.state.documents = newDocuments;
                }
                
                this.state.hasMoreDocuments = response.data.hasMore;
                this.renderDocuments();
                this.updateDocumentsCount(response.data.total || this.state.documents.length);
                
                if (this.state.documents.length === 0) {
                    this.showEmptyState();
                }
            } else {
                throw new Error(response.message || 'Failed to load documents');
            }
        } catch (error) {
            console.error('Load documents failed:', error);
            this.showToast('Failed to load documents: ' + error.message, 'error');
            this.showEmptyState();
        } finally {
            this.setLoading(false);
        }
    }
    
    renderDocuments() {
        const container = document.getElementById('documentsList');
        if (!container) return;
        
        container.innerHTML = '';
        
        this.state.documents.forEach(doc => {
            const docElement = this.createDocumentElement(doc);
            container.appendChild(docElement);
        });
        
        // Show/hide load more button
        const loadMoreContainer = document.getElementById('loadMoreContainer');
        if (loadMoreContainer) {
            loadMoreContainer.style.display = this.state.hasMoreDocuments ? 'block' : 'none';
        }
        
        // Hide empty state
        document.getElementById('emptyState').style.display = 'none';
    }
    
    createDocumentElement(doc) {
        const element = document.createElement('div');
        element.className = 'document-item';
        element.onclick = () => this.showDocumentDetails(doc);
        
        const iconClass = this.getFileIconClass(doc.mimeType);
        const sourceClass = doc.sourceType || 'unknown';
        
        element.innerHTML = `
            <div class="document-header">
                <div class="document-icon">
                    <i class="${iconClass}"></i>
                </div>
                <div class="document-info">
                    <div class="document-name" title="${doc.name}">${this.highlightSearchTerm(doc.name)}</div>
                    <div class="document-meta">
                        <span class="source-badge ${sourceClass}">${doc.sourceType}</span>
                        <span>${doc.formattedSize || this.formatFileSize(doc.size)}</span>
                        <span>${this.formatDate(doc.modifiedAt)}</span>
                    </div>
                </div>
            </div>
            ${doc.summary ? `
                <div class="document-summary">
                    ${this.highlightSearchTerm(doc.summary.text)}
                </div>
            ` : ''}
            <div class="document-actions">
                <button class="action-btn" onclick="event.stopPropagation(); this.summarizeDocument('${doc.id}')">
                    <i class="fas fa-magic"></i> Summarize
                </button>
                <button class="action-btn" onclick="event.stopPropagation(); this.downloadDocument('${doc.id}')">
                    <i class="fas fa-download"></i> Download
                </button>
            </div>
        `;
        
        return element;
    }
    
    async showDocumentDetails(doc) {
        try {
            const modal = document.getElementById('documentModal');
            const title = document.getElementById('modalTitle');
            const body = document.getElementById('modalBody');
            
            title.textContent = doc.name;
            
            // Show loading state
            body.innerHTML = `
                <div class="loading-state">
                    <i class="fas fa-spinner fa-spin"></i>
                    <p>Loading document details...</p>
                </div>
            `;
            
            modal.style.display = 'flex';
            
            // Load document details and summary
            const [detailsResponse, summaryResponse] = await Promise.allSettled([
                this.apiCall('GET', `/files/${doc.id}/metadata`),
                this.apiCall('POST', '/summarize', { fileId: doc.id })
            ]);
            
            let details = doc;
            let summary = doc.summary;
            
            if (detailsResponse.status === 'fulfilled' && detailsResponse.value.success) {
                details = { ...details, ...detailsResponse.value.data };
            }
            
            if (summaryResponse.status === 'fulfilled' && summaryResponse.value.success) {
                summary = summaryResponse.value.data;
            }
            
            this.renderDocumentDetails(body, details, summary);
            
        } catch (error) {
            console.error('Show document details failed:', error);
            this.showToast('Failed to load document details', 'error');
        }
    }
    
    renderDocumentDetails(container, doc, summary) {
        const iconClass = this.getFileIconClass(doc.mimeType);
        
        container.innerHTML = `
            <div style="display: flex; gap: 16px; margin-bottom: 20px;">
                <div class="document-icon" style="width: 60px; height: 60px; font-size: 24px;">
                    <i class="${iconClass}"></i>
                </div>
                <div style="flex: 1;">
                    <h3 style="margin-bottom: 8px; font-size: 16px;">${doc.name}</h3>
                    <div class="document-meta">
                        <span class="source-badge ${doc.sourceType}">${doc.sourceType}</span>
                        <span>${doc.formattedSize || this.formatFileSize(doc.size)}</span>
                        <span>Modified: ${this.formatDate(doc.modifiedAt)}</span>
                    </div>
                </div>
            </div>
            
            ${doc.messageSubject ? `
                <div style="margin-bottom: 16px;">
                    <strong>Email Subject:</strong> ${doc.messageSubject}<br>
                    <strong>From:</strong> ${doc.messageFrom}
                </div>
            ` : ''}
            
            ${summary ? `
                <div style="margin-bottom: 20px;">
                    <h4 style="margin-bottom: 8px; color: var(--primary-color);">
                        <i class="fas fa-magic"></i> AI Summary
                    </h4>
                    <div class="document-summary" style="background: var(--surface); padding: 16px; border-radius: 8px;">
                        ${summary.summary || summary.text}
                    </div>
                    
                    ${summary.keywords && summary.keywords.length > 0 ? `
                        <div style="margin-top: 12px;">
                            <strong>Keywords:</strong>
                            <div style="display: flex; flex-wrap: wrap; gap: 6px; margin-top: 6px;">
                                ${summary.keywords.slice(0, 10).map(keyword => 
                                    `<span style="background: #e0f2fe; color: #0277bd; padding: 4px 8px; border-radius: 12px; font-size: 11px;">
                                        ${keyword.text || keyword}
                                    </span>`
                                ).join('')}
                            </div>
                        </div>
                    ` : ''}
                    
                    ${summary.entities && summary.entities.length > 0 ? `
                        <div style="margin-top: 12px;">
                            <strong>Entities:</strong>
                            <div style="display: flex; flex-wrap: wrap; gap: 6px; margin-top: 6px;">
                                ${summary.entities.slice(0, 8).map(entity => 
                                    `<span style="background: #f3e5f5; color: #7b1fa2; padding: 4px 8px; border-radius: 12px; font-size: 11px;">
                                        ${entity.text || entity}
                                    </span>`
                                ).join('')}
                            </div>
                        </div>
                    ` : ''}
                </div>
            ` : `
                <div style="text-align: center; padding: 20px; color: var(--text-muted);">
                    <i class="fas fa-magic" style="font-size: 24px; margin-bottom: 8px;"></i>
                    <p>Click "Summarize" to generate an AI summary of this document</p>
                </div>
            `}
        `;
    }
    
    async handleSearch() {
        const searchInput = document.getElementById('searchInput');
        const query = searchInput?.value.trim() || '';
        
        this.state.searchQuery = query;
        
        // Update clear button visibility
        const clearBtn = document.getElementById('clearSearch');
        if (clearBtn) {
            clearBtn.style.display = query ? 'block' : 'none';
        }
        
        // Update section title
        const sectionTitle = document.getElementById('sectionTitle');
        if (sectionTitle) {
            sectionTitle.textContent = query ? `Search Results for "${query}"` : 'Recent Documents';
        }
        
        await this.loadDocuments();
    }
    
    clearSearch() {
        const searchInput = document.getElementById('searchInput');
        if (searchInput) {
            searchInput.value = '';
        }
        
        this.state.searchQuery = '';
        
        document.getElementById('clearSearch').style.display = 'none';
        document.getElementById('sectionTitle').textContent = 'Recent Documents';
        
        this.loadDocuments();
    }
    
    toggleFilters() {
        const panel = document.getElementById('filtersPanel');
        const btn = document.getElementById('searchFiltersBtn');
        
        if (panel && btn) {
            const isVisible = panel.style.display === 'block';
            panel.style.display = isVisible ? 'none' : 'block';
            btn.classList.toggle('active', !isVisible);
        }
    }
    
    applyFilters() {
        this.state.filters = {
            sourceType: document.getElementById('sourceFilter')?.value || 'all',
            fileType: document.getElementById('fileTypeFilter')?.value || 'all',
            sortBy: document.getElementById('sortFilter')?.value || 'relevance'
        };
        
        this.loadDocuments();
    }
    
    async loadMoreDocuments() {
        this.state.currentPage++;
        await this.loadDocuments(true);
    }
    
    async refreshIndex() {
        try {
            const btn = document.getElementById('refreshIndexBtn');
            const originalContent = btn.innerHTML;
            btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Refreshing...';
            btn.disabled = true;
            
            const response = await this.apiCall('POST', '/index/refresh');
            
            if (response.success) {
                this.showToast('Index refresh started successfully', 'success');
                setTimeout(() => this.loadDocuments(), 2000);
            } else {
                throw new Error(response.message || 'Failed to refresh index');
            }
        } catch (error) {
            console.error('Refresh index failed:', error);
            this.showToast('Failed to refresh index: ' + error.message, 'error');
        } finally {
            const btn = document.getElementById('refreshIndexBtn');
            btn.innerHTML = '<i class="fas fa-sync-alt"></i> Refresh Index';
            btn.disabled = false;
        }
    }
    
    async viewStats() {
        try {
            const response = await this.apiCall('GET', '/stats');
            
            if (response.success) {
                this.showStatsModal(response.data);
            } else {
                throw new Error(response.message || 'Failed to load statistics');
            }
        } catch (error) {
            console.error('View stats failed:', error);
            this.showToast('Failed to load statistics: ' + error.message, 'error');
        }
    }
    
    showStatsModal(stats) {
        const modal = document.getElementById('statsModal');
        const content = document.getElementById('statsContent');
        
        content.innerHTML = `
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 16px; margin-bottom: 20px;">
                <div style="text-align: center; padding: 16px; background: var(--surface); border-radius: 8px;">
                    <div style="font-size: 24px; font-weight: 600; color: var(--primary-color);">${stats.totalDocuments || 0}</div>
                    <div style="color: var(--text-secondary);">Total Documents</div>
                </div>
                <div style="text-align: center; padding: 16px; background: var(--surface); border-radius: 8px;">
                    <div style="font-size: 24px; font-weight: 600; color: var(--success-color);">${stats.processedDocuments || 0}</div>
                    <div style="color: var(--text-secondary);">Processed</div>
                </div>
                <div style="text-align: center; padding: 16px; background: var(--surface); border-radius: 8px;">
                    <div style="font-size: 24px; font-weight: 600; color: var(--warning-color);">${stats.workdriveFiles || 0}</div>
                    <div style="color: var(--text-secondary);">WorkDrive Files</div>
                </div>
                <div style="text-align: center; padding: 16px; background: var(--surface); border-radius: 8px;">
                    <div style="font-size: 24px; font-weight: 600; color: var(--secondary-color);">${stats.mailAttachments || 0}</div>
                    <div style="color: var(--text-secondary);">Mail Attachments</div>
                </div>
            </div>
            
            <div style="margin-bottom: 16px;">
                <h4>Recent Activity</h4>
                <div style="background: var(--surface); padding: 12px; border-radius: 8px; font-size: 13px;">
                    Last indexed: ${stats.lastIndexed ? this.formatDate(stats.lastIndexed) : 'Never'}
                </div>
            </div>
            
            ${stats.fileTypes ? `
                <div>
                    <h4>File Types</h4>
                    <div style="display: flex; flex-wrap: wrap; gap: 8px;">
                        ${Object.entries(stats.fileTypes).map(([type, count]) => 
                            `<span style="background: var(--surface); padding: 6px 12px; border-radius: 16px; font-size: 12px;">
                                ${type}: ${count}
                            </span>`
                        ).join('')}
                    </div>
                </div>
            ` : ''}
        `;
        
        modal.style.display = 'flex';
    }
    
    async summarizeDocument(fileId) {
        try {
            const response = await this.apiCall('POST', '/summarize', { fileId });
            
            if (response.success) {
                this.showToast('Document summarized successfully', 'success');
                // Refresh the document in the list
                this.loadDocuments();
            } else {
                throw new Error(response.message || 'Failed to summarize document');
            }
        } catch (error) {
            console.error('Summarize document failed:', error);
            this.showToast('Failed to summarize document: ' + error.message, 'error');
        }
    }
    
    async downloadDocument(fileId) {
        try {
            const url = `${this.config.baseUrl}/files/${fileId}/download`;
            window.open(url, '_blank');
        } catch (error) {
            console.error('Download document failed:', error);
            this.showToast('Failed to download document: ' + error.message, 'error');
        }
    }
    
    async saveToTask() {
        // Integrate with Cliq Tasks API
        this.showToast('Save to Task feature coming soon!', 'warning');
    }
    
    async downloadFile() {
        // Current selected document download
        this.showToast('Download started', 'success');
    }
    
    closeModal(modalId) {
        const modal = document.getElementById(modalId);
        if (modal) {
            modal.style.display = 'none';
        }
    }
    
    setLoading(isLoading) {
        this.state.isLoading = isLoading;
        
        const loadingState = document.getElementById('loadingState');
        const documentsList = document.getElementById('documentsList');
        
        if (loadingState) {
            loadingState.style.display = isLoading ? 'block' : 'none';
        }
        
        if (documentsList && !isLoading) {
            documentsList.style.display = 'block';
        }
    }
    
    showEmptyState() {
        const emptyState = document.getElementById('emptyState');
        const emptyMessage = document.getElementById('emptyMessage');
        
        if (emptyState) {
            emptyState.style.display = 'block';
            
            if (emptyMessage) {
                if (this.state.searchQuery) {
                    emptyMessage.textContent = `No documents found for "${this.state.searchQuery}"`;
                } else {
                    emptyMessage.textContent = 'Start by indexing your documents';
                }
            }
        }
    }
    
    updateDocumentsCount(count) {
        const countBadge = document.getElementById('documentsCount');
        if (countBadge) {
            countBadge.textContent = count.toString();
        }
    }
    
    showToast(message, type = 'info') {
        const container = document.getElementById('toastContainer');
        if (!container) return;
        
        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        
        const icon = type === 'success' ? 'check-circle' : 
                    type === 'error' ? 'exclamation-circle' : 
                    type === 'warning' ? 'exclamation-triangle' : 'info-circle';
        
        toast.innerHTML = `
            <i class="fas fa-${icon}"></i>
            <span class="toast-message">${message}</span>
            <button class="toast-close">
                <i class="fas fa-times"></i>
            </button>
        `;
        
        toast.querySelector('.toast-close').onclick = () => {
            toast.remove();
        };
        
        container.appendChild(toast);
        
        // Auto remove after 5 seconds
        setTimeout(() => {
            if (toast.parentNode) {
                toast.remove();
            }
        }, 5000);
    }
    
    async apiCall(method, endpoint, data = null) {
        const url = `${this.config.baseUrl}${endpoint}`;
        
        const options = {
            method,
            headers: {
                'Content-Type': 'application/json',
                'X-Cliq-User-ID': this.getCurrentUserId(),
                'X-Cliq-Org-ID': this.getCurrentOrgId()
            }
        };
        
        if (data) {
            options.body = JSON.stringify(data);
        }
        
        const response = await fetch(url, options);
        
        if (!response.ok) {
            throw new Error(`API call failed: ${response.status} ${response.statusText}`);
        }
        
        return await response.json();
    }
    
    getCurrentUserId() {
        // Get current Cliq user ID from widget context
        return window.cliqUserInfo?.id || 'unknown';
    }
    
    getCurrentOrgId() {
        // Get current Cliq organization ID from widget context
        return window.cliqOrgInfo?.id || 'unknown';
    }
    
    highlightSearchTerm(text) {
        if (!this.state.searchQuery || !text) return text;
        
        const regex = new RegExp(`(${this.escapeRegex(this.state.searchQuery)})`, 'gi');
        return text.replace(regex, '<mark>$1</mark>');
    }
    
    escapeRegex(string) {
        return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    }
    
    formatFileSize(bytes) {
        if (!bytes || bytes === 0) return 'Unknown';
        
        const sizes = ['B', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(1024));
        
        return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${sizes[i]}`;
    }
    
    formatDate(dateString) {
        if (!dateString) return 'Unknown';
        
        const date = new Date(dateString);
        const now = new Date();
        const diffMs = now - date;
        const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
        
        if (diffDays === 0) {
            return 'Today';
        } else if (diffDays === 1) {
            return 'Yesterday';
        } else if (diffDays < 7) {
            return `${diffDays} days ago`;
        } else {
            return date.toLocaleDateString();
        }
    }
    
    getFileIconClass(mimeType) {
        if (!mimeType) return 'fas fa-file';
        
        const mimeMap = {
            'application/pdf': 'fas fa-file-pdf',
            'application/msword': 'fas fa-file-word',
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'fas fa-file-word',
            'application/vnd.ms-excel': 'fas fa-file-excel',
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'fas fa-file-excel',
            'application/vnd.ms-powerpoint': 'fas fa-file-powerpoint',
            'application/vnd.openxmlformats-officedocument.presentationml.presentation': 'fas fa-file-powerpoint',
            'text/plain': 'fas fa-file-alt',
            'text/html': 'fas fa-file-code',
            'image/jpeg': 'fas fa-file-image',
            'image/png': 'fas fa-file-image',
            'image/gif': 'fas fa-file-image',
            'video/mp4': 'fas fa-file-video',
            'audio/mp3': 'fas fa-file-audio',
            'application/zip': 'fas fa-file-archive'
        };
        
        return mimeMap[mimeType] || 'fas fa-file';
    }
    
    debounce(func, wait) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    }
}

// Initialize widget when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.docDexWidget = new DocDexWidget();
});

// Expose for debugging
window.DocDexWidget = DocDexWidget;