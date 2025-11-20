/**
 * 
 * @param {import('./types/basicio').Context} context 
 * @param {import('./types/basicio').BasicIO} basicIO 
 */
module.exports = async (context, basicIO) => {
	try {
		// Get the request method and query parameters
		const method = context.request ? context.request.getMethod() : 'GET';
		const path = basicIO.getArgument('path') || 'default';
		
		// Route to different functions based on path parameter
		if (path === 'searchDocs') {
			return await handleSearchDocs(context, basicIO);
		} else if (path === 'summarizeDocument') {
			return await handleSummarizeDocument(context, basicIO);
		} else if (path === 'startOAuth') {
			return await handleStartOAuth(context, basicIO);
		} else if (path === 'botWebhook') {
			return await handleBotWebhook(context, basicIO);
		} else {
			// Default health check response
			const response = {
				status: 'success',
				message: 'DocDex API is running on Catalyst',
				method: method,
				path: path,
				timestamp: new Date().toISOString(),
				endpoints: [
					'?path=startOAuth - OAuth setup',
					'?path=searchDocs - Search documents', 
					'?path=summarizeDocument - AI document summary',
					'?path=botWebhook - Cliq bot webhook',
					'?path=oauthCallback - OAuth callback',
					'?path=fetchFileProxy - File proxy',
					'?path=indexWorkdrive - Index documents',
					'?path=adminUtils - Admin utilities'
				]
			};
			
			basicIO.write(JSON.stringify(response));
		}
		
	} catch (error) {
		console.error('Error in main function:', error);
		basicIO.write(JSON.stringify({
			status: 'error',
			message: error.message,
			timestamp: new Date().toISOString()
		}));
	}
	
	context.close();
};

// Placeholder handlers - implement these based on your existing functions
async function handleSearchDocs(context, basicIO) {
	basicIO.write(JSON.stringify({
		status: 'success',
		message: 'Search functionality - connect to your search implementation',
		timestamp: new Date().toISOString()
	}));
}

async function handleSummarizeDocument(context, basicIO) {
	basicIO.write(JSON.stringify({
		status: 'success',
		message: 'Summarize functionality - connect to your AI implementation',
		timestamp: new Date().toISOString()
	}));
}

async function handleStartOAuth(context, basicIO) {
	const userId = basicIO.getArgument('userId') || 'unknown';
	basicIO.write(JSON.stringify({
		status: 'success',
		message: 'OAuth setup for user: ' + userId,
		authUrl: 'https://accounts.zoho.com/oauth/v2/auth?...',
		timestamp: new Date().toISOString()
	}));
}

async function handleBotWebhook(context, basicIO) {
	// Simple bot response for Cliq
	const response = {
		text: "🤖 Hi! I'm DocDex Bot.\\n\\nAvailable commands:\\n• `/docdex help` - Show help\\n• `/docdex search <query>` - Search docs\\n• `/docdex-setup` - Connect WorkDrive",
		card: {
			title: "DocDex Bot",
			theme: "modern-inline"
		}
	};
	
	basicIO.write(JSON.stringify(response));
}
