# submit_to_chain.py
import io
import hashlib
import os
import json
import secrets
from datetime import datetime, timedelta
from typing import Optional, List, Dict, Any

import requests
from fastapi import FastAPI, HTTPException, File, UploadFile, Form, Request, Body
from fastapi.responses import StreamingResponse, FileResponse, JSONResponse
from pydantic import BaseModel
from web3 import Web3
from dotenv import load_dotenv

# --- All Imports at the top ---
from fastapi.middleware.cors import CORSMiddleware
import cv2
import numpy as np
import pywt
from reedsolo import RSCodec, ReedSolomonError
from collections import Counter
import csv
from io import StringIO, BytesIO
try:
    import pandas as pd
    _PANDAS_OK = True
except Exception:
    _PANDAS_OK = False
try:
    import firebase_admin
    from firebase_admin import credentials, messaging, firestore
    from google.cloud.firestore_v1.base_query import FieldFilter
    _FBASE_OK_IMPORT = True
except Exception:
    _FBASE_OK_IMPORT = False

# ======================================================================
# 1. INITIAL SETUP & CONFIGURATION
# ======================================================================

load_dotenv()

# --- Blockchain Configuration ---
rpc_url = os.getenv("RPC_URL")
private_key = os.getenv("PRIVATE_KEY")
account_address = os.getenv("PUBLIC_ADDRESS")
contract_address = os.getenv("CONTRACT_ADDRESS")
chain_id = int(os.getenv("CHAIN_ID", 80002))

# --- Robust Watermarking Configuration ---
ECC_BYTES = 32
Q = 40.0
WAVELET = 'haar'
DWT_LEVEL = 2
PAYLOAD_BIT_LENGTH = (32 + ECC_BYTES) * 8

# Create the FastAPI application instance
app = FastAPI(title="AuthentiChain IPFS & Blockchain API")

# Add CORS middleware to handle cross-origin requests
origins = ["*"] # This allows all origins for testing purposes

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],  # Allows all methods, including OPTIONS
    allow_headers=["*"],  # Allows all headers
)

w3 = Web3(Web3.HTTPProvider(rpc_url))
if not w3.is_connected():
    raise ConnectionError("❌ Blockchain connection failed. Check RPC_URL.")

contract_address = Web3.to_checksum_address(contract_address)

# ------------------------
# Embedded IPFS uploader (Pinata)
# ------------------------
PINATA_API_KEY = os.getenv("PINATA_API_KEY")
PINATA_SECRET_KEY = os.getenv("PINATA_SECRET_KEY")

if not all([PINATA_API_KEY, PINATA_SECRET_KEY]):
    raise RuntimeError("❌ Missing Pinata API keys. Check your .env file.")

def upload_to_ipfs(file_bytes: bytes, filename: str) -> str:
    url = "https://api.pinata.cloud/pinning/pinFileToIPFS"
    headers = {
        "pinata_api_key": PINATA_API_KEY,
        "pinata_secret_api_key": PINATA_SECRET_KEY
    }
    files = {"file": (filename, file_bytes)}
    try:
        resp = requests.post(url, files=files, headers=headers)
        resp.raise_for_status()
        return resp.json()["IpfsHash"]
    except requests.exceptions.RequestException as e:
        print(f"❌ Pinata error: {e}")
        return None

def fetch_from_ipfs(cid: str) -> dict:
    """Fetches JSON data from a public IPFS gateway using the CID."""
    gateway_url = f"https://ipfs.io/ipfs/{cid}"
    try:
        resp = requests.get(gateway_url, timeout=10)
        resp.raise_for_status()
        return resp.json()
    except requests.exceptions.RequestException as e:
        print(f"❌ IPFS gateway error: {e}")
        return None
    except ValueError:
        return None

