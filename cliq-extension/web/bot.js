const utils = require('./utilities');

/**
 * Zoho Cliq Bot Webhook Handler
 * Handles bot commands and user interactions
 */
module.exports = async (req, res) => {
    try {
        // Initialize Catalyst
        await utils.initCatalyst(req);
        
        const { type, user, chat, message, command } = req.body;
        
        // Log the incoming webhook for debugging
        console.log('Bot webhook received:', { type, user: user?.id, command });
        
        let response;
        
        switch (type) {
            case 'bot_command':
                response = await handleBotCommand(req.body);
                break;
            case 'bot_mention':
                response = await handleBotMention(req.body);
                break;
            case 'installation':
                response = await handleInstallation(req.body);
                break;
            default:
                response = {
                    type: 'message',
                    text: 'Hello! I\'m DocDex bot. Use `/doc help` to see available commands.'
                };
        }
        
        res.status(200).json(response);
        
    } catch (error) {
        console.error('Bot webhook error:', error);
        res.status(500).json({
            type: 'message',
            text: 'Sorry, I encountered an error. Please try again later.'
        });
    }
};

async function handleBotCommand(payload) {
    const { command, user, chat } = payload;
    const userId = user.id;
    const orgId = user.organization_id || chat.organization_id;
    
    if (!command || !command.command_name) {
        return createHelpResponse();
    }
    
    const commandName = command.command_name.toLowerCase();
    const params = command.params || [];
    const paramText = params.join(' ').trim();
    
    switch (commandName) {
        case '/doc':
            return await handleDocCommand(userId, orgId, paramText);
        case '/doc-auth':
            return await handleAuthCommand(userId, orgId);
        case '/doc-status':
            return await handleStatusCommand(userId, orgId);
        case '/doc-summary':
            return await handleSummaryCommand(userId, orgId, paramText);
        default:
            return createHelpResponse();
    }
}

async function handleDocCommand(userId, orgId, query) {
    try {
        if (!query || query === 'help') {
            return createHelpResponse();
        }
        
        if (query.startsWith('search ')) {
            const searchQuery = query.substring(7).trim();
            return await performSearch(userId, orgId, searchQuery);
        }
        
        // Default to search if no subcommand specified
        return await performSearch(userId, orgId, query);
        
    } catch (error) {
        console.error('Doc command error:', error);
        return {
            type: 'message',
            text: `❌ Error executing command: ${error.message}`
        };
    }
}

async function performSearch(userId, orgId, searchQuery) {
    try {
        // Validate user authentication
        const tokens = await utils.getUserTokens(userId, orgId);
        if (!tokens) {
            return {
                type: 'message',
                text: '🔐 You need to authorize DocDex first. Use `/doc-auth` to get started.',
                card: {
                    theme: 'modern-inline',
                    title: 'Authorization Required',
                    description: 'DocDex needs access to your WorkDrive and Mail to search documents.',
                    actions: [
                        {
                            type: 'button',
                            text: 'Authorize Now',
                            action: {
                                type: 'command',
                                data: '/doc-auth'
                            }
                        }
                    ]
                }
            };
        }
        
        // Sanitize search query
        const sanitizedQuery = utils.sanitizeSearchQuery(searchQuery);
        
        // Perform search using the searchDocs function
        const searchResults = await searchDocuments(userId, orgId, sanitizedQuery);
        
        if (!searchResults || searchResults.length === 0) {
            return {
                type: 'message',
                text: `🔍 No documents found for "${searchQuery}"\n\nTry:\n• Using different keywords\n• Checking spelling\n• Using broader search terms`,
                card: {
                    theme: 'modern-inline',
                    title: 'No Results Found',
                    description: `No documents match your search for "${searchQuery}"`,
                    actions: [
                        {
                            type: 'button',
                            text: 'Refresh Index',
                            action: {
                                type: 'command',
                                data: '/doc-refresh'
                            }
                        }
                    ]
                }
            };
        }
        
        // Format search results as cards
        return formatSearchResults(searchQuery, searchResults);
        
    } catch (error) {
        console.error('Search error:', error);
        return {
            type: 'message',
            text: `❌ Search failed: ${error.message}`
        };
    }
}

