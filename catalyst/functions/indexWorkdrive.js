const utils = require('./utilities');

/**
 * Background job to index WorkDrive files for all authorized users
 */
module.exports = async (req, res) => {
    try {
        // Initialize Catalyst
        await utils.initCatalyst(req);
        
        let userId = null;
        let orgId = null;
        
        // Check if this is a manual trigger for specific user
        if (req.body && req.body.user_id && req.body.org_id) {
            userId = req.body.user_id;
            orgId = req.body.org_id;
        }
        
        const results = [];
        
        if (userId && orgId) {
            // Index specific user
            const result = await indexUserFiles(userId, orgId);
            results.push(result);
        } else {
            // Index all authorized users
            const authorizedUsersTable = utils.datastore.table('authorized_users');
            const users = await authorizedUsersTable.getRecords({
                where: [`status='active'`]
            });
            
            console.log(`Starting indexing for ${users.length} authorized users`);
            
            for (const user of users) {
                try {
                    const result = await indexUserFiles(user.user_id, user.org_id);
                    results.push(result);
                } catch (error) {
                    console.error(`Error indexing user ${user.user_id}:`, error);
                    results.push({
                        userId: user.user_id,
                        orgId: user.org_id,
                        success: false,
                        error: error.message
                    });
                }
            }
        }
        
        const summary = {
            totalUsers: results.length,
            successfulIndexes: results.filter(r => r.success).length,
            failedIndexes: results.filter(r => !r.success).length,
            totalFilesIndexed: results.reduce((sum, r) => sum + (r.filesIndexed || 0), 0)
        };
        
        console.log('Indexing completed:', summary);
        
        res.status(200).json(utils.generateResponse(200, {
            summary,
            results
        }));
        
    } catch (error) {
        console.error('indexWorkdrive error:', error);
        res.status(500).json(utils.generateResponse(500, null, error.message));
    }
    
    async function indexUserFiles(userId, orgId) {
        const result = {
            userId,
            orgId,
            success: false,
            filesIndexed: 0,
            errors: []
        };
        
        try {
            console.log(`Starting indexing for user ${userId}`);
            
            // Get user's OAuth tokens
            const tokens = await utils.getUserTokens(userId, orgId);
            if (!tokens) {
                throw new Error('User tokens not found');
            }
            
            // Index WorkDrive files
            const workdriveFiles = await indexWorkDriveFiles(userId, orgId);
            result.filesIndexed += workdriveFiles;
            
            // Index Mail attachments
            const mailAttachments = await indexMailAttachments(userId, orgId);
            result.filesIndexed += mailAttachments;
            
            // Update user's last indexed timestamp
            const userTable = utils.datastore.table('authorized_users');
            const userRecords = await userTable.getRecords({
                where: [`user_id='${userId}' AND org_id='${orgId}'`]
            });
            
            if (userRecords.length > 0) {
                await userTable.updateRecord(userRecords[0].ROWID, {
                    last_indexed: new Date().toISOString()
                });
            }
            
            result.success = true;
            console.log(`Indexing completed for user ${userId}: ${result.filesIndexed} files`);
            
        } catch (error) {
            console.error(`Error indexing user ${userId}:`, error);
            result.error = error.message;
        }
        
        return result;
    }
    
    async function indexWorkDriveFiles(userId, orgId) {
        let filesIndexed = 0;
        let nextPageToken = null;
        
        do {
            const url = 'https://workdrive.zoho.com/api/v1/files';
            const params = new URLSearchParams({
                'fields': 'id,name,type,size,created_time,modified_time,mime_type,parent_id,permalink,download_url',
                'limit': '200'
            });
            
            if (nextPageToken) {
                params.set('page_token', nextPageToken);
            }
            
            const response = await utils.makeAuthenticatedRequest(
                userId, 
                orgId, 
                `${url}?${params}`
            );
            
            if (!response.ok) {
                throw new Error(`WorkDrive API error: ${response.status} ${response.statusText}`);
            }
            
            const data = await response.json();
            
            if (data.data && data.data.length > 0) {
                await saveFilesToDatastore(userId, orgId, data.data, 'workdrive');
                filesIndexed += data.data.length;
            }
            
            nextPageToken = data.page_info?.next_page_token;
            
        } while (nextPageToken);
        
        return filesIndexed;
    }
    
    async function indexMailAttachments(userId, orgId) {
        let attachmentsIndexed = 0;
        let fromDate = new Date();
        fromDate.setMonth(fromDate.getMonth() - 6); // Index last 6 months
        
        const url = 'https://mail.zoho.com/api/accounts/primary/messages/search';
        const params = new URLSearchParams({
            'searchKey': 'has:attachment',
            'fromDate': fromDate.toISOString().split('T')[0],
            'limit': '100'
        });
        
        const response = await utils.makeAuthenticatedRequest(
            userId,
            orgId,
            `${url}?${params}`
        );
        
        if (!response.ok) {
            throw new Error(`Mail API error: ${response.status} ${response.statusText}`);
        }
        
        const data = await response.json();
        
        if (data.data && data.data.length > 0) {
            for (const message of data.data) {
                try {
                    const attachments = await getMessageAttachments(userId, orgId, message.messageId);
                    if (attachments.length > 0) {
                        await saveFilesToDatastore(userId, orgId, attachments, 'mail');
                        attachmentsIndexed += attachments.length;
                    }
                } catch (error) {
                    console.warn(`Error processing message ${message.messageId}:`, error);
                }
            }
        }
        
        return attachmentsIndexed;
    }
    
    async function getMessageAttachments(userId, orgId, messageId) {
        const url = `https://mail.zoho.com/api/accounts/primary/messages/${messageId}`;
        
        const response = await utils.makeAuthenticatedRequest(userId, orgId, url);
        
        if (!response.ok) {
            return [];
        }
        
        const messageData = await response.json();
        const attachments = [];
        
        if (messageData.data && messageData.data.attachments) {
            for (const attachment of messageData.data.attachments) {
                attachments.push({
                    id: `mail_${messageId}_${attachment.attachmentId}`,
                    name: attachment.attachmentName,
                    type: 'file',
                    size: attachment.size,
                    created_time: messageData.data.receivedTime,
                    modified_time: messageData.data.receivedTime,
                    mime_type: attachment.mimeType || 'application/octet-stream',
                    parent_id: messageId,
                    download_url: `https://mail.zoho.com/api/accounts/primary/messages/${messageId}/attachments/${attachment.attachmentId}`,
                    source_type: 'mail',
                    message_subject: messageData.data.subject,
                    message_from: messageData.data.fromAddress
                });
            }
        }
        
        return attachments;
    }
    
    async function saveFilesToDatastore(userId, orgId, files, sourceType) {
        const documentsTable = utils.datastore.table('documents');
        
        for (const file of files) {
            try {
                // Skip folders and very large files
                if (file.type === 'folder' || (file.size && file.size > 50 * 1024 * 1024)) {
                    continue;
                }
                
                // Check if document already exists
                const existingDocs = await documentsTable.getRecords({
                    where: [`file_id='${file.id}' AND user_id='${userId}' AND org_id='${orgId}'`]
                });
                
                const documentData = {
                    file_id: file.id,
                    user_id: userId,
                    org_id: orgId,
                    name: file.name,
                    mime_type: file.mime_type || 'application/octet-stream',
                    size: file.size || 0,
                    source_type: sourceType,
                    created_at: file.created_time || new Date().toISOString(),
                    modified_at: file.modified_time || new Date().toISOString(),
                    download_url: file.download_url || file.permalink,
                    indexed_at: new Date().toISOString(),
                    parent_id: file.parent_id,
                    status: 'indexed'
                };
                
                // Add mail-specific metadata
                if (sourceType === 'mail') {
                    documentData.message_subject = file.message_subject;
                    documentData.message_from = file.message_from;
                }
                
                if (existingDocs.length > 0) {
                    // Update existing document
                    documentData.updated_at = new Date().toISOString();
                    await documentsTable.updateRecord(existingDocs[0].ROWID, documentData);
                } else {
                    // Insert new document
                    await documentsTable.insertRecord(documentData);
                }
                
            } catch (error) {
                console.error(`Error saving file ${file.id}:`, error);
            }
        }
    }
};