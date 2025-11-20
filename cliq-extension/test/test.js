const { handleDocuments } = require('../functions/searchDocuments');

/**
 * Simple test for DocDex Cliq extension functions
 */
async function testExtension() {
    console.log('🧪 Testing DocDex Cliq Extension...');
    
    // Mock context
    const mockContext = {
        user: { id: 'test_user_123' }
    };
    
    // Test search function
    console.log('\\n📄 Testing search function...');
    const searchResult = await handleDocuments({
        query: 'test document',
        userId: 'test_user_123'
    }, mockContext);
    
    console.log('Search result:', JSON.stringify(searchResult, null, 2));
    
    // Test summarize function (will fail without valid file ID)
    console.log('\\n📝 Testing summarize function...');
    const summarizeResult = await handleDocuments({
        fileId: '123456789',
        userId: 'test_user_123'
    }, mockContext);
    
    console.log('Summarize result:', JSON.stringify(summarizeResult, null, 2));
    
    console.log('\\n✅ Tests completed!');
}

// Run test if this file is executed directly
if (require.main === module) {
    testExtension().catch(error => {
        console.error('❌ Test failed:', error);
    });
}

module.exports = { testExtension };