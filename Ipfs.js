const pinataSDK = require('@pinata/sdk');
const fs = require("fs");

// ⚠️ Replace with your actual Pinata API keys
const pinataApiKey = "e19ad798dc5520530d58";
const pinataSecretApiKey = "a1dcbdcd34e2ef391f582b8e2b6f2dcb144819e0715c81f2cea898087c4ea0bb";

// Function to handle the authentication with Pinata.
async function authenticatePinata() {
  try {
    const result = await pinata.testAuthentication();
    console.log("✅ Pinata authentication successful.");
  } catch (err) {
    console.error("❌ Pinata authentication failed. Check your API keys and permissions.");
    // Exit the process if authentication fails to prevent further errors.
    process.exit(1); 
  }
}

// Function to upload JSON
async function uploadJSON() {
    try {
        const data = {
            productId: "12345",
            manufacturer: "Cipla",
            batchNo: "BATCH001",
            expiry: "2026-01-15",
            status: "Not Counterfeited"
        };
        const result = await pinata.pinJSONToIPFS(data);
        console.log("✅ JSON uploaded to IPFS. CID:", result.IpfsHash);
    } catch (error) {
        console.error("❌ Failed to upload JSON to IPFS:", error.message);
    }
}

// Function to upload a PDF
async function uploadPDF() {
    try {
        const readableStreamForFile = fs.createReadStream("./qc_report.pdf");
        const result = await pinata.pinFileToIPFS(readableStreamForFile);
        console.log("✅ PDF uploaded to IPFS. CID:", result.IpfsHash);
    } catch (error) {
        console.error("❌ Failed to upload PDF to IPFS:", error.message);
    }
}

// Main execution function
async function main() {
    const pinata = new pinataSDK({ pinataApiKey, pinataSecretApiKey });
    await authenticatePinata();
    await uploadJSON();
    await uploadPDF();
}

// Execute the main function
main();