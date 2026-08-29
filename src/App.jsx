// App.jsx
import React, { useEffect, useState } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Dashboard from './Dashboard';
import LotQuantity from './LotQuantity';
import LotImage from './LotImage';
import UnauthorizedAccess from './UnauthorizedAccess.jsx';

// Organization's location coordinates
const ORGANIZATION_LOCATION = {
  latitude: 30.9544768,
  longitude: 75.8577128,
  radiusInMeters: 500  // 500 meters radius from your organization
};

// Calculate distance between two coordinates using Haversine formula
const calculateDistance = (lat1, lon1, lat2, lon2) => {
  const R = 6371e3; // Earth's radius in meters
  const φ1 = lat1 * Math.PI / 180;
  const φ2 = lat2 * Math.PI / 180;
  const Δφ = (lat2 - lat1) * Math.PI / 180;
  const Δλ = (lon2 - lon1) * Math.PI / 180;

  const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
            Math.cos(φ1) * Math.cos(φ2) *
            Math.sin(Δλ/2) * Math.sin(Δλ/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));

  return R * c; // Distance in meters
};

function App() {
  const [isAuthorized, setIsAuthorized] = useState(null);
  const [locationError, setLocationError] = useState(null);
  const [userDistance, setUserDistance] = useState(null);

  useEffect(() => {
    const checkLocationAccess = () => {
      if (!navigator.geolocation) {
        setLocationError("Geolocation is not supported by your browser");
        setIsAuthorized(false);
        return;
      }

      // Show loading indicator
      console.log("Checking location access...");
      
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const userLat = position.coords.latitude;
          const userLng = position.coords.longitude;
          
          const distance = calculateDistance(
            userLat, 
            userLng, 
            ORGANIZATION_LOCATION.latitude, 
            ORGANIZATION_LOCATION.longitude
          );
          
          setUserDistance(Math.round(distance));
          console.log(`Distance from organization: ${Math.round(distance)} meters`);
          console.log(`User location: ${userLat}, ${userLng}`);
          console.log(`Organization location: ${ORGANIZATION_LOCATION.latitude}, ${ORGANIZATION_LOCATION.longitude}`);
          
          if (distance <= ORGANIZATION_LOCATION.radiusInMeters) {
            console.log("✅ Access granted - Within organization premises");
            setIsAuthorized(true);
          } else {
            console.log("❌ Access denied - Outside organization premises");
            setIsAuthorized(false);
            setLocationError(`You are ${Math.round(distance)} meters away from the organization. Access is only allowed within ${ORGANIZATION_LOCATION.radiusInMeters} meters.`);
          }
        },
        (error) => {
          console.error("Location error:", error);
          switch(error.code) {
            case error.PERMISSION_DENIED:
              setLocationError("Location access denied. Please enable location services to access this application.");
              break;
            case error.POSITION_UNAVAILABLE:
              setLocationError("Location information is unavailable. Please check your GPS/network connection.");
              break;
            case error.TIMEOUT:
              setLocationError("Location request timed out. Please try again.");
              break;
            default:
              setLocationError("An error occurred while getting your location.");
          }
          setIsAuthorized(false);
        },
        {
          enableHighAccuracy: true,  // Use GPS for better accuracy
          timeout: 10000,
          maximumAge: 0
        }
      );
    };

    checkLocationAccess();
  }, []);

  if (isAuthorized === null) {
    return (
      <div style={{ 
        display: 'flex', 
        justifyContent: 'center', 
        alignItems: 'center', 
        height: '100vh',
        flexDirection: 'column',
        fontFamily: 'Arial, sans-serif'
      }}>
        <h2>📍 Verifying Location Access...</h2>
        <p>Please allow location access when prompted by your browser.</p>
        <p style={{ fontSize: '12px', color: '#666' }}>Checking if you're within organization premises...</p>
      </div>
    );
  }

  if (!isAuthorized) {
    return <UnauthorizedAccess errorMessage={locationError} userDistance={userDistance} />;
  }

  return (
    <Router>
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/lot-quantity" element={<LotQuantity />} />
        <Route path="/lot-image" element={<LotImage />} />
      </Routes>
    </Router>
  );
}

export default App;