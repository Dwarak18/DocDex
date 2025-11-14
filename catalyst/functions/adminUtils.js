const utils = require('./utilities');

/**
 * Admin and security utilities for DocDex
 * Includes cleanup functions, health checks, and security monitoring
 */

/**
 * Health check endpoint
 */
async function healthCheck(req, res) {
    try {
        await utils.initCatalyst(req);
        
        const health = {
            status: 'healthy',
            timestamp: new Date().toISOString(),
            services: {
                catalyst: 'up',
                datastore: 'unknown',
                secrets: 'unknown'
            }
        };
        
        // Test datastore connection
        try {
            const testTable = utils.datastore.table('documents');
            await testTable.getRecords({ limit: 1 });
            health.services.datastore = 'up';
        } catch (error) {
            health.services.datastore = 'down';
            health.status = 'degraded';
        }
        
        // Test secrets access
        try {
            await utils.getSecret('ZOHO_CLIENT_ID');
            health.services.secrets = 'up';
        } catch (error) {
            health.services.secrets = 'down';
            health.status = 'degraded';
        }
        
        res.status(200).json(utils.generateResponse(200, health));
        
    } catch (error) {
        res.status(503).json(utils.generateResponse(503, {
            status: 'unhealthy',
            error: error.message
        }));
    }
}

/**
 * Cleanup expired OAuth states
 */
async function cleanupOAuthStates(req, res) {
    try {
        await utils.initCatalyst(req);
        
        const stateTable = utils.datastore.table('oauth_states');
        const now = new Date();
        
        // Get expired states
        const expiredStates = await stateTable.getRecords({
            where: [`expires_at < '${now.toISOString()}'`]
        });
        
        let deletedCount = 0;
        
        for (const state of expiredStates) {
            try {
                await stateTable.deleteRecord(state.ROWID);
                deletedCount++;
            } catch (error) {
                console.warn(`Failed to delete state ${state.ROWID}:`, error);
            }
        }
        
        console.log(`OAuth cleanup completed: ${deletedCount} expired states removed`);
        
        res.status(200).json(utils.generateResponse(200, {
            message: `Cleanup completed: ${deletedCount} expired states removed`,
            deletedCount
        }));
        
    } catch (error) {
        console.error('OAuth cleanup error:', error);
        res.status(500).json(utils.generateResponse(500, null, error.message));
    }
}

/**
 * Generate system statistics
 */
async function generateStats(req, res) {
    try {
        await utils.initCatalyst(req);
        
        const documentsTable = utils.datastore.table('documents');
        const usersTable = utils.datastore.table('authorized_users');
        const summariesTable = utils.datastore.table('document_summaries');
        
        // Get user statistics if user context provided
        const userContext = req.headers['x-cliq-user-id'] && req.headers['x-cliq-org-id'];
        
        let stats;
        
        if (userContext) {
            const userId = req.headers['x-cliq-user-id'];
            const orgId = req.headers['x-cliq-org-id'];
            
            stats = await getUserStats(userId, orgId);
        } else {
            stats = await getSystemStats();
        }
        
        res.status(200).json(utils.generateResponse(200, stats));
        
    } catch (error) {
        console.error('Generate stats error:', error);
        res.status(500).json(utils.generateResponse(500, null, error.message));
    }
}

