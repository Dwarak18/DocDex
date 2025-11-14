const utils = require('./utilities');

/**
 * Initiate OAuth flow for Zoho WorkDrive and Mail access
 */
module.exports = async (req, res) => {
    try {
        // Initialize Catalyst
        await utils.initCatalyst(req);
        
        // Validate Cliq user context
        const { userId, orgId } = utils.validateCliqUser(req);
        
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
        
        res.status(200).json(utils.generateResponse(200, {
            authUrl: authUrl.toString(),
            state,
            message: 'Please authorize DocDex to access your WorkDrive and Mail'
        }));
        
    } catch (error) {
        console.error('startOAuth error:', error);
        res.status(500).json(utils.generateResponse(500, null, error.message));
    }
};