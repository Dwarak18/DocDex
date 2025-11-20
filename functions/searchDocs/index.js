const utils = require('../utilities');

/**
 * Search documents with metadata and optional semantic search
 */
module.exports = async (req, res) => {
    try {
        // Initialize Catalyst
        await utils.initCatalyst(req);
        
        // Validate Cliq user context
        const { userId, orgId } = utils.validateCliqUser(req);
        
        let { query, limit = 20, offset = 0, sourceType, fileType, dateFrom, dateTo, sortBy = 'relevance' } = req.body;
        
        // Sanitize search query
        if (query) {
            query = utils.sanitizeSearchQuery(query);
        }
        
        // Validate limit
        limit = Math.min(Math.max(parseInt(limit) || 20, 1), 100);
        offset = Math.max(parseInt(offset) || 0, 0);
        
        console.log(`Search request from user ${userId}: "${query}"`);
        
        let results = [];
        let total = 0;
        
        if (query && query.length >= 2) {
            // Perform text-based search
            results = await performTextSearch(userId, orgId, query, limit, offset, {
                sourceType, fileType, dateFrom, dateTo, sortBy
            });
        } else {
            // Return recent documents when no query provided
            results = await getRecentDocuments(userId, orgId, limit, offset, {
                sourceType, fileType, dateFrom, dateTo
            });
        }
        
        total = results.length;
        
        // Enhance results with summaries if available
        const enhancedResults = await enhanceWithSummaries(results);
        
        const response = {
            query: query || '',
            results: enhancedResults,
            total,
            limit,
            offset,
            hasMore: enhancedResults.length === limit,
            searchTime: Date.now(),
            filters: {
                sourceType: sourceType || 'all',
                fileType: fileType || 'all',
                dateFrom: dateFrom || null,
                dateTo: dateTo || null,
                sortBy
            }
        };
        
        console.log(`Search completed: ${enhancedResults.length} results for user ${userId}`);
        
        res.status(200).json(utils.generateResponse(200, response));
        
    } catch (error) {
        console.error('searchDocs error:', error);
        res.status(500).json(utils.generateResponse(500, null, error.message));
    }
    
    async function performTextSearch(userId, orgId, query, limit, offset, filters) {
        const documentsTable = utils.datastore.table('documents');
        
        // Build WHERE clause
        let whereConditions = [
            `user_id='${userId}'`,
            `org_id='${orgId}'`,
            `status='indexed' OR status='processed'`
        ];
        
        // Add search conditions - search in name and other text fields
        const searchConditions = [
            `LOWER(name) LIKE '%${query.toLowerCase()}%'`
        ];
        
        // Add mail-specific search if applicable
        if (!filters.sourceType || filters.sourceType === 'mail') {
            searchConditions.push(
                `LOWER(message_subject) LIKE '%${query.toLowerCase()}%'`,
                `LOWER(message_from) LIKE '%${query.toLowerCase()}%'`
            );
        }
        
        whereConditions.push(`(${searchConditions.join(' OR ')})`);
        
        // Apply filters
        if (filters.sourceType && filters.sourceType !== 'all') {
            whereConditions.push(`source_type='${filters.sourceType}'`);
        }
        
        if (filters.fileType && filters.fileType !== 'all') {
            whereConditions.push(`LOWER(mime_type) LIKE '%${filters.fileType.toLowerCase()}%'`);
        }
        
        if (filters.dateFrom) {
            whereConditions.push(`created_at >= '${filters.dateFrom}'`);
        }
        
        if (filters.dateTo) {
            whereConditions.push(`created_at <= '${filters.dateTo}'`);
        }
        
        // Build ORDER BY clause
        let orderBy;
        switch (filters.sortBy) {
            case 'name':
                orderBy = 'name ASC';
                break;
            case 'date':
                orderBy = 'created_at DESC';
                break;
            case 'size':
                orderBy = 'size DESC';
                break;
            case 'modified':
                orderBy = 'modified_at DESC';
                break;
            default:
                // Default relevance sorting (by name match quality)
                orderBy = 'modified_at DESC';
        }
        
        const whereClause = whereConditions.join(' AND ');
        
        try {
            const results = await documentsTable.getRecords({
                where: [whereClause],
                limit: limit,
                offset: offset,
                orderBy: orderBy
            });
            
            return results.map(doc => formatDocumentResult(doc, query));
            
        } catch (error) {
            console.error('Database search error:', error);
            return [];
        }
    }
    
    async function getRecentDocuments(userId, orgId, limit, offset, filters) {
        const documentsTable = utils.datastore.table('documents');
        
        let whereConditions = [
            `user_id='${userId}'`,
            `org_id='${orgId}'`,
            `status='indexed' OR status='processed'`
        ];
        
        // Apply filters
        if (filters.sourceType && filters.sourceType !== 'all') {
            whereConditions.push(`source_type='${filters.sourceType}'`);
        }
        
        if (filters.fileType && filters.fileType !== 'all') {
            whereConditions.push(`LOWER(mime_type) LIKE '%${filters.fileType.toLowerCase()}%'`);
        }
        
        if (filters.dateFrom) {
            whereConditions.push(`created_at >= '${filters.dateFrom}'`);
        }
        
        if (filters.dateTo) {
            whereConditions.push(`created_at <= '${filters.dateTo}'`);
        }
        
        const whereClause = whereConditions.join(' AND ');
        
        try {
            const results = await documentsTable.getRecords({
                where: [whereClause],
                limit: limit,
                offset: offset,
                orderBy: 'modified_at DESC'
            });
            
            return results.map(doc => formatDocumentResult(doc));
            
        } catch (error) {
            console.error('Database query error:', error);
            return [];
        }
    }
    
    async function enhanceWithSummaries(documents) {
        const summariesTable = utils.datastore.table('document_summaries');
        const enhanced = [];
        
        for (const doc of documents) {
            try {
                const summaries = await summariesTable.getRecords({
                    where: [`document_id='${doc.id}'`],
                    limit: 1
                });
                
                const enhancedDoc = { ...doc };
                
                if (summaries.length > 0) {
                    const summary = summaries[0];
                    enhancedDoc.summary = {
                        text: summary.summary_text,
                        entities: summary.entities ? JSON.parse(summary.entities) : [],
                        keywords: summary.keywords ? JSON.parse(summary.keywords) : [],
                        confidence: summary.confidence
                    };
                }
                
                enhanced.push(enhancedDoc);
                
            } catch (error) {
                console.warn(`Error enhancing document ${doc.id}:`, error);
                enhanced.push(doc);
            }
        }
        
        return enhanced;
    }
    
    function formatDocumentResult(doc, searchQuery = '') {
        const result = {
            id: doc.file_id,
            rowId: doc.ROWID,
            name: doc.name,
            mimeType: doc.mime_type,
            size: doc.size,
            sourceType: doc.source_type,
            createdAt: doc.created_at,
            modifiedAt: doc.modified_at,
            indexedAt: doc.indexed_at,
            status: doc.status,
            downloadUrl: `/catalyst/functions/fetchFileProxy/${doc.file_id}`
        };
        
        // Add mail-specific metadata
        if (doc.source_type === 'mail') {
            result.messageSubject = doc.message_subject;
            result.messageFrom = doc.message_from;
        }
        
        // Add search relevance score if query provided
        if (searchQuery) {
            result.relevance = calculateRelevanceScore(doc, searchQuery);
        }
        
        // Format file size
        result.formattedSize = formatFileSize(doc.size);
        
        // Determine file type icon
        result.icon = getFileIcon(doc.mime_type);
        
        return result;
    }
    
    function calculateRelevanceScore(doc, query) {
        let score = 0;
        const lowerQuery = query.toLowerCase();
        const lowerName = doc.name.toLowerCase();
        
        // Exact name match
        if (lowerName === lowerQuery) {
            score += 100;
        }
        // Name starts with query
        else if (lowerName.startsWith(lowerQuery)) {
            score += 75;
        }
        // Name contains query
        else if (lowerName.includes(lowerQuery)) {
            score += 50;
        }
        
        // Mail subject match
        if (doc.message_subject && doc.message_subject.toLowerCase().includes(lowerQuery)) {
            score += 25;
        }
        
        // Recent files get slight boost
        const daysSinceModified = (Date.now() - new Date(doc.modified_at).getTime()) / (1000 * 60 * 60 * 24);
        if (daysSinceModified <= 7) {
            score += 10;
        } else if (daysSinceModified <= 30) {
            score += 5;
        }
        
        return Math.min(score, 100);
    }
    
    function formatFileSize(bytes) {
        if (!bytes || bytes === 0) return 'Unknown';
        
        const sizes = ['B', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(1024));
        
        return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${sizes[i]}`;
    }
    
    function getFileIcon(mimeType) {
        if (!mimeType) return 'file';
        
        if (mimeType.includes('pdf')) return 'file-pdf';
        if (mimeType.includes('word') || mimeType.includes('document')) return 'file-word';
        if (mimeType.includes('sheet') || mimeType.includes('excel')) return 'file-excel';
        if (mimeType.includes('presentation') || mimeType.includes('powerpoint')) return 'file-powerpoint';
        if (mimeType.includes('image')) return 'file-image';
        if (mimeType.includes('video')) return 'file-video';
        if (mimeType.includes('audio')) return 'file-audio';
        if (mimeType.includes('text')) return 'file-text';
        if (mimeType.includes('zip') || mimeType.includes('archive')) return 'file-archive';
        
        return 'file';
    }
};