async function getUserStats(userId, orgId) {
    const documentsTable = utils.datastore.table('documents');
    const summariesTable = utils.datastore.table('document_summaries');
    
    // Get user documents
    const userDocs = await documentsTable.getRecords({
        where: [`user_id='${userId}' AND org_id='${orgId}'`]
    });
    
    const processedDocs = userDocs.filter(doc => doc.status === 'processed');
    const workdriveDocs = userDocs.filter(doc => doc.source_type === 'workdrive');
    const mailDocs = userDocs.filter(doc => doc.source_type === 'mail');
    
    // Get summaries
    const userSummaries = await summariesTable.getRecords({
        where: [`user_id='${userId}' AND org_id='${orgId}'`]
    });
    
    // Calculate file types
    const fileTypes = {};
    userDocs.forEach(doc => {
        const mimeType = doc.mime_type || 'unknown';
        const category = categorizeFileType(mimeType);
        fileTypes[category] = (fileTypes[category] || 0) + 1;
    });
    
    // Find last indexed time
    let lastIndexed = null;
    if (userDocs.length > 0) {
        const latest = userDocs.reduce((latest, doc) => 
            new Date(doc.indexed_at) > new Date(latest.indexed_at) ? doc : latest
        );
        lastIndexed = latest.indexed_at;
    }
    
    return {
        totalDocuments: userDocs.length,
        processedDocuments: processedDocs.length,
        workdriveFiles: workdriveDocs.length,
        mailAttachments: mailDocs.length,
        summariesGenerated: userSummaries.length,
        fileTypes,
        lastIndexed,
        storageUsed: userDocs.reduce((total, doc) => total + (doc.size || 0), 0)
    };
}

async function getSystemStats() {
    const documentsTable = utils.datastore.table('documents');
    const usersTable = utils.datastore.table('authorized_users');
    const summariesTable = utils.datastore.table('document_summaries');
    
    const [allDocs, allUsers, allSummaries] = await Promise.all([
        documentsTable.getRecords(),
        usersTable.getRecords(),
        summariesTable.getRecords()
    ]);
    
    const processedDocs = allDocs.filter(doc => doc.status === 'processed');
    const workdriveDocs = allDocs.filter(doc => doc.source_type === 'workdrive');
    const mailDocs = allDocs.filter(doc => doc.source_type === 'mail');
    
    // Organization statistics
    const orgStats = {};
    allUsers.forEach(user => {
        orgStats[user.org_id] = (orgStats[user.org_id] || 0) + 1;
    });
    
    return {
        totalUsers: allUsers.length,
        totalDocuments: allDocs.length,
        processedDocuments: processedDocs.length,
        workdriveFiles: workdriveDocs.length,
        mailAttachments: mailDocs.length,
        summariesGenerated: allSummaries.length,
        organizationsUsing: Object.keys(orgStats).length,
        totalStorageUsed: allDocs.reduce((total, doc) => total + (doc.size || 0), 0)
    };
}

/**
 * Security audit functions
 */
async function auditUserAccess(req, res) {
    try {
        await utils.initCatalyst(req);
        
        const usersTable = utils.datastore.table('authorized_users');
        const tokensTable = utils.datastore.table('user_tokens');
        
        // Get all users and their token status
        const users = await usersTable.getRecords();
        const auditReport = [];
        
        for (const user of users) {
            try {
                const tokens = await tokensTable.getRecords({
                    where: [`user_id='${user.user_id}' AND org_id='${user.org_id}'`]
                });
                
                const tokenStatus = tokens.length > 0 ? 'valid' : 'missing';
                const daysSinceAuth = Math.floor((Date.now() - new Date(user.authorized_at)) / (1000 * 60 * 60 * 24));
                
                auditReport.push({
                    userId: user.user_id,
                    orgId: user.org_id,
                    authorizedAt: user.authorized_at,
                    daysSinceAuth,
                    tokenStatus,
                    status: user.status,
                    lastIndexed: user.last_indexed
                });
                
            } catch (error) {
                auditReport.push({
                    userId: user.user_id,
                    orgId: user.org_id,
                    error: error.message
                });
            }
        }
        
        res.status(200).json(utils.generateResponse(200, {
            auditDate: new Date().toISOString(),
            totalUsers: users.length,
            report: auditReport
        }));
        
    } catch (error) {
        console.error('Audit error:', error);
        res.status(500).json(utils.generateResponse(500, null, error.message));
    }
}

/**
 * Rate limiting tracker
 */
const rateLimitStore = new Map();