async function searchDocuments(userId, orgId, query) {
    // Use the searchDocs function logic
    const documentsTable = utils.datastore.table('documents');
    
    const whereConditions = [
        `user_id='${userId}'`,
        `org_id='${orgId}'`,
        `(status='indexed' OR status='processed')`,
        `(LOWER(name) LIKE '%${query.toLowerCase()}%' OR LOWER(message_subject) LIKE '%${query.toLowerCase()}%')`
    ];
    
    const results = await documentsTable.getRecords({
        where: whereConditions,
        limit: 5,
        orderBy: 'modified_at DESC'
    });
    
    // Enhance with summaries
    const summariesTable = utils.datastore.table('document_summaries');
    const enhanced = [];
    
    for (const doc of results) {
        const docData = {
            id: doc.file_id,
            name: doc.name,
            mimeType: doc.mime_type,
            size: doc.size,
            sourceType: doc.source_type,
            modifiedAt: doc.modified_at,
            messageSubject: doc.message_subject,
            messageFrom: doc.message_from
        };
        
        // Try to get summary
        try {
            const summaries = await summariesTable.getRecords({
                where: [`document_id='${doc.ROWID}'`],
                limit: 1
            });
            
            if (summaries.length > 0) {
                docData.summary = summaries[0].summary_text;
            }
        } catch (summaryError) {
            console.warn('Failed to load summary:', summaryError);
        }
        
        enhanced.push(docData);
    }
    
    return enhanced;
}

function formatSearchResults(query, results) {
    const cards = results.map(doc => {
        const icon = getFileIcon(doc.mimeType);
        const sourceIcon = doc.sourceType === 'mail' ? '📧' : '📁';
        
        return {
            theme: 'modern-inline',
            title: doc.name,
            description: doc.summary ? 
                (doc.summary.length > 150 ? doc.summary.substring(0, 150) + '...' : doc.summary) :
                (doc.messageSubject || 'No summary available'),
            thumbnail: `https://via.placeholder.com/48x48/2563eb/ffffff?text=${icon}`,
            footer: `${sourceIcon} ${doc.sourceType} • ${formatFileSize(doc.size)} • ${formatDate(doc.modifiedAt)}`,
            actions: [
                {
                    type: 'button',
                    text: '📄 View',
                    action: {
                        type: 'open.url',
                        url: `{{CATALYST_APP_URL}}/files/${doc.id}/view`
                    }
                },
                {
                    type: 'button',
                    text: '📥 Download',
                    action: {
                        type: 'open.url',
                        url: `{{CATALYST_APP_URL}}/files/${doc.id}/download`
                    }
                },
                {
                    type: 'button',
                    text: '🔮 Summarize',
                    action: {
                        type: 'command',
                        data: `/doc-summary ${doc.name}`
                    }
                }
            ]
        };
    });
    
    return {
        type: 'message',
        text: `🔍 Found ${results.length} document${results.length !== 1 ? 's' : ''} for "${query}"`,
        cards
    };
}

async function handleAuthCommand(userId, orgId) {
    try {
        // Check if user is already authenticated
        const tokens = await utils.getUserTokens(userId, orgId);
        
        if (tokens) {
            return {
                type: 'message',
                text: '✅ You are already authenticated with DocDex!',
                card: {
                    theme: 'modern-inline',
                    title: 'Already Authenticated',
                    description: 'DocDex has access to your WorkDrive and Mail. You can start searching documents.',
                    actions: [
                        {
                            type: 'button',
                            text: 'Search Documents',
                            action: {
                                type: 'command',
                                data: '/doc search recent'
                            }
                        },
                        {
                            type: 'button',
                            text: 'View Status',
                            action: {
                                type: 'command',
                                data: '/doc-status'
                            }
                        }
                    ]
                }
            };
        }
        
        // Generate OAuth URL
        const clientId = await utils.getSecret('ZOHO_CLIENT_ID');
        const redirectUri = await utils.getSecret('ZOHO_REDIRECT_URI');
        const scopes = [
            'ZohoWorkDrive.files.READ',
            'ZohoWorkDrive.folders.READ',
            'ZohoMail.messages.READ',
            'ZohoMail.attachments.READ'
        ].join(',');
        
        const state = utils.generateTokenHash(`${userId}-${orgId}-${Date.now()}`);
        
        // Store state temporarily
        const stateTable = utils.datastore.table('oauth_states');
        await stateTable.insertRecord({
            state,
            user_id: userId,
            org_id: orgId,
            created_at: new Date().toISOString(),
            expires_at: new Date(Date.now() + 10 * 60 * 1000).toISOString()
        });
        
        const authUrl = new URL('https://accounts.zoho.com/oauth/v2/auth');
        authUrl.searchParams.set('response_type', 'code');
        authUrl.searchParams.set('client_id', clientId);
        authUrl.searchParams.set('scope', scopes);
        authUrl.searchParams.set('redirect_uri', redirectUri);
        authUrl.searchParams.set('state', state);
        authUrl.searchParams.set('access_type', 'offline');
        authUrl.searchParams.set('prompt', 'consent');
        
        return {
            type: 'message',
            text: '🔐 Click the button below to authorize DocDex',
            card: {
                theme: 'modern-inline',
                title: 'Authorize DocDex',
                description: 'Grant DocDex access to your WorkDrive and Mail to start indexing documents.',
                actions: [
                    {
                        type: 'button',
                        text: '🔓 Authorize Now',
                        action: {
                            type: 'open.url',
                            url: authUrl.toString()
                        }
                    }
                ]
            }
        };
        
    } catch (error) {
        console.error('Auth command error:', error);
        return {
            type: 'message',
            text: `❌ Authorization failed: ${error.message}`
        };
    }
}

