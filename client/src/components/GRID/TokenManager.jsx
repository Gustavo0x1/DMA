import React, { useState, useEffect } from 'react';

const API_URL = process.env.REACT_APP_API_URL;

function TokenManager({ gridRef, socket }) {
    const [images, setImages] = useState([]);
    const [showModal, setShowModal] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');

    // Carrega lista de IMAGENS (não tokens) ao montar
    useEffect(() => {
        loadImagesList();
    }, []);

    const loadImagesList = async () => {
        try {
            const response = await fetch(`${API_URL}/api/images/list`);
            const data = await response.json();
            setImages(Array.isArray(data) ? data : []);
        } catch (err) {
            console.error('Erro ao carregar imagens:', err);
            setImages([]);
        }
    };

    // Adicionar imagem ao canvas como token TEMPORÁRIO
    const addImageToCanvas = (image) => {
        if (!gridRef.current) {
            alert('Grid não está pronto!');
            return;
        }

        const imageUrl = `${API_URL}/api/image/${image.image_id}`;

        // Gera um ID temporário único para este token
        const tempTokenId = `temp-token-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

        // Cria o token no canvas (SEM salvar no banco)
        gridRef.current.createToken(
            imageUrl,
            1, // posição inicial x
            1, // posição inicial y
            tempTokenId,
            image.image_id,
            true // Flag indicando que é temporário
        );

        console.log(`✨ Token temporário criado: ${tempTokenId} (imagem: ${image.image_id})`);
        console.log('⚠️ Este token será salvo apenas ao salvar a cena');
    };

    // Deletar imagem do banco
    const deleteImage = async (imageId) => {
        if (!window.confirm(`Deletar esta imagem do banco?\nIsso removerá a imagem de TODAS as cenas que a usam!`)) return;

        try {
            // Note: você precisará criar esta rota no backend
            await fetch(`${API_URL}/api/images/${imageId}`, {
                method: 'DELETE'
            });
            alert('Imagem deletada!');
            loadImagesList();
        } catch (err) {
            console.error('Erro ao deletar:', err);
            alert('Erro ao deletar imagem: ' + err.message);
        }
    };

    // Filtrar imagens pela busca
    const filteredImages = images.filter(image =>
        image.original_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        image.token_id?.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <div className="token-manager">
            <button className="token-btn" onClick={() => setShowModal(true)}>
                Imagens ({images.length})
            </button>

            {/* MODAL DE IMAGENS */}
            {showModal && (
                <div className="modal-overlay">
                    <div className="modal-content">
                        <div style={{ marginBottom: 20 }}>
                            <h2>
                                Biblioteca de Imagens
                            </h2>
                            <p>
                                Tokens criados aqui são temporários e serão salvos apenas ao salvar a cena
                            </p>

                            {/* Barra de busca */}
                            <input
                                type="text"
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                placeholder="🔍 Buscar por nome..."
                                style={{
                                    width: '100%',
                                    padding: 12,
                                    background: '#2a2a2a',
                                    color: 'white',
                                    border: '2px solid #444',
                                    borderRadius: 8,
                                    fontSize: '14px',
                                    outline: 'none'
                                }}
                                onFocus={(e) => e.target.style.borderColor = '#ff8800'}
                                onBlur={(e) => e.target.style.borderColor = '#444'}
                            />

                            <button
                                onClick={loadImagesList}
                                style={{
                                    marginTop: 10,
                                    padding: '8px 16px',
                                    background: '#333',
                                    color: '#ff8800',
                                    border: '1px solid #ff8800',
                                    borderRadius: 6,
                                    cursor: 'pointer',
                                    fontSize: '13px'
                                }}
                            >
                                 Atualizar Lista
                            </button>
                        </div>

                        {/* Lista de imagens com scroll */}
                        <div style={{
                            flex: 1,
                            overflowY: 'auto',
                            marginBottom: 15
                        }}>
                            {filteredImages.length === 0 ? (
                                <div style={{
                                    textAlign: 'center',
                                    padding: 40,
                                    color: '#666'
                                }}>
                                    {searchTerm ? (
                                        <p>Nenhuma imagem encontrada com "{searchTerm}"</p>
                                    ) : (
                                        <p>Nenhuma imagem no banco ainda.<br />Arraste imagens para o canvas para adicioná-las.</p>
                                    )}
                                </div>
                            ) : (
                                <div style={{
                                    display: 'grid',
                                    gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
                                    gap: 15
                                }}>
                                    {filteredImages.map(image => (
                                        <div key={image.image_id} style={{
                                            background: '#2a2a2a',
                                            padding: 15,
                                            borderRadius: 10,
                                            border: '1px solid #444',
                                            transition: 'all 0.2s',
                                            cursor: 'pointer'
                                        }}
                                            onMouseEnter={(e) => {
                                                e.currentTarget.style.borderColor = '#ff8800';
                                                e.currentTarget.style.transform = 'translateY(-2px)';
                                            }}
                                            onMouseLeave={(e) => {
                                                e.currentTarget.style.borderColor = '#444';
                                                e.currentTarget.style.transform = 'translateY(0)';
                                            }}>
                                            {/* Preview da imagem */}
                                            <div style={{
                                                width: '100%',
                                                height: 150,
                                                background: '#1a1a1a',
                                                borderRadius: 8,
                                                marginBottom: 10,
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                overflow: 'hidden'
                                            }}>
                                                <img
                                                    src={`${API_URL}/api/image/${image.image_id}`}
                                                    alt={image.original_name}
                                                    style={{
                                                        maxWidth: '100%',
                                                        maxHeight: '100%',
                                                        objectFit: 'contain'
                                                    }}
                                                    onError={(e) => {
                                                        e.target.style.display = 'none';
                                                        e.target.parentElement.innerHTML = '<span style="color: #666"> Sem preview</span>';
                                                    }}
                                                />
                                            </div>

                                            {/* Info da imagem */}
                                            <div style={{ marginBottom: 10 }}>
                                                <h4 style={{
                                                    margin: '0 0 8px 0',
                                                    color: '#ff8800',
                                                    fontSize: '13px',
                                                    fontWeight: 'bold',
                                                    wordBreak: 'break-all'
                                                }}>
                                                    {image.original_name}
                                                </h4>
                                                <p style={{
                                                    margin: '4px 0',
                                                    color: '#666',
                                                    fontSize: '11px'
                                                }}>
                                                     ID: {image.image_id}
                                                </p>
                                                {image.token_id && (
                                                    <p style={{
                                                        margin: '4px 0',
                                                        color: '#888',
                                                        fontSize: '10px'
                                                    }}>
                                                         Token: {image.token_id}
                                                    </p>
                                                )}
                                            </div>

                                            {/* Botões de ação */}
                                            <div style={{
                                                display: 'flex',
                                                gap: 8,
                                                marginTop: 10
                                            }}>
                                                <button
                                                    onClick={() => addImageToCanvas(image)}
                                                    style={{
                                                        flex: 1,
                                                        padding: '10px 12px',
                                                        background: '#ff8800',
                                                        color: 'white',
                                                        border: 'none',
                                                        borderRadius: 6,
                                                        cursor: 'pointer',
                                                        fontWeight: 'bold',
                                                        fontSize: '12px',
                                                        transition: 'background 0.2s'
                                                    }}
                                                    onMouseEnter={(e) => e.target.style.background = '#ff9920'}
                                                    onMouseLeave={(e) => e.target.style.background = '#ff8800'}
                                                >
                                                    Adicionar
                                                </button>
                                                <button
                                                    onClick={() => deleteImage(image.image_id)}
                                                    style={{
                                                        padding: '10px 12px',
                                                        background: '#ff4444',
                                                        color: 'white',
                                                        border: 'none',
                                                        borderRadius: 6,
                                                        cursor: 'pointer',
                                                        fontSize: '12px',
                                                        transition: 'background 0.2s'
                                                    }}
                                                    onMouseEnter={(e) => e.target.style.background = '#ff5555'}
                                                    onMouseLeave={(e) => e.target.style.background = '#ff4444'}
                                                >
                                                    Apagar
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* Botão fechar */}
                        <button
                            onClick={() => setShowModal(false)}
                            style={{
                                width: '100%',
                                padding: 14,
                                background: '#333',
                                color: 'white',
                                border: 'none',
                                borderRadius: 8,
                                cursor: 'pointer',
                                fontWeight: 'bold',
                                fontSize: '14px',
                                transition: 'background 0.2s'
                            }}
                            onMouseEnter={(e) => e.target.style.background = '#444'}
                            onMouseLeave={(e) => e.target.style.background = '#333'}
                        >
                            Fechar
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}

export default TokenManager;