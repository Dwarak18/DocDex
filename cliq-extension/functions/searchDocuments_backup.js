const DOCDEX_API_URL = 'https://docdex-60058081001.development.catalystserverless.in/server/docdex_io/execute';

/**
 * Cliq extension handler for document search and summarization
 */
async function handleDocuments(arguments, context) {
    try {
        const { query, fileId, userId } = arguments;
        
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
            }
        });

        // Format response for Cliq
        if (searchResult.success && searchResult.documents.length > 0) {
            const documents = searchResult.documents.slice(0, 5); // Show top 5 results
            
            let responseText = `📄 **Found ${searchResult.documents.length} documents:**\n\n`;
            
            documents.forEach((doc, index) => {
                responseText += `**${index + 1}. ${doc.name}**\n`;
                responseText += `📁 ${doc.path}\n`;
                if (doc.summary) {
                    responseText += `📝 ${doc.summary.substring(0, 100)}...\n`;
                }
                responseText += `🔗 [Open Document](${doc.downloadUrl})\n\n`;
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
async function summarizeDocument(arguments, context) {
    try {
        const { fileId, userId } = arguments;
        
        if (!fileId) {
            return {
                output: {
                    text: "Please provide a file ID. Example: `/docdex summarize <file_id>`"
                }
            };
        }

        // Show processing message
        const processingResponse = {
            output: {
                text: "🔄 **Processing document...**\nThis may take a few moments for large files.",
                card: {
                    title: "DocDex - Summarizing",
                    theme: "modern-inline"
                }
            }
        };

        // Call the main summarize function
        const result = await summarizeFunction({
            body: { 
                fileId,
                userId: userId || context.user.id
            }
        });

        if (result.success) {
            let responseText = `📄 **Document Summary**\n\n`;
            responseText += `**File:** ${result.fileName}\n\n`;
            responseText += `**📝 Summary:**\n${result.summary}\n\n`;
            
            if (result.entities && result.entities.length > 0) {
                responseText += `**🏷️ Key Entities:** ${result.entities.join(', ')}\n\n`;
            }
            
            if (result.keywords && result.keywords.length > 0) {
                responseText += `**🔍 Keywords:** ${result.keywords.join(', ')}\n\n`;
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
                    text: `❌ Failed to summarize document: ${result.message || 'Unknown error'}`
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

module.exports = { handleDocuments, summarizeDocument };