async function handleStatusCommand(userId, orgId) {
    try {
        // Check authentication status
        const tokens = await utils.getUserTokens(userId, orgId);
        const isAuthenticated = !!tokens;
        
        // Get document counts
        const documentsTable = utils.datastore.table('documents');
        
        const totalDocs = await documentsTable.getRecords({
            where: [`user_id='${userId}' AND org_id='${orgId}'`]
        });
        
        const processedDocs = await documentsTable.getRecords({
            where: [`user_id='${userId}' AND org_id='${orgId}' AND status='processed'`]
        });
        
        const workdriveDocs = await documentsTable.getRecords({
            where: [`user_id='${userId}' AND org_id='${orgId}' AND source_type='workdrive'`]
        });
        
        const mailDocs = await documentsTable.getRecords({
            where: [`user_id='${userId}' AND org_id='${orgId}' AND source_type='mail'`]
        });
        
        // Get last indexing time
        let lastIndexed = 'Never';
        if (totalDocs.length > 0) {
            const latest = totalDocs.reduce((latest, doc) => 
                new Date(doc.indexed_at) > new Date(latest.indexed_at) ? doc : latest
            );
            lastIndexed = formatDate(latest.indexed_at);
        }
        
        const statusEmoji = isAuthenticated ? '✅' : '❌';
        const statusText = isAuthenticated ? 'Connected' : 'Not Connected';
        
        return {
            type: 'message',
            text: `${statusEmoji} **DocDex Status: ${statusText}**`,
            card: {
                theme: 'modern-inline',
                title: 'DocDex Status',
                description: `Authentication: ${statusText}\nLast indexed: ${lastIndexed}`,
                sections: [
                    {
                        title: 'Document Statistics',
                        items: [
                            { title: 'Total Documents', value: totalDocs.length.toString() },
                            { title: 'Processed', value: processedDocs.length.toString() },
                            { title: 'WorkDrive Files', value: workdriveDocs.length.toString() },
                            { title: 'Mail Attachments', value: mailDocs.length.toString() }
                        ]
                    }
                ],
                actions: isAuthenticated ? [
                    {
                        type: 'button',
                        text: '🔍 Search Documents',
                        action: {
                            type: 'command',
                            data: '/doc search recent'
                        }
                    },
                    {
                        type: 'button',
                        text: '🔄 Refresh Index',
                        action: {
                            type: 'command',
                            data: '/doc-refresh'
                        }
                    }
                ] : [
                    {
                        type: 'button',
                        text: '🔓 Authorize',
                        action: {
                            type: 'command',
                            data: '/doc-auth'
                        }
                    }
                ]
            }
        };
        
    } catch (error) {
        console.error('Status command error:', error);
        return {
            type: 'message',
            text: `❌ Failed to get status: ${error.message}`
        };
    }
}

