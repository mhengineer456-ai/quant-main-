// UnauthorizedAccess.jsx
import React from 'react';

const UnauthorizedAccess = ({ errorMessage, userDistance }) => {
  return (
    <div style={{
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      height: '100vh',
      backgroundColor: '#f5f5f5',
      fontFamily: 'Arial, sans-serif'
    }}>
      <div style={{
        textAlign: 'center',
        padding: '40px',
        backgroundColor: 'white',
        borderRadius: '8px',
        boxShadow: '0 2px 10px rgba(0,0,0,0.1)',
        maxWidth: '500px'
      }}>
        <div style={{ fontSize: '48px', marginBottom: '20px' }}>📍🚫</div>
        <h1 style={{ color: '#d32f2f' }}>Access Restricted</h1>
        <p style={{ fontSize: '16px', margin: '20px 0', lineHeight: '1.5' }}>
          This application can only be accessed from within the organization's premises.
        </p>
        {userDistance && (
          <p style={{ 
            fontSize: '14px', 
            color: '#ff9800', 
            backgroundColor: '#fff3e0',
            padding: '10px',
            borderRadius: '5px',
            marginTop: '10px'
          }}>
            ⚠️ You are approximately {userDistance} meters away from the organization.
          </p>
        )}
        {errorMessage && (
          <p style={{ fontSize: '14px', color: '#666', marginTop: '10px' }}>
            {errorMessage}
          </p>
        )}
        <button 
          onClick={() => window.location.reload()}
          style={{
            marginTop: '20px',
            padding: '10px 20px',
            backgroundColor: '#1976d2',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer',
            fontSize: '16px'
          }}
        >
          Try Again
        </button>
        <p style={{ fontSize: '12px', color: '#999', marginTop: '20px' }}>
          Make sure location services are enabled and you are within the organization premises.
        </p>
      </div>
    </div>
  );
};

export default UnauthorizedAccess;