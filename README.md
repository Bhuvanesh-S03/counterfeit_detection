🧬 CypherMed — Blockchain-Based Medicine Authentication and QC Verification
Overview

CypherMed is a decentralized medicine authentication platform that prevents counterfeit drugs and ensures product quality through end-to-end blockchain tracking.
Every medicine batch passes through four main stakeholders:

Manufacturer – Adds product data

QC Authority (Government / Lab) – Uploads Quality Certificate (QC)

Retailer / Distributor – Verifies authenticity

Customer – Scans and verifies before purchase

Each product’s details are hashed using SHA-256 with dynamic salt, stored on the Polygon Amoy testnet, and linked with its IPFS CID for decentralized storage.
For visual traceability, the hash is invisibly embedded as a digital watermark in the product image using DCT-DWT-based watermarking.

Tech Stack

Mobile App: Flutter (Dart)

Backend: FastAPI (Python)

Blockchain: Solidity Smart Contract (Polygon Amoy)

Database / Auth: Firebase (Firestore + Authentication)

Decentralized Storage: IPFS

Watermarking: Python (OpenCV + NumPy using DCT & DWT)

Hashing: SHA-256 with dynamic salt

Admin Dashboard: React.js

Folder Structure

blockchain/ — Smart contract and Hardhat deployment files

CounterfeitProtection.sol

deploy.js

hardhat.config.js

drug_authentication/ — Flutter mobile app

auth_screen.dart

home_screen.dart

veridy_product.dart

report_page.dart

stored_product_page.dart

product_details_page.dart

notification_service.dart

Python/ — Backend, watermarking, and blockchain integration

fastapi_app.py

watermark/embed_watermark_dct_dwt.py

watermark/extract_watermark_dct_dwt.py

hash_generator.py

ipfs_utils.py

requirements.txt

ReactApp/frontend/ — React admin dashboard (QC uploader + reports)

src/

package.json

watermarked_images/ — Output folder for labeled images

ipfs.js — Node utility for IPFS integration

app.js — Node blockchain helper

.gitignore, README.md — Misc project files

Workflow Summary
1. Manufacturer — Add Product

Enters product details (ID, Name, Expiry, Batch No).

Backend generates:

SHA-256 hash (with salt)

DCT-DWT invisible watermark

IPFS CID for image or metadata

Hash and CID are stored on Polygon Amoy using the storeHash() function.

2. QC Uploader — Upload Quality Certificate

Government or lab official uploads test report or QC PDF.

File is uploaded to IPFS, and CID is linked to the product hash on blockchain.

3. Retailer / Distributor

Scans QR code or enters product hash.

Retrieves verification status:

✅ Not Counterfeited (hash found on chain)

❌ Counterfeited (not found)

4. Customer

Verifies authenticity through the Flutter app.

Can view product details, QC reports (via IPFS), and blockchain transaction info.

Backend (FastAPI)
Main Endpoints

/add_product — Generates hash, uploads metadata, and stores hash on Polygon

/verify_product — Verifies if hash exists on blockchain

/show_details — Fetches product info from blockchain/IPFS

/add_qc — Uploads QC file to IPFS and links to product hash

/view_qc — Retrieves QC report using IPFS CID

Blockchain Functions (Solidity)

storeHash(dataHash, cid) — Stores hash and IPFS CID

verifyProduct(dataHash) — Verifies product authenticity

getProductByHash(dataHash) — Retrieves stored product details

addQC(dataHash, qcCID) — Links QC document to product

getQC(dataHash) — Retrieves QC document CID

Flutter App Overview
Key Screens

auth_screen.dart — Firebase login/signup

home_screen.dart — Main dashboard

veridy_product.dart — Verify product by hash or QR

stored_product_page.dart — View manufacturer’s uploaded products

report_page.dart — Shows verification and QC status

notification_service.dart — Push notifications for QC updates

product_details_page.dart — Product + blockchain info display

Watermarking Module (Python)
Algorithm

Convert image to YCbCr and apply Discrete Cosine Transform (DCT).

Apply Discrete Wavelet Transform (DWT).

Embed the SHA-256 hash bits as watermark in the mid-frequency band.

Reconstruct the image and save to /watermarked_images/.

Detection

Extract watermark bits using inverse DWT and DCT.

Compare extracted hash with on-chain hash.
If any tampering occurs, the extracted code will not match.

React Admin Dashboard

Located inside ReactApp/frontend/.

Modules

Product Upload (Manufacturer)

QC Upload (Government / Lab)

Verification Dashboard (On-chain and IPFS data)

Analytics Page (Verified / Counterfeit counts)

To run locally:

cd ReactApp/frontend
npm install
npm start

IPFS + Blockchain Integration

All product metadata (JSON, images, certificates) are uploaded to IPFS.
Only the IPFS CID and SHA-256 hash are stored on Polygon to minimize gas fees.

Example metadata:

{
  "product_id": "CM1234",
  "hash": "0xa8d3c5...",
  "ipfs_cid": "QmXT7fP...",
  "qc_cid": "QmYh9zD..."
}

Deployment and Testing
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

Features Summary

Manufacturer: Add product, encode hash, upload image

QC Uploader: Upload government QC report

Customer: Verify authenticity, view QC & blockchain proof

Watermarking: DCT-DWT invisible embedding

IPFS: Decentralized file storage

Blockchain: Hash + CID traceability

Firebase: Auth and notifications

License

This project is released under the MIT License — free to use and modify with proper attribution.
