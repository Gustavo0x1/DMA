import React, { useEffect, useRef } from 'react';
import RPGGrid from './RPGGrid';
import SceneManager from './SceneManager';
import io from 'socket.io-client'
import TokenManager from './TokenManager';

const API_URL = process.env.REACT_APP_API_URL;
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
   <div className="vtt-container">

<SceneManager gridRef={gridRef} socket={socket} />
<TokenManager gridRef={gridRef} socket={socket} />

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