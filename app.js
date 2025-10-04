import React, { useState } from "react";

export default function App() {
  const [batchData, setBatchData] = useState({ manufacturerId: "", batchNumber: "" });
  const [productData, setProductData] = useState({
    productId: "",
    productName: "",
    mfgName: "",
    mfgDate: "",
    expiryDate: "",
    batchNumber: "",
    manufacturerId: "",
  });
  const [message, setMessage] = useState("");

  const handleBatchSubmit = async (e) => {
    e.preventDefault();
    try {
      const res = await fetch("http://localhost:8000/add_batch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(batchData),
      });
      const data = await res.json();
      setMessage(data.message || JSON.stringify(data));
    } catch (err) {
      setMessage("Error: " + err.message);
    }
  };

  const handleProductSubmit = async (e) => {
    e.preventDefault();
    try {
      const res = await fetch("http://localhost:8000/add_product", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(productData),
      });
      const data = await res.json();
      setMessage(data.message || JSON.stringify(data));
    } catch (err) {
      setMessage("Error: " + err.message);
    }
  };

  return (
    <div className="min-h-screen bg-gray-100 flex flex-col items-center p-6">
      <h1 className="text-2xl font-bold mb-6">Blockchain Product Manager</h1>

      {/* Add Batch Form */}
      <form onSubmit={handleBatchSubmit} className="bg-white p-6 rounded-2xl shadow-md w-full max-w-md mb-8">
        <h2 className="text-lg font-semibold mb-4">Add Batch</h2>
        <input
          type="text"
          placeholder="Manufacturer ID"
          className="border p-2 w-full mb-3 rounded"
          value={batchData.manufacturerId}
          onChange={(e) => setBatchData({ ...batchData, manufacturerId: e.target.value })}
          required
        />
        <input
          type="text"
          placeholder="Batch Number"
          className="border p-2 w-full mb-3 rounded"
          value={batchData.batchNumber}
          onChange={(e) => setBatchData({ ...batchData, batchNumber: e.target.value })}
          required
        />
        <button type="submit" className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600">
          Add Batch
        </button>
      </form>

      {/* Add Product Form */}
      <form onSubmit={handleProductSubmit} className="bg-white p-6 rounded-2xl shadow-md w-full max-w-md mb-8">
        <h2 className="text-lg font-semibold mb-4">Add Product</h2>
        {Object.keys(productData).map((field) => (
          <input
            key={field}
            type="text"
            placeholder={field}
            className="border p-2 w-full mb-3 rounded"
            value={productData[field]}
            onChange={(e) => setProductData({ ...productData, [field]: e.target.value })}
            required
          />
        ))}
        <button type="submit" className="bg-green-500 text-white px-4 py-2 rounded hover:bg-green-600">
          Add Product
        </button>
      </form>

      {/* Response */}
      {message && (
        <div className="bg-gray-800 text-white p-4 rounded-lg max-w-md text-sm">
          {message}
        </div>
      )}
    </div>
  );
}
