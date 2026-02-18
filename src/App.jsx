import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Play, Pause, Volume2, VolumeX, Maximize, Minimize, SkipBack, SkipForward, Film, Info, Home, List, Settings, Repeat, Repeat1, Shuffle, RotateCcw, RotateCw, PictureInPicture } from 'lucide-react';

const VideoPlayer = () => {
  const [videos, setVideos] = useState([]);
  const [playlists, setPlaylists] = useState([]);
  const [filteredItems, setFilteredItems] = useState([]);
  const [featuredItem, setFeaturedItem] = useState(null);
  const [currentVideo, setCurrentVideo] = useState(null);
  const [currentPlaylist, setCurrentPlaylist] = useState(null);
  const [view, setView] = useState('home');
  const [displayMode, setDisplayMode] = useState('all');
  const [durationFilter, setDurationFilter] = useState('all');
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [volume, setVolume] = useState(1);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const [thumbnails, setThumbnails] = useState({});
  const [playbackRate, setPlaybackRate] = useState(1);
  const [showSettings, setShowSettings] = useState(false);
  const [repeatMode, setRepeatMode] = useState('off');
  const [isShuffled, setIsShuffled] = useState(false);
  const [isPiP, setIsPiP] = useState(false);
  const [showPlaylist, setShowPlaylist] = useState(false);
  const [autoLoadAttempted, setAutoLoadAttempted] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [showStartupHint, setShowStartupHint] = useState(true);

  const videoRef = useRef(null);
  const containerRef = useRef(null);
  const controlsTimeoutRef = useRef(null);

  const toggleFullscreen = useCallback(async () => {
    try {
      if (!document.fullscreenElement) {
        await containerRef.current?.requestFullscreen();
      } else {
        await document.exitFullscreen();
      }
    } catch (error) {
      console.error('Fullscreen error:', error);
    }
  }, []);

  // Electron IPC Handler for fullscreen toggle
  useEffect(() => {
    if (window.require) {
      try {
        const { ipcRenderer } = window.require('electron');
        
        const handleFullscreenToggle = () => {
          setShowStartupHint(false);
          toggleFullscreen();
        };

        ipcRenderer.on('fullscreen-toggle', handleFullscreenToggle);

        return () => {
          ipcRenderer.removeListener('fullscreen-toggle', handleFullscreenToggle);
        };
      } catch (error) {
        console.log('Not running in Electron environment');
      }
    }
  }, [toggleFullscreen]);

  useEffect(() => {
    if (!autoLoadAttempted) {
      setAutoLoadAttempted(true);
      const timer = setTimeout(() => {
        loadVideos();
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [autoLoadAttempted]);

  useEffect(() => {
    const timer = setTimeout(() => setShowStartupHint(false), 4000);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    applyFilters();
  }, [videos, playlists, displayMode, durationFilter, isShuffled]);

  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.playbackRate = playbackRate;
    }
  }, [playbackRate]);

  const togglePlay = useCallback(() => {
    if (videoRef.current) {
      if (isPlaying) {
        videoRef.current.pause();
      } else {
        videoRef.current.play().catch(err => console.error('Play error:', err));
      }
      setIsPlaying(!isPlaying);
    }
  }, [isPlaying]);

  const seekBackward = useCallback(() => {
    if (videoRef.current) {
      videoRef.current.currentTime = Math.max(videoRef.current.currentTime - 10, 0);
    }
  }, []);

  const seekForward = useCallback(() => {
    if (videoRef.current && duration) {
      videoRef.current.currentTime = Math.min(videoRef.current.currentTime + 10, duration);
    }
  }, [duration]);

  const adjustVolume = useCallback((delta) => {
    const newVolume = Math.max(0, Math.min(1, volume + delta));
    setVolume(newVolume);
    if (videoRef.current) {
      videoRef.current.volume = newVolume;
    }
    setIsMuted(newVolume === 0);
  }, [volume]);

  const toggleMute = useCallback(() => {
    if (videoRef.current) {
      const newMuted = !isMuted;
      videoRef.current.muted = newMuted;
      setIsMuted(newMuted);
    }
  }, [isMuted]);

  const togglePiP = useCallback(async () => {
    try {
      if (videoRef.current) {
        if (!document.pictureInPictureElement) {
          await videoRef.current.requestPictureInPicture();
        } else {
          await document.exitPictureInPicture();
        }
      }
    } catch (error) {
      console.error('PiP error:', error);
    }
  }, []);

  const skipVideo = useCallback((direction) => {
    const allVideos = currentPlaylist ? currentPlaylist.videos : videos;
    
    if (!allVideos || !currentVideo) return;
    
    const currentIndex = allVideos.findIndex(v => v.id === currentVideo.id);
    let nextIndex = direction === 'next' ? currentIndex + 1 : currentIndex - 1;
    
    if (nextIndex >= 0 && nextIndex < allVideos.length) {
      handleVideoSelect(allVideos[nextIndex], currentPlaylist);
    } else if (direction === 'next' && repeatMode === 'all') {
      handleVideoSelect(allVideos[0], currentPlaylist);
    }
  }, [currentPlaylist, currentVideo, videos, repeatMode]);

  const toggleRepeatMode = useCallback(() => {
    const modes = ['off', 'all', 'one'];
    const currentIndex = modes.indexOf(repeatMode);
    setRepeatMode(modes[(currentIndex + 1) % modes.length]);
  }, [repeatMode]);

  const adjustPlaybackRate = useCallback((delta) => {
    setPlaybackRate(prev => Math.max(0.25, Math.min(2, prev + delta)));
  }, []);

  useEffect(() => {
    const handleKeyPress = (e) => {
      if (view !== 'player') return;

      const actions = {
        ' ': togglePlay,
        'k': togglePlay,
        'arrowleft': seekBackward,
        'arrowright': seekForward,
        'arrowup': () => adjustVolume(0.1),
        'arrowdown': () => adjustVolume(-0.1),
        'f': toggleFullscreen,
        'h': () => {
          setShowStartupHint(false);
          toggleFullscreen();
        },
        'm': toggleMute,
        'p': togglePiP,
        'n': () => skipVideo('next'),
        'b': () => skipVideo('prev'),
        'l': () => setShowPlaylist(prev => !prev),
        'r': toggleRepeatMode,
        ',': () => adjustPlaybackRate(-0.25),
        '.': () => adjustPlaybackRate(0.25)
      };

      const action = actions[e.key.toLowerCase()];
      if (action) {
        e.preventDefault();
        action();
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [view, isPlaying, volume, playbackRate, togglePlay, seekBackward, seekForward, adjustVolume, toggleFullscreen, toggleMute, togglePiP, skipVideo, toggleRepeatMode, adjustPlaybackRate]);

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  useEffect(() => {
    const handlePiPChange = () => {
      setIsPiP(!!document.pictureInPictureElement);
    };

    const video = videoRef.current;
    video?.addEventListener('enterpictureinpicture', handlePiPChange);
    video?.addEventListener('leavepictureinpicture', handlePiPChange);
    
    return () => {
      video?.removeEventListener('enterpictureinpicture', handlePiPChange);
      video?.removeEventListener('leavepictureinpicture', handlePiPChange);
    };
  }, []);

  useEffect(() => {
    return () => {
      if (controlsTimeoutRef.current) {
        clearTimeout(controlsTimeoutRef.current);
      }
      videos.forEach(video => {
        if (video.url) URL.revokeObjectURL(video.url);
      });
      playlists.forEach(playlist => {
        playlist.videos.forEach(video => {
          if (video.url) URL.revokeObjectURL(video.url);
        });
      });
    };
  }, [videos, playlists]);

  const shuffleArray = useCallback((array) => {
    const newArray = [...array];
    for (let i = newArray.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [newArray[i], newArray[j]] = [newArray[j], newArray[i]];
    }
    return newArray;
  }, []);

  const generateThumbnail = useCallback(async (videoFile) => {
    return new Promise((resolve) => {
      const video = document.createElement('video');
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      
      video.preload = 'metadata';
      video.src = URL.createObjectURL(videoFile);
      
      video.onloadeddata = () => {
        video.currentTime = Math.min(5, video.duration / 4);
      };
      
      video.onseeked = () => {
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        const thumbnail = canvas.toDataURL('image/jpeg', 0.7);
        URL.revokeObjectURL(video.src);
        resolve(thumbnail);
      };
      
      video.onerror = () => {
        URL.revokeObjectURL(video.src);
        resolve(null);
      };
    });
  }, []);

  const getVideoDuration = useCallback((file) => {
    return new Promise((resolve) => {
      const video = document.createElement('video');
      video.preload = 'metadata';
      video.src = URL.createObjectURL(file);
      video.onloadedmetadata = () => {
        URL.revokeObjectURL(video.src);
        resolve(video.duration);
      };
      video.onerror = () => {
        URL.revokeObjectURL(video.src);
        resolve(0);
      };
    });
  }, []);

  const isVideoFile = useCallback((filename) => {
    const videoExtensions = ['.mp4', '.mkv', '.avi', '.mov', '.wmv', '.flv', '.webm', '.m4v'];
    return videoExtensions.some(ext => filename.toLowerCase().endsWith(ext));
  }, []);

  const loadVideos = async () => {
    if (isLoading) return;
    
    try {
      setIsLoading(true);
      
      if (!('showDirectoryPicker' in window)) {
        alert('Your browser does not support local file access. Please use Chrome or Edge.');
        setIsLoading(false);
        return;
      }

      const dirHandle = await window.showDirectoryPicker({
        id: 'video-library',
        mode: 'read',
        startIn: 'downloads'
      });
      
      const foundVideos = [];
      const foundPlaylists = [];
      const thumbs = {};
      
      for await (const entry of dirHandle.values()) {
        if (entry.kind === 'file') {
          const file = await entry.getFile();
          if (isVideoFile(file.name)) {
            const videoId = `video-${Date.now()}-${Math.random()}`;
            const videoObj = {
              id: videoId,
              name: file.name,
              file: file,
              url: URL.createObjectURL(file),
              duration: await getVideoDuration(file),
              type: 'video'
            };
            foundVideos.push(videoObj);
            
            const thumb = await generateThumbnail(file);
            if (thumb) thumbs[videoId] = thumb;
          }
        } else if (entry.kind === 'directory') {
          const playlistVideos = [];
          for await (const subEntry of entry.values()) {
            if (subEntry.kind === 'file') {
              const file = await subEntry.getFile();
              if (isVideoFile(file.name)) {
                const videoId = `video-${Date.now()}-${Math.random()}`;
                const videoObj = {
                  id: videoId,
                  name: file.name,
                  file: file,
                  url: URL.createObjectURL(file),
                  duration: await getVideoDuration(file)
                };
                playlistVideos.push(videoObj);
                
                const thumb = await generateThumbnail(file);
                if (thumb) thumbs[videoId] = thumb;
              }
            }
          }
          if (playlistVideos.length > 0) {
            const playlistId = `playlist-${Date.now()}-${Math.random()}`;
            foundPlaylists.push({
              id: playlistId,
              name: entry.name,
              videos: playlistVideos,
              videoCount: playlistVideos.length,
              type: 'playlist'
            });
          }
        }
      }
      
      setVideos(foundVideos);
      setPlaylists(foundPlaylists);
      setThumbnails(thumbs);
      
      const allItems = [...foundVideos, ...foundPlaylists];
      if (allItems.length > 0) {
        setFeaturedItem(allItems[Math.floor(Math.random() * allItems.length)]);
      }
    } catch (err) {
      if (err.name !== 'AbortError') {
        console.error('Error accessing directory:', err);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const applyFilters = useCallback(() => {
    let items = [];
    
    if (displayMode === 'all') {
      items = [...videos, ...playlists];
    } else if (displayMode === 'videos') {
      items = [...videos];
    } else if (displayMode === 'playlists') {
      items = [...playlists];
    }
    
    if (durationFilter !== 'all' && displayMode !== 'playlists') {
      items = items.filter(item => {
        if (item.type === 'playlist') return true;
        if (durationFilter === 'short') return item.duration < 600;
        if (durationFilter === 'medium') return item.duration >= 600 && item.duration < 3600;
        if (durationFilter === 'long') return item.duration >= 3600;
        return true;
      });
    }
    
    setFilteredItems(isShuffled ? shuffleArray(items) : items);
  }, [videos, playlists, displayMode, durationFilter, isShuffled, shuffleArray]);

  const handleItemClick = useCallback((item) => {
    if (item.type === 'video') {
      handleVideoSelect(item);
    } else {
      if (item.videos.length > 0) {
        handleVideoSelect(item.videos[0], item);
      }
    }
  }, []);

  const handleVideoSelect = useCallback((video, playlist = null) => {
    setCurrentVideo(video);
    setCurrentPlaylist(playlist);
    setView('player');
    setIsPlaying(true);
    setCurrentTime(0);
    setShowControls(true);
    setShowSettings(false);
  }, []);

  const handleVolumeChange = useCallback((e) => {
    const newVolume = parseFloat(e.target.value);
    setVolume(newVolume);
    if (videoRef.current) {
      videoRef.current.volume = newVolume;
    }
    setIsMuted(newVolume === 0);
  }, []);

  const handleTimeUpdate = useCallback(() => {
    if (videoRef.current) {
      setCurrentTime(videoRef.current.currentTime);
      setDuration(videoRef.current.duration);
    }
  }, []);

  const handleSeek = useCallback((e) => {
    const seekTime = parseFloat(e.target.value);
    setCurrentTime(seekTime);
    if (videoRef.current) {
      videoRef.current.currentTime = seekTime;
    }
  }, []);

  const formatTime = useCallback((time) => {
    if (isNaN(time)) return '0:00';
    const hours = Math.floor(time / 3600);
    const minutes = Math.floor((time % 3600) / 60);
    const seconds = Math.floor(time % 60);
    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    }
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  }, []);

  const handleMouseMove = useCallback(() => {
    setShowControls(true);
    if (controlsTimeoutRef.current) {
      clearTimeout(controlsTimeoutRef.current);
    }
    controlsTimeoutRef.current = setTimeout(() => {
      if (isPlaying && !showSettings) setShowControls(false);
    }, 3000);
  }, [isPlaying, showSettings]);

  const handleVideoEnd = useCallback(() => {
    if (repeatMode === 'one') {
      if (videoRef.current) {
        videoRef.current.currentTime = 0;
        videoRef.current.play().catch(err => console.error('Replay error:', err));
      }
    } else if (repeatMode === 'all' || currentPlaylist) {
      skipVideo('next');
    }
  }, [repeatMode, currentPlaylist, skipVideo]);

  const goHome = useCallback(() => {
    if (videoRef.current) {
      videoRef.current.pause();
      videoRef.current.currentTime = 0;
      videoRef.current.src = '';
      videoRef.current.load();
    }
    
    if (document.fullscreenElement) {
      document.exitFullscreen().catch(err => console.error('Fullscreen exit error:', err));
    }
    
    if (document.pictureInPictureElement) {
      document.exitPictureInPicture().catch(err => console.error('PiP exit error:', err));
    }
    
    if (controlsTimeoutRef.current) {
      clearTimeout(controlsTimeoutRef.current);
    }
    
    setCurrentVideo(null);
    setCurrentPlaylist(null);
    setIsPlaying(false);
    setCurrentTime(0);
    setDuration(0);
    setShowControls(true);
    setShowSettings(false);
    setShowPlaylist(false);
    setIsFullscreen(false);
    setIsPiP(false);
    setPlaybackRate(1);
    setView('home');
  }, []);

  const getCurrentPlaylistVideos = useCallback(() => {
    return currentPlaylist ? currentPlaylist.videos : [];
  }, [currentPlaylist]);

  return (
    <div className="min-h-screen bg-black text-white" style={{ fontFamily: '"Inter", "Segoe UI", -apple-system, BlinkMacSystemFont, sans-serif' }}>
      {view === 'home' ? (
        <div className="min-h-screen">
          <header className="fixed top-0 left-0 right-0 z-50 bg-gradient-to-b from-black via-black/90 to-transparent px-12 py-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-8">
                <h1 className="text-4xl font-bold bg-gradient-to-r from-red-600 to-red-500 bg-clip-text text-transparent tracking-tight">HAITOMASworld</h1>
                <nav className="flex gap-6 text-sm font-medium">
                  <button className="text-white hover:text-red-500 transition-colors">Home</button>
                  <button className="text-gray-400 hover:text-white transition-colors">Videos</button>
                  <button className="text-gray-400 hover:text-white transition-colors">Playlists</button>
                  <button className="text-gray-400 hover:text-white transition-colors">My List</button>
                </nav>
              </div>
              <button
                onClick={loadVideos}
                disabled={isLoading}
                className="px-6 py-2.5 bg-red-600 hover:bg-red-700 disabled:bg-red-800 disabled:cursor-not-allowed rounded-md font-semibold text-sm transition-all shadow-lg shadow-red-600/20 hover:shadow-red-600/40"
              >
                {isLoading ? 'Loading...' : 'Load Library'}
              </button>
            </div>
          </header>

          {featuredItem && (
            <div className="relative h-screen">
              <div className="absolute inset-0">
                {featuredItem.type === 'video' && thumbnails[featuredItem.id] ? (
                  <img 
                    src={thumbnails[featuredItem.id]} 
                    alt={featuredItem.name}
                    className="w-full h-full object-cover"
                  />
                ) : featuredItem.type === 'playlist' && featuredItem.videos[0] && thumbnails[featuredItem.videos[0].id] ? (
                  <img 
                    src={thumbnails[featuredItem.videos[0].id]} 
                    alt={featuredItem.name}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full bg-gradient-to-br from-zinc-900 via-black to-zinc-900"></div>
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-black via-black/60 to-transparent"></div>
                <div className="absolute inset-0 bg-gradient-to-r from-black/90 via-black/40 to-transparent"></div>
              </div>
              
              <div className="absolute bottom-0 left-0 right-0 p-12 pb-32">
                <div className="max-w-2xl">
                  <h2 className="text-6xl font-bold mb-4 leading-tight drop-shadow-2xl">
                    {featuredItem.type === 'video' 
                      ? featuredItem.name.replace(/\.[^/.]+$/, "")
                      : featuredItem.name
                    }
                  </h2>
                  {featuredItem.type === 'playlist' && (
                    <p className="text-xl text-gray-200 mb-6 font-medium drop-shadow-lg">{featuredItem.videoCount} Videos</p>
                  )}
                  {featuredItem.type === 'video' && featuredItem.duration > 0 && (
                    <p className="text-xl text-gray-200 mb-6 font-medium drop-shadow-lg">Duration: {formatTime(featuredItem.duration)}</p>
                  )}
                  <div className="flex gap-4">
                    <button
                      onClick={() => handleItemClick(featuredItem)}
                      className="flex items-center gap-2 px-8 py-3.5 bg-white text-black rounded-md font-bold text-lg hover:bg-gray-200 transition-all shadow-xl hover:scale-105"
                    >
                      <Play className="w-6 h-6" fill="currentColor" />
                      Play
                    </button>
                    <button className="flex items-center gap-2 px-8 py-3.5 bg-zinc-700/80 backdrop-blur-sm text-white rounded-md font-bold text-lg hover:bg-zinc-600/80 transition-all">
                      <Info className="w-6 h-6" />
                      More Info
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {(videos.length > 0 || playlists.length > 0) && (
            <div className="sticky top-24 z-40 bg-black/95 backdrop-blur-md px-12 py-4 border-t border-zinc-800/50 shadow-2xl">
              <div className="flex gap-4 items-center justify-between">
                <div className="flex gap-4">
                  <div className="flex gap-2">
                    <button
                      onClick={() => setDisplayMode('all')}
                      className={`px-5 py-2.5 rounded-md font-semibold text-sm transition-all ${
                        displayMode === 'all' 
                          ? 'bg-white text-black shadow-lg' 
                          : 'bg-zinc-800 text-gray-300 hover:bg-zinc-700'
                      }`}
                    >
                      All
                    </button>
                    <button
                      onClick={() => setDisplayMode('videos')}
                      className={`px-5 py-2.5 rounded-md font-semibold text-sm transition-all ${
                        displayMode === 'videos' 
                          ? 'bg-white text-black shadow-lg' 
                          : 'bg-zinc-800 text-gray-300 hover:bg-zinc-700'
                      }`}
                    >
                      Videos
                    </button>
                    <button
                      onClick={() => setDisplayMode('playlists')}
                      className={`px-5 py-2.5 rounded-md font-semibold text-sm transition-all ${
                        displayMode === 'playlists' 
                          ? 'bg-white text-black shadow-lg' 
                          : 'bg-zinc-800 text-gray-300 hover:bg-zinc-700'
                      }`}
                    >
                      Playlists
                    </button>
                  </div>

                  {displayMode !== 'playlists' && (
                    <>
                      <div className="h-8 w-px bg-zinc-700/50"></div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => setDurationFilter('all')}
                          className={`px-4 py-2.5 rounded-md font-medium text-sm transition-all ${
                            durationFilter === 'all' 
                              ? 'bg-red-600 text-white shadow-lg shadow-red-600/30' 
                              : 'bg-zinc-800 text-gray-300 hover:bg-zinc-700'
                          }`}
                        >
                          All Durations
                        </button>
                        <button
                          onClick={() => setDurationFilter('short')}
                          className={`px-4 py-2.5 rounded-md font-medium text-sm transition-all ${
                            durationFilter === 'short' 
                              ? 'bg-red-600 text-white shadow-lg shadow-red-600/30' 
                              : 'bg-zinc-800 text-gray-300 hover:bg-zinc-700'
                          }`}
                        >
                          Short (&lt; 10min)
                        </button>
                        <button
                          onClick={() => setDurationFilter('medium')}
                          className={`px-4 py-2.5 rounded-md font-medium text-sm transition-all ${
                            durationFilter === 'medium' 
                              ? 'bg-red-600 text-white shadow-lg shadow-red-600/30' 
                              : 'bg-zinc-800 text-gray-300 hover:bg-zinc-700'
                          }`}
                        >
                          Medium (10-60min)
                        </button>
                        <button
                          onClick={() => setDurationFilter('long')}
                          className={`px-4 py-2.5 rounded-md font-medium text-sm transition-all ${
                            durationFilter === 'long' 
                              ? 'bg-red-600 text-white shadow-lg shadow-red-600/30' 
                              : 'bg-zinc-800 text-gray-300 hover:bg-zinc-700'
                          }`}
                        >
                          Long (&gt; 60min)
                        </button>
                      </div>
                    </>
                  )}
                </div>
                
                <button
                  onClick={() => setIsShuffled(!isShuffled)}
                  className={`flex items-center gap-2 px-5 py-2.5 rounded-md font-semibold text-sm transition-all ${
                    isShuffled 
                      ? 'bg-red-600 text-white shadow-lg shadow-red-600/30' 
                      : 'bg-zinc-800 text-gray-300 hover:bg-zinc-700'
                  }`}
                >
                  <Shuffle className="w-4 h-4" />
                  Shuffle
                </button>
              </div>
            </div>
          )}

          <div className="px-12 py-8 mt-4">
            {videos.length === 0 && playlists.length === 0 ? (
              <div className="text-center py-32">
                <div className="inline-block p-8 bg-zinc-900/50 rounded-2xl backdrop-blur-sm border border-zinc-800/50">
                  <Film className="w-24 h-24 text-zinc-700 mx-auto mb-6" />
                  <p className="text-zinc-400 text-xl mb-2 font-medium">Your video library is empty</p>
                  <p className="text-zinc-600 text-sm">Click "Load Library" to browse your videos</p>
                </div>
              </div>
            ) : (
              <div>
                <h2 className="text-2xl font-bold mb-6 text-gray-100">
                  {displayMode === 'all' && 'All Content'}
                  {displayMode === 'videos' && 'Videos'}
                  {displayMode === 'playlists' && 'Playlists'}
                </h2>
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-4">
                  {filteredItems.map((item) => (
                    <div
                      key={item.id}
                      onClick={() => handleItemClick(item)}
                      className="group cursor-pointer"
                    >
                      <div className="relative aspect-video bg-zinc-900 rounded-lg overflow-hidden mb-2 shadow-lg">
                        {item.type === 'video' && thumbnails[item.id] ? (
                          <img 
                            src={thumbnails[item.id]} 
                            alt={item.name}
                            className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                          />
                        ) : item.type === 'playlist' && item.videos[0] && thumbnails[item.videos[0].id] ? (
                          <>
                            <img 
                              src={thumbnails[item.videos[0].id]} 
                              alt={item.name}
                              className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                            />
                            <div className="absolute top-2 right-2 bg-black/90 px-2.5 py-1 rounded-md text-xs font-bold flex items-center gap-1.5 backdrop-blur-sm">
                              <List className="w-3 h-3" />
                              {item.videoCount}
                            </div>
                          </>
                        ) : (
                          <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-zinc-900 to-zinc-800">
                            <Film className="w-12 h-12 text-zinc-700" />
                          </div>
                        )}
                        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/50 transition-all duration-300 flex items-center justify-center">
                          <div className="opacity-0 group-hover:opacity-100 transition-all duration-300 transform scale-75 group-hover:scale-100">
                            <div className="bg-white/20 backdrop-blur-sm rounded-full p-4">
                              <Play className="w-10 h-10 text-white" fill="white" />
                            </div>
                          </div>
                        </div>
                        {item.type === 'video' && item.duration > 0 && (
                          <div className="absolute bottom-2 right-2 bg-black/95 px-2 py-1 rounded text-xs font-bold backdrop-blur-sm">
                            {formatTime(item.duration)}
                          </div>
                        )}
                      </div>
                      <h3 className="text-sm font-semibold text-gray-300 group-hover:text-white transition-colors truncate">
                        {item.type === 'video' 
                          ? item.name.replace(/\.[^/.]+$/, "")
                          : item.name
                        }
                      </h3>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      ) : (
        <div 
          ref={containerRef}
          className="relative w-full h-screen flex bg-black overflow-hidden"
          onMouseMove={handleMouseMove}
          onMouseLeave={() => isPlaying && !showSettings && setShowControls(false)}
        >
          <div className={`flex-1 flex items-center justify-center transition-all duration-300 ${showPlaylist ? 'mr-80' : ''} ${isFullscreen ? 'w-full h-full' : ''}`}>
            <video
              ref={videoRef}
              className={`${isFullscreen ? 'w-full h-full object-contain' : 'max-w-full max-h-full'}`}
              onTimeUpdate={handleTimeUpdate}
              onLoadedMetadata={handleTimeUpdate}
              onPlay={() => setIsPlaying(true)}
              onPause={() => setIsPlaying(false)}
              onEnded={handleVideoEnd}
              src={currentVideo?.url}
              autoPlay
            />
          </div>

          {showPlaylist && currentPlaylist && (
            <div className="w-80 bg-zinc-900/95 backdrop-blur-md overflow-y-auto border-l border-zinc-800/50">
              <div className="p-4 border-b border-zinc-800/50 sticky top-0 bg-zinc-900/95 backdrop-blur-md z-10">
                <h3 className="font-bold text-lg">{currentPlaylist.name}</h3>
                <p className="text-sm text-gray-400">{currentPlaylist.videoCount} videos</p>
              </div>
              <div className="p-2">
                {getCurrentPlaylistVideos().map((video, index) => (
                  <div
                    key={video.id}
                    onClick={() => handleVideoSelect(video, currentPlaylist)}
                    className={`flex gap-3 p-2 rounded-lg cursor-pointer hover:bg-zinc-800/80 transition-all ${
                      currentVideo?.id === video.id ? 'bg-red-600/20 border border-red-600/30' : ''
                    }`}
                  >
                    <div className="relative w-32 aspect-video bg-zinc-800 rounded overflow-hidden flex-shrink-0">
                      {thumbnails[video.id] ? (
                        <img 
                          src={thumbnails[video.id]} 
                          alt={video.name}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <Film className="w-6 h-6 text-zinc-600" />
                        </div>
                      )}
                      {video.duration > 0 && (
                        <div className="absolute bottom-1 right-1 bg-black/90 px-1.5 py-0.5 rounded text-xs font-bold">
                          {formatTime(video.duration)}
                        </div>
                      )}
                      {currentVideo?.id === video.id && (
                        <div className="absolute inset-0 flex items-center justify-center bg-black/40">
                          <Play className="w-6 h-6 text-red-500" fill="currentColor" />
                        </div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{video.name.replace(/\.[^/.]+$/, "")}</p>
                      <p className="text-xs text-gray-500">Video {index + 1}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="absolute top-0 left-0 right-0 p-6 flex items-center justify-between z-50 pointer-events-auto">
            <button
              onClick={goHome}
              className="flex items-center gap-2 px-4 py-2.5 bg-black/70 hover:bg-black/90 rounded-lg transition-all backdrop-blur-md shadow-lg"
            >
              <Home className="w-5 h-5" />
              <span className="font-semibold">Home</span>
            </button>
            <h2 className={`text-xl font-bold truncate max-w-2xl drop-shadow-lg transition-opacity duration-300 ${showControls ? 'opacity-100' : 'opacity-0'}`}>
              {currentVideo?.name.replace(/\.[^/.]+$/, "")}
            </h2>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowPlaylist(!showPlaylist)}
                className={`p-2.5 rounded-lg transition-all backdrop-blur-md shadow-lg ${
                  showPlaylist 
                    ? 'bg-red-600/80 hover:bg-red-600' 
                    : 'bg-black/70 hover:bg-black/90'
                }`}
                title="Toggle Playlist"
              >
                <List className="w-5 h-5" />
              </button>
            </div>
          </div>

          <div 
            className={`absolute inset-0 bg-gradient-to-t from-black/90 via-transparent to-black/80 transition-opacity duration-300 pointer-events-none ${
              showControls ? 'opacity-100' : 'opacity-0'
            }`}
          >
            <div 
              className="absolute inset-0 flex items-center justify-center pointer-events-auto cursor-pointer"
              onClick={togglePlay}
            >
              {!isPlaying && (
                <div className="bg-black/70 backdrop-blur-md rounded-full p-8 shadow-2xl animate-in fade-in zoom-in duration-300">
                  <Play className="w-20 h-20 text-white" fill="white" />
                </div>
              )}
            </div>

            <div className="absolute bottom-0 left-0 right-0 p-6 pointer-events-auto">
              <div className="mb-4">
                <input
                  type="range"
                  min="0"
                  max={duration || 0}
                  value={currentTime}
                  onChange={handleSeek}
                  className="w-full h-1.5 bg-zinc-700/50 rounded-lg appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-red-600 [&::-webkit-slider-thumb]:cursor-pointer [&::-webkit-slider-thumb]:shadow-lg hover:[&::-webkit-slider-thumb]:bg-red-500 [&::-webkit-slider-thumb]:transition-all backdrop-blur-sm"
                />
                <div className="flex justify-between text-sm text-zinc-300 mt-2 font-semibold">
                  <span>{formatTime(currentTime)}</span>
                  <span>{formatTime(duration)}</span>
                </div>
              </div>

              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => skipVideo('prev')}
                    className="p-2.5 hover:bg-white/20 rounded-full transition-all"
                    title="Previous"
                  >
                    <SkipBack className="w-6 h-6" />
                  </button>
                  <button
                    onClick={seekBackward}
                    className="p-2.5 hover:bg-white/20 rounded-full transition-all"
                    title="Rewind 10s"
                  >
                    <RotateCcw className="w-6 h-6" />
                  </button>
                  <button
                    onClick={togglePlay}
                    className="p-4 bg-white hover:bg-gray-200 rounded-full transition-all text-black shadow-2xl hover:scale-105"
                  >
                    {isPlaying ? <Pause className="w-7 h-7" fill="currentColor" /> : <Play className="w-7 h-7 ml-1" fill="currentColor" />}
                  </button>
                  <button
                    onClick={seekForward}
                    className="p-2.5 hover:bg-white/20 rounded-full transition-all"
                    title="Forward 10s"
                  >
                    <RotateCw className="w-6 h-6" />
                  </button>
                  <button
                    onClick={() => skipVideo('next')}
                    className="p-2.5 hover:bg-white/20 rounded-full transition-all"
                    title="Next"
                  >
                    <SkipForward className="w-6 h-6" />
                  </button>
                  
                  <button
                    onClick={toggleRepeatMode}
                    className={`p-2.5 rounded-full transition-all ${repeatMode !== 'off' ? 'bg-red-600/80 text-white' : 'hover:bg-white/20'}`}
                    title={`Repeat: ${repeatMode}`}
                  >
                    {repeatMode === 'one' ? <Repeat1 className="w-5 h-5" /> : <Repeat className="w-5 h-5" />}
                  </button>
                </div>

                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-3 bg-black/60 backdrop-blur-md px-4 py-2.5 rounded-full shadow-lg">
                    <button onClick={toggleMute} className="hover:text-red-500 transition-colors" title="Mute/Unmute">
                      {isMuted || volume === 0 ? <VolumeX className="w-6 h-6" /> : <Volume2 className="w-6 h-6" />}
                    </button>
                    <input
                      type="range"
                      min="0"
                      max="1"
                      step="0.01"
                      value={volume}
                      onChange={handleVolumeChange}
                      className="w-24 h-1 bg-zinc-700 rounded-lg appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:cursor-pointer [&::-webkit-slider-thumb]:shadow-md"
                    />
                  </div>

                  <div className="relative">
                    <button 
                      onClick={() => setShowSettings(!showSettings)}
                      className={`p-2.5 rounded-full transition-all backdrop-blur-md ${showSettings ? 'bg-red-600/80' : 'bg-black/60 hover:bg-black/80'} shadow-lg`}
                      title="Settings"
                    >
                      <Settings className="w-6 h-6" />
                    </button>
                    
                    {showSettings && (
                      <div className="absolute bottom-full right-0 mb-2 bg-black/95 backdrop-blur-md rounded-xl p-4 min-w-56 border border-zinc-800/50 shadow-2xl">
                        <div className="mb-3">
                          <p className="text-sm font-bold mb-3 text-gray-200">Playback Speed</p>
                          <div className="grid grid-cols-4 gap-2">
                            {[0.25, 0.5, 0.75, 1, 1.25, 1.5, 1.75, 2].map(speed => (
                              <button
                                key={speed}
                                onClick={() => setPlaybackRate(speed)}
                                className={`px-3 py-2 rounded-lg text-sm font-semibold transition-all ${
                                  playbackRate === speed 
                                    ? 'bg-red-600 text-white shadow-lg' 
                                    : 'bg-zinc-800 hover:bg-zinc-700 text-gray-300'
                                }`}
                              >
                                {speed}x
                              </button>
                            ))}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>

                  <button 
                    onClick={togglePiP}
                    className="p-2.5 bg-black/60 backdrop-blur-md hover:bg-black/80 rounded-full transition-all shadow-lg"
                    title="Picture in Picture"
                  >
                    <PictureInPicture className="w-6 h-6" />
                  </button>

                  <button 
                    onClick={toggleFullscreen} 
                    className="p-2.5 bg-black/60 backdrop-blur-md hover:bg-black/80 rounded-full transition-all shadow-lg"
                    title="Fullscreen"
                  >
                    {isFullscreen ? <Minimize className="w-6 h-6" /> : <Maximize className="w-6 h-6" />}
                  </button>
                </div>
              </div>
            </div>
          </div>

          {showStartupHint && (
            <div className="fixed bottom-10 left-1/2 transform -translate-x-1/2 bg-black/80 text-white px-6 py-3 rounded-lg shadow-lg text-sm z-50 pointer-events-none">
              Press H to toggle fullscreen
            </div>
          )}

          <div className={`absolute top-24 right-6 bg-black/90 backdrop-blur-md rounded-xl p-4 text-sm transition-opacity duration-300 pointer-events-none border border-zinc-800/50 shadow-2xl ${
            showControls ? 'opacity-100' : 'opacity-0'
          }`}>
            <p className="font-bold mb-3 text-gray-100">Keyboard Shortcuts</p>
            <div className="space-y-2 text-xs text-gray-300">
              <p><kbd className="bg-zinc-700 px-2 py-1 rounded font-semibold">Space</kbd> Play/Pause</p>
              <p><kbd className="bg-zinc-700 px-2 py-1 rounded font-semibold">←→</kbd> Seek 10s</p>
              <p><kbd className="bg-zinc-700 px-2 py-1 rounded font-semibold">↑↓</kbd> Volume</p>
              <p><kbd className="bg-zinc-700 px-2 py-1 rounded font-semibold">F/H</kbd> Fullscreen</p>
              <p><kbd className="bg-zinc-700 px-2 py-1 rounded font-semibold">M</kbd> Mute</p>
              <p><kbd className="bg-zinc-700 px-2 py-1 rounded font-semibold">N</kbd> Next</p>
              <p><kbd className="bg-zinc-700 px-2 py-1 rounded font-semibold">B</kbd> Previous</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default VideoPlayer;