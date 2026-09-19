import React, { useState, useEffect } from "react";

const SplashScreen = ({ onFinish }) => {
  const [isVisible, setIsVisible] = useState(true);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    // Simulate loading progress
    const progressInterval = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 100) {
          clearInterval(progressInterval);
          return 100;
        }
        return prev + 10;
      });
    }, 100);

    // Hide splash screen after delay
    const timer = setTimeout(() => {
      setIsVisible(false);
      setTimeout(onFinish, 400); // Wait for fade out animation
    }, 1500);

    return () => {
      clearInterval(progressInterval);
      clearTimeout(timer);
    };
  }, [onFinish]);

  const splashStyles = {
    container: {
      position: "fixed",
      top: 0,
      left: 0,
      width: "100%",
      height: "100%",
      backgroundColor: "rgb(72, 26, 123)",
      background: "linear-gradient(135deg, rgb(72, 26, 123) 0%, rgb(105, 38, 180) 100%)",
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      zIndex: 9999,
      transition: "opacity 0.4s ease-out",
      opacity: isVisible ? 1 : 0,
      pointerEvents: isVisible ? "auto" : "none",
    },
    logoContainer: {
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      marginBottom: "40px",
    },
    logo: {
      width: "80px",
      height: "80px",
      marginBottom: "20px",
      animation: "pulse 1.5s infinite alternate",
    },
    appName: {
      color: "white",
      fontSize: "2.5rem",
      fontWeight: "700",
      margin: "0 0 10px 0",
      letterSpacing: "1px",
    },
    tagline: {
      color: "rgba(255, 255, 255, 0.85)",
      fontSize: "1.1rem",
      margin: 0,
    },
    progressContainer: {
      width: "300px",
      height: "6px",
      backgroundColor: "rgba(255, 255, 255, 0.2)",
      borderRadius: "3px",
      overflow: "hidden",
      marginBottom: "20px",
    },
    progressBar: {
      height: "100%",
      width: `${progress}%`,
      backgroundColor: "white",
      borderRadius: "3px",
      transition: "width 0.2s ease",
    },
    loadingText: {
      color: "white",
      fontSize: "0.9rem",
      margin: 0,
    },
    company: {
      position: "absolute",
      bottom: "30px",
      color: "rgba(255, 255, 255, 0.7)",
      fontSize: "0.9rem",
    },
  };

  return (
    <div style={splashStyles.container}>
      <style>
        {`
          @keyframes pulse {
            0% { transform: scale(1); }
            50% { transform: scale(1.05); }
            100% { transform: scale(1); }
          }
        `}
      </style>
      <div style={splashStyles.logoContainer}>
        <div style={splashStyles.logo}>
          <svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
            <circle cx="50" cy="50" r="45" fill="white" />
            <path
              d="M35,30 L65,30 L75,50 L65,70 L35,70 L25,50 Z"
              fill="rgb(72, 26, 123)"
            />
            <circle cx="50" cy="50" r="15" fill="rgb(105, 38, 180)" />
          </svg>
        </div>
        <h1 style={splashStyles.appName}>InventoryPro</h1>
        <p style={splashStyles.tagline}>Smart Inventory Management</p>
      </div>
      
      <div style={splashStyles.progressContainer}>
        <div style={splashStyles.progressBar}></div>
      </div>
      
      <p style={splashStyles.loadingText}>
        {progress < 100 ? "Loading inventory data..." : "Ready!"}
      </p>
    </div>
  );
};

export default SplashScreen;