function checkRateLimit(userId, endpoint, limit = 100, windowMs = 15 * 60 * 1000) {
    const key = `${userId}:${endpoint}`;
    const now = Date.now();
    
    if (!rateLimitStore.has(key)) {
        rateLimitStore.set(key, { count: 1, resetTime: now + windowMs });
        return { allowed: true, remaining: limit - 1, resetTime: now + windowMs };
    }
    
    const record = rateLimitStore.get(key);
    
    if (now > record.resetTime) {
        // Reset window
        rateLimitStore.set(key, { count: 1, resetTime: now + windowMs });
        return { allowed: true, remaining: limit - 1, resetTime: now + windowMs };
    }
    
    if (record.count >= limit) {
        return { allowed: false, remaining: 0, resetTime: record.resetTime };
    }
    
    record.count++;
    rateLimitStore.set(key, record);
    return { allowed: true, remaining: limit - record.count, resetTime: record.resetTime };
}

/**
 * Security middleware
 */
function validateRequest(req, res, next) {
    try {
        // Check rate limiting
        const userId = req.headers['x-cliq-user-id'] || 'anonymous';
        const endpoint = req.path;
        const rateLimit = checkRateLimit(userId, endpoint);
        
        // Add rate limit headers
        res.setHeader('X-RateLimit-Limit', '100');
        res.setHeader('X-RateLimit-Remaining', rateLimit.remaining);
        res.setHeader('X-RateLimit-Reset', rateLimit.resetTime);
        
        if (!rateLimit.allowed) {
            return res.status(429).json(utils.generateResponse(429, null, 
                'Rate limit exceeded. Please try again later.'));
        }
        
        // Validate user context for protected endpoints
        const protectedEndpoints = ['/searchDocs', '/indexWorkdrive', '/summarizeDocument', '/fetchFileProxy'];
        const isProtected = protectedEndpoints.some(endpoint => req.path.includes(endpoint));
        
        if (isProtected) {
            try {
                utils.validateCliqUser(req);
            } catch (error) {
                return res.status(401).json(utils.generateResponse(401, null, 
                    'Invalid user context'));
            }
        }
        
        next();
        
    } catch (error) {
        res.status(500).json(utils.generateResponse(500, null, error.message));
    }
}

/**
 * Input validation and sanitization
 */
function validateAndSanitizeInput(req, res, next) {
    // Sanitize common inputs
    if (req.body) {
        if (req.body.query) {
            try {
                req.body.query = utils.sanitizeSearchQuery(req.body.query);
            } catch (error) {
                return res.status(400).json(utils.generateResponse(400, null, error.message));
            }
        }
        
        // Validate file IDs
        if (req.body.fileId || req.params.fileId) {
            const fileId = req.body.fileId || req.params.fileId;
            if (!/^[a-zA-Z0-9_-]+$/.test(fileId)) {
                return res.status(400).json(utils.generateResponse(400, null, 
                    'Invalid file ID format'));
            }
        }
        
        // Validate pagination parameters
        if (req.body.limit) {
            const limit = parseInt(req.body.limit);
            if (isNaN(limit) || limit < 1 || limit > 100) {
                return res.status(400).json(utils.generateResponse(400, null, 
                    'Limit must be between 1 and 100'));
            }
            req.body.limit = limit;
        }
        
        if (req.body.offset) {
            const offset = parseInt(req.body.offset);
            if (isNaN(offset) || offset < 0) {
                return res.status(400).json(utils.generateResponse(400, null, 
                    'Offset must be a non-negative number'));
            }
            req.body.offset = offset;
        }
    }
    
    next();
}

function categorizeFileType(mimeType) {
    if (!mimeType) return 'unknown';
    
    if (mimeType.includes('pdf')) return 'pdf';
    if (mimeType.includes('word') || mimeType.includes('document')) return 'word';
    if (mimeType.includes('sheet') || mimeType.includes('excel')) return 'excel';
    if (mimeType.includes('presentation') || mimeType.includes('powerpoint')) return 'powerpoint';
    if (mimeType.includes('image')) return 'image';
    if (mimeType.includes('video')) return 'video';
    if (mimeType.includes('audio')) return 'audio';
    if (mimeType.includes('text')) return 'text';
    if (mimeType.includes('zip') || mimeType.includes('archive')) return 'archive';
    
    return 'other';
}

module.exports = {
    healthCheck,
    cleanupOAuthStates,
    generateStats,
    auditUserAccess,
    checkRateLimit,
    validateRequest,
    validateAndSanitizeInput
};