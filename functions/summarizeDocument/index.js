const utils = require('../utilities');

/**
 * Extract text and summarize document using Zia Skills
 */
module.exports = async (req, res) => {
    try {
        // Initialize Catalyst
        await utils.initCatalyst(req);
        
        // Validate Cliq user context
        const { userId, orgId } = utils.validateCliqUser(req);
        
        const { fileId } = req.body;
        
        if (!fileId) {
            return res.status(400).json(utils.generateResponse(400, null, 
                'File ID is required'));
        }
        
        // Get document from datastore
        const documentsTable = utils.datastore.table('documents');
        const documents = await documentsTable.getRecords({
            where: [`file_id='${fileId}' AND user_id='${userId}' AND org_id='${orgId}'`]
        });
        
        if (documents.length === 0) {
            return res.status(404).json(utils.generateResponse(404, null, 
                'Document not found or access denied'));
        }
        
        const document = documents[0];
        
        // Check if document already has summary
        const summariesTable = utils.datastore.table('document_summaries');
        const existingSummaries = await summariesTable.getRecords({
            where: [`document_id='${document.ROWID}'`]
        });
        
        if (existingSummaries.length > 0) {
            const summary = existingSummaries[0];
            return res.status(200).json(utils.generateResponse(200, {
                fileId,
                summary: summary.summary_text,
                entities: summary.entities ? JSON.parse(summary.entities) : [],
                keywords: summary.keywords ? JSON.parse(summary.keywords) : [],
                confidence: summary.confidence,
                createdAt: summary.created_at
            }));
        }
        
        // Download file content
        const downloadUrl = document.download_url;
        let fileResponse;
        
        if (document.source_type === 'workdrive') {
            fileResponse = await utils.makeAuthenticatedRequest(userId, orgId, downloadUrl);
        } else if (document.source_type === 'mail') {
            fileResponse = await utils.makeAuthenticatedRequest(userId, orgId, downloadUrl);
        } else {
            return res.status(400).json(utils.generateResponse(400, null, 
                'Unsupported document source'));
        }
        
        if (!fileResponse.ok) {
            return res.status(502).json(utils.generateResponse(502, null, 
                'Failed to download document for processing'));
        }
        
        const fileBuffer = Buffer.from(await fileResponse.arrayBuffer());
        
        // Validate file size
        utils.validateFileSize(fileBuffer.length);
        
        // Extract text content
        const textContent = await utils.extractTextFromFile(
            fileBuffer, 
            document.mime_type, 
            document.name
        );
        
        if (!textContent || textContent.trim().length < 50) {
            return res.status(400).json(utils.generateResponse(400, null, 
                'Unable to extract sufficient text content from document'));
        }
        
        // Split into chunks if content is too large (Zia has limits)
        const chunks = splitIntoChunks(textContent, 5000);
        let allSummaries = [];
        let allEntities = [];
        let allKeywords = [];
        
        for (const chunk of chunks) {
            try {
                const result = await processWithZia(chunk);
                
                if (result.summary) {
                    allSummaries.push(result.summary);
                }
                if (result.entities) {
                    allEntities.push(...result.entities);
                }
                if (result.keywords) {
                    allKeywords.push(...result.keywords);
                }
                
                // Rate limiting - wait between requests
                await new Promise(resolve => setTimeout(resolve, 1000));
                
            } catch (ziaError) {
                console.warn('Zia processing error for chunk:', ziaError);
            }
        }
        
        // Combine results
        const finalSummary = allSummaries.length > 1 
            ? await summarizeChunks(allSummaries)
            : (allSummaries[0] || 'Summary not available');
        
        // Deduplicate and score entities/keywords
        const uniqueEntities = deduplicateEntities(allEntities);
        const uniqueKeywords = deduplicateKeywords(allKeywords);
        
        // Store summary results
        const summaryData = {
            document_id: document.ROWID,
            file_id: fileId,
            user_id: userId,
            org_id: orgId,
            summary_text: finalSummary,
            entities: JSON.stringify(uniqueEntities),
            keywords: JSON.stringify(uniqueKeywords),
            text_length: textContent.length,
            confidence: calculateConfidence(textContent, finalSummary),
            created_at: new Date().toISOString(),
            model_version: 'zia-v1'
        };
        
        await summariesTable.insertRecord(summaryData);
        
        // Update document with processing status
        await documentsTable.updateRecord(document.ROWID, {
            status: 'processed',
            processed_at: new Date().toISOString()
        });
        
        console.log(`Document ${fileId} summarized successfully for user ${userId}`);
        
        res.status(200).json(utils.generateResponse(200, {
            fileId,
            summary: finalSummary,
            entities: uniqueEntities,
            keywords: uniqueKeywords,
            confidence: summaryData.confidence,
            textLength: textContent.length
        }));
        
    } catch (error) {
        console.error('summarizeDocument error:', error);
        res.status(500).json(utils.generateResponse(500, null, error.message));
    }
    
    function splitIntoChunks(text, chunkSize) {
        const chunks = [];
        const words = text.split(' ');
        
        for (let i = 0; i < words.length; i += chunkSize) {
            chunks.push(words.slice(i, i + chunkSize).join(' '));
        }
        
        return chunks;
    }
    
    async function processWithZia(text) {
        try {
            const ziaApiKey = await utils.getSecret('ZIA_API_KEY');
            
            // Call Zia Skills for summarization
            const summaryResponse = await fetch('https://zia.zoho.com/api/v1/summarize', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${ziaApiKey}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    text: text,
                    sentences: 3,
                    language: 'en'
                })
            });
            
            let summary = '';
            if (summaryResponse.ok) {
                const summaryData = await summaryResponse.json();
                summary = summaryData.summary || '';
            }
            
            // Call Zia Skills for entity extraction
            const entityResponse = await fetch('https://zia.zoho.com/api/v1/extractEntities', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${ziaApiKey}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    text: text,
                    language: 'en'
                })
            });
            
            let entities = [];
            if (entityResponse.ok) {
                const entityData = await entityResponse.json();
                entities = entityData.entities || [];
            }
            
            // Call Zia Skills for keyword extraction
            const keywordResponse = await fetch('https://zia.zoho.com/api/v1/extractKeywords', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${ziaApiKey}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    text: text,
                    count: 10,
                    language: 'en'
                })
            });
            
            let keywords = [];
            if (keywordResponse.ok) {
                const keywordData = await keywordResponse.json();
                keywords = keywordData.keywords || [];
            }
            
            return { summary, entities, keywords };
            
        } catch (error) {
            console.error('Zia API error:', error);
            
            // Fallback to basic summarization
            return {
                summary: extractFirstSentences(text, 3),
                entities: [],
                keywords: extractBasicKeywords(text)
            };
        }
    }
    
    async function summarizeChunks(summaries) {
        try {
            const combinedText = summaries.join(' ');
            
            // Use Zia to summarize the combined summaries
            const result = await processWithZia(combinedText);
            return result.summary || summaries[0];
            
        } catch (error) {
            // Fallback - return first summary
            return summaries[0];
        }
    }
    
    function deduplicateEntities(entities) {
        const entityMap = new Map();
        
        entities.forEach(entity => {
            const key = entity.text ? entity.text.toLowerCase() : entity.toLowerCase();
            if (!entityMap.has(key)) {
                entityMap.set(key, entity);
            }
        });
        
        return Array.from(entityMap.values()).slice(0, 20); // Limit to 20 entities
    }
    
    function deduplicateKeywords(keywords) {
        const keywordSet = new Set();
        const result = [];
        
        keywords.forEach(keyword => {
            const key = keyword.text ? keyword.text.toLowerCase() : keyword.toLowerCase();
            if (!keywordSet.has(key) && result.length < 15) {
                keywordSet.add(key);
                result.push(keyword);
            }
        });
        
        return result;
    }
    
    function extractFirstSentences(text, count = 3) {
        const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 10);
        return sentences.slice(0, count).join('. ') + '.';
    }
    
    function extractBasicKeywords(text, count = 10) {
        // Simple keyword extraction based on word frequency
        const words = text.toLowerCase()
            .replace(/[^\w\s]/g, '')
            .split(/\s+/)
            .filter(word => word.length > 3);
        
        const frequency = {};
        words.forEach(word => {
            frequency[word] = (frequency[word] || 0) + 1;
        });
        
        return Object.entries(frequency)
            .sort(([,a], [,b]) => b - a)
            .slice(0, count)
            .map(([word, freq]) => ({ text: word, score: freq }));
    }
    
    function calculateConfidence(originalText, summary) {
        if (!summary || !originalText) return 0;
        
        const summaryLength = summary.length;
        const originalLength = originalText.length;
        const ratio = summaryLength / originalLength;
        
        // Confidence based on summary quality
        if (ratio > 0.05 && ratio < 0.3) {
            return 0.9;
        } else if (ratio >= 0.3 && ratio < 0.5) {
            return 0.7;
        } else {
            return 0.5;
        }
    }
};