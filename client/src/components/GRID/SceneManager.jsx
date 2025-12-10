import React, { useState, useEffect } from 'react';
const API_URL = process.env.REACT_APP_API_URL;

function SceneManager({ gridRef, socket }) {
    const [cenas, setCenas] = useState([]);
    const [showSaveModal, setShowSaveModal] = useState(false);
    const [showLoadModal, setShowLoadModal] = useState(false);
    const [nomeCena, setNomeCena] = useState('');
    const [descricaoCena, setDescricaoCena] = useState('');

    useEffect(() => {
        loadCenasList();

        if (socket) {
            socket.on("LoadActiveScene", (cena) => {
                console.log('🔥 Recebendo cena ativa do servidor:', cena.nome);
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

    // SALVAR CENA ATUAL (agora com suporte a tokens temporários)
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
            // 1. Pega todos os tokens do canvas (incluindo temporários)
            const allTokens = gridRef.current.getAllTokens();
            
            if (allTokens.length === 0) {
                alert('Não há tokens para salvar!');
                return;
            }

            console.log(`Salvando cena com ${allTokens.length} tokens...`);
            console.log('Tokens:', allTokens);

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

            console.log(` Cena criada: ${cenaId}`);

            // 3. Para cada token, processa baseado se é temporário ou não
            let tempCount = 0;
            let persistedCount = 0;

            for (const token of allTokens) {
                let finalTokenId = token.id;

                // Se for temporário, gera um ID permanente
                if (token.isTemporary) {
                    finalTokenId = `token-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
                    tempCount++;
                    console.log(`⚠️ Token temporário ${token.id} → permanente ${finalTokenId}`);
                } else {
                    persistedCount++;
                }

                // Salva/atualiza o token no banco
                await fetch(`${API_URL}/api/tokens`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        token_id: finalTokenId,
                        image_id: token.imageId,
                        pos_x: token.gridX,
                        pos_y: token.gridY
                    })
                });

                // Associa token à cena
                await fetch(`${API_URL}/api/cenas/${cenaId}/tokens`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ token_id: finalTokenId })
                });
            }

            alert(
                ` Cena "${nomeCena}" salva com sucesso!\n\n` +
                ` Total: ${allTokens.length} tokens\n` +
                ` Temporários salvos: ${tempCount}\n` +
                ` Já persistentes: ${persistedCount}`
            );
            
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
            const response = await fetch(`${API_URL}/api/cenas/${cenaId}`);
            const cena = await response.json();

            console.log('Carregando cena:', cena);

            // Ativa a cena no servidor
            if (socket) {
                socket.emit("ActivateScene", cenaId);
            }

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

        // Cria cada token no canvas (AGORA COMO PERSISTENTE)
        for (const token of cena.tokens) {
            const imageUrl = `${API_URL}/api/image/${token.image_id}`;
            gridRef.current.createToken(
                imageUrl,
                token.pos_x,
                token.pos_y,
                token.token_id,
                token.image_id,
                false // NÃO é temporário - foi carregado do banco
            );
        }

        console.log(` Cena "${cena.nome}" carregada localmente (${cena.tokens.length} tokens)`);
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
<div className="scene-manager">
            <h3 >Cenas</h3>
            
<button className="scene-btn" onClick={() => setShowSaveModal(true)}>
  Salvar Cena
</button>

<button className="scene-btn load" onClick={() => setShowLoadModal(true)}>
  Carregar Cena
</button>

            {/* MODAL DE SALVAR */}
            {showSaveModal && (
  <div className="modal-overlay">
 <div className="modal-content">
                        <h2 >Salvar Cena Atual</h2>
                        
                        <div>
                            ⚠️ <strong>Atenção:</strong> Tokens temporários (borda laranja) serão salvos permanentemente!
                        </div>
                        
                        <label>
                            <strong>Nome da Cena:</strong>
                            <input
                                type="text"
                                value={nomeCena}
                                onChange={(e) => setNomeCena(e.target.value)}
                                placeholder="Ex: Taverna do Dragão"
                            />
                        </label>

                          <label>
                            <strong>Descrição (opcional):</strong>
                            <textarea
                                value={descricaoCena}
                                onChange={(e) => setDescricaoCena(e.target.value)}
                                placeholder="Descreva a cena..."
                                rows={3}

                            />
                        </label>

                        <div style={{ display: 'flex', gap: 10 }}>
                            <button onClick={saveCurrentScene}>
                                Salvar
                            </button>
                            <button onClick={() => {
                                setShowSaveModal(false);
                                setNomeCena('');
                                setDescricaoCena('');
                            }} >
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
                        <h2 style={{ color: '#4488ff', marginTop: 0 }}>Carregar Cena</h2>
                        
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