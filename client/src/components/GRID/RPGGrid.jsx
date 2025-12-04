import React, { useEffect, useRef, useState } from 'react';
import { Canvas, FabricImage, Line, Point } from 'fabric';

const GRID_SIZE = 70;
const GRID_COLOR = '#444444';




function RPGGrid() {
  const [message,setMessage] = useState(null)
  const canvasRef = useRef(null);
  const canvasInstance = useRef(null);
  const [zoom, setZoom] = useState(1);


const MoveToken=(ID,gridX,gridY) =>{
  console.log("Movendo o token:", ID, gridX, gridY);
const canvas = canvasInstance.current;
  if (!canvas) return;

  // canvas.getObjects() retorna o array de tudo que está na tela
  const tokenEncontrado = canvas.getObjects().find(obj => obj.id === ID);

  if (tokenEncontrado) {

    
    tokenEncontrado.set({
      left:gridX * GRID_SIZE * zoom + canvas.viewportTransform[4],
      top:gridY * GRID_SIZE * zoom + canvas.viewportTransform[5],
    })
    tokenEncontrado.setCoords(); 

    canvas.requestRenderAll();

  } else {
    console.log('Não existe ninguém com esse nome.');
  }
}
const createTokenAt = async (fileOrDataUrl, gridX, gridY,ID) => {
  const canvas = canvasInstance.current;
  if (!canvas) return;

  try {
    // FabricImage.fromURL aceita URL remota ou DataURL (base64)
    // E retorna uma Promise com o objeto pronto
    const fabricImg = await FabricImage.fromURL(fileOrDataUrl);

    // Lógica de posicionamento (igual antes)
    const zoom = canvas.getZoom();

    

    const pixelX = gridX * GRID_SIZE * zoom + canvas.viewportTransform[4];
    const pixelY = gridY * GRID_SIZE * zoom + canvas.viewportTransform[5];

    // Escala
    const scale = ( (GRID_SIZE * zoom) / Math.max(fabricImg.width, fabricImg.height) ) * 0.9;

    fabricImg.set({
      left: pixelX,
      top: pixelY,
      id:ID,
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
    console.error("Erro ao criar token:", err);
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
        // === BACKGROUND ===
        const scale = Math.max(canvas.width / fabricImg.width, canvas.height / fabricImg.height);
        
        fabricImg.set({
          scaleX: scale,
          scaleY: scale,
          left: 0, 
          top: 1,
          selectable: false,
          evented: false,
          originX: 'left', // Importante resetar origem p/ background
          originY: 'top'
        });

        canvas.backgroundImage = fabricImg;
        canvas.renderAll();
      } else {
        // === TOKEN ===
        const gridSize = GRID_SIZE * canvas.getZoom();
        const scale = (gridSize / Math.max(fabricImg.width, fabricImg.height)) * 0.9;

        fabricImg.set({
          left: canvas.width / 2,
          top: canvas.height / 2,
          scaleX: scale,
          scaleY: scale,
          originX: 'center',
          originY: 'center',
          cornerStyle: 'circle',
          cornerColor: '#00ff88',
          transparentCorners: false,
        });

        canvas.add(fabricImg);
        canvas.setActiveObject(fabricImg);
        canvas.renderAll();
      }
    } catch (err) {
      console.error("Erro ao processar imagem:", err);
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

      // Limpa grid antigo
      canvas.getObjects().forEach((obj) => {
        if (obj.isGridLine) canvas.remove(obj);
      });

      const w = canvas.width;
      const h = canvas.height;

      for (let x = 0; x <= w; x += GRID_SIZE) {
        canvas.add(
          new Line([x, 0, x, h], {
            stroke: GRID_COLOR,
            selectable: false,
            evented: false,
            isGridLine: true,
          })
        );
      }
      for (let y = 0; y <= h; y += GRID_SIZE) {
        canvas.add(
          new Line([0, y, w, y], {
            stroke: GRID_COLOR,
            selectable: false,
            evented: false,
            isGridLine: true,
          })
        );
      }
      canvas.renderAll();
    };

    resizeAndDraw();
    window.addEventListener('resize', resizeAndDraw);
canvas.on('object:modified', (e) => {
    const obj = e.target; // O token que foi movido
    if (!obj) return;

    // Se for o background, ignorar (opcional)
    if (obj === canvas.backgroundImage) return;

    // --- LÓGICA DE SNAP (CENTRALIZADO) ---
    const gridSize = GRID_SIZE; // 70px fixo
    const halfGrid = gridSize / 2;

    // Calcula nova posição baseada no centro da célula
    const newLeft = Math.round((obj.left - halfGrid) / gridSize) * gridSize + halfGrid;
    const newTop = Math.round((obj.top - halfGrid) / gridSize) * gridSize + halfGrid;
    obj.set({ left: newLeft, top: newTop });
    obj.setCoords(); 
    const gridX = Math.floor((newLeft - halfGrid) / gridSize);
    const gridY = Math.floor((newTop - halfGrid) / gridSize);
    console.log(obj);
    console.log(`📍 Token [${obj.id || 'Sem ID'}] movido para: [${gridX}, ${gridY}]`);

  });
    // ZOOM
    canvas.on('mouse:wheel', (opt) => {
      const delta = opt.e.deltaY;
      let newZoom = canvas.getZoom() * (delta > 0 ? 0.9 : 1.1);
      newZoom = Math.max(0.2, Math.min(newZoom, 10));
      canvas.zoomToPoint(new Point(opt.pointer.x, opt.pointer.y), newZoom);
      setZoom(newZoom);
      opt.e.preventDefault();
    });

    // PAN
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

    // DRAG & DROP (mantido, mas com o novo método)
    const el = canvasRef.current;
    el.addEventListener('dragover', (e) => {
      e.preventDefault();
      el.style.outline = '3px dashed #00ff88';
    });
    el.addEventListener('dragleave', () => (el.style.outline = 'none'));
    el.addEventListener('drop', (e) => {
      e.preventDefault();
      el.style.outline = 'none';
      const file = e.dataTransfer.files[0];
      if (file?.type.startsWith('image/')) {
        addImageFromFile(file, e.shiftKey); // Shift = background
      }
    });

    return () => {
      window.removeEventListener('resize', resizeAndDraw);
      canvas.dispose();
    };
  }, []);

  // Refs para inputs separados
  const backgroundInputRef = useRef(null);
  const tokenInputRef = useRef(null);

  return (
    <div style={{ padding: 20, background: '#111', height: '100vh', color: 'white', fontFamily: 'Arial' }}>
      <div style={{ marginBottom: 15, display: 'flex', gap: 15, alignItems: 'center', flexWrap: 'wrap' }}>
        <strong>Zoom: {(zoom * 100).toFixed(0)}%</strong>

        <button
          onClick={() => backgroundInputRef.current?.click()}
          style={{
            padding: '10px 20px',
            background: '#222',
            border: '2px solid #00ff88',
            color: '#00ff88',
            borderRadius: 8,
            cursor: 'pointer',
            fontWeight: 'bold',
          }}
        >
          Adicionar Mapa (Background)
        </button>

        <button
          onClick={() => tokenInputRef.current?.click()}
          style={{
            padding: '10px 20px',
            background: '#222',
            border: '2px solid #00ff88',
            color: '#00ff88',
            borderRadius: 8,
            cursor: 'pointer',
            fontWeight: 'bold',
          }}
        >
          + Adicionar Token
        </button>

        <span style={{ opacity: 0.8, fontSize: 14 }}>
          Arrastar imagem para o mapa • Shift + soltar = background
        </span>
      </div>

      {/* Inputs escondidos */}
      <input
        type="file"
        accept="image/*"
        ref={backgroundInputRef}
        style={{ display: 'none' }}
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) {
            addImageFromFile(file, true);
            e.target.value = ''; // Limpa para repetir
          }
        }}
      />

      <input
        type="file"
        accept="image/*"
        ref={tokenInputRef}
        style={{ display: 'none' }}
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) {
            addImageFromFile(file, false);
            e.target.value = ''; // Limpa para repetir
          }
        }}
      />

      <canvas ref={canvasRef} style={{ border: '2px solid #333', display: 'block' }} />
      <div style={{ marginTop: 10, fontSize: 12, color: '#888' }}>
        Dica: Abra o Console (F12) para ver logs do upload.
      </div>
 
 <div>

      <input type='text' onChange={(event)=>{setMessage(event.target.value)}} placeholder='message'></input>
      <button onClick={()=>MoveToken(4,1,4)}>Send message</button>
      
 </div>

      <button onClick={() => createTokenAt('https://i.imgur.com/ezWs4Sn.png', 0, 0,4)}>
  Colocar goblin em (15,15)
</button>




    </div>
  );
}

export default RPGGrid;