import React, { useState, useEffect } from 'react';
import io from 'socket.io-client';

const API_URL = "https://navigation-calvin-serves-guardian.trycloudflare.com";

function SceneManager({ gridRef, socket }) {
    const [cenas, setCenas] = useState([]);
    const [showSaveModal, setShowSaveModal] = useState(false);
    const [showLoadModal, setShowLoadModal] = useState(false);
    const [nomeCena, setNomeCena] = useState('');
    const [descricaoCena, setDescricaoCena] = useState('');

    // Carrega lista de cenas ao montar
    useEffect(() => {
        loadCenasList();

        // NOVO: Escuta quando uma cena é ativada pelo servidor
        if (socket) {
            socket.on("LoadActiveScene", (cena) => {
                console.log('📥 Recebendo cena ativa do servidor:', cena.nome);
                loadSceneLocally(cena);
            });

            return () => {
                socket.off("LoadActiveScene");
            };
        }
    }, [socket]);

    const loadCenasList = async () => {
        try {
            const response = await fetch(`${API_URL}/api/cenas`);
            const data = await response.json();
            setCenas(Array.isArray(data) ? data : []);
        } catch (err) {
            console.error('Erro ao carregar cenas:', err);
            setCenas([]);
        }
    };

    // SALVAR CENA ATUAL
    const saveCurrentScene = async () => {
        if (!nomeCena.trim()) {
            alert('Digite um nome para a cena!');
            return;
        }

        if (!gridRef.current) {
            alert('Grid não está pronto!');
            return;
        }

        try {
            // 1. Pega todos os tokens do canvas
            const tokens = gridRef.current.getAllTokens();
            
            if (tokens.length === 0) {
                alert('Não há tokens para salvar!');
                return;
            }

            // 2. Cria a cena no banco
            const cenaResponse = await fetch(`${API_URL}/api/cenas`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    nome: nomeCena,
                    descricao: descricaoCena
                })
            });

            const cenaData = await cenaResponse.json();
            const cenaId = cenaData.cena_id;

            console.log(`Cena criada: ${cenaId}`);

            // 3. Para cada token, salva no banco e associa à cena
            for (const token of tokens) {
                // Salva/atualiza o token
                await fetch(`${API_URL}/api/tokens`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        token_id: token.id,
                        image_id: token.imageId,
                        pos_x: token.gridX,
                        pos_y: token.gridY
                    })
                });

                // Associa token à cena
                await fetch(`${API_URL}/api/cenas/${cenaId}/tokens`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ token_id: token.id })
                });
            }

            alert(`Cena "${nomeCena}" salva com sucesso! (${tokens.length} tokens)`);
            setShowSaveModal(false);
            setNomeCena('');
            setDescricaoCena('');
            loadCenasList();

        } catch (err) {
            console.error('Erro ao salvar cena:', err);
            alert('Erro ao salvar cena: ' + err.message);
        }
    };

    // CARREGAR CENA
    const loadScene = async (cenaId) => {
        try {
            // 1. Busca a cena completa
            const response = await fetch(`${API_URL}/api/cenas/${cenaId}`);
            const cena = await response.json();

            console.log('Carregando cena:', cena);

            // 2. Ativa a cena no servidor (isso vai notificar TODOS os clientes via Socket.IO)
            if (socket) {
                socket.emit("ActivateScene", cenaId);
            }

            // 3. Carrega localmente também
            loadSceneLocally(cena);

            alert(`Cena "${cena.nome}" carregada e ativada para todos os jogadores!`);
            setShowLoadModal(false);

        } catch (err) {
            console.error('Erro ao carregar cena:', err);
            alert('Erro ao carregar cena: ' + err.message);
        }
    };

    // Função auxiliar para carregar a cena localmente
    const loadSceneLocally = (cena) => {
        if (!gridRef.current) {
            console.warn('Grid não está pronto!');
            return;
        }

        // Limpa o canvas atual
        gridRef.current.clearAllTokens();

        // Cria cada token no canvas
        for (const token of cena.tokens) {
            const imageUrl = `${API_URL}/api/image/${token.image_id}`;
            gridRef.current.createToken(
                imageUrl,
                token.pos_x,
                token.pos_y,
                token.token_id,
                token.image_id
            );
        }

        console.log(`✅ Cena "${cena.nome}" carregada localmente (${cena.tokens.length} tokens)`);
    };

    // DELETAR CENA
    const deleteScene = async (cenaId, nome) => {
        if (!window.confirm(`Deletar a cena "${nome}"?`)) return;

        try {
            await fetch(`${API_URL}/api/cenas/${cenaId}`, {
                method: 'DELETE'
            });
            alert('Cena deletada!');
            loadCenasList();
        } catch (err) {
            console.error('Erro ao deletar:', err);
        }
    };

    return (
        <div style={{ 
            position: 'fixed', 
            top: 10, 
            left: 10, 
            zIndex: 1000, 
            background: 'rgba(0,0,0,0.9)', 
            padding: 15,
            borderRadius: 8,
            border: '2px solid #00ff88',
            color: 'white',
            fontFamily: 'Arial'
        }}>
            <h3 style={{ margin: '0 0 10px 0', color: '#00ff88' }}>🎬 Cenas</h3>
            
            <button 
                onClick={() => setShowSaveModal(true)}
                style={{
                    padding: '8px 16px',
                    background: '#00ff88',
                    color: 'black',
                    border: 'none',
                    borderRadius: 5,
                    cursor: 'pointer',
                    fontWeight: 'bold',
                    marginRight: 10
                }}
            >
                💾 Salvar Cena
            </button>

            <button 
                onClick={() => setShowLoadModal(true)}
                style={{
                    padding: '8px 16px',
                    background: '#4488ff',
                    color: 'white',
                    border: 'none',
                    borderRadius: 5,
                    cursor: 'pointer',
                    fontWeight: 'bold'
                }}
            >
                📂 Carregar Cena
            </button>

            {/* MODAL DE SALVAR */}
            {showSaveModal && (
                <div style={{
                    position: 'fixed',
                    top: 0, left: 0, right: 0, bottom: 0,
                    background: 'rgba(0,0,0,0.8)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    zIndex: 2000
                }}>
                    <div style={{
                        background: '#222',
                        padding: 30,
                        borderRadius: 10,
                        border: '2px solid #00ff88',
                        minWidth: 400
                    }}>
                        <h2 style={{ color: '#00ff88', marginTop: 0 }}>💾 Salvar Cena Atual</h2>
                        
                        <label style={{ display: 'block', marginBottom: 10 }}>
                            <strong>Nome da Cena:</strong>
                            <input
                                type="text"
                                value={nomeCena}
                                onChange={(e) => setNomeCena(e.target.value)}
                                placeholder="Ex: Taverna do Dragão"
                                style={{
                                    width: '100%',
                                    padding: 10,
                                    marginTop: 5,
                                    background: '#333',
                                    color: 'white',
                                    border: '1px solid #555',
                                    borderRadius: 5
                                }}
                            />
                        </label>

                        <label style={{ display: 'block', marginBottom: 20 }}>
                            <strong>Descrição (opcional):</strong>
                            <textarea
                                value={descricaoCena}
                                onChange={(e) => setDescricaoCena(e.target.value)}
                                placeholder="Descreva a cena..."
                                rows={3}
                                style={{
                                    width: '100%',
                                    padding: 10,
                                    marginTop: 5,
                                    background: '#333',
                                    color: 'white',
                                    border: '1px solid #555',
                                    borderRadius: 5,
                                    resize: 'vertical'
                                }}
                            />
                        </label>

                        <div style={{ display: 'flex', gap: 10 }}>
                            <button onClick={saveCurrentScene} style={{
                                flex: 1,
                                padding: 12,
                                background: '#00ff88',
                                color: 'black',
                                border: 'none',
                                borderRadius: 5,
                                cursor: 'pointer',
                                fontWeight: 'bold'
                            }}>
                                Salvar
                            </button>
                            <button onClick={() => {
                                setShowSaveModal(false);
                                setNomeCena('');
                                setDescricaoCena('');
                            }} style={{
                                flex: 1,
                                padding: 12,
                                background: '#555',
                                color: 'white',
                                border: 'none',
                                borderRadius: 5,
                                cursor: 'pointer'
                            }}>
                                Cancelar
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* MODAL DE CARREGAR */}
            {showLoadModal && (
                <div style={{
                    position: 'fixed',
                    top: 0, left: 0, right: 0, bottom: 0,
                    background: 'rgba(0,0,0,0.8)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    zIndex: 2000
                }}>
                    <div style={{
                        background: '#222',
                        padding: 30,
                        borderRadius: 10,
                        border: '2px solid #4488ff',
                        minWidth: 500,
                        maxHeight: '80vh',
                        overflow: 'auto'
                    }}>
                        <h2 style={{ color: '#4488ff', marginTop: 0 }}>📂 Carregar Cena</h2>
                        
                        {cenas.length === 0 ? (
                            <p style={{ color: '#999' }}>Nenhuma cena salva ainda.</p>
                        ) : (
                            <div>
                                {cenas.map(cena => (
                                    <div key={cena.cena_id} style={{
                                        background: '#333',
                                        padding: 15,
                                        marginBottom: 10,
                                        borderRadius: 8,
                                        border: '1px solid #555'
                                    }}>
                                        <h3 style={{ margin: '0 0 5px 0', color: '#00ff88' }}>
                                            {cena.nome}
                                        </h3>
                                        <p style={{ margin: '0 0 10px 0', color: '#aaa', fontSize: '0.9em' }}>
                                            {cena.descricao || 'Sem descrição'}
                                        </p>
                                        <p style={{ margin: '0 0 10px 0', color: '#888', fontSize: '0.85em' }}>
                                            {cena.tokens.length} token(s) • {new Date(cena.updated_at).toLocaleString('pt-BR')}
                                        </p>
                                        
                                        <div style={{ display: 'flex', gap: 10 }}>
                                            <button onClick={() => loadScene(cena.cena_id)} style={{
                                                flex: 1,
                                                padding: 8,
                                                background: '#4488ff',
                                                color: 'white',
                                                border: 'none',
                                                borderRadius: 5,
                                                cursor: 'pointer',
                                                fontWeight: 'bold'
                                            }}>
                                                Carregar
                                            </button>
                                            <button onClick={() => deleteScene(cena.cena_id, cena.nome)} style={{
                                                padding: 8,
                                                background: '#ff4444',
                                                color: 'white',
                                                border: 'none',
                                                borderRadius: 5,
                                                cursor: 'pointer'
                                            }}>
                                                🗑️
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}

                        <button onClick={() => setShowLoadModal(false)} style={{
                            width: '100%',
                            padding: 12,
                            marginTop: 10,
                            background: '#555',
                            color: 'white',
                            border: 'none',
                            borderRadius: 5,
                            cursor: 'pointer'
                        }}>
                            Fechar
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}

export default SceneManager;