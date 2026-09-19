// LotQuantity.jsx (Updated with Navy Theme & Back Button in Header)
import React, { useState, useEffect, useRef } from "react";
import { useNavigate } from 'react-router-dom';
import SplashScreen from "./SplashScreen";
import html2pdf from 'html2pdf.js';

/** ========= helpers ========= */
const norm = (v) => (v ?? "").toString().trim();
const lc = (v) => norm(v).toLowerCase();
const includes = (hay, needle) => lc(hay).includes(lc(needle));
const toNumOrNull = (v) => {
  const t = norm(v);
  if (t === "") return null;
  const n = parseFloat(t.replace(/[, ]/g, ""));
  return Number.isFinite(n) ? n : null;
};

// Display-only: trim before GENTS/LADIES/KIDS (even inside brackets)
const simplifyItemName = (s) => {
  const t = norm(s);
  if (!t) return t;

  const bracketRe = /\(\s*(GENTS|LADIES|KIDS)\s*\)/i;
  if (bracketRe.test(t)) return t.split(bracketRe)[0].trim();

  const wordRe = /\b(GENTS|LADIES|KIDS)\b/i;
  const m = wordRe.exec(t);
  return m ? t.slice(0, m.index).trim().replace(/\s{2,}/g, " ") : t;
};

// NEW: 5-digit detector (e.g., "11001")
const isFiveDigit = (v) => /^\d{5}$/.test(String(v ?? "").trim());

const extractGoogleDriveFileId = (url) => {
  if (!url) return null;

  const patterns = [
    /\/d\/([a-zA-Z0-9_-]+)/,
    /id=([a-zA-Z0-9_-]+)/,
    /uc\?export=download&id=([a-zA-Z0-9_-]+)/,
    /drive\.google\.com\/open\?id=([a-zA-Z0-9_-]+)/,
    /file\/d\/([a-zA-Z0-9_-]+)/,
    /drive\.google\.com\/uc\?id=([a-zA-Z0-9_-]+)/
  ];

  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match && match[1]) {
      return match[1];
    }
  }

  return null;
};

const getGoogleDriveImageUrls = (url) => {
  const fileId = extractGoogleDriveFileId(url);
  if (fileId) {
    return [
      // Weserv proxy to bypass hotlink and CORS
      `https://images.weserv.nl/?url=${encodeURIComponent(`https://drive.google.com/uc?export=view&id=${fileId}`)}`,
      // Google user content
      `https://lh3.googleusercontent.com/d/${fileId}`,
      `https://lh3.googleusercontent.com/d/${fileId}=w800`,
      `https://lh3.googleusercontent.com/d/${fileId}=w1600`,
      // Direct download
      `https://drive.google.com/uc?export=download&id=${fileId}`,
      `https://drive.google.com/uc?export=view&id=${fileId}`,
      `https://drive.google.com/thumbnail?id=${fileId}&sz=w800`,
    ];
  }
  return [url];
};

// Fetch image as Base64 for embedding safely into PDF (avoids CORS issues)
const fetchImageAsBase64 = async (url) => {
  if (!url) return null;
  const urlsToTry = Array.isArray(url) ? url : [url];
  const allUrls = [];
  for (const u of urlsToTry) {
    allUrls.push(u);
    const fileId = extractGoogleDriveFileId(u);
    if (fileId) {
      allUrls.push(`https://images.weserv.nl/?url=${encodeURIComponent(`https://drive.google.com/uc?export=view&id=${fileId}`)}`);
      allUrls.push(`https://lh3.googleusercontent.com/d/${fileId}`);
      allUrls.push(`https://lh3.googleusercontent.com/d/${fileId}=w800`);
      allUrls.push(`https://lh3.googleusercontent.com/d/${fileId}=w1600`);
    }
  }
  const uniqueUrls = [...new Set(allUrls)];

  for (const currentUrl of uniqueUrls) {
    try {
      const response = await fetch(currentUrl, { mode: 'cors' });
      if (!response.ok) continue;
      const blob = await response.blob();
      if (!blob || blob.size === 0) continue;
      return await new Promise((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result);
        reader.onerror = () => resolve(null);
        reader.readAsDataURL(blob);
      });
    } catch {
      // Try next candidate
    }
  }
  return null;
};