# ------------------------
# Contract ABI
# ------------------------
abi = [
    {"inputs":[{"internalType":"string","name":"manufacturerId","type":"string"},{"internalType":"string","name":"batchNumber","type":"string"}],"name":"addBatch","outputs":[],"stateMutability":"nonpayable","type":"function"},
    {"inputs":[{"internalType":"string","name":"productHash","type":"string"},{"internalType":"string","name":"productCid","type":"string"},{"internalType":"string","name":"batchNumber","type":"string"},{"internalType":"string","name":"manufacturerId","type":"string"}],"name":"addProduct","outputs":[],"stateMutability":"nonpayable","type":"function"},
    {"inputs":[{"internalType":"string","name":"uploaderId","type":"string"},{"internalType":"string","name":"qcCid","type":"string"},{"internalType":"string","name":"batchNumber","type":"string"},{"internalType":"bool","name":"isStandard","type":"bool"}],"name":"addQCSubmission","outputs":[],"stateMutability":"nonpayable","type":"function"},
    {"inputs":[{"internalType":"string","name":"productHash","type":"string"}],"name":"viewProductDetails","outputs":[{"internalType":"string","name":"","type":"string"},{"internalType":"string","name":"","type":"string"},{"internalType":"string","name":"","type":"string"},{"internalType":"string","name":"","type":"string"}],"stateMutability":"view","type":"function"},
    {"inputs":[{"internalType":"string","name":"batchNumber","type":"string"}],"name":"viewProductsByBatch","outputs":[{"internalType":"string[]","name":"","type":"string[]"}],"stateMutability":"view","type":"function"},
    {"inputs":[{"internalType":"string","name":"manufacturerId","type":"string"}],"name":"viewBatchesByManufacturer","outputs":[{"internalType":"string[]","name":"","type":"string[]"}],"stateMutability":"view","type":"function"},
    {"inputs":[],"name":"viewTotalBatches","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"view","type":"function"},
    {"inputs":[{"internalType":"string","name":"manufacturerId","type":"string"}],"name":"viewProductsByManufacturer","outputs":[{"internalType":"string[]","name":"","type":"string[]"}],"stateMutability":"view","type":"function"},
    {"inputs":[],"name":"viewTotalProducts","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"view","type":"function"},
    {"inputs":[],"name":"viewTotalQCSubmissions","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"view","type":"function"},
    {"inputs":[{"internalType":"string","name":"batchNumber","type":"string"}],"name":"viewQCSubmissions","outputs":[{"components":[{"internalType":"string","name":"uploaderId","type":"string"},{"internalType":"string","name":"qcCid","type":"string"},{"internalType":"bool","name":"isStandard","type":"bool"},{"internalType":"uint256","name":"timestamp","type":"uint256"}],"internalType":"struct Counterfeit.QCSubmission[]","name":"","type":"tuple[]"}],"stateMutability":"view","type":"function"},
    {"inputs":[{"internalType":"string","name":"batchNumber","type":"string"}],"name":"checkProductStandard","outputs":[{"internalType":"bool","name":"exists","type":"bool"},{"internalType":"bool","name":"isStandard","type":"bool"}],"stateMutability":"view","type":"function"}
]

contract = w3.eth.contract(address=contract_address, abi=abi)

# ------------------------
# Helper Functions (blockchain tx)
# ------------------------
def sign_and_send_tx(txn):
    signed = w3.eth.account.sign_transaction(txn, private_key)
    tx_hash = w3.eth.send_raw_transaction(signed.raw_transaction)
    receipt = w3.eth.wait_for_transaction_receipt(tx_hash)
    return tx_hash.hex(), receipt

def get_nonce():
    return w3.eth.get_transaction_count(account_address)

# ------------------------
# Pydantic Models
# ------------------------
class ProductRequest(BaseModel):
    productId: str
    productName: str
    mfgName: str
    mfgDate: str
    expiryDate: str
    batchNumber: str
    manufacturerId: str

class BatchRequest(BaseModel):
    manufacturerId: str
    batchNumber: str

class QCRequest(BaseModel):
    uploaderId: str
    qc_file: UploadFile

class HashRequest(BaseModel):
    dataHash: str

class ViewRequest(BaseModel):
    batchNumber: Optional[str] = None
    manufacturerId: Optional[str] = None
    productHash: Optional[str] = None

class ReportRequest(BaseModel):
    userId: str
    productHash: str
    reportDetails: str

# ======================================================================
# 2. ROBUST WATERMARKING HELPER FUNCTIONS
# ======================================================================

def prepare_data(text_to_embed: str) -> np.ndarray:
    if text_to_embed.startswith('0x'):
        text_to_embed = text_to_embed[2:]

    if len(text_to_embed) != 64:
        raise ValueError("dataHash must be 32 bytes (64 hex characters).")

    hash_bytes = bytes.fromhex(text_to_embed)
    rsc = RSCodec(ECC_BYTES)
    encoded_bytes = rsc.encode(hash_bytes)
    bits = np.unpackbits(np.frombuffer(encoded_bytes, dtype=np.uint8))
    if bits.size != PAYLOAD_BIT_LENGTH:
        bits = np.resize(bits, PAYLOAD_BIT_LENGTH)
    return bits.astype(np.uint8)

def embed_watermark(image: np.ndarray, watermark_payload: np.ndarray) -> np.ndarray:
    if image is None:
        raise ValueError("Input image for embedding is None")

    image_yuv = cv2.cvtColor(image, cv2.COLOR_BGR2YUV)
    y_channel, u_channel, v_channel = cv2.split(image_yuv)
    coeffs = pywt.wavedec2(y_channel, WAVELET, level=DWT_LEVEL)
    target_tuple = coeffs[-1]
    target_coeffs = target_tuple[0]
    coeffs_flat = target_coeffs.flatten()

    payload_len = int(watermark_payload.size)
    if payload_len > coeffs_flat.size:
        raise ValueError(f"Watermark ({payload_len} bits) too large for the image's target sub-band ({coeffs_flat.size} coeffs). Use a larger image or reduce ECC_BYTES.")
    
    num_tiles = coeffs_flat.size // payload_len
    for tile_idx in range(num_tiles):
        start = tile_idx * payload_len
        end = start + payload_len
        for i in range(payload_len):
            coeff_index = start + i
            C = coeffs_flat[coeff_index]
            q_idx = int(np.round(C / Q))
            bit = int(watermark_payload[i])
            if bit == 0:
                if q_idx % 2 != 0:
                    q_idx -= 1
            else:
                if q_idx % 2 == 0:
                    q_idx += 1
            coeffs_flat[coeff_index] = q_idx * Q

    embedded_coeffs = coeffs_flat.reshape(target_coeffs.shape)
    coeffs[-1] = (embedded_coeffs, target_tuple[1], target_tuple[2])
    watermarked_y_channel = pywt.waverec2(coeffs, WAVELET)
    watermarked_y_channel = np.clip(watermarked_y_channel, 0, 255).astype(np.uint8)

    if watermarked_y_channel.shape != y_channel.shape:
        watermarked_y_channel = cv2.resize(watermarked_y_channel, (y_channel.shape[1], y_channel.shape[0]))

    watermarked_yuv = cv2.merge([watermarked_y_channel, u_channel, v_channel])
    return cv2.cvtColor(watermarked_yuv, cv2.COLOR_YUV2BGR)

def decode_watermark(watermarked_image: np.ndarray) -> Optional[str]:
    if watermarked_image is None:
        raise ValueError("Input image for decoding is None.")

    watermarked_yuv = cv2.cvtColor(watermarked_image, cv2.COLOR_BGR2YUV)
    watermarked_y, _, _ = cv2.split(watermarked_yuv)
    coeffs = pywt.wavedec2(watermarked_y, WAVELET, level=DWT_LEVEL)
    target_coeffs = coeffs[-1][0].flatten()

    num_tiles = target_coeffs.size // PAYLOAD_BIT_LENGTH
    if num_tiles == 0:
        raise ValueError("Not enough capacity in the image to extract payload. Use a larger image.")

    bit_votes = [[] for _ in range(PAYLOAD_BIT_LENGTH)]
    for tile_idx in range(num_tiles):
        start = tile_idx * PAYLOAD_BIT_LENGTH
        for i in range(PAYLOAD_BIT_LENGTH):
            val = target_coeffs[start + i]
            q_idx = int(np.round(val / Q))
            bit = 1 if (q_idx % 2) != 0 else 0
            bit_votes[i].append(bit)

    extracted_bits = np.array([Counter(v).most_common(1)[0][0] for v in bit_votes], dtype=np.uint8)
    extracted_bytes = np.packbits(extracted_bits).tobytes()

    rsc = RSCodec(ECC_BYTES)
    try:
        decoded = rsc.decode(extracted_bytes)
        if isinstance(decoded, (tuple, list)):
            decoded_bytes = bytes(decoded[0])
        else:
            decoded_bytes = bytes(decoded)
        return "0x" + decoded_bytes.hex()
    except ReedSolomonError:
        return None

# ------------------------
# Create watermark output dir & helper
# ------------------------
WATERMARKED_DIR = "watermarked_images"
os.makedirs(WATERMARKED_DIR, exist_ok=True)

# ------------------------
# API Endpoints (Write Operations)
# ------------------------

@app.post("/add_batch", tags=["Write Operations"])
async def add_batch(data: BatchRequest):
    try:
        txn = contract.functions.addBatch(data.manufacturerId, data.batchNumber).build_transaction({
            "from": account_address,
            "nonce": get_nonce(),
            "gas": 300000,
            "gasPrice": w3.eth.gas_price,
            "chainId": chain_id
        })
        tx_hash, receipt = sign_and_send_tx(txn)
        if receipt.status == 0:
            raise HTTPException(status_code=500, detail="Transaction failed on the blockchain.")
        return {"message": "Batch added successfully", "transaction_hash": tx_hash}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/add_product", tags=["Write Operations"])
async def add_product(data: ProductRequest):
    salt = secrets.token_hex(16)
    product_json = data.dict()
    product_json["salt"] = salt
    product_json["registeredAt"] = datetime.utcnow().isoformat() + "Z"
    product_bytes = json.dumps(product_json, indent=2).encode()

    canonical = f"{data.productId}|{data.batchNumber}|{data.expiryDate}|{salt}"
    product_hash = hashlib.sha256(canonical.encode("utf-8")).hexdigest()

    product_cid = upload_to_ipfs(product_bytes, f"product_{product_hash}.json")
    if not product_cid:
        raise HTTPException(status_code=500, detail="Failed to upload product JSON to IPFS.")
    
    product_uri = f"ipfs://{product_cid}"

    try:
        txn = contract.functions.addProduct(
            product_hash,
            product_uri,
            data.batchNumber,
            data.manufacturerId
        ).build_transaction({
            "from": account_address,
            "nonce": get_nonce(),
            "gas": 500000,
            "gasPrice": w3.eth.gas_price,
            "chainId": chain_id
        })
        tx_hash, receipt = sign_and_send_tx(txn)
        if receipt.status == 0:
            raise HTTPException(status_code=500, detail="Transaction failed on the blockchain. Check if batch exists.")
        return {
            "message": "Product added successfully",
            "productHash": product_hash,
            "productUri": product_uri,
            "transaction_hash": tx_hash
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# ------------------------
# Watermarking Endpoints
# ------------------------
@app.post("/embed_robust_watermark", tags=["Watermarking"])
async def embed_robust_watermark_endpoint(
    request: Request,
    dataHash: str = Form(...),
    file: UploadFile = File(...)
):
    if not file.content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="File must be an image.")

    try:
        payload_bits = prepare_data(dataHash)

        image_stream = await file.read()
        image_array = np.frombuffer(image_stream, np.uint8)
        img_cv2 = cv2.imdecode(image_array, cv2.IMREAD_COLOR)
        if img_cv2 is None:
            raise ValueError("Failed to decode uploaded image.")

        y_channel = cv2.cvtColor(img_cv2, cv2.COLOR_BGR2YUV)
        y_channel = cv2.split(y_channel)[0]
        coeffs_check = pywt.wavedec2(y_channel, WAVELET, level=DWT_LEVEL)
        capacity = coeffs_check[-1][0].size
        if capacity < PAYLOAD_BIT_LENGTH:
            raise HTTPException(status_code=400, detail=f"Image too small for payload: capacity {capacity} bits < required {PAYLOAD_BIT_LENGTH} bits. Use a larger image or reduce ECC_BYTES.")

        watermarked_img = embed_watermark(img_cv2, payload_bits)

        safe_name = os.path.basename(file.filename)
        timestamp = datetime.utcnow().strftime("%Y%m%d%H%M%S%f")
        output_filename = f"watermarked_{timestamp}_{safe_name}.png"
        output_path = os.path.join(WATERMARKED_DIR, output_filename)
        cv2.imwrite(output_path, watermarked_img)

        base_url = str(request.base_url).rstrip("/")
        download_url = f"{base_url}/download/{output_filename}"

        try:
            decoded_hash = decode_watermark(watermarked_img)
            verification_passed = (decoded_hash is not None and decoded_hash.lower() == (("0x" + dataHash.lower().lstrip("0x")).lower()))
        except Exception:
            decoded_hash = None
            verification_passed = False

        return JSONResponse({
            "message": "Watermark embedded successfully",
            "dataHash": dataHash,
            "download_url": download_url,
            "saved_path": output_path,
            "verification_passed": verification_passed,
            "decoded_hash_from_self_check": decoded_hash
        })

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to embed watermark: {str(e)}")

@app.get("/download/{filename}", tags=["Watermarking"])
async def download_file(filename: str):
    filename = os.path.basename(filename)
    file_path = os.path.join(WATERMARKED_DIR, filename)
    if not os.path.exists(file_path):
        raise HTTPException(status_code=404, detail="File not found")
    return FileResponse(file_path, media_type="image/png", filename=filename)

@app.post("/decode_robust_watermark", tags=["Watermarking"])
async def decode_robust_watermark_endpoint(file: UploadFile = File(...)):
    if not file.content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="File must be an image.")

    try:
        image_stream = await file.read()
        image_array = np.frombuffer(image_stream, np.uint8)
        img_cv2 = cv2.imdecode(image_array, cv2.IMREAD_COLOR)
        if img_cv2 is None:
            raise ValueError("Failed to decode image.")

        decoded_hash = decode_watermark(img_cv2)
        if decoded_hash:
            return {"decoded_hash": decoded_hash}
        else:
            raise HTTPException(status_code=404, detail="Watermark not found or is too corrupted to decode.")
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"An error occurred during decoding: {str(e)}")

# ------------------------
# Read operations
# ------------------------

@app.get("/view_product_details/{product_hash}", tags=["Read Operations"])
async def view_product_details(product_hash: str):
    try:
        clean_hash = product_hash.strip().replace('"', '').replace("'", '').lstrip('0x')
        product_details = contract.functions.viewProductDetails(clean_hash).call()
        if not product_details[0]:
            raise HTTPException(status_code=404, detail="Product not found on the blockchain.")

        pid, cid, batch, manufacturer = product_details
        
        ipfs_cid = cid.replace("ipfs://", "")
        ipfs_data = fetch_from_ipfs(ipfs_cid)
        if not ipfs_data:
            raise HTTPException(status_code=500, detail="Failed to retrieve product details from IPFS.")
        
        exists, is_standard = contract.functions.checkProductStandard(batch).call()
        qc_status = "No QC data"
        
        if exists:
            qc_status = "STANDARD ✅" if is_standard else "NOT STANDARD ❌"

        return {
            "productHash": pid,
            "productCid": cid,
            "batchNumber": batch,
            "manufacturerId": manufacturer,
            "productDetailsFromIPFS": ipfs_data,
            "qcStatus": qc_status
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    
@app.get("/view_all_qc_submissions", tags=["Read Operations"])
async def view_all_qc_submissions():
    """
    Retrieves all QC submissions by iterating through a known list of manufacturers.
    Note: This is a workaround as the smart contract does not provide a direct
    function to list all batches across all manufacturers.
    """
    try:
        all_submissions = []
        # Predefined list of manufacturer IDs to iterate through
        manufacturer_ids = ["MANU001", "MANU002"] # Add more as needed
        
        processed_batches = set()

        for manufacturerId in manufacturer_ids:
            batch_list = contract.functions.viewBatchesByManufacturer(manufacturerId).call()
            candidate_batches = sorted(set(batch_list))
            
            for batch_num in candidate_batches:
                if batch_num in processed_batches:
                    continue # Skip if already processed
                
                submissions = contract.functions.viewQCSubmissions(batch_num).call()
                for submission in submissions:
                    uploader_id, cid, is_standard, timestamp = submission
                    ipfs_cid = cid.replace("ipfs://", "")
                    qc_data = fetch_from_ipfs(ipfs_cid)
                    gateway_url = f"https://ipfs.io/ipfs/{ipfs_cid}"
                    
                    submission_details = {
                        "uploaderId": uploader_id,
                        "qcCid": cid,
                        "isStandard": is_standard,
                        "timestamp": timestamp,
                        "batchNumber": batch_num,
                        "qcDetailsFromIPFS": qc_data if qc_data else "Could not retrieve JSON from IPFS.",
                        "qcGatewayUrl": gateway_url
                    }
                    all_submissions.append(submission_details)
                
                processed_batches.add(batch_num)

        return {"qcSubmissions": all_submissions}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/view_products_by_batch", tags=["Read Operations"])
async def view_products_by_batch(data: BatchRequest):
    try:
        product_hashes = contract.functions.viewProductsByBatch(data.batchNumber).call()
        return {"batchNumber": data.batchNumber, "productHashes": product_hashes}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/view_products_by_manufacturer", tags=["Read Operations"])
async def view_products_by_manufacturer(data: BatchRequest):
    try:
        product_hashes = contract.functions.viewProductsByManufacturer(data.manufacturerId).call()
        return {"manufacturerId": data.manufacturerId, "productHashes": product_hashes}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    
@app.post("/view_batches_by_manufacturer", tags=["Read Operations"])
async def view_batches_by_manufacturer(data: BatchRequest):
    try:
        batch_numbers = contract.functions.viewBatchesByManufacturer(data.manufacturerId).call()
        return {"manufacturerId": data.manufacturerId, "batchNumbers": batch_numbers}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/view_totals", tags=["Read Operations"])
async def view_totals():
    try:
        return {
            "totalBatches": int(contract.functions.viewTotalBatches().call()),
            "totalProducts": int(contract.functions.viewTotalProducts().call()),
            "totalQCSubmissions": int(contract.functions.viewTotalQCSubmissions().call())
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# ======================================================================
# 3. Firebase setup, QC parsing, notifications, verification
# ======================================================================

_FIREBASE_READY = False
_db = None

def _init_firebase_once():
    global _FIREBASE_READY, _db
    if _FIREBASE_READY:
        return
    if not _FBASE_OK_IMPORT:
        print("⚠ firebase_admin not installed; push notifications disabled.")
        return
    try:
        sa_path = os.getenv("FIREBASE_SERVICE_ACCOUNT_JSON") or os.getenv("GOOGLE_APPLICATION_CREDENTIALS")
        if sa_path and os.path.exists(sa_path):
            cred = credentials.Certificate(sa_path)
            if not firebase_admin._apps:
                firebase_admin.initialize_app(cred)
        else:
            if not firebase_admin._apps:
                firebase_admin.initialize_app()
        _db = firestore.client()
        _FIREBASE_READY = True
        print("✅ Firebase initialized.")
    except Exception as e:
        print(f"❌ Firebase init failed: {e}")

def _send_push_to_token(token: str, title: str, body: str, data: Optional[Dict[str, str]] = None):
    if not _FIREBASE_READY:
        return
    try:
        msg = messaging.Message(
            notification=messaging.Notification(title=title, body=body),
            data=data or {},
            token=token
        )
        resp = messaging.send(msg)
        print(f"✅ Push sent to token: {resp}")
    except Exception as e:
        print(f"❌ Push send error: {e}")

async def _notify_users_of_failed_batch(batch_id: str):
    _init_firebase_once()
    if not _FIREBASE_READY:
        print("Firebase is not initialized. Cannot send notifications.")
        return 0

    user_ids = set()
    try:
        scans_ref = _db.collection('scans')
        query_results = scans_ref.where('batchNumber', '==', batch_id).stream()
        
        for doc in query_results:
            user_id = doc.to_dict().get('userId')
            if user_id:
                user_ids.add(user_id)
    except Exception as e:
        print(f"Error querying Firestore for user IDs: {e}")
        return 0

    if not user_ids:
        print(f"No users found with products from batch {batch_id}.")
        return 0

    tokens = []
    try:
        users_ref = _db.collection('users')
        for user_id in user_ids:
            user_doc = users_ref.document(user_id).get()
            if user_doc.exists:
                fcm_token = user_doc.to_dict().get('fcmToken')
                if fcm_token:
                    tokens.append(fcm_token)
    except Exception as e:
        print(f"Error retrieving FCM tokens: {e}")
        return 0

    if not tokens:
        print("No FCM tokens found for the users.")
        return 0
    
    title = "QC Alert: Product Failure"
    body = f"A product you own from batch {batch_id} has failed a recent quality control check. It is not considered safe to consume."
    
    for t in tokens:
        _send_push_to_token(
            t,
            title=title,
            body=body,
            data={"batchId": batch_id, "qcStatus": "NOT_STANDARD"}
        )
    
    return len(tokens)

async def _check_expiries_and_notify():
    _init_firebase_once()
    if not _FIREBASE_READY:
        print("Firebase not ready. Skipping expiry check.")
        return

    today = datetime.now()
    one_month_from_now = today + timedelta(days=30)

    try:
        scans_ref = _db.collection('scans')
        query_results = scans_ref.stream()

        for doc in query_results:
            scan_data = doc.to_dict()
            expiry_date_str = scan_data.get('expiryDate')
            user_id = scan_data.get('userId')
            product_name = scan_data.get('productName')

            if not expiry_date_str or not user_id or not product_name:
                continue

            try:
                expiry_date = datetime.strptime(expiry_date_str, '%Y-%m-%d')
                if today < expiry_date <= one_month_from_now:
                    user_doc = _db.collection('users').document(user_id).get()
                    if user_doc.exists:
                        fcm_token = user_doc.to_dict().get('fcmToken')
                        if fcm_token:
                            _send_push_to_token(
                                fcm_token,
                                title='Product Expiry Alert',
                                body=f'Your {product_name} is expiring on {expiry_date_str}!',
                                data={'productId': doc.id, 'alertType': 'expiry'}
                            )
            except ValueError as e:
                print(f"Invalid date format for product {doc.id}: {e}")

    except Exception as e:
        print(f"Error during expiry check: {e}")

def _normalize_passfail(val: Any) -> str:
    s = str(val).strip().upper()
    s = s.replace("✅", "").replace("❌", "").strip()
    if s in ["PASS", "P", "OK", "TRUE", "1", "YES", "Y"]:
        return "PASS"
    return "FAIL" if s in ["FAIL", "F", "NO", "N", "0", "FALSE"] else s

def _normalize_qc_item(item: Dict[str, Any]) -> Dict[str, Any]:
    key_map = {
        "productBatch": "productBatch",
        "product_batch": "productBatch",
        "Batch ID": "productBatch",
        "BatchId": "productBatch",
        "Batch": "productBatch",
        "batch_id": "productBatch",
        "status": "PassFail",
        "PassFail": "PassFail",
        "Pass/Fail": "PassFail",
        "Result": "PassFail",
        "isStandard": "PassFail"
    }
    normalized = {}
    for k, v in item.items():
        if k in key_map:
            nk = key_map[k]
            normalized[nk] = v
        if k == "qcResults" and isinstance(v, dict):
            if "Pass" in v.values() or "pass" in v.values():
                normalized["PassFail"] = "PASS"
            if "Fail" in v.values() or "fail" in v.values():
                normalized["PassFail"] = "FAIL"
    for key, val in item.items():
        if isinstance(val, dict):
            if "qcResults" in val and isinstance(val["qcResults"], dict):
                if any(x.lower() == "fail" for x in val["qcResults"].values()):
                    normalized["PassFail"] = "FAIL"
                    break
                elif any(x.lower() == "pass" for x in val["qcResults"].values()):
                    if "PassFail" not in normalized or normalized["PassFail"] != "FAIL":
                        normalized["PassFail"] = "PASS"
    return normalized

def _parse_qc_file_to_json(file_bytes: bytes, filename: str) -> List[Dict[str, Any]]:
    lower = filename.lower()
    rows: List[Dict[str, Any]] = []

    if lower.endswith(".json"):
        try:
            data = json.loads(file_bytes.decode("utf-8"))
            if isinstance(data, dict) and "qcSubmissions" in data:
                data = data["qcSubmissions"]
            if isinstance(data, dict):
                data = [data]
            if not isinstance(data, list):
                raise ValueError("JSON must be an array or object.")
            rows = [ _normalize_qc_item(r) for r in data ]
        except Exception as e:
            raise HTTPException(status_code=400, detail=f"Invalid JSON: {e}")
    elif lower.endswith(".csv"):
        try:
            csv_text = file_bytes.decode("utf-8")
            reader = csv.DictReader(StringIO(csv_text))
            for r in reader:
                rows.append(_normalize_qc_item(r))
        except Exception as e:
            raise HTTPException(status_code=400, detail=f"Invalid CSV: {e}")
    elif lower.endswith(".xlsx") or lower.endswith(".xls"):
        if not _PANDAS_OK:
            raise HTTPException(status_code=400, detail="XLS/XLSX provided but pandas is not installed on server.")
        try:
            df = pd.read_excel(BytesIO(file_bytes))
            rows = [ _normalize_qc_item(r) for r in df.to_dict(orient="records") ]
        except Exception as e:
            raise HTTPException(status_code=400, detail=f"Invalid Excel: {e}")
    else:
        raise HTTPException(status_code=400, detail="Unsupported file type. Upload JSON, CSV, or XLSX.")

    for idx, r in enumerate(rows):
        if "productBatch" not in r:
            if "product_batch" in r:
                r["productBatch"] = r["product_batch"]
            elif "Batch ID" in r:
                r["productBatch"] = r["Batch ID"]
            elif "BatchId" in r:
                r["productBatch"] = r["BatchId"]
            elif "Batch" in r:
                r["productBatch"] = r["Batch"]
            elif "batch_id" in r:
                r["productBatch"] = r["batch_id"]
            else:
                raise HTTPException(status_code=400, detail=f"Row {idx} missing key 'productBatch' after normalization.")
        
        if "PassFail" not in r:
            normalized_row = _normalize_qc_item(r)
            if "PassFail" not in normalized_row:
                raise HTTPException(status_code=400, detail=f"Row {idx} missing key 'PassFail' after normalization.")
            r = normalized_row

        r["PassFail"] = _normalize_passfail(r["PassFail"])
    return rows

@app.post("/verify", tags=["Watermark + Verification"])
async def verify_unified(file: UploadFile = File(...)):
    if not file.content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="File must be an image.")
    try:
        image_stream = await file.read()
        image_array = np.frombuffer(image_stream, np.uint8)
        img_cv2 = cv2.imdecode(image_array, cv2.IMREAD_COLOR)
        if img_cv2 is None:
            raise ValueError("Failed to decode image.")
        decoded_hash = decode_watermark(img_cv2)
        if not decoded_hash:
            return {
                "status": "COUNTERFEIT_OR_DAMAGED ❌",
                "decodedHash": None,
                "batchId": None,
                "qcStatus": "Unknown",
                "productDetails": None
            }
        clean_hash = decoded_hash.lstrip("0x").lower()
        product_details = contract.functions.viewProductDetails(clean_hash).call()
        if not product_details[0]:
            return {
                "status": "COUNTERFEIT ❌",
                "decodedHash": decoded_hash,
                "batchId": None,
                "qcStatus": "Unknown",
                "productDetails": None
            }
        pid, cid, batch, manufacturer = product_details
        exists, is_standard = contract.functions.checkProductStandard(batch).call()
        qc_status = "No QC data"
        if exists:
            qc_status = "STANDARD ✅" if is_standard else "NOT STANDARD ❌"
        ipfs_cid = cid.replace("ipfs://", "")
        ipfs_data = fetch_from_ipfs(ipfs_cid)
        if qc_status == "STANDARD ✅":
            overall = "SAFE_TO_EAT ✅"
        elif qc_status == "NOT STANDARD ❌":
            overall = "QC_FAIL ❌"
        else:
            overall = "AUTHENTIC ✅"
        return {
            "status": overall,
            "decodedHash": decoded_hash,
            "batchId": batch,
            "qcStatus": qc_status,
            "productDetails": {
                "productId": pid,
                "productCid": cid,
                "manufacturerId": manufacturer,
                "ipfs": ipfs_data
            }
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Verification failed: {str(e)}")

# ======================================================================
# 4. NEW: REPORTING API ENDPOINTS
# ======================================================================
@app.post("/add_report", tags=["Reporting"])
async def add_report(report: ReportRequest):
    _init_firebase_once()
    if not _FIREBASE_READY:
        raise HTTPException(status_code=500, detail="Firebase is not initialized.")
    try:
        report_data = {
            "userId": report.userId,
            "productHash": report.productHash,
            "reportDetails": report.reportDetails,
            "timestamp": firestore.SERVER_TIMESTAMP,
            "status": "pending"
        }
        _db.collection("reports").add(report_data)
        return {"message": "Report submitted successfully."}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to submit report: {str(e)}")

@app.get("/view_reports", tags=["Reporting"])
async def view_reports():
    _init_firebase_once()
    if not _FIREBASE_READY:
        raise HTTPException(status_code=500, detail="Firebase is not initialized.")
    try:
        reports_ref = _db.collection("reports")
        reports = []
        for doc in reports_ref.stream():
            report_data = doc.to_dict()
            report_data['id'] = doc.id
            reports.append(report_data)
        return {"reports": reports}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to retrieve reports: {str(e)}")

@app.delete("/delete_report/{report_id}", tags=["Reporting"])
async def delete_report(report_id: str):
    _init_firebase_once()
    if not _FIREBASE_READY:
        raise HTTPException(status_code=500, detail="Firebase is not initialized.")
    try:
        report_ref = _db.collection("reports").document(report_id)
        await report_ref.delete()
        return {"message": f"Report {report_id} deleted successfully."}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to delete report: {str(e)}")
@app.post("/approve_report/{report_id}", tags=["Reporting"])
async def approve_report(report_id: str):
    """
    Approves a report by updating its status to 'approved' in Firestore.
    """
    _init_firebase_once()
    if not _FIREBASE_READY:
        raise HTTPException(status_code=500, detail="Firebase is not initialized.")
    try:
        report_ref = _db.collection("reports").document(report_id)
        report_data = report_ref.get()

        if not report_data.exists:
            raise HTTPException(status_code=404, detail="Report not found.")

        report_ref.update({"status": "approved", "approvedAt": firestore.SERVER_TIMESTAMP})
        
        return {"message": f"Report {report_id} approved successfully."}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to approve report: {str(e)}")

# ======================================================================
# 5. NEW: COMBINED QC SUBMISSION ENDPOINT
# ======================================================================

@app.post("/add_qc_submission", tags=["Write Operations"])
async def add_qc_submission(
    uploaderId: str = Form(...),
    uploadDate: str = Form(...),
    qc_file: UploadFile = File(...),
):
    raw_bytes = await qc_file.read()
    qc_rows = _parse_qc_file_to_json(raw_bytes, qc_file.filename)
    batch_numbers = sorted(list(set(r["productBatch"] for r in qc_rows)))
    if not batch_numbers:
        raise HTTPException(status_code=400, detail="No valid batch numbers found in the QC file.")
    payload = {
        "meta": {
            "uploaderId": uploaderId,
            "uploadDate": uploadDate,
            "sourceFilename": qc_file.filename
        },
        "qc": qc_rows
    }
    payload_bytes = json.dumps(payload, indent=2).encode("utf-8")
    qc_cid = upload_to_ipfs(payload_bytes, f"qc_{datetime.utcnow().strftime('%Y%m%d%H%M%S')}.json")
    if not qc_cid:
        raise HTTPException(status_code=500, detail="Failed to upload QC JSON to IPFS.")
    qc_uri = f"ipfs://{qc_cid}"
    
    try:
        for batch_num in batch_numbers:
            batch_is_standard = all(_normalize_passfail(r["PassFail"]) == "PASS" for r in qc_rows if r["productBatch"] == batch_num)
            
            current_nonce = get_nonce()

            txn = contract.functions.addQCSubmission(
                uploaderId, 
                qc_uri, 
                batch_num, 
                batch_is_standard
            ).build_transaction({
                "from": account_address,
                "nonce": current_nonce,
                "gas": 300000,
                "gasPrice": w3.eth.gas_price,
                "chainId": chain_id
            })
            tx_hash, receipt = sign_and_send_tx(txn)
            if receipt.status == 0:
                raise HTTPException(status_code=500, detail=f"Transaction failed on the blockchain for batch {batch_num}.")
            
            if not batch_is_standard:
                await _notify_users_of_failed_batch(batch_num)
                
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
        
    return {
        "message": "QC submission added successfully",
        "uploaderId": uploaderId,
        "uploadDate": uploadDate,
        "qcUri": qc_uri,
        "batchesProcessed": batch_numbers,
        "transaction_hash": tx_hash
    }

@app.get("/check_expiries")
async def check_expiries():
    """
    Manually triggers the expiry date notification check.
    For testing purposes. In a production environment, this would be a scheduled task.
    """
    await _check_expiries_and_notify()
    return {"message": "Expiry check initiated."}


# ------------------------
# Run server
# ------------------------
if __name__ == "__main__":
    import uvicorn
    _init_firebase_once()
    uvicorn.run("submit_to_chain:app", host="0.0.0.0", port=8000, reload=True)