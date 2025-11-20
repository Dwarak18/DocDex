const DOCDEX_API_URL = 'https://docdex-60058081001.development.catalystserverless.in/server/docdex_io/execute';

/**
 * Cliq extension handler for document search and summarization
 */
async function handleDocuments(args, context) {
    try {
        const { query, fileId, userId } = args;
        
        // If fileId is provided, perform summarization
        if (fileId) {
            return await summarizeDocument({ fileId, userId: userId || context.user.id }, context);
        }

        // Validate search query
        if (!query || query.trim() === '') {
            return {
                output: {
                    text: "Please provide a search query. Example: `/docdex search AI technology`"
                }
            };
        }

        // Call the DocDex API deployed on Catalyst
        const response = await fetch(`${DOCDEX_API_URL}?path=searchDocs`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                query: query.trim(),
                userId: userId || context.user.id,
                limit: 10
            })
        });

        const result = await response.json();
        
        // Parse the nested JSON response from Catalyst  
        const searchResult = result.output ? JSON.parse(result.output) : result;

        // Format response for Cliq
        if (searchResult.success && searchResult.documents && searchResult.documents.length > 0) {
            const documents = searchResult.documents.slice(0, 5); // Show top 5 results
            
            let responseText = `📄 **Found ${searchResult.documents.length} documents:**\n\n`;
            
            documents.forEach((doc, index) => {
                responseText += `**${index + 1}. ${doc.name}**\n`;
                responseText += `📁 ${doc.path || 'Unknown path'}\n`;
                if (doc.summary) {
                    responseText += `📝 ${doc.summary.substring(0, 100)}...\n`;
                }
                if (doc.downloadUrl || doc.url) {
                    responseText += `🔗 [Open Document](${doc.downloadUrl || doc.url})\n`;
                }
                responseText += `\n`;
            });

            return {
                output: {
                    text: responseText,
                    card: {
                        title: "Document Search Results",
                        theme: "modern-inline"
                    }
                }
            };
        } else {
            return {
                output: {
                    text: `🔍 No documents found for "${query}". Try different keywords or check if you're connected to WorkDrive.`
                }
            };
        }

    } catch (error) {
        console.error('Cliq documents handler error:', error);
        return {
            output: {
                text: "❌ Operation failed. Please try again or contact support."
            }
        };
    }
}

/**
 * Cliq extension handler for document summarization
 */
async function summarizeDocument(args, context) {
    try {
        const { fileId, userId } = args;
        
        if (!fileId) {
            return {
                output: {
                    text: "Please provide a file ID. Example: `/docdex summarize <file_id>`"
                }
            };
        }

        // Call the DocDex API deployed on Catalyst
        const response = await fetch(`${DOCDEX_API_URL}?path=summarizeDocument`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                fileId,
                userId: userId || context.user.id
            })
        });

        const result = await response.json();
        
        // Parse the nested JSON response from Catalyst
        const summaryResult = result.output ? JSON.parse(result.output) : result;

        if (summaryResult.success) {
            let responseText = `📄 **Document Summary**\n\n`;
            responseText += `**File:** ${summaryResult.fileName}\n\n`;
            responseText += `**📝 Summary:**\n${summaryResult.summary}\n\n`;
            
            if (summaryResult.entities && summaryResult.entities.length > 0) {
                responseText += `**🏷️ Key Entities:** ${summaryResult.entities.join(', ')}\n\n`;
            }
            
            if (summaryResult.keywords && summaryResult.keywords.length > 0) {
                responseText += `**🔍 Keywords:** ${summaryResult.keywords.join(', ')}\n\n`;
            }

            return {
                output: {
                    text: responseText,
                    card: {
                        title: "Document Analysis Complete",
                        theme: "modern-inline"
                    }
                }
            };
        } else {
            return {
                output: {
                    text: `❌ Failed to summarize document: ${summaryResult.message || 'Unknown error'}`
                }
            };
        }

    } catch (error) {
        console.error('Cliq summarize error:', error);
        return {
            output: {
                text: "❌ Summarization failed. Please check the file ID and try again."
            }
        };
    }
}

module.exports = { 
    handleDocuments,
    summarizeDocument 
};