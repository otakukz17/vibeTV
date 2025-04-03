'use client';

import { useState, useEffect, ChangeEvent, useCallback, useRef } from 'react';
import { PlaySquare, Tv, Search, Loader2, AlertTriangle } from 'lucide-react';
import Hls from 'hls.js';

interface Channel {
    name: string;
    url: string;
}

const IPTVPlayer: React.FC = () => {
    const playlistUrl = 'https://iptv-org.github.io/iptv/index.m3u';
    const [channels, setChannels] = useState<Channel[]>([]);
    const [selectedChannelUrl, setSelectedChannelUrl] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState<boolean>(true);
    const [error, setError] = useState<string | null>(null);
    const [searchTerm, setSearchTerm] = useState<string>('');
    const videoRef = useRef<HTMLVideoElement>(null);
    const hlsRef = useRef<Hls | null>(null);
    const [useCorsProxy, setUseCorsProxy] = useState<boolean>(true);
    const [proxyType, setProxyType] = useState<string>('corsproxy');

    // Функция для добавления CORS-прокси к URL
    const addCorsProxy = (url: string): string => {
        if (!useCorsProxy) return url;
        
        // Проверка наличия протокола
        if (!url.startsWith('http://') && !url.startsWith('https://')) {
            return url; // Возвращаем неизмененным, если нет протокола
        }
        
        // Преобразуем http в https для решения Mixed Content проблемы
        let secureUrl = url;
        if (url.startsWith('http://')) {
            secureUrl = 'https://' + url.substring(7);
        }
        
        // Используем выбранный прокси
        if (proxyType === 'corsproxy') {
            return `https://corsproxy.io/?${encodeURIComponent(secureUrl)}`;
        } else if (proxyType === 'corsanywhere') {
            return `https://cors-anywhere.herokuapp.com/${secureUrl}`;
        } else if (proxyType === 'allorigins') {
            return `https://api.allorigins.win/raw?url=${encodeURIComponent(secureUrl)}`;
        } else if (proxyType === 'thingproxy') {
            return `https://thingproxy.freeboard.io/fetch/${secureUrl}`;
        } else {
            return secureUrl;
        }
    };

    const parseM3U = useCallback((m3uContent: string): Channel[] => {
        const lines = m3uContent.split('\n');
        const parsedChannels: Channel[] = [];
        for (let i = 0; i < lines.length; i++) {
            if (lines[i].startsWith('#EXTINF:')) {
                const infoLine = lines[i];
                const urlLine = lines[i + 1];
                if (urlLine && (urlLine.startsWith('http://') || urlLine.startsWith('https://') || urlLine.startsWith('rtmp://') || urlLine.startsWith('rtsp://'))) {
                    let name = infoLine.substring(infoLine.lastIndexOf(',') + 1).trim();
                    const tvgNameMatch = infoLine.match(/tvg-name="([^"]+)"/);
                    if (tvgNameMatch && tvgNameMatch[1]) {
                        name = tvgNameMatch[1];
                    }
                    if (!name) {
                        name = `Channel ${parsedChannels.length + 1}`;
                    }
                    parsedChannels.push({ name, url: urlLine });
                    i++; 
                }
            }
        }
        return parsedChannels;
    }, []);

    useEffect(() => {
        const fetchPlaylist = async () => {
            setIsLoading(true);
            setError(null);
            try {
                const response = await fetch(playlistUrl);
                if (!response.ok) {
                    throw new Error(`HTTP error! status: ${response.status}`);
                }
                const data = await response.text();
                const parsed = parseM3U(data);
                setChannels(parsed);
                if(parsed.length > 0 && !selectedChannelUrl){
                    // Optionally select the first channel by default
                    // setSelectedChannelUrl(parsed[0].url);
                }
            } catch (e) {
                console.error("Failed to fetch or parse playlist:", e);
                setError(e instanceof Error ? e.message : 'An unknown error occurred while loading channels.');
            } finally {
                setIsLoading(false);
            }
        };

        fetchPlaylist();
    }, [playlistUrl, parseM3U, selectedChannelUrl]);

    useEffect(() => {
        if (selectedChannelUrl && videoRef.current) {
            // Сбрасываем ошибку при выборе нового канала
            setError(null);
            
            // Уничтожаем предыдущий экземпляр HLS.js если он существует
            if (hlsRef.current) {
                hlsRef.current.destroy();
                hlsRef.current = null;
            }
            
            // Применяем CORS прокси к URL
            const proxyUrl = addCorsProxy(selectedChannelUrl);
            
            // Функция для воспроизведения видео напрямую
            const playDirectStream = () => {
                if (videoRef.current) {
                    videoRef.current.src = proxyUrl;
                    videoRef.current.play().catch(e => {
                        console.error('Ошибка воспроизведения напрямую:', e);
                        setError(`Ошибка воспроизведения: ${e.message || 'Неизвестная ошибка'}`);
                    });
                }
            };
            
            // Проверяем, поддерживается ли HLS.js и подходит ли URL для HLS
            if (Hls.isSupported() && (proxyUrl.includes('.m3u8') || selectedChannelUrl.includes('.m3u8'))) {
                try {
                    const hls = new Hls({
                        maxBufferLength: 30,
                        maxMaxBufferLength: 60,
                        // Критически важно: настройка для принудительного использования прокси для всех запросов
                        xhrSetup: function(xhr, url) {
                            // Проверяем, если URL уже обработан нашим прокси
                            if (!url.includes('corsproxy.io') && 
                                !url.includes('cors-anywhere') && 
                                !url.includes('allorigins.win') && 
                                !url.includes('thingproxy.freeboard.io') && 
                                useCorsProxy &&
                                (url.startsWith('http://') || url.startsWith('https://'))) {
                                // Применяем прокси к URL сегментов и мастер-плейлистов
                                const proxiedUrl = addCorsProxy(url);
                                xhr.open('GET', proxiedUrl, true);
                                return;
                            }
                        }
                    });
                    
                    hls.attachMedia(videoRef.current);
                    hls.on(Hls.Events.MEDIA_ATTACHED, () => {
                        hls.loadSource(proxyUrl);
                    });
                    
                    hls.on(Hls.Events.ERROR, (event, data) => {
                        if (data.fatal) {
                            console.error('HLS Error:', data);
                            switch(data.type) {
                                case Hls.ErrorTypes.NETWORK_ERROR:
                                    console.error('Сетевая ошибка:', data);
                                    setError('Ошибка сети: не удалось загрузить поток. Попробуйте другой канал или прокси.');
                                    break;
                                case Hls.ErrorTypes.MEDIA_ERROR:
                                    console.error('Ошибка медиа:', data);
                                    setError('Ошибка медиа: формат не поддерживается или повреждён');
                                    break;
                                default:
                                    console.error('Фатальная ошибка:', data);
                                    setError(`Ошибка воспроизведения: ${data.details}`);
                                    break;
                            }
                        }
                    });
                    
                    hlsRef.current = hls;
                } catch (e) {
                    console.error('Ошибка при инициализации HLS.js:', e);
                    // Если HLS не удался, пробуем обычное воспроизведение
                    playDirectStream();
                }
            } else {
                // Если HLS не поддерживается или URL не для HLS, используем обычное воспроизведение
                playDirectStream();
            }
        }
        
        // Очистка при размонтировании
        return () => {
            if (hlsRef.current) {
                hlsRef.current.destroy();
                hlsRef.current = null;
            }
        };
    }, [selectedChannelUrl, useCorsProxy, proxyType]);

    const handleChannelSelect = (url: string) => {
        setSelectedChannelUrl(url);
    };

    const handleSearchChange = (event: ChangeEvent<HTMLInputElement>) => {
        setSearchTerm(event.target.value);
    };

    const toggleCorsProxy = () => {
        setUseCorsProxy(!useCorsProxy);
        if (selectedChannelUrl) {
            // Перезагружаем текущий канал с новой настройкой
            const currentUrl = selectedChannelUrl;
            setSelectedChannelUrl(null);
            setTimeout(() => setSelectedChannelUrl(currentUrl), 100);
        }
    };

    const changeProxyType = () => {
        // Циклически переключаем между доступными прокси
        const proxyTypes = ['corsproxy', 'corsanywhere', 'allorigins', 'thingproxy', 'none'];
        const currentIndex = proxyTypes.indexOf(proxyType);
        const nextIndex = (currentIndex + 1) % proxyTypes.length;
        setProxyType(proxyTypes[nextIndex]);
        
        if (selectedChannelUrl) {
            // Перезагружаем текущий канал с новой настройкой
            const currentUrl = selectedChannelUrl;
            setSelectedChannelUrl(null);
            setTimeout(() => setSelectedChannelUrl(currentUrl), 100);
        }
    };

    const getProxyName = (type: string): string => {
        switch(type) {
            case 'corsproxy': return 'CorsprIO';
            case 'corsanywhere': return 'CORS Anywhere';
            case 'allorigins': return 'All Origins';
            case 'thingproxy': return 'ThingProxy';
            case 'none': return 'Отключен';
            default: return type;
        }
    };

    const filteredChannels = channels.filter(channel =>
        channel.name.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <div className="min-h-screen bg-gradient-to-r from-slate-900 via-purple-900 to-slate-900 text-white flex flex-col font-sans">
            <header className="p-4 bg-black bg-opacity-50 shadow-md backdrop-blur-sm sticky top-0 z-10 border-b border-gray-700">
                <div className="container mx-auto flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                        <PlaySquare className="w-6 h-6 text-indigo-400" />
                        <h1 className="text-xl font-bold tracking-tight">Simple IPTV Player</h1>
                    </div>
                    <div className="flex items-center space-x-2">
                        <button 
                            onClick={changeProxyType}
                            className={`px-3 py-1 text-xs rounded-md bg-blue-700 hover:bg-blue-800`}>
                            Прокси: {getProxyName(proxyType)}
                        </button>
                        <button 
                            onClick={toggleCorsProxy}
                            className={`px-3 py-1 text-xs rounded-md ${useCorsProxy ? 'bg-green-600 hover:bg-green-700' : 'bg-red-600 hover:bg-red-700'}`}>
                            CORS Proxy: {useCorsProxy ? 'Вкл' : 'Выкл'}
                        </button>
                    </div>
                </div>
            </header>

            <div className="flex flex-1 container mx-auto p-4 md:p-6 lg:p-8 gap-6 md:gap-8 flex-col lg:flex-row overflow-hidden">
                <aside className="w-full lg:w-72 xl:w-80 bg-slate-800 bg-opacity-70 rounded-xl shadow-lg p-4 flex flex-col border border-slate-700 backdrop-blur-sm lg:h-[calc(100vh-120px)]">
                    <div className="mb-4 relative">
                        <input
                            type="text"
                            placeholder="Search channels..."
                            value={searchTerm}
                            onChange={handleSearchChange}
                            className="w-full p-3 pl-10 rounded-lg bg-slate-700 border border-slate-600 focus:border-indigo-500 focus:ring focus:ring-indigo-500 focus:ring-opacity-50 transition duration-200 text-white placeholder-slate-400"
                        />
                        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-slate-400" />
                    </div>
                    <div className="flex-1 overflow-y-auto pr-2 space-y-2 scrollbar-thin scrollbar-thumb-slate-600 scrollbar-track-slate-700">
                        {isLoading ? (
                            <div className="flex justify-center items-center h-full">
                                <Loader2 className="w-8 h-8 animate-spin text-indigo-400" />
                            </div>
                        ) : error ? (
                            <div className="text-red-400 flex items-center space-x-2 p-3 bg-red-900 bg-opacity-30 rounded-lg">
                                <AlertTriangle className="w-5 h-5"/>
                                <span>Error: {error}</span>
                            </div>
                        ) : filteredChannels.length === 0 ? (
                            <p className="text-center text-slate-400 py-4">No channels found{searchTerm && ' for "' + searchTerm + '"'}.</p>
                        ) : (
                            filteredChannels.map((channel, index) => (
                                <button
                                    key={index}
                                    onClick={() => handleChannelSelect(channel.url)}
                                    className={`w-full text-left p-3 rounded-lg transition duration-200 ease-in-out flex items-center space-x-3 ${selectedChannelUrl === channel.url ? 'bg-indigo-600 shadow-md' : 'hover:bg-slate-700'}`}>
                                    <Tv className={`w-5 h-5 ${selectedChannelUrl === channel.url ? 'text-white' : 'text-indigo-300'}`} />
                                    <span className="truncate font-medium">{channel.name}</span>
                                </button>
                            ))
                        )}
                    </div>
                </aside>

                <main className="flex-1 bg-black rounded-xl shadow-inner overflow-hidden border border-slate-700 flex items-center justify-center min-h-[300px] lg:min-h-0 relative">
                    {selectedChannelUrl ? (
                        <>
                            <video
                                ref={videoRef}
                                controls
                                autoPlay
                                className="w-full h-full object-contain bg-black"
                                onError={() => setError('Ошибка воспроизведения: формат видео не поддерживается браузером')}>
                                Your browser does not support the video tag.
                            </video>
                            {error && (
                                <div className="absolute inset-0 bg-black bg-opacity-70 flex items-center justify-center p-4">
                                    <div className="text-red-400 flex flex-col items-center space-y-2 p-4 bg-red-900 bg-opacity-30 rounded-lg max-w-md text-center">
                                        <AlertTriangle className="w-8 h-8 mb-2"/>
                                        <h3 className="font-bold">Проблема воспроизведения</h3>
                                        <p>{error}</p>
                                        <div className="flex space-x-2 mt-2">
                                            <button 
                                                className="px-4 py-2 bg-slate-700 hover:bg-slate-600 rounded-lg transition"
                                                onClick={() => setError(null)}>
                                                Закрыть
                                            </button>
                                            <button 
                                                className="px-4 py-2 bg-blue-700 hover:bg-blue-600 rounded-lg transition"
                                                onClick={changeProxyType}>
                                                Сменить прокси
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </>
                    ) : (
                        <div className="text-center text-slate-500 flex flex-col items-center">
                            <PlaySquare size={64} className="mb-4 opacity-50"/>
                            <p className="text-xl font-semibold">Выберите канал для просмотра</p>
                            <p className="text-sm">Выберите из списка слева.</p>
                        </div>
                    )}
                </main>
            </div>
            <footer className="p-4 text-center text-xs text-slate-500 bg-slate-900 bg-opacity-80 border-t border-slate-700">
                Simple IPTV Player - Приятного просмотра!
            </footer>
        </div>
    );
};

export default IPTVPlayer;
