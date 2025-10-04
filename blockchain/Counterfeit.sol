// SPDX-License-Identifier: MIT

pragma solidity ^0.8.20;

contract Counterfeit {
    // --------------------------
    // Structs
    // --------------------------
    struct Product {
        string productHash;
        string productCid;
        string batchNumber;
        string manufacturerId;
    }

    struct QCSubmission {
        string uploaderId;
        string qcCid;
        bool isStandard;
        uint256 timestamp;
    }

    // --------------------------
    // Storage
    // --------------------------
    mapping(string => Product) private products;
    // productHash => Product
    mapping(string => string[]) private batchProducts;
    // batchNumber => productHashes
    mapping(string => string[]) private manufacturerProducts;
    // manufacturerId => productHashes
    mapping(string => string[]) private manufacturerBatches;
    // manufacturerId => batchNumbers

    mapping(string => QCSubmission[]) private qcSubmissions;
    // batchNumber => QCSubmission[]
    mapping(string => bool) public latestQCResult;
    // batchNumber => last QC status
    mapping(string => bool) public qcExists;
    // track whether QC exists for batch

    uint256 public totalProducts;
    uint256 public totalBatches;
    uint256 public totalQCSubmissions;

    // --------------------------
    // Events
    // --------------------------
    event ProductAdded(string productHash, string productCid, string batchNumber, string manufacturerId);
    event BatchAdded(string manufacturerId, string batchNumber);
    event QCSubmitted(string uploaderId, string qcCid, bool isStandard, string batchNumber);

    // --------------------------
    // Add Functions
    // --------------------------
    function addBatch(string memory manufacturerId, string memory batchNumber) public {
        manufacturerBatches[manufacturerId].push(batchNumber);
        totalBatches++;
        emit BatchAdded(manufacturerId, batchNumber);
    }

    function addProduct(
        string memory productHash,
        string memory productCid,
        string memory batchNumber,
        string memory manufacturerId
    ) public {
        Product memory p = Product(productHash, productCid, batchNumber, manufacturerId);
        products[productHash] = p;
        batchProducts[batchNumber].push(productHash);
        manufacturerProducts[manufacturerId].push(productHash);
        totalProducts++;
        emit ProductAdded(productHash, productCid, batchNumber, manufacturerId);
    }

    function addQCSubmission(
        string memory uploaderId,
        string memory qcCid,
        string memory batchNumber,
        bool isStandard
    ) public {
        QCSubmission memory submission = QCSubmission({
            uploaderId: uploaderId,
            qcCid: qcCid,
            isStandard: isStandard,
            timestamp: block.timestamp
        });
        qcSubmissions[batchNumber].push(submission);
        latestQCResult[batchNumber] = isStandard;
        qcExists[batchNumber] = true;
        totalQCSubmissions++;

        emit QCSubmitted(uploaderId, qcCid, isStandard, batchNumber);
    }

    // --------------------------
    // View Functions
    // --------------------------
    function viewProductDetails(string memory productHash) public view returns (
        string memory, string memory, string memory, string memory
    ) {
        Product memory p = products[productHash];
        return (p.productHash, p.productCid, p.batchNumber, p.manufacturerId);
    }

    function viewProductsByBatch(string memory batchNumber) public view returns (string[] memory) {
        return batchProducts[batchNumber];
    }

    function viewProductsByManufacturer(string memory manufacturerId) public view returns (string[] memory) {
        return manufacturerProducts[manufacturerId];
    }

    function viewBatchesByManufacturer(string memory manufacturerId) public view returns (string[] memory) {
        return manufacturerBatches[manufacturerId];
    }

    function viewQCSubmissions(string memory batchNumber) public view returns (QCSubmission[] memory) {
        return qcSubmissions[batchNumber];
    }

    function viewTotalProducts() public view returns (uint256) {
        return totalProducts;
    }

    function viewTotalBatches() public view returns (uint256) {
        return totalBatches;
    }

    function viewTotalQCSubmissions() public view returns (uint256) {
        return totalQCSubmissions;
    }

    // --------------------------
    // QC Standard Check
    // --------------------------
    function checkProductStandard(string memory batchNumber) public view returns (bool exists, bool isStandard) {
        if (!qcExists[batchNumber]) {
            return (false, true);
        }
        return (true, latestQCResult[batchNumber]);
    }
}