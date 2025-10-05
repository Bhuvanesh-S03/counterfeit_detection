🧬 CypherMed — Blockchain-Based Medicine Authentication and QC Verification
📖 Overview

CypherMed is a decentralized medicine authentication platform that prevents counterfeit drugs and ensures product quality through end-to-end blockchain tracking.
Every medicine batch passes through four stakeholders:

Manufacturer – adds product data

QC Authority (Government / Lab) – uploads Quality Certificate (QC)

Retailer / Distributor – verifies authenticity

Customer – scans and verifies before purchase

Each product’s details are hashed using SHA-256 with dynamic salt, stored on the Polygon Amoy testnet, and linked with its IPFS CID for decentralized storage.
For visual traceability, the hash is invisibly embedded as a digital watermark in the product image using DCT-DWT-based watermarking.

⚙️ Tech Stack
Layer	Technology
Mobile App	Flutter (Dart)
Backend	FastAPI (Python)
Blockchain	Solidity Smart Contract on Polygon Amoy
Database / Auth	Firebase (Firestore + Authentication)
Decentralized Storage	IPFS
Watermarking	Python (OpenCV + NumPy using DCT & DWT)
Hashing	SHA-256 with dynamic salt
Admin Dashboard	React.js (Frontend folder inside /ReactApp)
🧩 Folder Structure
CypherMed/
│
├── blockchain/               # Smart contract + Hardhat deployment
│   ├── CounterfeitProtection.sol
│   ├── deploy.js
│   └── hardhat.config.js
│
├── drug_authentication/       # Flutter Mobile App
│   ├── lib/
│   │   ├── auth_screen.dart
│   │   ├── home_screen.dart
│   │   ├── veridy_product.dart
│   │   ├── report_page.dart
│   │   ├── stored_product_page.dart
│   │   ├── product_details_page.dart
│   │   └── notification_service.dart
│   └── pubspec.yaml
│
├── Python/                    # Backend + Watermark + Blockchain link
│   ├── fastapi_app.py         # API endpoints for add/verify/show/QC
│   ├── watermark/
│   │   ├── embed_watermark_dct_dwt.py
│   │   └── extract_watermark_dct_dwt.py
│   ├── hash_generator.py      # SHA-256 with salt
│   ├── ipfs_utils.py          # Upload / retrieve IPFS files
│   ├── requirements.txt
│   └── README.md
│
├── ReactApp/
│   └── frontend/              # Admin dashboard (QC uploader + reports)
│       ├── src/
│       ├── package.json
│       └── README.md
│
├── watermarked_images/        # Output folder for labeled images
│
├── ipfs.js                    # Node utility for IPFS integration
├── app.js                     # Node blockchain helper
├── firebase-debug.log         # Firebase logs
├── .gitignore
└── README.md                  # (this file)

🔗 Workflow Summary
🏭 1. Manufacturer — Add Product

Enters Product ID, Name, Expiry Date, Batch No

Backend generates:

SHA-256 hash (with salt)

DCT-DWT invisible watermark

IPFS CID for the image / QC file

Hash + CID stored on Polygon Amoy using storeHash()

🧪 2. QC Uploader — Upload Quality Certificate

Government official / lab uploads test report or QC PDF

File sent to IPFS

CID linked to existing product hash on blockchain

🛒 3. Retailer / Distributor

Scans product QR or enters hash

Retrieves verification result:
✅ Not Counterfeited (if hash exists on chain)
❌ Counterfeited (if not found)

👤 4. Customer

Uses mobile app to verify authenticity

Can view:

Product details

IPFS link (certificate / image)

Blockchain transaction

⚡ Backend (FastAPI)
Main Endpoints
Endpoint	Method	Description
/add_product	POST	Generates hash, uploads metadata, stores hash on Polygon
/verify_product	POST	Verifies if hash exists on-chain
/show_details	GET	Fetches full product info from blockchain/IPFS
/add_qc	POST	Uploads QC file to IPFS and links to product hash
/view_qc	GET	Retrieves QC file via IPFS CID
Blockchain Functions (Solidity)
function storeHash(bytes32 dataHash, string memory cid) public;
function verifyProduct(bytes32 dataHash) public view returns (bool);
function getProductByHash(bytes32 dataHash) public view returns (Product memory);
function addQC(bytes32 dataHash, string memory qcCID) public;
function getQC(bytes32 dataHash) public view returns (string memory);

📱 Flutter App Overview
Key Screens
File	Description
auth_screen.dart	Firebase login/signup
home_screen.dart	Main dashboard
veridy_product.dart	Verify product by hash/QR
stored_product_page.dart	Lists products uploaded by manufacturer
report_page.dart	Shows blockchain verification & QC status
notification_service.dart	Push notifications (QC updates)
product_details_page.dart	Full details from blockchain/IPFS
custom_particle_widget.dart	UI animations
lottieTransition.dart	Page transition effects
🖼️ Watermarking Module (Python)

Algorithm:

Convert image to YCbCr and apply Discrete Cosine Transform (DCT)

Apply Discrete Wavelet Transform (DWT)

Embed SHA-256 hash bits as watermark in mid-frequency band

Reconstruct image and save to /watermarked_images/

Detection:

Extract watermark bits using inverse DWT + DCT

Compare extracted hash with blockchain-stored hash

This ensures that any tampering with the label will break the embedded code.

🌐 React Admin Dashboard

Located in ReactApp/frontend/

Modules

Product Upload: For manufacturers to register new products

QC Upload: For officials to attach QC documents

Verification Dashboard: Shows on-chain and IPFS data

Analytics Page: Shows number of verified / counterfeit products

Run locally:

cd ReactApp/frontend
npm install
npm start

💾 IPFS + Blockchain Integration

All product metadata (JSON, images, certificates) are stored on IPFS.

Only the IPFS CID and SHA-256 hash are stored on Polygon → ensures very low gas fees.

Example:

{
  "product_id": "CM1234",
  "hash": "0xa8d3c5...",
  "ipfs_cid": "QmXT7fP...",
  "qc_cid": "QmYh9zD..."
}

🔧 Deployment & Testing
Smart Contract
cd blockchain
npm install
npx hardhat run deploy.js --network amoy

Backend
cd Python
pip install -r requirements.txt
uvicorn fastapi_app:app --reload

Flutter App
cd drug_authentication
flutter pub get
flutter run

React Dashboard
cd ReactApp/frontend
npm install
npm start

📜 Features Summary
Module	Features
Manufacturer	Add product, encode hash, upload image
QC Uploader	Upload government QC report
Customer	Verify product, view QC & blockchain proof
Watermarking	DCT-DWT invisible watermark
IPFS	Decentralized storage for images & QC files
Blockchain	Hash + CID storage for traceability
Firebase	Authentication & notification service
