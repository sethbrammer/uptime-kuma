#!/usr/bin/env node

const axios = require("axios");

// Configuration
const BASE_URL = "http://localhost:3001/api/v2";
const USERNAME = "admin"; // Change this to your username
const PASSWORD = "admin"; // Change this to your password or API key

// Create axios client with auth
const client = axios.create({
    baseURL: BASE_URL,
    auth: {
        username: USERNAME,
        password: PASSWORD
    },
    timeout: 10000
});

async function testAPI() {
    console.log("🧪 Testing Uptime Kuma API v2...\n");
    
    try {
        // Test 1: Get system info
        console.log("1. Testing system info...");
        const infoResponse = await client.get("/info");
        console.log(`✅ Version: ${infoResponse.data.version}`);
        console.log(`✅ Monitor count: ${infoResponse.data.monitorCount}\n`);
        
        // Test 2: List existing monitors
        console.log("2. Listing existing monitors...");
        const monitorsResponse = await client.get("/monitors");
        console.log(`✅ Found ${monitorsResponse.data.length} monitors\n`);
        
        // Test 3: Create a new monitor
        console.log("3. Creating a new monitor...");
        const newMonitor = {
            name: "Test API Monitor",
            type: "http",
            url: "https://httpbin.org/status/200",
            interval: 60,
            method: "GET",
            active: 1
        };
        
        const createResponse = await client.post("/monitors", newMonitor);
        const monitorId = createResponse.data.id;
        console.log(`✅ Created monitor with ID: ${monitorId}\n`);
        
        // Test 4: Get the specific monitor
        console.log("4. Getting monitor details...");
        const getResponse = await client.get(`/monitors/${monitorId}`);
        console.log(`✅ Monitor name: ${getResponse.data.name}`);
        console.log(`✅ Monitor URL: ${getResponse.data.url}\n`);
        
        // Test 5: Update the monitor
        console.log("5. Updating monitor...");
        const updateData = {
            name: "Updated Test Monitor",
            interval: 120
        };
        const updateResponse = await client.put(`/monitors/${monitorId}`, updateData);
        console.log(`✅ Updated monitor name: ${updateResponse.data.name}`);
        console.log(`✅ Updated interval: ${updateResponse.data.interval}s\n`);
        
        // Test 6: Pause monitor
        console.log("6. Pausing monitor...");
        await client.post(`/monitors/${monitorId}/pause`);
        console.log("✅ Monitor paused\n");
        
        // Test 7: Resume monitor
        console.log("7. Resuming monitor...");
        await client.post(`/monitors/${monitorId}/resume`);
        console.log("✅ Monitor resumed\n");
        
        // Test 8: Create a tag
        console.log("8. Creating a tag...");
        const tagData = {
            name: "API Test",
            color: "#FF5733"
        };
        const tagResponse = await client.post("/tags", tagData);
        console.log(`✅ Created tag: ${tagResponse.data.name}\n`);
        
        // Test 9: List tags
        console.log("9. Listing tags...");
        const tagsResponse = await client.get("/tags");
        console.log(`✅ Found ${tagsResponse.data.length} tags\n`);
        
        // Test 10: Delete the test monitor
        console.log("10. Cleaning up - deleting test monitor...");
        await client.delete(`/monitors/${monitorId}`);
        console.log("✅ Monitor deleted\n");
        
        console.log("🎉 All API tests passed!");
        
    } catch (error) {
        console.error("❌ API test failed:");
        if (error.response) {
            console.error(`Status: ${error.response.status}`);
            console.error(`Error: ${error.response.data.error || error.response.data}`);
        } else {
            console.error(error.message);
        }
        
        if (error.code === "ECONNREFUSED") {
            console.log("\n💡 Make sure Uptime Kuma is running on localhost:3001");
            console.log("   Start it with: npm run dev");
        }
        
        process.exit(1);
    }
}

// Quick examples
function showExamples() {
    console.log("\n📚 API Usage Examples:\n");
    
    console.log("Add HTTP monitor:");
    console.log(`curl -X POST ${BASE_URL}/monitors \\
  -u ${USERNAME}:${PASSWORD} \\
  -H "Content-Type: application/json" \\
  -d '{
    "name": "My Website",
    "type": "http", 
    "url": "https://example.com",
    "interval": 60
  }'\n`);
    
    console.log("List all monitors:");
    console.log(`curl -u ${USERNAME}:${PASSWORD} ${BASE_URL}/monitors\n`);
    
    console.log("Add ping monitor:");
    console.log(`curl -X POST ${BASE_URL}/monitors \\
  -u ${USERNAME}:${PASSWORD} \\
  -H "Content-Type: application/json" \\
  -d '{
    "name": "Server Ping",
    "type": "ping",
    "hostname": "example.com", 
    "interval": 60
  }'\n`);
}

// Parse command line arguments
const args = process.argv.slice(2);

if (args.includes("--examples") || args.includes("-e")) {
    showExamples();
} else {
    testAPI();
}