/** ========= Main App ========= */
export default function LotQuantity({
  apiKey: propApiKey,
  sheetId: propSheetId,
  range: propRange,
  indexSheetId: propIndexSheetId,
  indexRange: propIndexRange,
  cuttingSheetId: propCuttingSheetId,
  cuttingTab: propCuttingTab,
}) {
  const navigate = useNavigate();
  const [showSplash, setShowSplash] = useState(false);
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState("");
  const [filteredHeaders, setFilteredHeaders] = useState([]);
  const [quantityColumn, setQuantityColumn] = useState(null);
  const [itemNameHeader, setItemNameHeader] = useState(null);

  const [shadeLoading, setShadeLoading] = useState(false);
  const [shadeError, setShadeError] = useState(null);
  const [lotMeta, setLotMeta] = useState(null);
  const [shadeRows, setShadeRows] = useState([]);
  const [shadeSizes, setShadeSizes] = useState([]);
  const [shadeTotals, setShadeTotals] = useState({ perSize: {}, grand: 0 });
  const [lotImageUrl, setLotImageUrl] = useState(null);
  const [showImageModal, setShowImageModal] = useState(false);
  const [imageLoading, setImageLoading] = useState(false);
  const [loadedImageUrl, setLoadedImageUrl] = useState(null);

  const [showResults, setShowResults] = useState(false);
  const [activeTab, setActiveTab] = useState("details");

  const [downloading, setDownloading] = useState(false);
  const resultsRef = useRef(null);

  const API_KEY = propApiKey ?? "AIzaSyAomDFBkOySlIxKWSKGHe6ATv9gvaBr7uk";
  const SHEET_ID = propSheetId ?? "18FzakygM7DVD29IRbpe68pDeCFQhFLj7t4C-XQ1MWWc";
  const RANGE = propRange ?? import.meta.env.VITE_SHEET_RANGE ?? "Sheet1!A3:Z";

  const INDEX_SHEET_ID = propIndexSheetId ?? import.meta.env.VITE_INDEX_SHEET_ID ?? "1Hj3JeJEKB43aYYWv8gk2UhdU6BWuEQfCg5pBlTdBMNA";
  const INDEX_RANGE = propIndexRange ?? import.meta.env.VITE_INDEX_RANGE ?? "Index!A1:Z";
  const CUTTING_SHEET_ID = propCuttingSheetId ?? "1Hj3JeJEKB43aYYWv8gk2UhdU6BWuEQfCg5pBlTdBMNA";
  const CUTTING_TAB = propCuttingTab ?? import.meta.env.VITE_CUTTING_TAB ?? "Cutting";

  // Handle back navigation
  const handleGoBack = () => {
    if (window.history.length > 1) {
      navigate(-1);
    } else {
      navigate('/dashboard');
    }
  };

  useEffect(() => {
    const handleEscape = (e) => {
      if (e.key === "Escape") {
        setShowResults(false);
        setShowImageModal(false);
      }
    };
    window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
  }, []);

  const loadImageForModal = async () => {
    if (!lotImageUrl) return;

    setImageLoading(true);
    setLoadedImageUrl(null);

    const urlsToTry = Array.isArray(lotImageUrl) ? lotImageUrl : [lotImageUrl];
    const allUrlsToTry = [];

    for (const url of urlsToTry) {
      allUrlsToTry.push(url);
      const fileId = extractGoogleDriveFileId(url);
      if (fileId) {
        // Prioritize lh3.googleusercontent.com URLs (no CORS issues)
        allUrlsToTry.push(`https://lh3.googleusercontent.com/d/${fileId}`);
        allUrlsToTry.push(`https://lh3.googleusercontent.com/d/${fileId}=w800`);
        allUrlsToTry.push(`https://lh3.googleusercontent.com/d/${fileId}=w1600`);
      }
    }

    const uniqueUrls = [...new Set(allUrlsToTry)];
    console.log('Attempting to load image with URLs:', uniqueUrls);

    let loadedSuccessfully = false;

    const tryLoadImage = (urls, index = 0) => {
      if (index >= urls.length || loadedSuccessfully) {
        if (!loadedSuccessfully) {
          setImageLoading(false);
          alert(`Failed to load image. 
        
Please ensure:
1. The image is publicly accessible
2. The sharing settings are set to "Anyone with the link"
3. You have internet connectivity

Tried ${urls.length} different URL formats.`);
        }
        return;
      }

      const currentUrl = urls[index];
      console.log(`Attempt ${index + 1}: Loading from: ${currentUrl}`);

      const img = new Image();

      const timeoutId = setTimeout(() => {
        img.src = '';
        console.log(`Timeout for URL: ${currentUrl}`);
        tryLoadImage(urls, index + 1);
      }, 15000);

      img.onload = () => {
        clearTimeout(timeoutId);
        console.log(`Successfully loaded image from: ${currentUrl}`);
        setLoadedImageUrl(currentUrl);
        setImageLoading(false);
        setShowImageModal(true);
        loadedSuccessfully = true;
      };

      img.onerror = (e) => {
        clearTimeout(timeoutId);
        console.log(`Failed to load from ${currentUrl}:`, e);
        tryLoadImage(urls, index + 1);
      };

      // Don't add cache-busting for lh3 URLs as it may cause issues
      if (currentUrl.includes('lh3.googleusercontent.com')) {
        img.src = currentUrl;
      } else {
        img.src = `${currentUrl}${currentUrl.includes('?') ? '&' : '?'}_=${Date.now()}`;
      }
    };

    tryLoadImage(uniqueUrls);
  };
  const fetchDataForLotNo = async (lotNo) => {
    if (!lotNo.trim()) {
      setRows([]);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      if (!API_KEY || !SHEET_ID) {
        throw new Error("Missing Google Sheets configuration.");
      }

      const headersUrl = `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}/values/${encodeURIComponent("Sheet1!A3:Z")}?key=${API_KEY}`;
      const headersRes = await fetch(headersUrl);
      if (!headersRes.ok) {
        const text = await headersRes.text();
        throw new Error(`Google Sheets API error: ${headersRes.status} ${text}`);
      }

      const headersBody = await headersRes.json();
      const headerValues = headersBody.values || [];
      const headerRow = headerValues.length > 0 ? headerValues[0].map((h) => String(h ?? "").trim()) : [];

      const itemNameIndex = headerRow.findIndex((h) => h && h.toLowerCase().includes("item") && h.toLowerCase().includes("name"));
      if (itemNameIndex === -1) throw new Error("Could not find ITEM NAME column in the sheet");
      setItemNameHeader(headerRow[itemNameIndex]);

      const quantityIndex = headerRow.findIndex((h) => h && h.toLowerCase().includes("quantity"));
      setQuantityColumn(quantityIndex !== -1 ? headerRow[quantityIndex] : null);

      const dataUrl = `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}/values/${encodeURIComponent(RANGE)}?key=${API_KEY}`;
      const dataRes = await fetch(dataUrl);
      if (!dataRes.ok) {
        const text = await dataRes.text();
        throw new Error(`Google Sheets API error: ${dataRes.status} ${text}`);
      }

      const dataBody = await dataRes.json();
      const values = dataBody.values || [];
      if (values.length === 0) {
        setRows([]);
        return;
      }

      const normalizedSearch = String(lotNo).trim().toLowerCase();
      const filteredValues = values.filter((row) => {
        if (row.length <= itemNameIndex) return false;
        const itemVal = String(row[itemNameIndex] ?? "").trim().toLowerCase();
        return itemVal.startsWith(normalizedSearch);
      });

      const dataRows = filteredValues.map((row) => {
        const obj = {};
        headerRow.forEach((header, i) => {
          const key = header || `col_${i + 1}`;
          obj[key] = i < row.length ? row[i] ?? "" : "";
        });
        return obj;
      });

      setRows(dataRows);

      const headersToShow = headerRow.filter(
        (header) =>
          header &&
          ((header.toLowerCase().includes("item") && header.toLowerCase().includes("name")) ||
            (header.toLowerCase().includes("shade") && header.toLowerCase().includes("name")) ||
            header.toLowerCase().includes("pack") ||
            header.toLowerCase().includes("size") ||
            header.toLowerCase().includes("quantity"))
      );

      setFilteredHeaders(headersToShow);
      setShowResults(true);
      setActiveTab("details");
    } catch (err) {
      setError(err.message || String(err));
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = async (e) => {
    e.preventDefault();
    const q = String(search ?? "").trim();
    if (!q) return;

    if (isFiveDigit(q)) {
      setShowResults(true);
      setActiveTab("matrix");
      setRows([]);
      setError(null);
      await loadShadeMatrixForLot(q);
      return;
    }

    setActiveTab("details");
    fetchDataForLotNo(q);
  };

  const handleClearSearch = () => {
    setSearch("");
    setShowResults(false);
    setRows([]);
    setError(null);
    setShadeRows([]);
    setLotMeta(null);
    setLotImageUrl(null);
    setLoadedImageUrl(null);
    setShowImageModal(false);
  };

  const calculateTotalQuantity = () => {
    if (!quantityColumn) return 0;
    return rows.reduce((total, row) => {
      const quantityValue = row[quantityColumn] || "0";
      const quantity = parseFloat(quantityValue.toString().replace(/[^\d.-]/g, "")) || 0;
      return total + quantity;
    }, 0);
  };

  const downloadPDF = async () => {
    if (!resultsRef.current) return;

    setDownloading(true);

    try {
      const isLandscape = (activeTab === "matrix" && shadeSizes && shadeSizes.length >= 6);
      const targetWidth = isLandscape ? 1040 : 710;

      const pdfContent = document.createElement('div');
      pdfContent.style.padding = '20px 22px';
      pdfContent.style.backgroundColor = '#ffffff';
      pdfContent.style.fontFamily = "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif";
      pdfContent.style.width = `${targetWidth}px`;
      pdfContent.style.minWidth = `${targetWidth}px`;
      pdfContent.style.maxWidth = `${targetWidth}px`;
      pdfContent.style.boxSizing = 'border-box';
      pdfContent.style.color = '#0f172a';
      pdfContent.style.WebkitFontSmoothing = 'antialiased';
      pdfContent.style.MozOsxFontSmoothing = 'grayscale';
      pdfContent.style.textRendering = 'geometricPrecision';
      pdfContent.style.lineHeight = '1.4';

      // Professional PDF Header
      const headerDiv = document.createElement('div');
      headerDiv.style.display = 'flex';
      headerDiv.style.justifyContent = 'space-between';
      headerDiv.style.alignItems = 'flex-end';
      headerDiv.style.borderBottom = '3px solid rgb(72, 26, 123)';
      headerDiv.style.paddingBottom = '14px';
      headerDiv.style.marginBottom = '18px';

      const headerLeft = document.createElement('div');
      headerLeft.innerHTML = `
        <div style="font-size: 22px; font-weight: 800; color: rgb(72, 26, 123); letter-spacing: -0.4px; line-height: 1.2;">LOT QUANTITY REPORT</div>
        <div style="font-size: 13px; font-weight: 600; color: #334155; margin-top: 4px;">Lot Number: <span style="color: rgb(72, 26, 123); font-weight: 800; font-size: 14px;">${search}</span></div>
      `;

      const headerRight = document.createElement('div');
      headerRight.style.textAlign = 'right';
      headerRight.innerHTML = `
        <div style="font-size: 11px; font-weight: 800; color: rgb(72, 26, 123); text-transform: uppercase; letter-spacing: 0.5px;">Quantity Finder System</div>
        <div style="font-size: 10px; color: #475569; font-weight: 500; margin-top: 2px;">Date: ${new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}</div>
        <div style="font-size: 10px; color: #64748b; font-weight: 500;">Time: ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
      `;

      headerDiv.appendChild(headerLeft);
      headerDiv.appendChild(headerRight);
      pdfContent.appendChild(headerDiv);

      if (activeTab === "details") {
        if (rows.length > 0) {
          const table = document.createElement('table');
          table.style.width = '100%';
          table.style.borderCollapse = 'collapse';
          table.style.marginTop = '14px';
          table.style.marginBottom = '16px';
          table.style.fontSize = '11px';
          table.style.boxSizing = 'border-box';

          const thead = document.createElement('thead');
          const headerRow = document.createElement('tr');

          filteredHeaders.forEach(header => {
            const th = document.createElement('th');
            th.textContent = header;
            th.style.border = '1.5px solid rgb(72, 26, 123)';
            th.style.padding = '8px 10px';
            th.style.textAlign = 'center';
            th.style.fontSize = '11px';
            th.style.fontWeight = '700';
            th.style.backgroundColor = 'rgb(72, 26, 123)';
            th.style.color = '#ffffff';
            th.style.letterSpacing = '0.2px';
            headerRow.appendChild(th);
          });
          thead.appendChild(headerRow);
          table.appendChild(thead);

          const tbody = document.createElement('tbody');

          rows.forEach((row, idx) => {
            const tr = document.createElement('tr');
            tr.style.backgroundColor = idx % 2 === 0 ? '#ffffff' : '#f8fafc';

            filteredHeaders.forEach(header => {
              const td = document.createElement('td');
              let cellValue = row[header] || '';
              if (header === itemNameHeader) {
                cellValue = simplifyItemName(cellValue);
              }
              td.textContent = cellValue;
              td.style.border = '1px solid #cbd5e1';
              td.style.padding = '8px 10px';
              td.style.textAlign = 'center';
              td.style.fontSize = '11px';
              td.style.fontWeight = '500';
              td.style.color = '#0f172a';
              tr.appendChild(td);
            });
            tbody.appendChild(tr);
          });

          if (quantityColumn) {
            const totalRow = document.createElement('tr');
            filteredHeaders.forEach((header, index) => {
              const td = document.createElement('td');
              if (header === quantityColumn) {
                td.textContent = `${calculateTotalQuantity()}`;
                td.style.fontWeight = '800';
              } else if (index === 0) {
                td.textContent = 'Grand Total';
                td.style.fontWeight = '800';
              } else {
                td.textContent = '';
              }
              td.style.border = '1.5px solid #cbd5e1';
              td.style.padding = '9px 10px';
              td.style.textAlign = 'center';
              td.style.fontSize = '11px';
              td.style.backgroundColor = '#f1eaf7';
              td.style.color = 'rgb(72, 26, 123)';
              totalRow.appendChild(td);
            });
            tbody.appendChild(totalRow);
          }

          table.appendChild(tbody);
          pdfContent.appendChild(table);

          const summaryDiv = document.createElement('div');
          summaryDiv.style.marginTop = '14px';
          summaryDiv.style.padding = '10px 14px';
          summaryDiv.style.backgroundColor = '#faf8fc';
          summaryDiv.style.border = '1.5px solid rgba(72, 26, 123, 0.2)';
          summaryDiv.style.borderRadius = '8px';
          summaryDiv.innerHTML = `
            <div style="font-size: 11px; color: #0f172a;">
              <strong style="color: rgb(72, 26, 123); font-weight: 800;">Summary:</strong> Found <strong>${rows.length}</strong> record(s) with total quantity of <strong style="color: rgb(72, 26, 123); font-size: 13px;">${calculateTotalQuantity()}</strong> pcs.
            </div>
          `;
          pdfContent.appendChild(summaryDiv);
        } else {
          const noDataDiv = document.createElement('div');
          noDataDiv.style.textAlign = 'center';
          noDataDiv.style.padding = '30px';
          noDataDiv.style.backgroundColor = '#faf8fc';
          noDataDiv.style.borderRadius = '10px';
          noDataDiv.style.margin = '20px 0';
          noDataDiv.style.color = '#64748b';
          noDataDiv.innerHTML = '<p>No records found for this lot number.</p>';
          pdfContent.appendChild(noDataDiv);
        }
      }
      else if (activeTab === "matrix") {
        if (lotMeta && shadeRows.length > 0) {
          // Fetch image if available
          let base64Image = null;
          if (lotImageUrl || loadedImageUrl) {
            try {
              base64Image = await fetchImageAsBase64(loadedImageUrl || lotImageUrl);
            } catch (err) {
              console.warn("Could not load lot image for PDF:", err);
            }
          }

          // Meta summary card + Image layout
          const metaSection = document.createElement('div');
          metaSection.style.display = 'flex';
          metaSection.style.justifyContent = 'space-between';
          metaSection.style.alignItems = 'center';
          metaSection.style.gap = '16px';
          metaSection.style.padding = '14px 16px';
          metaSection.style.backgroundColor = '#faf8fc';
          metaSection.style.marginBottom = '16px';
          metaSection.style.borderRadius = '10px';
          metaSection.style.border = '1.5px solid rgba(72, 26, 123, 0.2)';

          const metaGrid = document.createElement('div');
          metaGrid.style.display = 'grid';
          metaGrid.style.gridTemplateColumns = 'repeat(2, 1fr)';
          metaGrid.style.gap = '8px 18px';
          metaGrid.style.flex = '1';

          const metaItems = [
            { label: 'Lot No:', value: lotMeta.Lot },
            { label: 'Style:', value: lotMeta.Style },
            { label: 'Fabric:', value: lotMeta.Fabric },
            { label: 'Garment Type:', value: lotMeta.GarmentType },
            { label: 'Available Sizes:', value: shadeSizes.join(', ') },
            { label: 'Total Quantity:', value: `${shadeTotals?.grand || 0} Pcs` }
          ];

          metaItems.forEach(item => {
            if (item.value && item.value !== '') {
              const itemDiv = document.createElement('div');
              itemDiv.style.fontSize = '11px';
              itemDiv.style.color = '#0f172a';
              itemDiv.innerHTML = `
                <span style="color: rgb(72, 26, 123); font-weight: 800; text-transform: uppercase; font-size: 10px; margin-right: 4px;">${item.label}</span>
                <span style="font-weight: 600; color: #0f172a;">${item.value}</span>
              `;
              metaGrid.appendChild(itemDiv);
            }
          });

          metaSection.appendChild(metaGrid);

          if (base64Image) {
            const imageDiv = document.createElement('div');
            imageDiv.style.display = 'flex';
            imageDiv.style.flexDirection = 'column';
            imageDiv.style.alignItems = 'center';
            imageDiv.style.justifyContent = 'center';
            imageDiv.style.backgroundColor = '#ffffff';
            imageDiv.style.border = '1.5px solid rgba(72, 26, 123, 0.25)';
            imageDiv.style.borderRadius = '8px';
            imageDiv.style.padding = '6px';
            imageDiv.style.minWidth = '115px';
            imageDiv.style.maxWidth = '135px';

            const imgEl = document.createElement('img');
            imgEl.src = base64Image;
            imgEl.style.maxHeight = '90px';
            imgEl.style.maxWidth = '125px';
            imgEl.style.objectFit = 'contain';
            imgEl.style.borderRadius = '4px';
            imgEl.style.imageRendering = '-webkit-optimize-contrast';
            imgEl.alt = `Lot ${lotMeta.Lot}`;

            const imgCaption = document.createElement('span');
            imgCaption.style.fontSize = '9px';
            imgCaption.style.color = 'rgb(72, 26, 123)';
            imgCaption.style.marginTop = '4px';
            imgCaption.style.fontWeight = '800';
            imgCaption.textContent = 'Lot Preview';

            imageDiv.appendChild(imgEl);
            imageDiv.appendChild(imgCaption);
            metaSection.appendChild(imageDiv);
          }

          pdfContent.appendChild(metaSection);

          // Matrix Data Table
          const table = document.createElement('table');
          table.style.width = '100%';
          table.style.borderCollapse = 'collapse';
          table.style.marginTop = '12px';
          table.style.marginBottom = '16px';
          table.style.fontSize = isLandscape ? '10px' : (shadeSizes.length > 5 ? '9px' : '10px');
          table.style.boxSizing = 'border-box';

          const thead = document.createElement('thead');
          const headerRow = document.createElement('tr');

          const cellPadding = isLandscape ? '7px 8px' : '6px 5px';
          const fontSizeTh = isLandscape ? '10.5px' : (shadeSizes.length > 5 ? '9px' : '10px');
          const fontSizeTd = isLandscape ? '10px' : (shadeSizes.length > 5 ? '8.5px' : '9.5px');

          const headersList = ['Shade', 'Cutting Table', ...shadeSizes, 'Total'];
          headersList.forEach(header => {
            const th = document.createElement('th');
            th.textContent = header;
            th.style.border = '1.5px solid rgb(72, 26, 123)';
            th.style.padding = cellPadding;
            th.style.textAlign = 'center';
            th.style.fontSize = fontSizeTh;
            th.style.fontWeight = '700';
            th.style.backgroundColor = 'rgb(72, 26, 123)';
            th.style.color = '#ffffff';
            th.style.whiteSpace = 'nowrap';
            headerRow.appendChild(th);
          });
          thead.appendChild(headerRow);
          table.appendChild(thead);

          const tbody = document.createElement('tbody');

          shadeRows.forEach((row, idx) => {
            const tr = document.createElement('tr');
            tr.style.backgroundColor = idx % 2 === 0 ? '#ffffff' : '#f8fafc';

            const shadeTd = document.createElement('td');
            shadeTd.textContent = row.color;
            shadeTd.style.border = '1px solid #cbd5e1';
            shadeTd.style.padding = cellPadding;
            shadeTd.style.textAlign = 'center';
            shadeTd.style.fontSize = fontSizeTd;
            shadeTd.style.fontWeight = '700';
            shadeTd.style.color = 'rgb(72, 26, 123)';
            shadeTd.style.whiteSpace = 'nowrap';
            tr.appendChild(shadeTd);

            const cuttingTd = document.createElement('td');
            cuttingTd.textContent = row.cuttingTable ?? '—';
            cuttingTd.style.border = '1px solid #cbd5e1';
            cuttingTd.style.padding = cellPadding;
            cuttingTd.style.textAlign = 'center';
            cuttingTd.style.fontSize = fontSizeTd;
            cuttingTd.style.color = '#334155';
            tr.appendChild(cuttingTd);

            shadeSizes.forEach(size => {
              const sizeTd = document.createElement('td');
              sizeTd.textContent = row.sizes?.[size] ?? '';
              sizeTd.style.border = '1px solid #cbd5e1';
              sizeTd.style.padding = cellPadding;
              sizeTd.style.textAlign = 'center';
              sizeTd.style.fontSize = fontSizeTd;
              sizeTd.style.fontWeight = '500';
              sizeTd.style.color = '#0f172a';
              tr.appendChild(sizeTd);
            });

            const totalTd = document.createElement('td');
            totalTd.textContent = row.totalPcs ?? '';
            totalTd.style.border = '1px solid #cbd5e1';
            totalTd.style.padding = cellPadding;
            totalTd.style.textAlign = 'center';
            totalTd.style.fontSize = fontSizeTd;
            totalTd.style.fontWeight = '800';
            totalTd.style.color = '#0f172a';
            tr.appendChild(totalTd);

            tbody.appendChild(tr);
          });

          table.appendChild(tbody);

          const tfoot = document.createElement('tfoot');
          const totalRow = document.createElement('tr');

          const emptyTd1 = document.createElement('td');
          emptyTd1.textContent = 'Grand Total';
          emptyTd1.style.border = '1.5px solid #94a3b8';
          emptyTd1.style.padding = cellPadding;
          emptyTd1.style.textAlign = 'center';
          emptyTd1.style.fontSize = fontSizeTd;
          emptyTd1.style.fontWeight = '800';
          emptyTd1.style.backgroundColor = '#f1eaf7';
          emptyTd1.style.color = 'rgb(72, 26, 123)';
          emptyTd1.style.whiteSpace = 'nowrap';
          totalRow.appendChild(emptyTd1);

          const emptyTd2 = document.createElement('td');
          emptyTd2.textContent = '—';
          emptyTd2.style.border = '1.5px solid #94a3b8';
          emptyTd2.style.padding = cellPadding;
          emptyTd2.style.textAlign = 'center';
          emptyTd2.style.fontSize = fontSizeTd;
          emptyTd2.style.fontWeight = '700';
          emptyTd2.style.backgroundColor = '#f1eaf7';
          emptyTd2.style.color = '#64748b';
          totalRow.appendChild(emptyTd2);

          shadeSizes.forEach(size => {
            const totalSize = shadeRows.reduce((sum, r) => sum + (r.sizes?.[size] ?? 0), 0);
            const sizeTd = document.createElement('td');
            sizeTd.textContent = totalSize;
            sizeTd.style.border = '1.5px solid #94a3b8';
            sizeTd.style.padding = cellPadding;
            sizeTd.style.textAlign = 'center';
            sizeTd.style.fontSize = fontSizeTd;
            sizeTd.style.fontWeight = '800';
            sizeTd.style.backgroundColor = '#f1eaf7';
            sizeTd.style.color = 'rgb(72, 26, 123)';
            totalRow.appendChild(sizeTd);
          });

          const grandTd = document.createElement('td');
          grandTd.textContent = shadeTotals?.grand ?? 0;
          grandTd.style.border = '1.5px solid #94a3b8';
          grandTd.style.padding = cellPadding;
          grandTd.style.textAlign = 'center';
          grandTd.style.fontSize = fontSizeTd;
          grandTd.style.fontWeight = '800';
          grandTd.style.backgroundColor = '#f1eaf7';
          grandTd.style.color = 'rgb(72, 26, 123)';
          totalRow.appendChild(grandTd);

          tfoot.appendChild(totalRow);
          table.appendChild(tfoot);

          pdfContent.appendChild(table);

          const summaryDiv = document.createElement('div');
          summaryDiv.style.marginTop = '14px';
          summaryDiv.style.padding = '10px 14px';
          summaryDiv.style.backgroundColor = '#faf8fc';
          summaryDiv.style.border = '1.5px solid rgba(72, 26, 123, 0.2)';
          summaryDiv.style.borderRadius = '8px';
          summaryDiv.innerHTML = `
            <div style="font-size: 11px; color: #0f172a;">
              <strong style="color: rgb(72, 26, 123); font-weight: 800;">Matrix Summary:</strong> Total of <strong>${shadeRows.length}</strong> shade(s) across <strong>${shadeSizes.length}</strong> size(s) with <strong style="color: rgb(72, 26, 123); font-size: 13px;">${shadeTotals?.grand || 0}</strong> total pieces.
            </div>
          `;
          pdfContent.appendChild(summaryDiv);
        } else if (shadeLoading) {
          const loadingDiv = document.createElement('div');
          loadingDiv.style.textAlign = 'center';
          loadingDiv.style.padding = '30px';
          loadingDiv.style.color = '#64748b';
          loadingDiv.innerHTML = '<p>Loading matrix data...</p>';
          pdfContent.appendChild(loadingDiv);
        } else {
          const noDataDiv = document.createElement('div');
          noDataDiv.style.textAlign = 'center';
          noDataDiv.style.padding = '30px';
          noDataDiv.style.backgroundColor = '#faf8fc';
          noDataDiv.style.borderRadius = '10px';
          noDataDiv.style.margin = '20px 0';
          noDataDiv.style.color = '#64748b';
          noDataDiv.innerHTML = '<p>No matrix data available for this lot.</p>';
          pdfContent.appendChild(noDataDiv);
        }
      }

      // Professional PDF Footer
      const footerDiv = document.createElement('div');
      footerDiv.style.display = 'flex';
      footerDiv.style.justifyContent = 'space-between';
      footerDiv.style.alignItems = 'center';
      footerDiv.style.fontSize = '9px';
      footerDiv.style.fontWeight = '500';
      footerDiv.style.marginTop = '24px';
      footerDiv.style.paddingTop = '12px';
      footerDiv.style.borderTop = '1px solid #cbd5e1';
      footerDiv.style.color = '#64748b';
      footerDiv.innerHTML = `
        <div>Quantity Finder System • Confidential &amp; Proprietary</div>
        <div>Generated on ${new Date().toLocaleString()}</div>
      `;
      pdfContent.appendChild(footerDiv);

      const opt = {
        margin: [8, 8, 8, 8],
        filename: `quantity_report_${search}_${new Date().toISOString().slice(0, 19).replace(/:/g, '-')}.pdf`,
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: {
          scale: 2.5,
          letterRendering: true,
          logging: false,
          backgroundColor: '#ffffff',
          useCORS: true,
          scrollY: 0,
          scrollX: 0,
          windowWidth: targetWidth,
        },
        jsPDF: {
          unit: 'mm',
          format: 'a4',
          orientation: isLandscape ? 'landscape' : 'portrait',
          compress: true
        }
      };

      await html2pdf().set(opt).from(pdfContent).save();

    } catch (error) {
      console.error('PDF generation error:', error);
      alert('Failed to generate PDF. Please try again.');
    } finally {
      setDownloading(false);
    }
  };

  async function fetchIndexSheet(signal) {
    const range = encodeURIComponent(INDEX_RANGE);
    const url = `https://sheets.googleapis.com/v4/spreadsheets/${INDEX_SHEET_ID}/values/${range}?key=${API_KEY}`;
    const res = await fetch(url, { signal });
    if (!res.ok) throw new Error(`Failed to access Index sheet: ${res.status}`);
    const data = await res.json();
    if (!data?.values?.length) throw new Error("Index sheet is empty");
    return data.values;
  }

  function findLotInIndex(indexData, lotNo) {
    if (!indexData || indexData.length < 2) return null;
    const headers = indexData[0].map(norm);
    const lotNumberCol = headers.findIndex((h) => includes(h, "lot number"));
    const startRowCol = headers.findIndex((h) => includes(h, "startrow"));
    const numRowsCol = headers.findIndex((h) => includes(h, "numrows"));
    const headerColsCol = headers.findIndex((h) => includes(h, "headercols"));
    const idx = {
      fabric: headers.findIndex((h) => includes(h, "fabric")),
      garmentType: headers.findIndex((h) => includes(h, "garment type")),
      style: headers.findIndex((h) => includes(h, "style")),
      sizes: headers.findIndex((h) => includes(h, "sizes")),
      shades: headers.findIndex((h) => includes(h, "shades")),
      imageUrl: headers.findIndex((h) => includes(h, "image") && includes(h, "url")),
    };
    if (lotNumberCol === -1) return null;

    for (let i = 1; i < indexData.length; i++) {
      const row = indexData[i] || [];
      const rowLotNo = norm(row[lotNumberCol]);
      if (rowLotNo === norm(lotNo)) {
        const imageUrl = idx.imageUrl !== -1 && row[idx.imageUrl] ? norm(row[idx.imageUrl]) : null;

        return {
          lotNumber: rowLotNo,
          startRow: startRowCol !== -1 ? parseInt(row[startRowCol]) || 1 : 1,
          numRows: numRowsCol !== -1 ? parseInt(row[numRowsCol]) || 20 : 20,
          headerCols: headerColsCol !== -1 ? parseInt(row[headerColsCol]) || 7 : 7,
          fabric: idx.fabric !== -1 ? row[idx.fabric] || "" : "",
          garmentType: idx.garmentType !== -1 ? row[idx.garmentType] || "" : "",
          style: idx.style !== -1 ? row[idx.style] || "" : "",
          sizes: idx.sizes !== -1 ? row[idx.sizes] || "" : "",
          shades: idx.shades !== -1 ? row[idx.shades] || "" : "",
          imageUrl: imageUrl,
        };
      }
    }
    return null;
  }

  async function fetchFromCuttingUsingIndex(lotInfo, signal) {
    const { startRow, numRows } = lotInfo;
    const endRow = startRow + numRows - 1;
    const cuttingRange = `${CUTTING_TAB}!A${startRow}:Z${endRow}`;
    const url = `https://sheets.googleapis.com/v4/spreadsheets/${CUTTING_SHEET_ID}/values/${encodeURIComponent(cuttingRange)}?key=${API_KEY}`;
    const res = await fetch(url, { signal });
    if (!res.ok) throw new Error(`Failed to access Cutting sheet: ${res.status}`);
    const data = await res.json();
    if (!data?.values?.length) throw new Error("No data found in the specified range");
    const parsed = parseMatrixWithIndexInfo(data.values, lotInfo);
    if (!parsed || !parsed.rows?.length) throw new Error("Failed to parse cutting matrix");
    return parsed;
  }

  function parseMatrixWithIndexInfo(rows, lotInfo) {
    let lotNumber = lotInfo.lotNumber;
    let style = lotInfo.style || "";
    let fabric = lotInfo.fabric || "";
    let garmentType = lotInfo.garmentType || "";
    const headerCols = lotInfo.headerCols || 7;

    for (let i = 0; i < Math.min(rows.length, 12); i++) {
      const r = rows[i] || [];
      if (includes(r[0], "lot number") && r[1]) {
        lotNumber = norm(r[1]);
        const idxStyle = r.findIndex((c) => includes(c, "style"));
        if (idxStyle !== -1 && r[idxStyle + 1]) style = norm(r[idxStyle + 1]);
      }
      if (includes(r[0], "fabric") && r[1]) {
        fabric = norm(r[1]);
        const idxGT = r.findIndex((c) => includes(c, "garment type"));
        if (idxGT !== -1 && r[idxGT + 1]) garmentType = norm(r[idxGT + 1]);
      }
      const styleIdx = r.findIndex((c) => includes(c, "style"));
      if (styleIdx !== -1 && r[styleIdx + 1] && !style) style = norm(r[styleIdx + 1]);
      const fabricIdx = r.findIndex((c) => includes(c, "fabric"));
      if (fabricIdx !== -1 && r[fabricIdx + 1] && !fabric) fabric = norm(r[fabricIdx + 1]);
      const gtIdx = r.findIndex((c) => includes(c, "garment type"));
      if (gtIdx !== -1 && r[gtIdx + 1] && !garmentType) garmentType = norm(r[gtIdx + 1]);
    }

    let headerIdx = -1;
    for (let i = 0; i < Math.min(rows.length, 10); i++) {
      const r = rows[i] || [];
      const hasColor = r.some((c) => includes(c, "color"));
      const hasCT = r.some((c) => includes(c, "cutting table")) || r.some((c) => includes(c, "table"));
      const hasNums = r.some((c) => !isNaN(parseFloat(c)) && isFinite(c));
      if ((hasColor && hasCT) || (hasColor && hasNums) || (hasCT && hasNums)) {
        headerIdx = i;
        break;
      }
    }
    if (headerIdx === -1) {
      for (let i = 0; i < Math.min(rows.length, 10); i++) {
        const r = rows[i] || [];
        const textCols = r.filter((c) => typeof c === "string" && c.trim().length > 2);
        const numberCols = r.filter((c) => !isNaN(parseFloat(c)) && isFinite(c));
        if (textCols.length >= 2 && numberCols.length >= 2) {
          headerIdx = i;
          break;
        }
      }
      if (headerIdx === -1) {
        for (let i = 0; i < Math.min(rows.length, 10); i++) {
          const r = rows[i] || [];
          if (r.some((cell) => norm(cell))) {
            headerIdx = i;
            break;
          }
        }
      }
    }
    if (headerIdx === -1) return null;

    const header = rows[headerIdx].map(norm);
    let idxColor = header.findIndex((c) => includes(c, "color"));
    let idxCT = header.findIndex((c) => includes(c, "cutting table")) || header.findIndex((c) => includes(c, "table"));
    let idxTotal = header.findIndex((c) => includes(c, "total"));
    if (idxColor === -1) idxColor = 0;
    if (idxCT === -1) idxCT = idxColor >= 0 ? idxColor + 1 : 1;

    const sizesFromIndex = String(lotInfo.sizes || "").split(",").map(norm).filter(Boolean);

    const sizeCols = [];
    const startIdx = idxCT + 1;
    const endIdx = idxTotal !== -1 ? idxTotal : Math.min(header.length, headerCols);
    if (sizesFromIndex.length) {
      const nameToIdx = new Map(header.map((h, i) => [lc(h), i]));
      for (const nm of sizesFromIndex) {
        const i = nameToIdx.get(lc(nm));
        if (i != null && i >= startIdx && i < endIdx) sizeCols.push({ key: nm, index: i });
      }
    }
    if (!sizeCols.length) {
      for (let i = startIdx; i < endIdx; i++) {
        const label = norm(header[i]);
        if (label && !includes(label, "total") && !includes(label, "alter") && !includes(label, "pcs")) {
          sizeCols.push({ key: label, index: i });
        } else if (!label) {
          sizeCols.push({ key: `Size${i - startIdx + 1}`, index: i });
        }
      }
    }
    if (!sizeCols.length) return null;

    const allColors = new Set();
    for (let r = headerIdx + 1; r < rows.length; r++) {
      const row = rows[r] || [];
      const color = norm(row[idxColor]);
      if (color && !includes(color, "total")) allColors.add(color);
    }

    const body = [];
    for (let r = headerIdx + 1; r < rows.length; r++) {
      const row = rows[r] || [];
      const color = norm(row[idxColor]);
      if (!color) {
        if (body.length) break;
        else continue;
      }
      if (includes(color, "total")) break;

      const cuttingTable = toNumOrNull(row[idxCT]);
      const sizeMap = {};
      let rowTotal = 0;
      let hasAny = false;
      for (const s of sizeCols) {
        const qty = toNumOrNull(row[s.index]);
        sizeMap[s.key] = qty;
        if (qty != null) {
          rowTotal += qty;
          hasAny = true;
        }
      }
      if (!hasAny) continue;
      const explicitTotal = idxTotal !== -1 ? toNumOrNull(row[idxTotal]) : null;
      const totalPcs = explicitTotal ?? rowTotal;
      body.push({ color, cuttingTable, sizes: sizeMap, totalPcs });
    }

    const existingColors = new Set(body.map((r) => r.color));
    for (const c of allColors) {
      if (!existingColors.has(c)) {
        const m = {};
        for (const s of sizeCols) m[s.key] = null;
        body.push({ color: c, cuttingTable: null, sizes: m, totalPcs: 0 });
      }
    }
    body.sort((a, b) => a.color.localeCompare(b.color));
    if (!body.length) return null;

    const sizeKeys = sizeCols.map((s) => s.key);
    const totals = { perSize: {}, grand: 0 };
    for (const k of sizeKeys) totals.perSize[k] = 0;
    for (const row of body) {
      for (const k of sizeKeys) totals.perSize[k] += row.sizes[k] ?? 0;
      totals.grand += row.totalPcs ?? 0;
    }

    return {
      lotNumber,
      style,
      fabric,
      garmentType,
      sizes: sizeKeys,
      rows: body,
      totals,
    };
  }

  const loadShadeMatrixForLot = async (lotNo) => {
    setShadeLoading(true);
    setShadeError(null);
    setLotMeta(null);
    setShadeRows([]);
    setShadeSizes([]);
    setShadeTotals({ perSize: {}, grand: 0 });
    setLotImageUrl(null);
    setLoadedImageUrl(null);

    const ctrl = new AbortController();
    try {
      const idx = await fetchIndexSheet(ctrl.signal);
      const lotInfo = findLotInIndex(idx, lotNo);
      if (!lotInfo) throw new Error(`Lot ${lotNo} not found in Index`);

      if (lotInfo.imageUrl) {
        const imageUrls = getGoogleDriveImageUrls(lotInfo.imageUrl);
        setLotImageUrl(imageUrls);

        const testImage = new Image();
        testImage.onload = () => {
          console.log("Pre-test: Image is accessible");
        };
        testImage.onerror = () => {
          console.log("Pre-test: Image might not be accessible");
        };
        testImage.src = imageUrls[0];
      }

      const parsed = await fetchFromCuttingUsingIndex(lotInfo, ctrl.signal);

      setLotMeta({
        Lot: parsed.lotNumber,
        Style: parsed.style,
        Fabric: parsed.fabric,
        GarmentType: parsed.garmentType,
      });
      setShadeRows(parsed.rows);
      setShadeSizes(parsed.sizes);
      setShadeTotals(parsed.totals);
    } catch (e) {
      setShadeError(e?.message || "Failed to fetch shade matrix.");
    } finally {
      setShadeLoading(false);
    }
  };

  const openShadeMatrix = async () => {
    if (!search || !search.trim()) {
      setShadeError("Enter a Lot No. first.");
      return;
    }
    if (!API_KEY || !INDEX_SHEET_ID || !INDEX_RANGE) {
      setShadeError("Missing Index sheet configuration.");
      return;
    }
    if (!CUTTING_SHEET_ID || !CUTTING_TAB) {
      setShadeError("Missing Cutting sheet configuration.");
      return;
    }
    setActiveTab("matrix");
    await loadShadeMatrixForLot(search);
  };

  // Royal Amethyst Plum Theme: rgb(72 26 123)
  const brand = "rgb(72, 26, 123)";
  const navy = brand;
  const brandGradient = "linear-gradient(135deg, rgb(72, 26, 123) 0%, rgb(105, 38, 180) 100%)";

  const styles = {
    wrapper: {
      fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
      maxWidth: "100%",
      margin: "0 auto",
      padding: "14px 12px",
      background: "linear-gradient(180deg, #fdfbfc 0%, #f7f3fb 50%, #eee8f6 100%)",
      minHeight: "100vh",
      boxSizing: "border-box",
      opacity: showSplash ? 0 : 1,
      transition: "opacity 0.5s ease-in",
    },

    // Floating Dribbble-style Mobile App Header with Amethyst Accent
    header: {
      background: "rgba(255, 255, 255, 0.94)",
      backdropFilter: "blur(20px)",
      WebkitBackdropFilter: "blur(20px)",
      color: brand,
      padding: "12px 16px",
      borderRadius: "22px",
      marginBottom: "14px",
      boxShadow: "0 8px 24px -4px rgba(72, 26, 123, 0.08), 0 1px 2px rgba(72, 26, 123, 0.03)",
      border: "1px solid rgba(72, 26, 123, 0.1)",
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      flexWrap: "nowrap",
      gap: "12px",
    },
    headerLeft: {
      flex: "1",
      minWidth: 0,
    },
    heading: {
      margin: "0 0 2px 0",
      fontSize: "clamp(17px, 4.2vw, 24px)",
      fontWeight: "800",
      letterSpacing: "-0.4px",
      color: brand,
      whiteSpace: "nowrap",
      overflow: "hidden",
      textOverflow: "ellipsis",
    },
    subheading: {
      margin: "0",
      fontSize: "clamp(11px, 2.8vw, 13px)",
      fontWeight: "500",
      color: "#6b7280",
      whiteSpace: "nowrap",
      overflow: "hidden",
      textOverflow: "ellipsis",
    },
    backButton: {
      background: "rgba(72, 26, 123, 0.06)",
      border: "1px solid rgba(72, 26, 123, 0.15)",
      padding: "8px 14px",
      borderRadius: "9999px",
      fontSize: "12px",
      fontWeight: "600",
      cursor: "pointer",
      transition: "all 0.2s ease",
      fontFamily: "inherit",
      display: "flex",
      alignItems: "center",
      gap: "6px",
      color: brand,
      flexShrink: "0",
      boxShadow: "0 1px 3px rgba(0, 0, 0, 0.03)",
    },

    // Amethyst Pill Search Card
    searchSection: {
      background: "#ffffff",
      padding: "16px 14px",
      borderRadius: "22px",
      boxShadow: "0 10px 30px -4px rgba(72, 26, 123, 0.07), 0 2px 4px rgba(72, 26, 123, 0.02)",
      border: "1px solid rgba(72, 26, 123, 0.09)",
      marginBottom: "14px",
    },
    searchForm: {
      display: "flex",
      gap: "10px",
      flexDirection: "column",
    },
    inputGroup: {
      width: "100%",
    },
    searchLabel: {
      display: "block",
      fontWeight: "700",
      color: brand,
      fontSize: "12px",
      marginBottom: "6px",
      letterSpacing: "0.2px",
      textTransform: "uppercase",
    },
    searchInput: {
      width: "100%",
      padding: "12px 18px",
      border: "1.5px solid rgba(72, 26, 123, 0.16)",
      borderRadius: "9999px",
      fontSize: "14px",
      transition: "all 0.2s ease",
      outline: "none",
      boxSizing: "border-box",
      fontFamily: "inherit",
      WebkitAppearance: "none",
      backgroundColor: "#faf8fc",
      color: "#1e1b4b",
      fontWeight: "500",
    },
    buttonGroup: {
      display: "flex",
      gap: "8px",
      width: "100%",
      marginTop: "2px",
    },
    searchButton: {
      background: brandGradient,
      color: "white",
      border: "none",
      padding: "12px 20px",
      borderRadius: "9999px",
      fontSize: "13px",
      fontWeight: "600",
      cursor: "pointer",
      transition: "all 0.2s ease",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      gap: "6px",
      fontFamily: "inherit",
      flex: "1",
      minHeight: "42px",
      boxShadow: "0 4px 14px rgba(72, 26, 123, 0.3)",
    },
    clearButton: {
      background: "rgba(72, 26, 123, 0.05)",
      color: "#4b5563",
      border: "1px solid rgba(72, 26, 123, 0.12)",
      padding: "12px 18px",
      borderRadius: "9999px",
      fontSize: "13px",
      fontWeight: "600",
      cursor: "pointer",
      transition: "all 0.2s ease",
      fontFamily: "inherit",
      flex: "1",
      minHeight: "42px",
    },

    // Results Section Card
    resultsSection: {
      background: "#ffffff",
      borderRadius: "22px",
      boxShadow: "0 12px 36px -4px rgba(72, 26, 123, 0.08), 0 2px 6px rgba(72, 26, 123, 0.03)",
      overflow: "hidden",
      marginBottom: "20px",
      border: "1px solid rgba(72, 26, 123, 0.1)",
      display: showResults ? "block" : "none",
    },
    resultsHeader: {
      background: "#ffffff",
      color: brand,
      padding: "14px 16px",
      borderBottom: "1px solid #f3eff9",
      display: "flex",
      flexDirection: "column",
      gap: "10px",
    },
    resultsTitleRow: {
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      flexWrap: "wrap",
      gap: "8px",
    },
    resultsTitle: {
      margin: "0",
      fontSize: "15px",
      fontWeight: "700",
      color: brand,
      display: "flex",
      alignItems: "center",
      gap: "6px",
    },
    resultsBadge: {
      fontSize: "11px",
      background: "rgba(72, 26, 123, 0.08)",
      color: brand,
      padding: "3px 10px",
      borderRadius: "9999px",
      fontWeight: "700",
      border: "1px solid rgba(72, 26, 123, 0.15)",
    },
    resultsControls: {
      display: "flex",
      flexWrap: "wrap",
      gap: "8px",
      alignItems: "center",
      justifyContent: "space-between",
    },
    downloadButton: {
      background: brandGradient,
      color: "white",
      border: "none",
      padding: "7px 14px",
      borderRadius: "9999px",
      fontSize: "11px",
      fontWeight: "600",
      cursor: "pointer",
      transition: "all 0.2s ease",
      display: "flex",
      alignItems: "center",
      gap: "5px",
      fontFamily: "inherit",
      boxShadow: "0 2px 8px rgba(72, 26, 123, 0.25)",
    },
    downloadButtonDisabled: {
      opacity: 0.4,
      cursor: "not-allowed",
    },
    tabContainer: {
      display: "flex",
      background: "#f4edf9",
      borderRadius: "9999px",
      padding: "3px",
      gap: "2px",
      border: "1px solid rgba(72, 26, 123, 0.1)",
    },
    tab: {
      padding: "6px 14px",
      borderRadius: "9999px",
      border: "none",
      background: "transparent",
      color: "#6b7280",
      cursor: "pointer",
      fontWeight: "600",
      transition: "all 0.2s ease",
      fontSize: "11px",
      textAlign: "center",
    },
    activeTab: {
      background: "#ffffff",
      color: brand,
      boxShadow: "0 2px 8px rgba(72, 26, 123, 0.12)",
      fontWeight: "700",
    },

    resultsContent: {
      padding: "0",
      overflow: "hidden",
    },
    tableContainer: {
      overflowX: "auto",
      overflowY: "auto",
      maxHeight: "62vh",
      WebkitOverflowScrolling: "touch",
    },
    table: {
      width: "100%",
      borderCollapse: "separate",
      borderSpacing: 0,
      minWidth: "500px",
    },
    tableHeaderCell: {
      padding: "10px 12px",
      textAlign: "center",
      fontWeight: "700",
      color: brand,
      border: "1px solid #f1eaf7",
      fontSize: "11px",
      textTransform: "uppercase",
      letterSpacing: "0.4px",
      whiteSpace: "nowrap",
      backgroundColor: "#faf7fc",
    },
    tableCell: {
      padding: "10px 12px",
      border: "1px solid #f5eff9",
      color: "#1e1b4b",
      fontSize: "12px",
      textAlign: "center",
      whiteSpace: "nowrap",
      backgroundColor: "#ffffff",
    },
    totalRow: {
      backgroundColor: "#faf7fc",
      fontWeight: "700",
    },
    totalCell: {
      padding: "10px 12px",
      border: "1px solid #f1eaf7",
      color: brand,
      fontSize: "12px",
      fontWeight: "800",
      textAlign: "center",
      backgroundColor: "#faf7fc",
    },

    // Sticky column styles for pinned first column
    stickyColHeader: {
      position: "sticky",
      left: 0,
      zIndex: 10,
      backgroundColor: "#faf7fc",
      borderRight: "2px solid #e7ddf2",
      boxShadow: "3px 0 6px -2px rgba(72, 26, 123, 0.08)",
    },
    stickyColCell: {
      position: "sticky",
      left: 0,
      zIndex: 5,
      backgroundColor: "#ffffff",
      fontWeight: "700",
      color: brand,
      borderRight: "2px solid #e7ddf2",
      boxShadow: "3px 0 6px -2px rgba(72, 26, 123, 0.08)",
    },
    stickyColTotal: {
      position: "sticky",
      left: 0,
      zIndex: 5,
      backgroundColor: "#faf7fc",
      borderRight: "2px solid #e7ddf2",
      boxShadow: "3px 0 6px -2px rgba(72, 26, 123, 0.08)",
    },

    // Horizontal scroll hint banner
    scrollHint: {
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      gap: "6px",
      padding: "6px 12px",
      backgroundColor: "#faf7fc",
      color: brand,
      fontSize: "11px",
      fontWeight: "600",
      borderBottom: "1px solid #f1eaf7",
      textAlign: "center",
    },

    // Matrix specific styles
    shadeMeta: {
      padding: "10px 14px",
      backgroundColor: "#fdfbfe",
      borderBottom: "1px solid #f3eff9",
      display: "flex",
      flexWrap: "wrap",
      gap: "8px",
      alignItems: "center",
    },
    metaChip: {
      display: "inline-flex",
      alignItems: "center",
      gap: "5px",
      fontSize: "12px",
      backgroundColor: "#ffffff",
      border: "1px solid rgba(72, 26, 123, 0.15)",
      padding: "4px 12px",
      borderRadius: "9999px",
      boxShadow: "0 1px 3px rgba(72, 26, 123, 0.04)",
    },
    metaLabel: {
      fontWeight: "700",
      color: brand,
      fontSize: "11px",
      textTransform: "uppercase",
      letterSpacing: "0.3px",
    },
    metaVal: {
      color: "#4b5563",
      fontWeight: "500",
    },
    imageContainer: {
      padding: "10px 14px",
      backgroundColor: "#fdfbfe",
      borderBottom: "1px solid #f3eff9",
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      flexWrap: "wrap",
      gap: "8px",
    },
    viewImageButton: {
      background: brandGradient,
      color: "white",
      border: "none",
      padding: "7px 14px",
      borderRadius: "9999px",
      fontSize: "11px",
      fontWeight: "600",
      cursor: "pointer",
      transition: "all 0.2s ease",
      display: "flex",
      alignItems: "center",
      gap: "5px",
      fontFamily: "inherit",
      boxShadow: "0 2px 8px rgba(72, 26, 123, 0.25)",
    },
    viewImageButtonDisabled: {
      opacity: 0.5,
      cursor: "not-allowed",
    },
    shadeTableContainer: {
      overflowX: "auto",
      overflowY: "auto",
      maxHeight: "62vh",
      WebkitOverflowScrolling: "touch",
    },
    shadeTable: {
      width: "100%",
      borderCollapse: "separate",
      borderSpacing: 0,
      minWidth: "550px",
    },
    shadeHeaderCell: {
      padding: "9px 10px",
      textAlign: "center",
      fontWeight: "600",
      color: "#0f172a",
      border: "1px solid #cbd5e1",
      fontSize: "11px",
      whiteSpace: "nowrap",
      backgroundColor: "#f8fafc",
    },
    shadeCell: {
      padding: "8px 10px",
      border: "1px solid #e2e8f0",
      color: "#334155",
      fontSize: "11px",
      textAlign: "center",
      whiteSpace: "nowrap",
      backgroundColor: "#ffffff",
    },

    modalOverlay: {
      position: "fixed",
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: "rgba(0, 0, 0, 0.88)",
      display: "flex",
      justifyContent: "center",
      alignItems: "center",
      zIndex: 1000,
      cursor: "pointer",
      backdropFilter: "blur(4px)",
      padding: "16px",
      boxSizing: "border-box",
    },
    modalContent: {
      maxWidth: "92vw",
      maxHeight: "90vh",
      position: "relative",
      backgroundColor: "#fff",
      borderRadius: "14px",
      padding: "16px",
      display: "flex",
      justifyContent: "center",
      alignItems: "center",
      boxShadow: "0 8px 30px rgba(0,0,0,0.3)",
      boxSizing: "border-box",
    },
    modalImage: {
      maxWidth: "100%",
      maxHeight: "75vh",
      objectFit: "contain",
      borderRadius: "8px",
    },
    closeModalButton: {
      position: "absolute",
      top: "8px",
      right: "8px",
      background: navy,
      color: "white",
      border: "none",
      borderRadius: "50%",
      width: "30px",
      height: "30px",
      fontSize: "16px",
      cursor: "pointer",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      boxShadow: "0 2px 8px rgba(0,0,0,0.2)",
      zIndex: 1001,
    },

    loadingSpinner: {
      width: "32px",
      height: "32px",
      border: "3px solid #f3f4f6",
      borderTop: `3px solid ${navy}`,
      borderRadius: "50%",
      animation: "spin 1s linear infinite",
    },
    loading: {
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      padding: "36px 16px",
      gap: "12px",
    },
    error: {
      backgroundColor: "#fef2f2",
      color: "#dc2626",
      padding: "14px",
      borderRadius: "10px",
      margin: "14px",
      display: "flex",
      alignItems: "center",
      gap: "10px",
      border: "1px solid #fecaca",
      fontSize: "13px",
    },
    empty: {
      backgroundColor: "#f8fafc",
      color: navy,
      padding: "24px 16px",
      textAlign: "center",
      borderRadius: "10px",
      margin: "14px",
      border: "1px solid #e2e8f0",
      fontSize: "13px",
    },
  };

  const animations = `
    @keyframes spin { 
      0% { transform: rotate(0deg); } 
      100% { transform: rotate(360deg); } 
    }
    @keyframes fadeIn { 
      0% { opacity: 0; transform: translateY(6px); } 
      100% { opacity: 1; transform: translateY(0); } 
    }
    .results-section { animation: fadeIn 0.25s ease-out; }
    .search-input:focus {
      border-color: ${navy} !important;
      box-shadow: 0 0 0 3px rgba(10, 37, 64, 0.12) !important;
    }
    button:active {
      transform: scale(0.97);
    }
    .table-scroll-container::-webkit-scrollbar {
      height: 6px;
      width: 6px;
    }
    .table-scroll-container::-webkit-scrollbar-track {
      background: #f1f5f9;
      border-radius: 4px;
    }
    .table-scroll-container::-webkit-scrollbar-thumb {
      background: #cbd5e1;
      border-radius: 4px;
    }
    .table-scroll-container::-webkit-scrollbar-thumb:hover {
      background: #94a3b8;
    }

    @media (min-width: 768px) {
      .mobile-scroll-hint {
        display: none !important;
      }
    }
    @media (max-width: 640px) {
      .wrapper {
        padding: 10px 10px 24px !important;
      }
      .app-header {
        padding: 12px 14px !important;
        border-radius: 14px !important;
        margin-bottom: 12px !important;
      }
      .search-card {
        padding: 14px !important;
        border-radius: 14px !important;
        margin-bottom: 12px !important;
      }
      .search-btn-group {
        display: flex !important;
        flex-direction: row !important;
        gap: 8px !important;
      }
      .results-card {
        border-radius: 14px !important;
        margin-bottom: 14px !important;
      }
      .results-header-box {
        padding: 12px 14px !important;
      }
      .table-scroll-container {
        max-height: 56vh !important;
      }
    }
  `;

  return (
    <>
      {showSplash && <SplashScreen onFinish={() => setShowSplash(false)} />}

      <div style={styles.wrapper} className="wrapper">
        <style>{animations}</style>

        {/* Header with integrated Back Button */}
        <header style={styles.header} className="app-header">
          <div style={styles.headerLeft}>
            <h1 style={styles.heading}>📦 Quantity Finder</h1>
            <p style={styles.subheading}>Professional inventory management</p>
          </div>
          <button onClick={handleGoBack} style={styles.backButton}>
            <span>←</span> Back
          </button>
        </header>

        <section style={styles.searchSection} className="search-card">
          <form onSubmit={handleSearch} style={styles.searchForm}>
            <div style={styles.inputGroup}>
              <label htmlFor="lot-search" style={styles.searchLabel}>
                Search by Lot Number
              </label>
              <input
                id="lot-search"
                type="search"
                placeholder="Enter Lot No. (e.g. JO11001 or 11001)"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                style={styles.searchInput}
                className="search-input"
              />
            </div>

            <div style={styles.buttonGroup} className="search-btn-group">
              <button
                type="submit"
                style={{
                  ...styles.searchButton,
                  ...(loading ? { opacity: 0.8, cursor: "not-allowed" } : {}),
                }}
                disabled={loading}
              >
                {loading ? (
                  <>
                    <div
                      style={{
                        width: "16px",
                        height: "16px",
                        border: "2px solid transparent",
                        borderTop: "2px solid white",
                        borderRadius: "50%",
                        animation: "spin 1s linear infinite",
                      }}
                    />
                    Searching...
                  </>
                ) : (
                  <>
                    <span>🔍</span>
                    Find
                  </>
                )}
              </button>

              {search && (
                <button
                  type="button"
                  style={styles.clearButton}
                  onClick={handleClearSearch}
                >
                  Clear
                </button>
              )}
            </div>
          </form>
        </section>

        {showResults && (
          <section style={styles.resultsSection} className="results-section results-card">
            <div style={styles.resultsHeader} className="results-header-box">
              <div style={styles.resultsTitleRow}>
                <h2 style={styles.resultsTitle}>
                  Results for "{search}"
                  {rows.length > 0 && !isFiveDigit(search) && (
                    <span style={styles.resultsBadge}>
                      {rows.length}
                    </span>
                  )}
                </h2>
              </div>

              <div style={styles.resultsControls}>
                <button
                  onClick={downloadPDF}
                  disabled={downloading || (!rows.length && !shadeRows.length)}
                  style={{
                    ...styles.downloadButton,
                    ...((downloading || (!rows.length && !shadeRows.length)) ? styles.downloadButtonDisabled : {}),
                  }}
                >
                  {downloading ? (
                    <>
                      <div
                        style={{
                          width: "14px",
                          height: "14px",
                          border: "2px solid transparent",
                          borderTop: "2px solid white",
                          borderRadius: "50%",
                          animation: "spin 1s linear infinite",
                        }}
                      />
                      PDF...
                    </>
                  ) : (
                    <>
                      <span>📄</span>
                      PDF
                    </>
                  )}
                </button>

                <div style={styles.tabContainer}>
                  <button
                    style={{ ...styles.tab, ...(activeTab === "details" ? styles.activeTab : {}) }}
                    onClick={() => setActiveTab("details")}
                  >
                    📋 Details
                  </button>
                  <button
                    style={{ ...styles.tab, ...(activeTab === "matrix" ? styles.activeTab : {}) }}
                    onClick={() => {
                      if (isFiveDigit(search)) return;
                      openShadeMatrix();
                    }}
                    disabled={isFiveDigit(search)}
                  >
                    📊 Matrix
                  </button>
                </div>
              </div>
            </div>

            <div style={styles.resultsContent} ref={resultsRef}>
              {activeTab === "details" && (
                <>
                  {loading && (
                    <div style={styles.loading}>
                      <div style={styles.loadingSpinner} />
                      <p>Loading details...</p>
                    </div>
                  )}

                  {error && (
                    <div style={styles.error}>
                      <span>❌</span>
                      <div>
                        <strong>Error:</strong> {error}
                      </div>
                    </div>
                  )}

                  {!loading && !error && rows.length > 0 && (
                    <>
                      <div className="mobile-scroll-hint" style={styles.scrollHint}>
                        <span>↔️ Swipe horizontally to view all columns</span>
                      </div>
                      <div style={styles.tableContainer} className="table-scroll-container">
                        <table style={styles.table}>
                          <thead>
                            <tr>
                              {filteredHeaders.map((col, index) => (
                                <th
                                  key={col}
                                  style={{
                                    ...styles.tableHeaderCell,
                                    ...(index === 0 ? styles.stickyColHeader : {}),
                                  }}
                                  className="table-header-cell"
                                >
                                  {col}
                                </th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {rows.map((r, idx) => (
                              <tr key={idx}>
                                {filteredHeaders.map((col, index) => (
                                  <td
                                    key={col}
                                    style={{
                                      ...styles.tableCell,
                                      ...(index === 0 ? styles.stickyColCell : {}),
                                    }}
                                    className="table-data-cell"
                                  >
                                    {col === itemNameHeader ? simplifyItemName(r[col]) : r[col]}
                                  </td>
                                ))}
                              </tr>
                            ))}
                            {quantityColumn && (
                              <tr style={styles.totalRow}>
                                {filteredHeaders.map((col, index) => {
                                  if (col === quantityColumn) {
                                    return (
                                      <td
                                        key={col}
                                        style={{
                                          ...styles.totalCell,
                                          ...(index === 0 ? styles.stickyColTotal : {}),
                                        }}
                                        className="table-data-cell"
                                      >
                                        Total: {calculateTotalQuantity()}
                                      </td>
                                    );
                                  } else if (index === 0) {
                                    return (
                                      <td
                                        key={col}
                                        style={{
                                          ...styles.totalCell,
                                          ...styles.stickyColTotal,
                                        }}
                                        className="table-data-cell"
                                      >
                                        Total
                                      </td>
                                    );
                                  } else {
                                    return <td key={col} style={styles.totalCell} className="table-data-cell" />;
                                  }
                                })}
                              </tr>
                            )}
                          </tbody>
                        </table>
                      </div>
                    </>
                  )}

                  {!loading && !error && rows.length === 0 && (
                    <div style={styles.empty}>
                      <p>No results found for "{search}". Try a different lot number.</p>
                    </div>
                  )}
                </>
              )}

              {activeTab === "matrix" && (
                <div>
                  {shadeLoading && (
                    <div style={styles.loading}>
                      <div style={styles.loadingSpinner} />
                      <p>Loading size matrix...</p>
                    </div>
                  )}

                  {shadeError && (
                    <div style={styles.error}>
                      <span>❌</span>
                      <div>
                        <strong>Error:</strong> {shadeError}
                      </div>
                    </div>
                  )}

                  {!shadeLoading && !shadeError && lotMeta && (
                    <>
                      {lotImageUrl && (
                        <div style={styles.imageContainer} className="image-banner">
                          <span style={{ ...styles.metaLabel, fontSize: "12px", textTransform: "none" }}>📷 Lot Image Available</span>
                          <div style={{ display: "flex", gap: "6px", alignItems: "center" }}>
                            <button
                              onClick={loadImageForModal}
                              style={styles.viewImageButton}
                              disabled={imageLoading}
                            >
                              {imageLoading ? (
                                <>
                                  <div
                                    style={{
                                      width: "12px",
                                      height: "12px",
                                      border: "2px solid transparent",
                                      borderTop: "2px solid white",
                                      borderRadius: "50%",
                                      animation: "spin 1s linear infinite",
                                    }}
                                  />
                                  Loading...
                                </>
                              ) : (
                                <>
                                  <span>👁️</span>
                                  View
                                </>
                              )}
                            </button>
                            <button
                              onClick={downloadPDF}
                              style={{
                                ...styles.viewImageButton,
                                ...(downloading ? styles.viewImageButtonDisabled : {}),
                              }}
                              disabled={downloading}
                            >
                              {downloading ? (
                                <>
                                  <div
                                    style={{
                                      width: "12px",
                                      height: "12px",
                                      border: "2px solid transparent",
                                      borderTop: "2px solid white",
                                      borderRadius: "50%",
                                      animation: "spin 1s linear infinite",
                                    }}
                                  />
                                  PDF...
                                </>
                              ) : (
                                <>
                                  <span>📄</span>
                                  PDF with Image
                                </>
                              )}
                            </button>
                          </div>
                        </div>
                      )}

                      <div style={styles.shadeMeta} className="meta-chip-box">
                        <div style={styles.metaChip}>
                          <span style={styles.metaLabel}>Lot:</span>
                          <span style={styles.metaVal}>{lotMeta.Lot}</span>
                        </div>
                        {lotMeta.Style && (
                          <div style={styles.metaChip}>
                            <span style={styles.metaLabel}>Style:</span>
                            <span style={styles.metaVal}>{lotMeta.Style}</span>
                          </div>
                        )}
                        {lotMeta.Fabric && (
                          <div style={styles.metaChip}>
                            <span style={styles.metaLabel}>Fabric:</span>
                            <span style={styles.metaVal}>{lotMeta.Fabric}</span>
                          </div>
                        )}
                        {lotMeta.GarmentType && (
                          <div style={styles.metaChip}>
                            <span style={styles.metaLabel}>Garment:</span>
                            <span style={styles.metaVal}>{lotMeta.GarmentType}</span>
                          </div>
                        )}
                        {shadeSizes.length > 0 && (
                          <div style={styles.metaChip}>
                            <span style={styles.metaLabel}>Sizes:</span>
                            <span style={styles.metaVal}>{shadeSizes.join(", ")}</span>
                          </div>
                        )}
                      </div>

                      <div className="mobile-scroll-hint" style={styles.scrollHint}>
                        <span>↔️ Swipe horizontally to view all sizes</span>
                      </div>
                      <div style={styles.shadeTableContainer} className="table-scroll-container">
                        <table style={styles.shadeTable}>
                          <thead>
                            <tr>
                              <th style={{ ...styles.shadeHeaderCell, ...styles.stickyColHeader }} className="table-header-cell">Shade</th>
                              <th style={styles.shadeHeaderCell} className="table-header-cell">CT</th>
                              {shadeSizes.map((size) => (
                                <th key={size} style={styles.shadeHeaderCell} className="table-header-cell">
                                  {size}
                                </th>
                              ))}
                              <th style={styles.shadeHeaderCell} className="table-header-cell">Total</th>
                            </tr>
                          </thead>
                          <tbody>
                            {shadeRows.map((row, index) => (
                              <tr key={index}>
                                <td style={{ ...styles.shadeCell, ...styles.stickyColCell }} className="table-data-cell">{row.color}</td>
                                <td style={styles.shadeCell} className="table-data-cell">{row.cuttingTable ?? "—"}</td>
                                {shadeSizes.map((size) => (
                                  <td key={size} style={styles.shadeCell} className="table-data-cell">
                                    {row.sizes?.[size] ?? ""}
                                  </td>
                                ))}
                                <td style={styles.shadeCell} className="table-data-cell">{row.totalPcs ?? ""}</td>
                              </tr>
                            ))}
                          </tbody>
                          <tfoot>
                            <tr style={styles.totalRow}>
                              <td style={{ ...styles.totalCell, ...styles.stickyColTotal }} className="table-data-cell">Total</td>
                              <td style={styles.totalCell} className="table-data-cell">—</td>
                              {shadeSizes.map((size) => (
                                <td key={size} style={styles.totalCell} className="table-data-cell">
                                  {shadeRows.reduce((sum, r) => sum + (r.sizes?.[size] ?? 0), 0)}
                                </td>
                              ))}
                              <td style={styles.totalCell} className="table-data-cell">{shadeTotals?.grand ?? 0}</td>
                            </tr>
                          </tfoot>
                        </table>
                      </div>
                    </>
                  )}

                  {!shadeLoading && !shadeError && !lotMeta && (
                    <div style={styles.empty}>
                      <p>No matrix data available for this lot.</p>
                    </div>
                  )}
                </div>
              )}
            </div>
          </section>
        )}

        {showImageModal && (
          <div style={styles.modalOverlay} onClick={() => {
            setShowImageModal(false);
            setLoadedImageUrl(null);
          }}>
            <div style={{ ...styles.modalContent, flexDirection: "column", gap: "12px" }} onClick={(e) => e.stopPropagation()}>
              <button
                style={styles.closeModalButton}
                onClick={() => {
                  setShowImageModal(false);
                  setLoadedImageUrl(null);
                }}
              >
                ×
              </button>
              {imageLoading ? (
                <div style={{ textAlign: "center", padding: "20px" }}>
                  <div style={styles.loadingSpinner} />
                  <p style={{ marginTop: "16px", color: navy, fontSize: "13px" }}>Loading image...</p>
                </div>
              ) : loadedImageUrl ? (
                <>
                  <img src={loadedImageUrl} alt="Lot Preview" style={styles.modalImage} />
                  <button
                    onClick={downloadPDF}
                    style={{
                      ...styles.viewImageButton,
                      marginTop: "8px",
                      ...(downloading ? styles.viewImageButtonDisabled : {}),
                    }}
                    disabled={downloading}
                  >
                    {downloading ? (
                      <>
                        <div
                          style={{
                            width: "14px",
                            height: "14px",
                            border: "2px solid transparent",
                            borderTop: "2px solid white",
                            borderRadius: "50%",
                            animation: "spin 1s linear infinite",
                          }}
                        />
                        Generating PDF...
                      </>
                    ) : (
                      <>
                        <span>📄</span>
                        Download PDF with Image
                      </>
                    )}
                  </button>
                </>
              ) : (
                <p style={{ color: navy }}>No image available</p>
              )}
            </div>
          </div>
        )}

        {!showResults && !loading && (
          <div style={styles.empty}>
            <p>Enter a Lot Number above to search for quantities. 5-digit lots (like 11001) will automatically load the size matrix.</p>
          </div>
        )}
      </div>
    </>
  );
}