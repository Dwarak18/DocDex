const utils = require('./utilities');

/**
 * Securely download file bytes and proxy to frontend
 */
module.exports = async (req, res) => {
    try {
        // Initialize Catalyst
        await utils.initCatalyst(req);
        
        // Validate Cliq user context
        const { userId, orgId } = utils.validateCliqUser(req);
        
        const { fileId } = req.params;
        
        if (!fileId) {
            return res.status(400).json(utils.generateResponse(400, null, 
                'File ID is required'));
        }
        
        // Get file metadata from datastore
        const documentsTable = utils.datastore.table('documents');
        const documents = await documentsTable.getRecords({
            where: [`file_id='${fileId}' AND user_id='${userId}' AND org_id='${orgId}'`]
        });
        
        if (documents.length === 0) {
            return res.status(404).json(utils.generateResponse(404, null, 
                'File not found or access denied'));
        }
        
        const document = documents[0];
        
        // Validate file size
        if (document.size && document.size > 50 * 1024 * 1024) {
            return res.status(413).json(utils.generateResponse(413, null, 
                'File too large for processing (max 50MB)'));
        }
        
        // Download file with authenticated request
        const downloadUrl = document.download_url;
        
        if (!downloadUrl) {
            return res.status(400).json(utils.generateResponse(400, null, 
                'File download URL not available'));
        }
        
        let fileResponse;
        
        if (document.source_type === 'workdrive') {
            // Download from WorkDrive
            fileResponse = await utils.makeAuthenticatedRequest(
                userId, 
                orgId, 
                downloadUrl
            );
        } else if (document.source_type === 'mail') {
            // Download mail attachment
            fileResponse = await utils.makeAuthenticatedRequest(
                userId,
                orgId,
                downloadUrl
            );
        } else {
            return res.status(400).json(utils.generateResponse(400, null, 
                'Unsupported source type'));
        }
        
        if (!fileResponse.ok) {
            console.error(`File download failed: ${fileResponse.status} ${fileResponse.statusText}`);
            return res.status(502).json(utils.generateResponse(502, null, 
                'Failed to download file from source'));
        }
        
        // Get file content type
        const contentType = fileResponse.headers.get('content-type') || document.mime_type || 'application/octet-stream';
        
        // Check if request wants metadata only
        if (req.query.metadata === 'true') {
            return res.status(200).json(utils.generateResponse(200, {
                fileId: document.file_id,
                name: document.name,
                size: document.size,
                mimeType: document.mime_type,
                sourceType: document.source_type,
                createdAt: document.created_at,
                modifiedAt: document.modified_at
            }));
        }
        
        // Stream file content to response
        res.setHeader('Content-Type', contentType);
        res.setHeader('Content-Disposition', `inline; filename="${document.name}"`);
        res.setHeader('Cache-Control', 'private, max-age=3600');
        
        // Add CORS headers
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
        
        // For text-based files that can be displayed inline
        if (contentType.startsWith('text/') || 
            contentType.includes('application/json') ||
            contentType.includes('application/xml')) {
            
            const text = await fileResponse.text();
            res.send(text);
            
        } else {
            // For binary files, stream the response
            const buffer = await fileResponse.arrayBuffer();
            res.send(Buffer.from(buffer));
        }
        
        // Log successful download
        console.log(`File ${fileId} downloaded successfully for user ${userId}`);
        
    } catch (error) {
        console.error('fetchFileProxy error:', error);
        res.status(500).json(utils.generateResponse(500, null, error.message));
    }
};