import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

const LotImage = () => {
  const navigate = useNavigate();
  const [lotNumber, setLotNumber] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [searchedLot, setSearchedLot] = useState('');
  const [imageLoadError, setImageLoadError] = useState(false);

  // Google Sheets Configuration
  const API_KEY = 'AIzaSyAomDFBkOySlIxKWSKGHe6ATv9gvaBr7uk';
  const SHEET_ID = '1yHVieyNb7A5rds3oBEaUlfxxgG04QetLpb8T9g_xQPw';
  const SHEET_NAME = 'Sheet34';
  const RANGE = 'B:C'; // Column B = LOT NO, Column C = PICS

  // Function to extract file ID and generate working URL using proxy
  const getWorkingImageUrl = (driveUrl) => {
    if (!driveUrl) return null;
    
    console.log('Processing URL:', driveUrl);
    
    // Extract file ID from various Google Drive URL formats
    let fileId = null;
    
    const patterns = [
      /\/d\/([^/]+)/,                    // Format: /d/FILE_ID
      /id=([^&]+)/,                       // Format: id=FILE_ID
      /\/file\/d\/([^/]+)/,              // Format: /file/d/FILE_ID
      /uc\?id=([^&]+)/,                  // Format: uc?id=FILE_ID
      /\/u\/\d+\/d\/([^/]+)/,            // Format: /u/0/d/FILE_ID
    ];
    
    for (const pattern of patterns) {
      const match = driveUrl.match(pattern);
      if (match && match[1]) {
        fileId = match[1];
        break;
      }
    }
    
    if (fileId) {
      // Clean the file ID (remove any extra parameters)
      fileId = fileId.split('?')[0].split('&')[0];
      console.log('Extracted file ID:', fileId);
      
      // Use images.weserv.nl proxy service to bypass Google Drive hotlink protection
      // This is the most reliable method that worked in testing
      const proxyUrl = `https://images.weserv.nl/?url=${encodeURIComponent(`https://drive.google.com/uc?export=view&id=${fileId}`)}`;
      console.log('Generated proxy URL:', proxyUrl);
      return proxyUrl;
    }
    
    console.log('Could not extract file ID from URL');
    return null;
  };

  // Function to fetch data from Google Sheets
  const fetchLotImage = async () => {
    if (!lotNumber.trim()) {
      setError('Please enter a lot number');
      return;
    }

    setLoading(true);
    setError('');
    setImageUrl('');
    setSearchedLot('');
    setImageLoadError(false);

    try {
      // Build the Google Sheets API URL
      const url = `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}/values/${SHEET_NAME}!${RANGE}?key=${API_KEY}`;
      
      console.log('Fetching from URL:', url);
      const response = await fetch(url);
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const data = await response.json();
      console.log('Sheet data received');
      
      const rows = data.values;
      
      if (!rows || rows.length === 0) {
        throw new Error('No data found in the sheet');
      }
      
      console.log(`Total rows found: ${rows.length}`);
      
      // Search for the lot number (case-insensitive, trim whitespace)
      const searchLot = lotNumber.toString().trim();
      const foundRow = rows.find(row => {
        if (!row[0]) return false;
        const sheetLot = row[0].toString().trim();
        return sheetLot.toLowerCase() === searchLot.toLowerCase();
      });
      
      if (foundRow && foundRow[1]) {
        console.log('Match found! Lot:', foundRow[0]);
        console.log('Original image URL from sheet:', foundRow[1]);
        
        setSearchedLot(foundRow[0]);
        
        // Generate working image URL using proxy
        const workingUrl = getWorkingImageUrl(foundRow[1]);
        
        if (workingUrl) {
          setImageUrl(workingUrl);
          console.log('✅ Working image URL generated');
        } else {
          setImageLoadError(true);
          setError('Invalid Google Drive URL format. Please check the URL in your sheet.');
        }
      } else {
        console.log(`Lot number "${lotNumber}" not found in sheet`);
        setError(`Lot number "${lotNumber}" not found. Please check and try again.`);
      }
      
    } catch (err) {
      console.error('Error fetching data:', err);
      setError(`Unable to fetch data: ${err.message}. Please check your API key and sheet ID.`);
    } finally {
      setLoading(false);
    }
  };

  // Handle form submission
  const handleSubmit = (e) => {
    e.preventDefault();
    fetchLotImage();
  };

  // Handle enter key press
  const handleKeyPress = (e) => {
    if (e.key === 'Enter') {
      fetchLotImage();
    }
  };

  // Handle image load error
  const handleImageError = () => {
    setImageLoadError(true);
    console.error('Image failed to load in img tag');
  };

  // Handle back navigation
  const handleGoBack = () => {
    navigate(-1); // Go back to previous page
  };

  // Add keyframes animation
  useEffect(() => {
    const styleSheet = document.createElement("style");
    styleSheet.textContent = `
      @keyframes spin {
        to { transform: rotate(360deg); }
      }
      @keyframes fadeIn {
        from {
          opacity: 0;
          transform: translateY(10px);
        }
        to {
          opacity: 1;
          transform: translateY(0);
        }
      }
      @keyframes slideIn {
        from {
          opacity: 0;
          transform: translateX(-20px);
        }
        to {
          opacity: 1;
          transform: translateX(0);
        }
      }
    `;
    document.head.appendChild(styleSheet);
    
    return () => {
      document.head.removeChild(styleSheet);
    };
  }, []);

  // Styles with Royal Amethyst Plum Theme: rgb(72 26 123)
  const brand = 'rgb(72, 26, 123)';
  const brandGradient = 'linear-gradient(135deg, rgb(72, 26, 123) 0%, rgb(105, 38, 180) 100%)';

  const styles = {
    container: {
      maxWidth: '460px',
      margin: '0 auto',
      padding: '16px 12px',
      minHeight: '100vh',
      background: 'linear-gradient(180deg, #fdfbfc 0%, #f7f3fb 50%, #eee8f6 100%)',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      boxSizing: 'border-box',
    },
    card: {
      backgroundColor: '#ffffff',
      borderRadius: '24px',
      boxShadow: '0 12px 36px -4px rgba(72, 26, 123, 0.08), 0 2px 4px rgba(72, 26, 123, 0.02)',
      border: '1px solid rgba(72, 26, 123, 0.1)',
      overflow: 'hidden',
      padding: '24px 18px 30px',
    },
    header: {
      display: 'flex',
      alignItems: 'center',
      gap: '14px',
      marginBottom: '24px',
      position: 'relative',
    },
    backButton: {
      width: '38px',
      height: '38px',
      borderRadius: '9999px',
      background: 'rgba(72, 26, 123, 0.06)',
      border: '1px solid rgba(72, 26, 123, 0.15)',
      cursor: 'pointer',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      transition: 'all 0.2s ease',
      boxShadow: '0 1px 3px rgba(0, 0, 0, 0.03)',
    },
    backButtonHover: {
      background: 'rgba(72, 26, 123, 0.12)',
      transform: 'scale(0.96)',
    },
    backIcon: {
      width: '10px',
      height: '10px',
      borderLeft: `2px solid ${brand}`,
      borderBottom: `2px solid ${brand}`,
      transform: 'rotate(45deg)',
      marginLeft: '3px',
    },
    titleContainer: {
      flex: 1,
      textAlign: 'center',
    },
    title: {
      fontSize: '22px',
      fontWeight: '800',
      color: brand,
      letterSpacing: '-0.3px',
      marginBottom: '4px',
    },
    subtitle: {
      fontSize: '13px',
      color: '#6b7280',
      fontWeight: '400',
    },
    form: {
      marginBottom: '24px',
    },
    inputGroup: {
      marginBottom: '16px',
    },
    label: {
      display: 'block',
      fontSize: '12px',
      fontWeight: '700',
      color: brand,
      marginBottom: '6px',
      letterSpacing: '0.2px',
      textTransform: 'uppercase',
    },
    inputWrapper: {
      display: 'flex',
      gap: '8px',
      alignItems: 'center',
    },
    input: {
      flex: 1,
      padding: '12px 18px',
      fontSize: '14px',
      border: '1.5px solid rgba(72, 26, 123, 0.16)',
      borderRadius: '9999px',
      outline: 'none',
      transition: 'all 0.2s ease',
      backgroundColor: '#faf8fc',
      fontFamily: 'inherit',
      fontWeight: '500',
      color: '#1e1b4b',
    },
    inputFocus: {
      borderColor: brand,
      boxShadow: '0 0 0 3px rgba(72, 26, 123, 0.15)',
    },
    button: {
      padding: '12px 22px',
      fontSize: '13px',
      fontWeight: '600',
      background: brandGradient,
      color: 'white',
      border: 'none',
      borderRadius: '9999px',
      cursor: 'pointer',
      transition: 'all 0.2s ease',
      boxShadow: '0 4px 14px rgba(72, 26, 123, 0.3)',
      fontFamily: 'inherit',
      whiteSpace: 'nowrap',
    },
    buttonDisabled: {
      opacity: 0.5,
      cursor: 'not-allowed',
      transform: 'none',
    },
    loadingContainer: {
      textAlign: 'center',
      padding: '40px 20px',
    },
    spinner: {
      display: 'inline-block',
      width: '36px',
      height: '36px',
      border: '3px solid #e2e8f0',
      borderTopColor: brand,
      borderRadius: '50%',
      animation: 'spin 0.8s linear infinite',
    },
    error: {
      backgroundColor: '#fee2e2',
      color: '#dc2626',
      padding: '14px 18px',
      borderRadius: '16px',
      fontSize: '14px',
      marginBottom: '20px',
      borderLeft: '4px solid #dc2626',
      fontWeight: '500',
    },
    warning: {
      backgroundColor: '#fff3e0',
      color: '#ed6c02',
      padding: '14px 18px',
      borderRadius: '16px',
      fontSize: '14px',
      marginBottom: '20px',
      borderLeft: '4px solid #ed6c02',
    },
    successBadge: {
      backgroundColor: '#e8f5e9',
      color: '#2e7d32',
      padding: '8px 16px',
      borderRadius: '20px',
      fontSize: '13px',
      fontWeight: '600',
      display: 'inline-block',
      marginBottom: '16px',
    },
    imageContainer: {
      marginTop: '24px',
      textAlign: 'center',
      animation: 'fadeIn 0.5s ease',
    },
    image: {
      maxWidth: '100%',
      maxHeight: '400px',
      borderRadius: '20px',
      boxShadow: '0 8px 24px rgba(0, 0, 0, 0.12)',
      objectFit: 'contain',
      backgroundColor: '#f8f9fa',
    },
    imagePlaceholder: {
      textAlign: 'center',
      padding: '40px 20px',
      backgroundColor: '#f8f9fa',
      borderRadius: '20px',
      color: '#adb5bd',
      fontSize: '14px',
    },
    footer: {
      marginTop: '24px',
      textAlign: 'center',
      fontSize: '12px',
      color: '#95a5a6',
      borderTop: '1px solid #e9ecef',
      paddingTop: '20px',
    },
    instructions: {
      marginTop: '16px',
      padding: '12px',
      backgroundColor: '#f0f4ff',
      borderRadius: '12px',
      fontSize: '12px',
      color: '#1a2a4f',
    },
    debug: {
      marginTop: '16px',
      padding: '12px',
      backgroundColor: '#f8f9fa',
      borderRadius: '12px',
      fontSize: '11px',
      fontFamily: 'monospace',
      color: '#666',
      wordBreak: 'break-all',
    },
  };

  // Handle input focus styles
  const [isInputFocused, setIsInputFocused] = useState(false);
  const [isBackButtonHovered, setIsBackButtonHovered] = useState(false);

  return (
    <div style={styles.container}>
      <div style={styles.card}>
        <div style={styles.header}>
          <button
            onClick={handleGoBack}
            onMouseEnter={() => setIsBackButtonHovered(true)}
            onMouseLeave={() => setIsBackButtonHovered(false)}
            style={{
              ...styles.backButton,
              ...(isBackButtonHovered ? styles.backButtonHover : {}),
            }}
            aria-label="Go back"
          >
            <div style={styles.backIcon}></div>
          </button>
          <div style={styles.titleContainer}>
            <h1 style={styles.title}>Lot Image Viewer</h1>
            <p style={styles.subtitle}>Enter lot number to view associated image</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} style={styles.form}>
          <div style={styles.inputGroup}>
            <label style={styles.label}>Lot Number</label>
            <div style={styles.inputWrapper}>
              <input
                type="text"
                value={lotNumber}
                onChange={(e) => setLotNumber(e.target.value)}
                onKeyPress={handleKeyPress}
                onFocus={() => setIsInputFocused(true)}
                onBlur={() => setIsInputFocused(false)}
                placeholder="e.g., 242"
                style={{
                  ...styles.input,
                  ...(isInputFocused ? styles.inputFocus : {}),
                }}
                autoFocus
              />
              <button
                type="submit"
                disabled={loading}
                style={{
                  ...styles.button,
                  ...(loading ? styles.buttonDisabled : {}),
                }}
                onMouseEnter={(e) => {
                  if (!loading) {
                    e.currentTarget.style.transform = 'translateY(-2px)';
                    e.currentTarget.style.boxShadow = '0 6px 16px rgba(26, 42, 79, 0.4)';
                  }
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = 'none';
                  e.currentTarget.style.boxShadow = '0 2px 8px rgba(26, 42, 79, 0.3)';
                }}
              >
                {loading ? 'Searching...' : 'Search'}
              </button>
            </div>
          </div>
        </form>

        {error && (
          <div style={styles.error}>
            ⚠️ {error}
          </div>
        )}

        {loading && (
          <div style={styles.loadingContainer}>
            <div style={styles.spinner}></div>
            <p style={{ marginTop: '12px', color: '#6c757d', fontSize: '14px' }}>
              Fetching image...
            </p>
          </div>
        )}

        {imageUrl && !loading && (
          <div style={styles.imageContainer}>
            {searchedLot && (
              <div style={styles.successBadge}>
                ✓ Showing results for Lot #{searchedLot}
              </div>
            )}
            <img
              src={imageUrl}
              alt={`Lot ${searchedLot}`}
              style={styles.image}
              onError={handleImageError}
              onLoad={() => {
                console.log('✅ Image loaded successfully!');
                setImageLoadError(false);
              }}
            />
            {imageLoadError && (
              <div style={styles.warning}>
                ⚠️ Unable to load image. Please check:
                <br />
                1. Your Google Drive folder is shared with "Anyone with the link"
                <br />
                2. The image file exists and hasn't been deleted
                <br />
                3. The URL in your Google Sheet is correct
                <br />
                <br />
                <details>
                  <summary>🔧 Technical Details</summary>
                  <pre style={{ fontSize: '10px', marginTop: '8px', whiteSpace: 'pre-wrap' }}>
                    Image URL: {imageUrl}
                  </pre>
                </details>
              </div>
            )}
          </div>
        )}

        {!imageUrl && !loading && !error && lotNumber && (
          <div style={styles.imagePlaceholder}>
            📸 No image found for this lot number
            <br />
            <span style={{ fontSize: '12px', marginTop: '8px', display: 'block' }}>
              Please check if the lot number exists in the sheet
            </span>
          </div>
        )}

        {!imageUrl && !loading && !error && !lotNumber && (
          <div style={styles.imagePlaceholder}>
            🔍 Enter a lot number to view image
            <br />
            <span style={{ fontSize: '12px', marginTop: '8px', display: 'block' }}>
              Example: 242
            </span>
          </div>
        )}

        <div style={styles.footer}>
          <span>Powered by Google Sheets API • Images via proxy service</span>
        </div>
        
        <div style={styles.instructions}>
          💡 <strong>Quick Guide:</strong>
          <br />
          • Enter any lot number 
          <br />
          • Images are loaded using a proxy service to bypass restrictions
          <br />
          • Click the back button (←) to return to previous page
        </div>

        {/* Debug section - useful for troubleshooting */}
        {/* <div style={styles.debug}>
          <details>
            <summary>🔧 Debug Information (Click to expand)</summary>
            <div style={{ marginTop: '8px' }}>
              <strong>Current Lot:</strong> {lotNumber || '(empty)'}<br />
              <strong>Searched Lot:</strong> {searchedLot || '(none)'}<br />
              <strong>Image URL:</strong> {imageUrl ? imageUrl.substring(0, 100) + '...' : '(none)'}<br />
              <strong>Loading:</strong> {loading ? 'Yes' : 'No'}<br />
              <strong>Error:</strong> {error || 'None'}<br />
              <strong>Image Load Error:</strong> {imageLoadError ? 'Yes' : 'No'}<br />
              <strong>API Status:</strong> {API_KEY ? 'Configured' : 'Missing'}<br />
              <strong>Sheet ID:</strong> {SHEET_ID ? 'Configured' : 'Missing'}
            </div>
          </details>
        </div> */}
      </div>
    </div>
  );
};

export default LotImage;