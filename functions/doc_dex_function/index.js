const utils = require('../utilities');

/**
 * 
 * @param {import('./types/basicio').Context} context 
 * @param {import('./types/basicio').BasicIO} basicIO 
 */
module.exports = async (context, basicIO) => {
	try {
		// Get the request path from context
		const requestUrl = context.request.getUrlAndQuery();
		const url = new URL(requestUrl);
		const path = url.pathname;
		
		// Route to appropriate function based on path
		if (path.includes('startOAuth')) {
			// Import and execute startOAuth function
			const startOAuthFn = require('../startOAuth');
			await startOAuthFn(context, basicIO);
		} else if (path.includes('searchDocs')) {
			// Import and execute searchDocs function  
			const searchDocsFn = require('../searchDocs');
			await searchDocsFn(context, basicIO);
		} else if (path.includes('summarizeDocument')) {
			// Import and execute summarizeDocument function
			const summarizeDocumentFn = require('../summarizeDocument');
			await summarizeDocumentFn(context, basicIO);
		} else if (path.includes('oauthCallback')) {
			// Import and execute oauthCallback function
			const oauthCallbackFn = require('../oauthCallback');
			await oauthCallbackFn(context, basicIO);
		} else if (path.includes('fetchFileProxy')) {
			// Import and execute fetchFileProxy function
			const fetchFileProxyFn = require('../fetchFileProxy');
			await fetchFileProxyFn(context, basicIO);
		} else if (path.includes('indexWorkdrive')) {
			// Import and execute indexWorkdrive function
			const indexWorkdriveFn = require('../indexWorkdrive');
			await indexWorkdriveFn(context, basicIO);
		} else if (path.includes('adminUtils')) {
			// Import and execute adminUtils function
			const adminUtilsFn = require('../adminUtils');
			await adminUtilsFn(context, basicIO);
		} else {
			// Default health check or welcome message
			basicIO.write(JSON.stringify({
				status: 'success',
				message: 'DocDex API is running',
				endpoints: [
					'/startOAuth',
					'/searchDocs', 
					'/summarizeDocument',
					'/oauthCallback',
					'/fetchFileProxy',
					'/indexWorkdrive',
					'/adminUtils'
				]
			}));
		}
	} catch (error) {
		console.error('Error in main function:', error);
		basicIO.write(JSON.stringify({
			status: 'error',
			message: error.message
		}));
	}
	
	context.close();
};
