import React, { useEffect, useRef } from 'react';
import RPGGrid from './RPGGrid';
import io from 'socket.io-client'
const socket = io.connect("http://10.10.10.12:3001")


function GridController() {
    const gridRef = useRef();
  useEffect(()=>{

    socket.on("move_token_by_id",(ID,PosX,PosY)=>{

      forceMoveGoblin(ID,PosX,PosY)

    });

    socket.on("TokenMoved",(ID,PosX,PosY)=>{

    console.log("movn");
    gridRef.current.moveToken(ID, PosX, PosY);
    })


  },[socket])


    var gpos = 0;
    // 2. This function runs when the user drags a token inside the Grid
    const handleGridTokenMove = (data) => {
        console.log("Parent received move:", data);
        socket.emit("TokenMoved", data.id, data.x, data.y);    
    };

    const forceMoveGoblin = (ID,PosX,PosY) => {
        if (gridRef.current) {
            gpos += 1
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
            <div style={{ position: 'fixed', top: 10, right: 10, zIndex: 1000, background: 'white', padding: 10 }}>
                <h3>Parent Controls</h3>
                <button onClick={spawnGoblin}>Spawn Goblin (ID 4)</button>
                <button onClick={forceMoveGoblin}>Move Goblin to (5,5)</button>
            </div>

            {/* Pass the ref and the handler */}
            <RPGGrid
                ref={gridRef}
                onTokenMove={handleGridTokenMove}
            />
        </div>
    );
}

export default GridController;