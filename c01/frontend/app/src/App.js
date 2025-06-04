import React, { useState, useEffect } from 'react';
import './App.css';

function App() {
  const [image, setImage] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const [aesKey, setAesKey] = useState('');
  const [operation, setOperation] = useState('encrypt');
  const [message, setMessage] = useState('');
  const [processedImages, setProcessedImages] = useState([]);

  useEffect(() => {
    let mounted = true;
    const fetchPictures = async () => {
      try {
        const res = await fetch('http://localhost:4000/pictures');
        if (!res.ok) return;
        const rows = await res.json();
        if (!mounted) return;
        setProcessedImages(rows.map(r => ({ id: r.id, type: r.type })));
      } catch (err) {
        console.error(err);
      }
    };

    fetchPictures();
    const interval = setInterval(fetchPictures, 5000);
    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, []);

  const handleImageChange = (e) => {
    const file = e.target.files[0];
    setImage(file);
    setMessage('');
    if (file) {
      setImagePreview(URL.createObjectURL(file));
    } else {
      setImagePreview(null);
    }
  };

  const handleKeyChange = (e) => {
    setAesKey(e.target.value);
    setMessage('');
  };

  const handleOperationChange = (e) => {
    setOperation(e.target.value);
    setMessage('');
  };

  const isValidHex = (str) => /^[0-9a-f]{32}$/i.test(str);

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!image) {
      setMessage('Please select an image.');
      return;
    }

    if (aesKey.length !== 32) {
      setMessage('AES key must be exactly 32 hexadecimal characters.');
      return;
    }

    if (!isValidHex(aesKey)) {
      setMessage('AES key must use only hexadecimal characters.');
      return;
    }

    // Convert hex string to bytes
    const keyBytes = new Uint8Array(16);
    for (let i = 0; i < 16; i++) {
      keyBytes[i] = parseInt(aesKey.substr(i * 2, 2), 16);
    }

    const formData = new FormData();
    formData.append('photo', image);
    formData.append('aesKey', new Blob([keyBytes], { type: 'application/octet-stream' }), 'aesKey.bin');
    formData.append('operation', operation);

    try {
      const res = await fetch('http://localhost:8080/encrypt', {
        method: 'POST',
        body: formData,
      });

      if (res.ok) {
        const data = await res.text();
        setMessage(`${operation.charAt(0).toUpperCase() + operation.slice(1)}ion successful!`);

        setProcessedImages((prev) => [
          ...prev,
          { id: data.id, type: operation }
        ]);
      } else {
        setMessage('Failed to process the image.');
      }
    } catch (err) {
      setMessage('Error: ' + err.message);
    }
  };
const handleRowClick = (id) => {
    // Open the image in a new tab (browser will display or download it)
    window.open(`http://localhost:4000/pictures/${id}`, '_blank');
  };

  return (
    <div className="App">
      <h1>AES Image Uploader</h1>
      <form onSubmit={handleSubmit}>
        <label htmlFor="photo" style={{ fontWeight: 'bold' }}>Select an image:</label><br />
        <input id="photo" type="file" accept="image/*" onChange={handleImageChange} />
        <br /><br />

        {imagePreview && (
          <div>
            <strong>Preview:</strong><br />
            <img src={imagePreview} alt="Preview" style={{ maxWidth: '300px', border: '1px solid #ccc', marginBottom: '1rem' }} />
          </div>
        )}

        <label htmlFor="aesKey" style={{ fontWeight: 'bold' }}>Enter 32-character AES Key:</label><br />
        <input
          id="aesKey"
          type="text"
          placeholder="Enter AES Key"
          value={aesKey}
          onChange={handleKeyChange}
          style={{
            width: '400px',
            padding: '6px',
            fontFamily: 'monospace'
          }}
        />
        <br /><br />

        <label htmlFor="operation" style={{ fontWeight: 'bold' }}>Select operation:</label><br />
        <select
          id="operation"
          value={operation}
          onChange={handleOperationChange}
          style={{ padding: '8px', marginBottom: '20px', border: '1px solid black', borderRadius: '4px' }}
        >
          <option value="encrypt">Encrypt</option>
          <option value="decrypt">Decrypt</option>
        </select>
        <br /><br />

        <button
          type="submit"
          className="encrypt-button"
          style={{
            fontWeight: 'bold',
            fontSize: '1.2em',
            backgroundColor: '#007bff',
            color: 'white',
            padding: '10px 20px',
            border: '2px solid black',
            borderRadius: '6px',
            cursor: 'pointer'
          }}
        >
          {operation === 'encrypt' ? 'Encrypt Image' : 'Decrypt Image'}
        </button>
      </form>
      <p>{message}</p>

      <div style={{ marginTop: '2rem' }}>
        <h2>Processed Images</h2>
        <table style={{ borderCollapse: 'collapse', width: '100%' }}>
         <thead>
          <tr>
          <th style={{ border: '1px solid #ddd', padding: '8px', textAlign: 'center' }}>ID</th>
          </tr>
        </thead>

          <tbody>
            {processedImages.map((item, index) => (
              <tr key={index}
 		onClick={() => handleRowClick(item.id)}
                style={{ cursor: 'pointer' }}>
                <td style={{ border: '1px solid #ddd', padding: '8px' }}>
                  {`${item.type.charAt(0).toUpperCase() + item.type.slice(1)}-${item.id}`}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default App;
