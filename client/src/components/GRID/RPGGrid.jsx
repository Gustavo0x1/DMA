import React, { useEffect, useRef, useState, useImperativeHandle } from 'react';
import { Canvas, FabricImage, Line, Point } from 'fabric';

const GRID_SIZE = 70;
const GRID_COLOR = '#444444';

// REACT 19 CHANGE: No forwardRef wrapper. 'ref' is now just a prop.
function RPGGrid({ onTokenMove, ref }) {
  const canvasRef = useRef(null);
  const canvasInstance = useRef(null);
  const [zoom, setZoom] = useState(1);
  const onTokenMoveRef = useRef(onTokenMove);

  useEffect(() => {
    onTokenMoveRef.current = onTokenMove;
  }, [onTokenMove]);

  // Expose functions to the parent via the ref prop
useImperativeHandle(ref, () => ({
    moveToken: (ID, gridX, gridY) => {
      const canvas = canvasInstance.current;
      if (!canvas) return;

      const tokenEncontrado = canvas.getObjects().find((obj) => obj.id === ID);

      if (tokenEncontrado) {
        const newX = gridX * GRID_SIZE + GRID_SIZE / 2;
        const newY = gridY * GRID_SIZE + GRID_SIZE / 2;  
        tokenEncontrado.set({
          left: newX ,
          top: newY,
        });

        // UPDATE 1: Update saved coordinates when moved programmatically
        tokenEncontrado.savedGridX = gridX;
        tokenEncontrado.savedGridY = gridY;

        tokenEncontrado.setCoords();
        canvas.requestRenderAll();
        console.log(`Command: Token ${ID} moved to ${gridX}, ${gridY}`);
      } else {
        console.warn(`Token with ID ${ID} not found.`);
      }
    },
    createToken: (fileOrDataUrl, gridX, gridY, ID) => {
      createTokenAt(fileOrDataUrl, gridX, gridY, ID);
    }
  }));

  const createTokenAt = async (fileOrDataUrl, gridX, gridY, ID) => {
    const canvas = canvasInstance.current;
    if (!canvas) return;

    try {
      const fabricImg = await FabricImage.fromURL(fileOrDataUrl);
      const currentZoom = canvas.getZoom();

      const pixelX = gridX * GRID_SIZE   + GRID_SIZE/2
      const pixelY = gridY * GRID_SIZE  + GRID_SIZE/2

      const scale = ((GRID_SIZE) / Math.max(fabricImg.width, fabricImg.height)) * 0.9;

      fabricImg.set({
        left: 1+35,
        top: 1+35,
        id: ID,
        scaleX: scale,
        scaleY: scale,
        originX: 'center',
        originY: 'center',
        cornerStyle: 'circle',
        cornerColor: '#00ff88',
        borderColor: '#33ff99',
        transparentCorners: false,
      });

      canvas.add(fabricImg);
      canvas.renderAll();
    } catch (err) {
      console.error('Erro ao criar token:', err);
    }
  };

  const addImageFromFile = (file, asBackground = false) => {
    if (!file || !canvasInstance.current) return;
    const reader = new FileReader();
    reader.onload = async (e) => {
      const dataUrl = e.target.result;
      try {
        const fabricImg = await FabricImage.fromURL(dataUrl);
        const canvas = canvasInstance.current;
        if (asBackground) {
          //BACKGROUND
          const scale = Math.max(canvas.width / fabricImg.width, canvas.height / fabricImg.height);
          fabricImg.set({
            scaleX: scale,
            scaleY: scale,
            left: 0,
            top: 0,
            selectable: false,
            evented: false,
            originX: 'left',
            originY: 'top',
          });
          canvas.backgroundImage = fabricImg;
          canvas.renderAll();
        } else {
          //TOKEN
          const gridSize = GRID_SIZE;
          const scale = (gridSize / Math.max(fabricImg.width, fabricImg.height)) * 0.9;
          const startGridX = 1;
          const startGridY = 1;
          const newX = startGridX * GRID_SIZE + GRID_SIZE / 2;  
          const newY = startGridY * GRID_SIZE + GRID_SIZE / 2;
          fabricImg.set({
            left: newX,
            top: newY,
            scaleX: scale,
            scaleY: scale,
            originX: 'center',
            originY: 'center',
            cornerStyle: 'circle',
            cornerColor: '#00ff88',
            transparentCorners: false,
            id: 'temp-' + Date.now()
          });
          fabricImg.savedGridX = startGridX;
          fabricImg.savedGridY = startGridY;

          canvas.add(fabricImg);
          canvas.setActiveObject(fabricImg);
          canvas.renderAll();
        }
      } catch (err) {
        console.error('Erro ao processar imagem:', err);
      }
    };
    reader.readAsDataURL(file);
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

      // Clear old grid lines
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

      // UPDATE 4: Check if coordinates actually changed
      // We compare current gridX/Y with the stored savedGridX/Y
      if (obj.savedGridX !== gridX || obj.savedGridY !== gridY) {
        
        console.log(`📍 Token [${obj.id}] CHANGED to: [${gridX}, ${gridY}]`);
        
        // Update the stored coordinates so we don't fire again for the same spot
        obj.savedGridX = gridX;
        obj.savedGridY = gridY;

        if (onTokenMoveRef.current) {
          onTokenMoveRef.current({ id: obj.id, x: gridX, y: gridY });
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
      if (opt.e.altKey || opt.e.button === 1) {
        panning = true;
        lastX = opt.e.clientX;
        lastY = opt.e.clientY;
        canvas.defaultCursor = 'grab';
      }
    });
    canvas.on('mouse:move', (opt) => {
      if (panning) {
        const delta = new Point(opt.e.clientX - lastX, opt.e.clientY - lastY);
        lastX = opt.e.clientX;
        lastY = opt.e.clientY;
        canvas.relativePan(delta);
        canvas.defaultCursor = 'grabbing';
      }
    });
    canvas.on('mouse:up', () => {
      panning = false;
      canvas.defaultCursor = 'default';
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
      <div style={{ marginBottom: 15, display: 'flex', gap: 15, alignItems: 'center', flexWrap: 'wrap' }}>
        <strong>Zoom: {(zoom * 100).toFixed(0)}%</strong>
        <button
          onClick={() => backgroundInputRef.current?.click()}
          style={{ padding: '10px 20px', background: '#222', border: '2px solid #00ff88', color: '#00ff88', borderRadius: 8, cursor: 'pointer', fontWeight: 'bold' }}
        >
          Add Background
        </button>
        <button
          onClick={() => tokenInputRef.current?.click()}
          style={{ padding: '10px 20px', background: '#222', border: '2px solid #00ff88', color: '#00ff88', borderRadius: 8, cursor: 'pointer', fontWeight: 'bold' }}
        >
          + Add Token
        </button>
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

      <canvas ref={canvasRef} style={{ border: '2px solid #333', display: 'block' }} />
    </div>
  );
}

export default RPGGrid;