async function handleSummaryCommand(userId, orgId, fileName) {
    try {
        if (!fileName) {
            return {
                type: 'message',
                text: '📝 Please provide a file name: `/doc-summary filename.pdf`'
            };
        }
        
        // Find document by name
        const documentsTable = utils.datastore.table('documents');
        const documents = await documentsTable.getRecords({
            where: [`user_id='${userId}' AND org_id='${orgId}' AND LOWER(name) LIKE '%${fileName.toLowerCase()}%'`],
            limit: 1
        });
        
        if (documents.length === 0) {
            return {
                type: 'message',
                text: `📄 Document "${fileName}" not found. Try searching first with \`/doc search ${fileName}\``
            };
        }
        
        const doc = documents[0];
        
        // Check if summary already exists
        const summariesTable = utils.datastore.table('document_summaries');
        const summaries = await summariesTable.getRecords({
            where: [`document_id='${doc.ROWID}'`],
            limit: 1
        });
        
        if (summaries.length > 0) {
            const summary = summaries[0];
            
            return {
                type: 'message',
                text: `🔮 **Summary for ${doc.name}**`,
                card: {
                    theme: 'modern-inline',
                    title: doc.name,
                    description: summary.summary_text,
                    footer: `Generated with ${summary.confidence * 100}% confidence`,
                    sections: summary.keywords ? [
                        {
                            title: 'Key Topics',
                            description: JSON.parse(summary.keywords).slice(0, 5)
                                .map(k => k.text || k).join(', ')
                        }
                    ] : [],
                    actions: [
                        {
                            type: 'button',
                            text: '📄 View Document',
                            action: {
                                type: 'open.url',
                                url: `{{CATALYST_APP_URL}}/files/${doc.file_id}/view`
                            }
                        }
                    ]
                }
            };
        }
        
        // Generate summary
        try {
            // Call the summarizeDocument function
            const summaryResult = await generateSummary(userId, orgId, doc);
            
            return {
                type: 'message',
                text: `🔮 **Summary for ${doc.name}**`,
                card: {
                    theme: 'modern-inline',
                    title: doc.name,
                    description: summaryResult.summary,
                    actions: [
                        {
                            type: 'button',
                            text: '📄 View Document',
                            action: {
                                type: 'open.url',
                                url: `{{CATALYST_APP_URL}}/files/${doc.file_id}/view`
                            }
                        }
                    ]
                }
            };
            
        } catch (summaryError) {
            return {
                type: 'message',
                text: `❌ Failed to generate summary: ${summaryError.message}`
            };
        }
        
    } catch (error) {
        console.error('Summary command error:', error);
        return {
            type: 'message',
            text: `❌ Summary command failed: ${error.message}`
        };
    }
}

async function generateSummary(userId, orgId, doc) {
    // This would call the summarizeDocument function
    // For now, return a basic summary
    return {
        summary: `This is a ${doc.source_type} document named "${doc.name}" (${formatFileSize(doc.size)}). Summary generation is in progress.`,
        confidence: 0.7
    };
}

async function handleBotMention(payload) {
    const { message, user } = payload;
    const messageText = message.text.toLowerCase();
    
    if (messageText.includes('help')) {
        return createHelpResponse();
    } else if (messageText.includes('search')) {
        const searchTerm = messageText.replace(/.*search\s+/, '').trim();
        if (searchTerm) {
            return await performSearch(user.id, user.organization_id, searchTerm);
        }
    }
    
    return {
        type: 'message',
        text: 'Hi! 👋 I\'m DocDex. I help you search and manage your documents. Use `/doc help` to see what I can do!'
    };
}

async function handleInstallation(payload) {
    return {
        type: 'message',
        text: '🎉 Welcome to DocDex! Use `/doc-auth` to get started with document indexing and search.'
    };
}

function createHelpResponse() {
    return {
        type: 'message',
        text: '**DocDex Bot Help** 🤖',
        card: {
            theme: 'modern-inline',
            title: 'DocDex Commands',
            description: 'AI-powered document search and management',
            sections: [
                {
                    title: 'Available Commands',
                    items: [
                        {
                            title: '/doc search <query>',
                            value: 'Search your documents'
                        },
                        {
                            title: '/doc-auth',
                            value: 'Authorize DocDex access'
                        },
                        {
                            title: '/doc-status',
                            value: 'Check authorization status'
                        },
                        {
                            title: '/doc-summary <filename>',
                            value: 'Get AI summary of document'
                        }
                    ]
                }
            ],
            actions: [
                {
                    type: 'button',
                    text: '🔓 Get Started',
                    action: {
                        type: 'command',
                        data: '/doc-auth'
                    }
                }
            ]
        }
    };
}

function getFileIcon(mimeType) {
    if (!mimeType) return '📄';
    
    if (mimeType.includes('pdf')) return '📃';
    if (mimeType.includes('word') || mimeType.includes('document')) return '📘';
    if (mimeType.includes('sheet') || mimeType.includes('excel')) return '📊';
    if (mimeType.includes('presentation') || mimeType.includes('powerpoint')) return '📽️';
    if (mimeType.includes('image')) return '🖼️';
    if (mimeType.includes('video')) return '🎥';
    if (mimeType.includes('audio')) return '🎵';
    if (mimeType.includes('text')) return '📝';
    if (mimeType.includes('zip') || mimeType.includes('archive')) return '📦';
    
    return '📄';
}

function formatFileSize(bytes) {
    if (!bytes || bytes === 0) return 'Unknown';
    
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    
    return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${sizes[i]}`;
}

function formatDate(dateString) {
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