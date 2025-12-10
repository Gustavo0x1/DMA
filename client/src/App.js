
import './App.css';
import {useEffect,useState} from "react"
import GridController from './components/GRID/GridController';
import io from 'socket.io-client'
import './VTT.css';
const API_URL = process.env.REACT_APP_API_URL;

const socket = io.connect(API_URL)
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
      
      <GridController></GridController>
 
      <input type='text' onChange={(event)=>{setMessage(event.target.value)}} placeholder='message'></input>
      <button onClick={senMessage}>Send message</button>
      <h1>Data 1 {MessageReceived}</h1>
    </div>
  );
}

export default App;
