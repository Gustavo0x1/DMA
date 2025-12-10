import React, { useState } from 'react';

function ChatSidebar({ visible }) {
  const [messages, setMessages] = useState([
    { user: 'GM', message: 'Bem-vindos à sessão!', type: 'gm', time: '19:30' },
    { user: 'Jogador 1', message: 'Pronto!', type: 'player', time: '19:31' },
  ]);
  const [input, setInput] = useState('');

  const sendMessage = () => {
    if (input.trim()) {
      const now = new Date();
      setMessages([...messages, {
        user: 'Você',
        message: input,
        type: 'player',
        time: `${now.getHours()}:${now.getMinutes().toString().padStart(2, '0')}`
      }]);
      setInput('');
    }
  };

  if (!visible) return null;

  return (
    <div className="vtt-sidebar">
      <div className="chat-header">
        <div className="chat-title-row">
          <div className="chat-avatar">GM</div>
          <div className="chat-title-info">
            <h3>Chat da Mesa</h3>
            <p>3 jogadores online</p>
          </div>
        </div>
        <div className="chat-actions">
          <button className="chat-action-btn">
            🎲 Rolar Dado
          </button>
          <button className="chat-action-btn icon-only">⚙️</button>
        </div>
      </div>

      <div className="chat-messages">
        {messages.map((msg, idx) => (
          <div key={idx} className="chat-message">
            <div className="message-header">
              <div className={`message-avatar ${msg.type}`}>
                {msg.user.charAt(0)}
              </div>
              <div className={`message-user ${msg.type}`}>{msg.user}</div>
              <div className="message-time">{msg.time}</div>
            </div>
            <div className={`message-content ${msg.type}`}>
              {msg.message}
            </div>
          </div>
        ))}
      </div>

      <div className="chat-input-area">
        <div className="chat-input-row">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && sendMessage()}
            placeholder="Digite sua mensagem..."
          />
          <button className="chat-send-btn" onClick={sendMessage}>
            📤
          </button>
        </div>
        <div className="chat-input-hint">Pressione Enter para enviar</div>
      </div>
    </div>
  );
}

export default ChatSidebar;