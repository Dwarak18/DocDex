/**
 * Bot webhook handler for DocDex Cliq extension
 */
async function handleBotWebhook(args, context) {
    try {
        const { command, text, user } = args;
        
        console.log('Bot webhook received:', { command, text, user: user?.id });
        
        // Handle different commands
        if (command === '/docdex' || command === '/doc') {
            return await handleDocdexCommand(text, user, context);
        } else if (command === '/docdex-setup') {
            return await handleSetupCommand(user, context);
        }
        
        // Default response
        return {
            text: "🤖 Hi! I'm DocDex Bot. Use `/docdex help` to see available commands."
        };
        
    } catch (error) {
        console.error('Bot webhook error:', error);
        return {
            text: "❌ Something went wrong. Please try again."
        };
    }
}

/**
 * Handle /docdex command with subcommands
 */
async function handleDocdexCommand(text, user, context) {
    const args = text ? text.trim().split(' ') : [];
    const subcommand = args[0];
    const query = args.slice(1).join(' ');
    
    switch (subcommand) {
        case 'help':
            return {
                text: `🤖 **DocDex Bot - Your AI Document Assistant**\n\n**Available Commands:**\n• \`/docdex search <query>\` - Search your documents\n• \`/docdex summarize <file_id>\` - Get AI summary\n• \`/docdex-setup\` - Connect WorkDrive\n• \`/docdex help\` - Show this help\n\n**Examples:**\n• \`/docdex search project proposal\`\n• \`/docdex summarize 123456789\``,
                card: {
                    title: "DocDex Commands",
                    theme: "modern-inline"
                }
            };
            
        case 'search':
            if (!query) {
                return {
                    text: "Please provide a search query. Example: `/docdex search project reports`"
                };
            }
            
            // Call the search function
            const { handleDocuments } = require('./searchDocuments');
            return await handleDocuments({
                query: query,
                userId: user.id
            }, context);
            
        case 'summarize':
            if (!query) {
                return {
                    text: "Please provide a file ID. Example: `/docdex summarize 123456789`"
                };
            }
            
            // Call the summarize function
            const { handleDocuments: handleDocs } = require('./searchDocuments');
            return await handleDocs({
                fileId: query,
                userId: user.id
            }, context);
            
        default:
            return {
                text: "🤖 Hi! I'm DocDex Bot. Use `/docdex help` to see available commands or `/docdex-setup` to get started!"
            };
    }
}

/**
 * Handle setup command
 */
async function handleSetupCommand(user, context) {
    return {
        text: `🔐 **Setup Required**\n\nTo use DocDex, you need to connect your WorkDrive account.\n\nClick here: [🔗 **Connect WorkDrive**](https://docdex-60058081001.development.catalystserverless.in/server/docdex_io/execute?path=startOAuth&userId=${user.id})\n\nAfter authorization, you can start searching and summarizing documents!`,
        card: {
            title: "DocDex - Connect WorkDrive",
            theme: "modern-inline"
        }
    };
}

module.exports = { 
    handleBotWebhook,
    handleDocdexCommand,
    handleSetupCommand
};