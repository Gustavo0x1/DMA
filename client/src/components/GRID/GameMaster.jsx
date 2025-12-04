import React, { useEffect, useState, useRef } from 'react';
import RPGGrid from './RPGGrid';
import { io } from 'socket.io-client';
import cosmic_entity from './cosmic_entity.png';
const GameMaster = () => {
  const [tokens, setTokens] = useState([
    {
      id: 155,
      imageUrl: cosmic_entity,
      gridX: 1,
      gridY: 1,
    },
  ]);

  const socketRef = useRef(null);

  // Initialize Socket.IO connection
  useEffect(() => {
    const socket = io('http://localhost:3001', {
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      reconnectionAttempts: 5,
    });

    socket.on('connect', () => {
      console.log('🔗 Connected to server');
    });

    socket.on('disconnect', () => {
      console.log('❌ Disconnected from server');
    });

    // Listen for token movements from other clients
    socket.on('token:moved', (data) => {
      console.log('📍 Received token move from server:', data);
      handleRemoteTokenMove(data.id, data.gridX, data.gridY);
    });

    // Listen for token creation from other clients
    socket.on('token:created', (data) => {
      console.log('✨ Received token creation from server:', data);
      handleRemoteTokenCreate(data);
    });

    socketRef.current = socket;

    return () => {
      socket.disconnect();
    };
  }, []);

  // Handle local token movement (from RPGGrid)
  const handleLocalTokenMove = (id, gridX, gridY) => {
    console.log(`🎮 Local token move: [${id}] -> (${gridX}, ${gridY})`);

    // Update local state (optimistic update)
    setTokens((prevTokens) =>
      prevTokens.map((token) =>
        token.id === id ? { ...token, gridX, gridY } : token
      )
    );

    // Emit to server
    if (socketRef.current?.connected) {
      socketRef.current.emit('token:move', {
        id,
        gridX,
        gridY,
      });
    }
  };

  // Handle remote token movement (from socket)
  const handleRemoteTokenMove = (id, gridX, gridY) => {
    setTokens((prevTokens) =>
      prevTokens.map((token) =>
        token.id === id ? { ...token, gridX, gridY } : token
      )
    );
  };

  // Handle local token creation (from RPGGrid)
  const handleLocalTokenCreate = (imageUrl, gridX, gridY) => {
    console.log(`✨ Local token create: (${gridX}, ${gridY})`);

    const newToken = {
      id: Date.now(), // Temporary ID, server will assign real one
      imageUrl,
      gridX,
      gridY,
    };

    // Update local state
    setTokens((prevTokens) => [...prevTokens, newToken]);

    // Emit to server
    if (socketRef.current?.connected) {
      socketRef.current.emit('token:create', {
        imageUrl,
        gridX,
        gridY,
      });
    }
  };

  // Handle remote token creation (from socket)
  const handleRemoteTokenCreate = (tokenData) => {
    setTokens((prevTokens) => [...prevTokens, tokenData]);
  };

  return (
    <RPGGrid
      tokens={tokens}
      onTokenMove={handleLocalTokenMove}
      onTokenCreate={handleLocalTokenCreate}
    />
  );
};

export default GameMaster;
