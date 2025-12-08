import React, { useEffect, useRef } from 'react';
import RPGGrid from './RPGGrid';
import SceneManager from './SceneManager';
import io from 'socket.io-client'

const API_URL = "https://navigation-calvin-serves-guardian.trycloudflare.com";
const socket = io.connect(API_URL)

function GridController() {
    const gridRef = useRef();
    
    useEffect(() => {
        socket.on("TokenCreated", (data) => {
            console.log("Outro jogador criou um token:", data);
            const fullImageUrl = `${API_URL}/api/image/${data.imageId}`;
            
            if (gridRef.current) {
                gridRef.current.createToken(fullImageUrl, data.x, data.y, data.id, data.imageId);
            }
        });

        socket.on("move_token_by_id", (ID, PosX, PosY) => {
            forceMoveGoblin(ID, PosX, PosY);
        });

        socket.on("TokenMoved", (data) => {
            console.log("Token movido por outro jogador");
            if (gridRef.current) {
                gridRef.current.moveToken(data.id, data.x, data.y);
            }
        });
    }, [socket]);

    var gpos = 0;
    
    const handleLocalTokenCreated = (tokenData) => {
        console.log("Upload concluído, avisando o servidor:", tokenData);
        socket.emit("CreateToken", tokenData);
    };
    
    const handleGridTokenMove = (data) => {
        console.log("Parent received move:", data);
        socket.emit("TokenMoved", data);    
    };

    const forceMoveGoblin = (ID, PosX, PosY) => {
        console.log(ID + " movendo para " + PosX + ", " + PosY);
        if (gridRef.current) {
            gpos += 1;
            gridRef.current.moveToken(ID, PosX, PosY);
        }
    };

    const spawnGoblin = () => {
        if (gridRef.current) {
            gridRef.current.createToken('https://i.imgur.com/ezWs4Sn.png', 0, 0, 4);
        }
    }

    useEffect(() => {
        spawnGoblin();
    }, []);

    return (
        <div>
            {/* NOVO: Scene Manager com socket */}
            <SceneManager gridRef={gridRef} socket={socket} />

            {/* Controles de Debug (opcional - pode remover) */}
            <div style={{ 
                position: 'fixed', 
                top: 10, 
                right: 10, 
                zIndex: 1000, 
                background: 'rgba(255,255,255,0.9)', 
                padding: 10,
                borderRadius: 8,
                border: '2px solid #333'
            }}>
                <h3 style={{ margin: '0 0 10px 0', fontSize: 14 }}>Debug Controls</h3>
                <button 
                    onClick={spawnGoblin}
                    style={{
                        display: 'block',
                        width: '100%',
                        marginBottom: 5,
                        padding: 8,
                        background: '#4CAF50',
                        color: 'white',
                        border: 'none',
                        borderRadius: 4,
                        cursor: 'pointer'
                    }}
                >
                    Spawn Goblin (ID 4)
                </button>
                <button 
                    onClick={() => forceMoveGoblin(4, 5, 5)}
                    style={{
                        display: 'block',
                        width: '100%',
                        padding: 8,
                        background: '#2196F3',
                        color: 'white',
                        border: 'none',
                        borderRadius: 4,
                        cursor: 'pointer'
                    }}
                >
                    Move Goblin to (5,5)
                </button>
            </div>

            {/* RPG Grid */}
            <RPGGrid
                ref={gridRef}
                onTokenMove={handleGridTokenMove}
                onTokenCreated={handleLocalTokenCreated}
            />
        </div>
    );
}

export default GridController;