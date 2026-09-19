// Dashboard.jsx
import React from 'react';
import { useNavigate } from 'react-router-dom';

const Dashboard = () => {
  const navigate = useNavigate();

  const handleLotQuantityClick = () => {
    navigate('/lot-quantity');
  };

  const handleLotImageClick = () => {
    navigate('/lot-image');
  };

  // Internal CSS styles - Royal Amethyst Plum Theme: rgb(72 26 123)
  const brand = 'rgb(72, 26, 123)';
  const brandGradient = 'linear-gradient(135deg, rgb(72, 26, 123) 0%, rgb(105, 38, 180) 100%)';

  const styles = {
    container: {
      minHeight: '100vh',
      background: 'linear-gradient(180deg, #fdfbfc 0%, #f7f3fb 50%, #eee8f6 100%)',
      padding: '28px 16px',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      boxSizing: 'border-box',
    },
    title: {
      textAlign: 'center',
      color: brand,
      fontSize: '26px',
      fontWeight: '800',
      marginBottom: '24px',
      letterSpacing: '-0.4px',
    },
    cardsContainer: {
      display: 'flex',
      flexDirection: 'column',
      gap: '16px',
      maxWidth: '400px',
      margin: '0 auto',
    },
    card: {
      background: '#ffffff',
      borderRadius: '24px',
      padding: '28px 22px',
      cursor: 'pointer',
      transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
      boxShadow: '0 12px 32px -4px rgba(72, 26, 123, 0.08), 0 2px 4px rgba(72, 26, 123, 0.02)',
      textAlign: 'center',
      border: '1px solid rgba(72, 26, 123, 0.1)',
      outline: 'none',
    },
    cardActive: {
      transform: 'scale(0.98)',
    },
    cardIcon: {
      fontSize: '32px',
      width: '64px',
      height: '64px',
      lineHeight: '64px',
      borderRadius: '20px',
      background: 'rgba(72, 26, 123, 0.05)',
      border: '1px solid rgba(72, 26, 123, 0.12)',
      margin: '0 auto 16px',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      boxShadow: '0 2px 6px rgba(72, 26, 123, 0.04)',
    },
    cardTitle: {
      fontSize: '20px',
      fontWeight: '800',
      color: brand,
      marginBottom: '6px',
      letterSpacing: '-0.2px',
    },
    cardDescription: {
      fontSize: '13px',
      color: '#6b7280',
      marginBottom: '20px',
      lineHeight: '1.5',
      fontWeight: '400',
    },
    cardButton: {
      background: brandGradient,
      color: 'white',
      border: 'none',
      padding: '12px 28px',
      borderRadius: '9999px',
      fontSize: '13px',
      fontWeight: '600',
      cursor: 'pointer',
      transition: 'all 0.2s ease',
      width: '100%',
      maxWidth: '200px',
      margin: '0 auto',
      boxShadow: '0 4px 14px rgba(72, 26, 123, 0.3)',
    },
    quantityCard: {},
    imageCard: {},
  };

  // Handle touch/click events with visual feedback
  const handleCardTouchStart = (e) => {
    e.currentTarget.style.transform = 'scale(0.98)';
    e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,0,0,0.15)';
  };

  const handleCardTouchEnd = (e) => {
    e.currentTarget.style.transform = 'scale(1)';
    e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.1)';
  };

  return (
    <div style={styles.container}>
      <h1 style={styles.title}>Quantity and Image finder</h1>

      <div style={styles.cardsContainer}>
        {/* Lot Quantity Card */}
        <div
          style={{
            ...styles.card,
            ...styles.quantityCard,
          }}
          onClick={handleLotQuantityClick}
          onTouchStart={handleCardTouchStart}
          onTouchEnd={handleCardTouchEnd}
          onMouseDown={handleCardTouchStart}
          onMouseUp={handleCardTouchEnd}
          role="button"
          tabIndex={0}
          aria-label="Navigate to Lot Quantity"
        >
          <div style={styles.cardIcon}>📊</div>
          <h2 style={styles.cardTitle}>Lot Quantity</h2>
          <p style={styles.cardDescription}>
            View and manage inventory quantities
          </p>
          <button
            style={styles.cardButton}
            onClick={(e) => {
              e.stopPropagation();
              handleLotQuantityClick();
            }}
          >
            View Details →
          </button>
        </div>

        {/* Lot Image Card */}
        <div
          style={{
            ...styles.card,
            ...styles.imageCard,
          }}
          onClick={handleLotImageClick}
          onTouchStart={handleCardTouchStart}
          onTouchEnd={handleCardTouchEnd}
          onMouseDown={handleCardTouchStart}
          onMouseUp={handleCardTouchEnd}
          role="button"
          tabIndex={0}
          aria-label="Navigate to Lot Image"
        >
          <div style={styles.cardIcon}>🖼️</div>
          <h2 style={styles.cardTitle}>Lot Image</h2>
          <p style={styles.cardDescription}>
            View and manage lot photographs
          </p>
          <button
            style={styles.cardButton}
            onClick={(e) => {
              e.stopPropagation();
              handleLotImageClick();
            }}
          >
            View Details →
          </button>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;