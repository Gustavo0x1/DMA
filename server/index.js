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

})
server.listen(3001,()=>{
    console.log("Server is running")
})