const express = require('express')
const app = express()
const http = require('http')
const {Server} = require('socket.io')
const server = http.createServer(app)
const cors = require('cors')

app.use(cors)

const io = new Server(server,{

    cors:{
        origin:"*"
    }

});

io.on("connection",(socket)=>{

    console.log(`Novo usuario conectado ${socket.id}`)

    socket.on("send_message",(data)=>{
        console.log(data);

        socket.broadcast.emit("receive_message",data)
    })

    socket.on("TokenMoved", (ID,PosX,PosY) => {
        console.log(`Token moved by ${socket.id}:`, ID);
        socket.broadcast.emit("TokenMoved", ID, PosX, PosY);
    });

})
server.listen(3001,()=>{
    console.log("Server is running")
})


/*
let fds = -5;


setInterval(() => {
    console.log("?");
    fds +=1
    io.emit("move_token_by_id", 4, fds,fds);
}, 1000); // 1000 milliseconds = 1 second

*/