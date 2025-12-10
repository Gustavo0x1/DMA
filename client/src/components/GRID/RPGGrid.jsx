import React, { useEffect, useRef, useState, useImperativeHandle } from 'react';
import { Canvas, FabricImage, Line, Point } from 'fabric';

const GRID_SIZE = 70;
const GRID_COLOR = '#444444';
const API_URL = process.env.REACT_APP_API_URL;
const USER_ID = 'gm'; 

function RPGGrid({ onTokenMove, onTokenCreated, ref }) {
  const canvasRef = useRef(null);
  const canvasInstance = useRef(null);
  const [zoom, setZoom] = useState(1);
  const onTokenMoveRef = useRef(onTokenMove);
  let isDragging = false;
  const getClientPos = (e) => {
      // Se for evento de toque (Touch)
      if (e.touches && e.touches.length > 0) {
        return { x: e.touches[0].clientX, y: e.touches[0].clientY };
      }
      // Se for evento de toque que acabou (ChangedTouches - raro no move, comum no end)
      if (e.changedTouches && e.changedTouches.length > 0) {
        return { x: e.changedTouches[0].clientX, y: e.changedTouches[0].clientY };
      }
      // Se for Mouse padrão
      return { x: e.clientX, y: e.clientY };
    };
  useEffect(() => {
    onTokenMoveRef.current = onTokenMove;
  }, [onTokenMove]);

  // Expose functions to the parent via the ref prop
  useImperativeHandle(ref, () => ({
    getAllTokens: () => {
      const canvas = canvasInstance.current;
      if (!canvas) return [];
      
      return canvas.getObjects()
        .filter(obj => obj.id && obj !== canvas.backgroundImage)
        .map(obj => ({
          id: obj.id,
          imageId: obj.imageId,
          gridX: obj.savedGridX || 0,
          gridY: obj.savedGridY || 0,
          isTemporary: obj.isTemporary || false // Flag para identificar tokens temporários
        }));
    },
    
    clearAllTokens: () => {
      const canvas = canvasInstance.current;
      if (!canvas) return;
      
      const objectsToRemove = canvas.getObjects()
        .filter(obj => obj.id && obj !== canvas.backgroundImage);
      
      objectsToRemove.forEach(obj => canvas.remove(obj));
      canvas.renderAll();
      console.log('Todos os tokens foram removidos');
    },
    
    moveToken: (ID, gridX, gridY) => {
      console.log(gridX);
      const canvas = canvasInstance.current;

      if (!canvas) return;

      const tokenEncontrado = canvas.getObjects().find((obj) => obj.id === ID);

      if (tokenEncontrado) {
        const newX = gridX * GRID_SIZE + GRID_SIZE / 2;
        const newY = gridY * GRID_SIZE + GRID_SIZE / 2;  
        tokenEncontrado.set({
          left: newX,
          top: newY,
        });

        tokenEncontrado.savedGridX = gridX;
        tokenEncontrado.savedGridY = gridY;

        tokenEncontrado.setCoords();
        canvas.requestRenderAll();
        console.log(`Command: Token ${ID} moved to ${gridX}, ${gridY}`);
      } else {
        console.warn(`Token with ID ${ID} not found.`);
      }
    },
    
    createToken: (fileOrDataUrl, gridX, gridY, ID, imageId = null, isTemporary = false) => {
      createTokenAt(fileOrDataUrl, gridX, gridY, ID, imageId, isTemporary);
    }
  }));

  const createTokenAt = async (fileOrDataUrl, gridX, gridY, ID, imageId = null, isTemporary = false) => {
    const canvas = canvasInstance.current;
    if (!canvas) return;

    try {
      const fabricImg = await FabricImage.fromURL(fileOrDataUrl);
      const currentZoom = canvas.getZoom();

      const pixelX = gridX * GRID_SIZE + GRID_SIZE/2;
      const pixelY = gridY * GRID_SIZE + GRID_SIZE/2;

      const scale = ((GRID_SIZE) / Math.max(fabricImg.width, fabricImg.height)) * 0.9;

      fabricImg.set({
        left: pixelX,
        top: pixelY,
        id: ID,
        imageId: imageId,
        savedGridX: gridX,
        savedGridY: gridY,
        isTemporary: isTemporary, // NOVO: marca se é temporário
        scaleX: scale,
        scaleY: scale,
        originX: 'center',
        originY: 'center',
        cornerStyle: 'circle',
        cornerColor: isTemporary ? '#ffaa00' : '#00ff88', // Cor diferente para temporários
        borderColor: isTemporary ? '#ffcc44' : '#33ff99',
        transparentCorners: false,
      });

      canvas.add(fabricImg);
      canvas.renderAll();
      
      const status = isTemporary ? '⚠️ TEMPORÁRIO' : '✅ PERSISTENTE';
      console.log(`${status} Token criado: ${ID} em (${gridX}, ${gridY}) com imageId: ${imageId}`);
    } catch (err) {
      console.error('Erro ao criar token:', err);
    }
  };

  const addImageFromFile = async (file, asBackground = false) => {
    if (!file || !canvasInstance.current) return;

    const formData = new FormData();
    formData.append('file', file);

    try {
      const response = await fetch(`${API_URL}/api/upload`, {
        method: 'POST',
        headers: { 'x-user-id': USER_ID },
        body: formData
      });

      if (!response.ok) throw new Error('Upload failed');

      const data = await response.json();
      const serverUrl = data.url;
      
      if (onTokenCreated) {
        onTokenCreated({
          id: data.token_id,
          imageId: data.image_id,
          x: 1,
          y: 1
        });
      }
 
      if (asBackground) {
        const fabricImg = await FabricImage.fromURL(serverUrl);
        const canvas = canvasInstance.current;
        const scale = Math.max(canvas.width / fabricImg.width, canvas.height / fabricImg.height);
        fabricImg.set({
          scaleX: scale, scaleY: scale,
          left: 0, top: 0,
          selectable: false, evented: false,
          originX: 'left', originY: 'top',
        });
        canvas.backgroundImage = fabricImg;
        canvas.renderAll();
      } else {
        // Token criado por drag&drop - TEMPORÁRIO até salvar cena
        await createTokenAt(serverUrl, 1, 1, 'temp-token-' + Date.now(), data.image_id, true);
      }
    } catch (err) {
      console.error('Erro no upload ou criação do token:', err);
      alert('Falha ao enviar imagem para o servidor');
    }
  };

  useEffect(() => {
    if (!canvasRef.current) return;

    const canvas = new Canvas(canvasRef.current, {
      backgroundColor: '#1a1a1a',
      selection: false,
      preserveObjectStacking: true,
    });
    canvasInstance.current = canvas;

    const resizeAndDraw = () => {
      canvas.setDimensions({
        width: window.innerWidth - 40,
        height: window.innerHeight - 120,
      });

      canvas.getObjects().forEach((obj) => {
        if (obj.isGridLine) canvas.remove(obj);
      });

      const gridSquares = 100;
      const startGrid = -gridSquares / 2;
      const endGrid = gridSquares / 2;
      const startPixel = startGrid * GRID_SIZE;
      const endPixel = endGrid * GRID_SIZE;

      for (let gridX = startGrid; gridX <= endGrid; gridX++) {
        const x = gridX * GRID_SIZE;
        canvas.add(
          new Line([x, startPixel, x, endPixel], {
            stroke: GRID_COLOR,
            selectable: false,
            evented: false,
            isGridLine: true,
          })
        );
      }

      for (let gridY = startGrid; gridY <= endGrid; gridY++) {
        const y = gridY * GRID_SIZE;
        canvas.add(
          new Line([startPixel, y, endPixel, y], {
            stroke: GRID_COLOR,
            selectable: false,
            evented: false,
            isGridLine: true,
          })
        );
      }

      const centerX = canvas.width / 2;
      const centerY = canvas.height / 2;
      canvas.viewportTransform = [1, 0, 0, 1, centerX, centerY];
      canvas.renderAll();
    };

    resizeAndDraw();
    window.addEventListener('resize', resizeAndDraw);

    canvas.on('object:modified', (e) => {
      const obj = e.target;
      if (!obj || obj === canvas.backgroundImage) return;

      const gridSize = GRID_SIZE;
      const halfGrid = gridSize / 2;
      const newLeft = Math.round((obj.left - halfGrid) / gridSize) * gridSize + halfGrid;
      const newTop = Math.round((obj.top - halfGrid) / gridSize) * gridSize + halfGrid;
      
      obj.set({ left: newLeft, top: newTop });
      obj.setCoords();

      const gridX = Math.floor((newLeft - halfGrid) / gridSize);
      const gridY = Math.floor((newTop - halfGrid) / gridSize);

      // Check if coordinates actually changed
      if (obj.savedGridX !== gridX || obj.savedGridY !== gridY) {
        console.log(`📍 Token [${obj.id}] CHANGED to: [${gridX}, ${gridY}]`);
        
        obj.savedGridX = gridX;
        obj.savedGridY = gridY;

        // Só propaga movimento se NÃO for temporário
        if (!obj.isTemporary && onTokenMoveRef.current) {
          onTokenMoveRef.current({ id: obj.id, x: gridX, y: gridY });
        } else if (obj.isTemporary) {
          console.log('⚠️ Token temporário movido - não propagado');
        }
      } else {
        console.log(`📍 Token [${obj.id}] snapped back to same cell. Ignoring.`);
      }
    });

    // Zoom
    canvas.on('mouse:wheel', (opt) => {
      const delta = opt.e.deltaY;
      let newZoom = canvas.getZoom() * (delta > 0 ? 0.9 : 1.1);
      newZoom = Math.max(0.2, Math.min(newZoom, 10));
      canvas.zoomToPoint(new Point(opt.pointer.x, opt.pointer.y), newZoom);
      setZoom(newZoom);
      opt.e.preventDefault();
    });

    // Pan
    let panning = false;
    let lastX, lastY;
canvas.on('mouse:down', (opt) => {
      const evt = opt.e;
      
      // Detecção de clique/toque
      const isMiddleClick = evt.button === 1; // Botão do meio
      const isLeftClickEmpty = evt.button === 0 && !opt.target; // Botão esquerdo no vazio
      // Verifica se existe touches antes de ler length para evitar erro no Desktop
      const isTouchPan = evt.touches && evt.touches.length === 1 && !opt.target; 

      if (evt.altKey || isMiddleClick || isLeftClickEmpty || isTouchPan) {
        isDragging = true;
        canvas.selection = false; 
        
        const pos = getClientPos(evt);
        lastX = pos.x;
        lastY = pos.y;
        
        canvas.defaultCursor = 'grabbing';
      }
    });
canvas.on('mouse:move', (opt) => {
      if (isDragging) {
        const evt = opt.e;
        const pos = getClientPos(evt); 

        // Proteção contra NaN ou undefined
        if (!pos.x || !pos.y) return;

        // O cálculo de delta que você queria manter
        const delta = new Point(pos.x - lastX, pos.y - lastY);
        
        canvas.relativePan(delta);
        
        lastX = pos.x;
        lastY = pos.y;
        
        // Evita scroll da tela no celular
        if(evt.preventDefault) evt.preventDefault();
        if(evt.stopPropagation) evt.stopPropagation();
      }
    });
canvas.on('mouse:up', () => {
      // Reseta tudo
      if (isDragging) {
        isDragging = false;
        canvas.selection = true;
        canvas.defaultCursor = 'default';
        
        // Recalcula coordenadas para garantir que o clique no token funcione depois
        canvas.getObjects().forEach(obj => obj.setCoords());
        canvas.requestRenderAll();
      }
    });

    const el = canvasRef.current;
    const onDragOver = (e) => { e.preventDefault(); el.style.outline = '3px dashed #00ff88'; };
    const onDragLeave = () => (el.style.outline = 'none');
    const onDrop = (e) => {
      e.preventDefault();
      el.style.outline = 'none';
      const file = e.dataTransfer.files[0];
      if (file?.type.startsWith('image/')) {
        addImageFromFile(file, e.shiftKey);
      }
    };

    el.addEventListener('dragover', onDragOver);
    el.addEventListener('dragleave', onDragLeave);
    el.addEventListener('drop', onDrop);

    return () => {
      window.removeEventListener('resize', resizeAndDraw);
      el.removeEventListener('dragover', onDragOver);
      el.removeEventListener('dragleave', onDragLeave);
      el.removeEventListener('drop', onDrop);
      canvas.dispose();
    };
  }, []);

  const backgroundInputRef = useRef(null);
  const tokenInputRef = useRef(null);

  return (
    <div style={{ padding: 20, background: '#111', height: '100vh', color: 'white', fontFamily: 'Arial' }}>
<div className="vtt-toolbar">
  <div className="vtt-logo">Virtual Tabletop</div>
  
  <button className="toolbar-btn" onClick={() => backgroundInputRef.current?.click()}>
     Background
  </button>
  
  <button className="toolbar-btn" onClick={() => tokenInputRef.current?.click()}>
     Token
  </button>
  
  <div className="toolbar-spacer"></div>
  
  <div className="zoom-indicator">
    Zoom: {(zoom * 100).toFixed(0)}%
  </div>
  
  <button className="toolbar-btn">
    👥 3 Online
  </button>
</div>

<div className="canvas-area">
  <canvas ref={canvasRef} />
</div>
      <input
        type="file"
        accept="image/*"
        ref={backgroundInputRef}
        style={{ display: 'none' }}
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) { addImageFromFile(file, true); e.target.value = ''; }
        }}
      />
      <input
        type="file"
        accept="image/*"
        ref={tokenInputRef}
        style={{ display: 'none' }}
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) { addImageFromFile(file, false); e.target.value = ''; }
        }}
      />

  
    </div>
  );
}

export default RPGGrid;