const utils = require('../utilities');

/**
 * Initiate OAuth flow for Zoho WorkDrive and Mail access
 * @param {import('../doc_dex_function/types/basicio').Context} context 
 * @param {import('../doc_dex_function/types/basicio').BasicIO} basicIO 
 */
module.exports = async (context, basicIO) => {
    try {
        // Get request data from context
        const requestMethod = context.request.getMethod();
        const requestUrl = context.request.getUrlAndQuery();
        
        // Create mock req/res objects for compatibility
        const mockReq = {
            method: requestMethod,
            url: requestUrl,
            headers: context.request.getHeaders(),
            body: context.request.getBody()
        };
        
        const mockRes = {
            status: (code) => ({ 
                json: (data) => basicIO.write(JSON.stringify(data)),
                send: (data) => basicIO.write(typeof data === 'string' ? data : JSON.stringify(data))
            }),
            json: (data) => basicIO.write(JSON.stringify(data)),
            send: (data) => basicIO.write(typeof data === 'string' ? data : JSON.stringify(data))
        };
        
        // Initialize Catalyst
        await utils.initCatalyst(mockReq);
        
        // Validate Cliq user context
        const { userId, orgId } = utils.validateCliqUser(mockReq);
        
        // Get OAuth configuration from secrets
        const clientId = await utils.getSecret('ZOHO_CLIENT_ID');
        const redirectUri = await utils.getSecret('ZOHO_REDIRECT_URI');
        
        // Define required scopes for WorkDrive and Mail
        const scopes = [
            'ZohoWorkDrive.files.READ',
            'ZohoWorkDrive.folders.READ',
            'ZohoMail.messages.READ',
            'ZohoMail.attachments.READ'
        ].join(',');
        
        // Generate OAuth authorization URL
        const state = utils.generateTokenHash(`${userId}-${orgId}-${Date.now()}`);
        
        // Store state temporarily for validation in callback
        const table = utils.datastore.table('oauth_states');
        await table.insertRecord({
            state,
            user_id: userId,
            org_id: orgId,
            created_at: new Date().toISOString(),
            expires_at: new Date(Date.now() + 10 * 60 * 1000).toISOString() // 10 minutes
        });
        
        const authUrl = new URL('https://accounts.zoho.com/oauth/v2/auth');
        authUrl.searchParams.set('response_type', 'code');
        authUrl.searchParams.set('client_id', clientId);
        authUrl.searchParams.set('scope', scopes);
        authUrl.searchParams.set('redirect_uri', redirectUri);
        authUrl.searchParams.set('state', state);
        authUrl.searchParams.set('access_type', 'offline');
        authUrl.searchParams.set('prompt', 'consent');
        
        console.log(`OAuth initiated for user ${userId} in org ${orgId}`);
        
        const response = utils.generateResponse(200, {
            authUrl: authUrl.toString(),
            state,
            message: 'Please authorize DocDex to access your WorkDrive and Mail'
        });
        
        basicIO.write(JSON.stringify(response));
        
    } catch (error) {
        console.error('startOAuth error:', error);
        const errorResponse = utils.generateResponse(500, null, error.message);
        basicIO.write(JSON.stringify(errorResponse));
    }
};