
import './App.css';
import io from 'socket.io-client'
import {useEffect,useState} from "react"
import RPGGrid from './components/GRID/RPGGrid';


const socket = io.connect("http://localhost:3001")
function App() {
  const [message,setMessage] = useState("")
  const [MessageReceived,setMessageReceived] = useState("")

  const senMessage = () =>{

    socket.emit("send_message",{message})
    
  }

  useEffect(()=>{

    socket.on("receive_message",(data)=>{

      setMessageReceived(data.message)

    })

  },[socket])

  return (
    <div className="App">
      
      <RPGGrid></RPGGrid>
 
      <input type='text' onChange={(event)=>{setMessage(event.target.value)}} placeholder='message'></input>
      <button onClick={senMessage}>Send message</button>
      <h1>Data 1 {MessageReceived}</h1>
    </div>
  );
}

export default App;
